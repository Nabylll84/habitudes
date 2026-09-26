// Agenda — liaison Google Calendar (OAuth + synchronisation 2 sens).
//
// L'interface ne voit jamais les tokens : la table calendar_connections n'a
// aucune policy RLS pour `authenticated`, cette fonction est le seul lecteur
// (service_role). Le client appelle `action=sync` / `disconnect` avec son JWT.
//
// Actions (query `action`, GET ou POST) :
//   authorize  -> redirige le navigateur vers Google (scope calendar)
//   callback  -> échange le code contre des tokens, puis renvoie vers l'app
//   sync      -> tire (pull) puis pousse (push) les modifications
//   disconnect-> supprime la connexion et les événements importés
//
// Déploiement :
//   supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... OAUTH_STATE_SECRET=...
//   supabase functions deploy google-calendar --no-verify-jwt
//
// Le callback de Google ne peut pas envoyer d'en-tête Authorization : on vérifie
// donc le JWT nous-mêmes quand il y en a un, et le `state` signé sinon.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const CAL_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const PROVIDER = 'google';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const STATE_SECRET = Deno.env.get('OAUTH_STATE_SECRET') ?? '';

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Appelée en cross-origin depuis l'app Vite/Netlify : sans ces en-têtes le
// preflight OPTIONS bloque toute requête du navigateur.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { ...CORS, location } });
}

function base64url(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const encoder = new TextEncoder();

async function hmac(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

/** state = base64url(json{uid,nonce}) + '.' + signature — non falsifiable. */
async function signState(uid: string) {
  const payload = base64url(encoder.encode(JSON.stringify({ uid, nonce: crypto.randomUUID() })));
  return `${payload}.${await hmac(payload, STATE_SECRET)}`;
}

async function readState(state: string) {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = await hmac(payload, STATE_SECRET);
  // Comparaison à longueur constante pour éviter de fuir le secret par timing.
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { uid: string };
    return parsed.uid;
  } catch {
    return null;
  }
}

/** Vérifie le JWT de l'appelant (Authorization: Bearer) et renvoie son uid. */
async function userFromToken(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

async function fetchToken(uid: string): Promise<{ token: string; calendarId: string; conn: Record<string, unknown> }> {
  const { data, error } = await admin()
    .from('calendar_connections')
    .select('*')
    .eq('user_id', uid)
    .eq('provider', PROVIDER)
    .maybeSingle();
  if (error || !data) throw new Error('NOT_CONNECTED');
  const conn = data as Record<string, unknown>;
  const refresh = String(conn.refresh_token ?? '');
  if (!refresh) throw new Error('NOT_CONNECTED');

  // Le refresh_token est stable : inutile de le remplacer à chaque refresh.
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  const payload = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !payload.access_token) throw new Error(payload.error_description ?? 'REFRESH_FAILED');
  const expiresAt = new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString();
  await admin()
    .from('calendar_connections')
    .update({ access_token: payload.access_token, token_expires_at: expiresAt })
    .eq('user_id', uid)
    .eq('provider', PROVIDER);
  return { token: payload.access_token, calendarId: String(conn.calendar_id ?? 'primary'), conn };
}

async function gcal(
  token: string,
  path: string,
  init: { method?: string; body?: unknown; ifMatch?: string } = {},
) {
  const res = await fetch(`${CAL_API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.ifMatch ? { 'if-match': init.ifMatch } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return { status: res.status, data: null as Record<string, unknown> | null, headers: res.headers };
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, headers: res.headers };
}

type GEvent = {
  id?: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  recurrence?: string[];
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

const GOOGLE_COLOR_IDS: Record<string, string> = {
  '#6366f1': '9', '#8b5cf6': '10', '#a855f7': '11', '#d946ef': '12', '#ec4899': '6',
  '#f43f5e': '6', '#ef4444': '4', '#f97316': '5', '#f59e0b': '3', '#facc15': '3',
  '#84cc16': '2', '#22c55e': '10', '#10b981': '2', '#14b8a6': '2', '#06b6d4': '9',
  '#0ea5e9': '9', '#3b82f6': '8', '#64748b': '1',
};

function colorFromGoogle(colorId?: string): string | null {
  if (!colorId) return null;
  const found = Object.entries(GOOGLE_COLOR_IDS).find(([, id]) => id === colorId);
  return found ? found[0] : null;
}

function colorToGoogle(color: string | null): string {
  if (!color) return '7';
  const key = color.toLowerCase();
  for (const [hex, id] of Object.entries(GOOGLE_COLOR_IDS)) if (hex === key) return id;
  return '7';
}

/** Événement local -> charge utile Google. */
function toGoogle(ev: Record<string, unknown>) {
  const allDay = Boolean(ev.all_day);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const base: Record<string, unknown> = {
    summary: String(ev.title ?? ''),
    description: ev.description ? String(ev.description) : undefined,
    location: ev.location ? String(ev.location) : undefined,
    colorId: colorToGoogle(ev.color as string | null),
  };
  if (allDay) {
    // Google attend des dates (fin exclusive) et un fuseau par défaut.
    const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
    base.start = { date: day(String(ev.starts_at)) };
    base.end = { date: day(new Date(new Date(String(ev.ends_at)).getTime() + 86400000).toISOString()) };
    base.startTimeZone = timeZone;
    base.endTimeZone = timeZone;
  } else {
    base.start = { dateTime: String(ev.starts_at), timeZone };
    base.end = { dateTime: String(ev.ends_at), timeZone };
  }
  return base;
}

/** Événement Google -> ligne locale. `fallback` = série récurrente. */
function fromGoogle(g: GEvent, fallback: GEvent | null, dirtyIds: Set<string>) {
  const start = g.start ?? {};
  const end = g.end ?? {};
  const allDay = Boolean(start.date && !start.dateTime);
  const midnight = (d: string) => new Date(`${d}T00:00:00`).toISOString();
  const startsAt = allDay ? midnight(start.date!) : new Date(start.dateTime!).toISOString();
  // Fin : Google renvoie l'exclu pour un all-day, on stocke le dernier jour à 23:59:59.999.
  const endsAt = allDay
    ? new Date(new Date(`${end.date ?? start.date!}T00:00:00`).getTime() - 1).toISOString()
    : new Date(end.dateTime ?? start.dateTime!).toISOString();

  return {
    g_event_id: String(g.id),
    g_etag: g.etag ?? null,
    title: (g.summary ?? '(sans titre)').slice(0, 200),
    description: g.description ?? null,
    location: g.location ?? null,
    color: colorFromGoogle(g.colorId),
    all_day: allDay,
    starts_at: startsAt,
    ends_at: endsAt,
    g_readonly: Boolean(fallback) || Boolean(g.recurrence?.length),
    // Modifié localement depuis le dernier pull : la push réécrasera Google.
    g_dirty: dirtyIds.has(String(g.id)),
    g_synced_at: new Date().toISOString(),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pull(uid: string, token: string, calendarId: string, syncToken: string | null) {
  const sb = admin();
  const counters = { pulled: 0, updated: 0, deleted: 0, skipped: 0 };
  const { data: dirtyRows } = await sb
    .from('events')
    .select('g_event_id')
    .eq('user_id', uid)
    .eq('g_dirty', true)
    .not('g_event_id', 'is', null);
  const dirtyIds = new Set((dirtyRows ?? []).map((r) => (r as { g_event_id: string }).g_event_id));

  const seen: string[] = [];
  const series: GEvent[] = [];
  let pageToken = syncToken;
  let next: string | null = syncToken;

  do {
    const qs = new URLSearchParams({
      maxResults: '250',
      showDeleted: 'true',
      singleEvents: 'false',
    });
    if (pageToken) qs.set('pageToken', pageToken);
    const res = await gcal(token, `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`);
    // 410 Gone : le syncToken est périmé, on repart d'une sync complète.
    if (res.status === 410) return null;
    if (res.status >= 400) throw new Error(`Google a refusé la lecture (${res.status})`);
    const data = (res.data ?? {}) as { items?: GEvent[]; nextPageToken?: string; nextSyncToken?: string };
    for (const item of data.items ?? []) {
      if (item.recurrence?.length) {
        series.push(item);
        continue;
      }
      if (item.status === 'cancelled') {
        await sb.from('events').delete().eq('user_id', uid).eq('g_event_id', String(item.id));
        counters.deleted++;
        continue;
      }
      seen.push(String(item.id));
      const row = fromGoogle(item, null, dirtyIds);
      const { error } = await sb
        .from('events')
        .upsert({ ...row, user_id: uid }, { onConflict: 'user_id,g_event_id' });
      if (error) throw new Error(error.message);
      counters.pulled++;
      if (dirtyIds.has(String(item.id))) counters.updated++;
    }
    pageToken = data.nextPageToken ?? null;
    if (data.nextSyncToken) next = data.nextSyncToken;
  } while (pageToken);

  // Séries récurrentes : on matérialise les occurrences du mois courant en
  // lecture seule, elles ne sont jamais poussées telles quelles.
  if (series.length) {
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59).toISOString();
    for (const master of series) {
      const qs = new URLSearchParams({ timeMin, timeMax, maxResults: '100' });
      const res = await gcal(
        token,
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(String(master.id))}/instances?${qs}`,
      );
      if (res.status >= 400) {
        counters.skipped++;
        continue;
      }
      const data = (res.data ?? {}) as { items?: GEvent[] };
      for (const inst of data.items ?? []) {
        if (inst.status === 'cancelled') continue;
        // Google renvoie l'occurrence déjà développée (dates/heures justes) ;
        // le master sert uniquement à marquer la ligne comme lecture seule.
        const dayISO = new Date(inst.start?.dateTime ?? inst.start?.date ?? now.toISOString())
          .toLocaleDateString('en-CA');
        const row = fromGoogle(inst, master, new Set());
        const { error } = await sb
          .from('events')
          .upsert({ ...row, user_id: uid, g_readonly: true, g_event_id: `${master.id}::${dayISO}` }, { onConflict: 'user_id,g_event_id' });
        if (error) throw new Error(error.message);
        counters.pulled++;
      }
    }
  }

  // Purge : uniquement en sync complète. En incrémental, Google ne renvoie
  // que les changements (les suppressions arrivent en `cancelled`), donc un
  // événement absent de `seen` n'est pas forcément supprimé de Google.
  if (syncToken === null) {
    const { data: local } = await sb
      .from('events')
      .select('id,g_event_id,g_readonly,g_dirty')
      .eq('user_id', uid)
      .not('g_event_id', 'is', null);
    const keep = new Set(seen);
    for (const row of (local ?? []) as { id: string; g_event_id: string; g_readonly: boolean; g_dirty: boolean }[]) {
      if (row.g_readonly || row.g_dirty) continue;
      if (keep.has(row.g_event_id)) continue;
      await sb.from('events').delete().eq('user_id', uid).eq('id', row.id);
      counters.deleted++;
    }
  }

  if (next) {
    await sb
      .from('calendar_connections')
      .update({ sync_token: next, last_sync_at: new Date().toISOString(), last_error: null })
      .eq('user_id', uid)
      .eq('provider', PROVIDER);
  }
  return { counters, next };
}

async function push(uid: string, token: string, calendarId: string) {
  const sb = admin();
  const counters = { pushed: 0, deleted: 0, skipped: 0, failed: 0 };
  const errors: string[] = [];

  const { data: rows, error } = await sb
    .from('events')
    .select('*')
    .eq('user_id', uid)
    .eq('g_dirty', true);
  if (error) throw new Error(error.message);

  for (const ev of (rows ?? []) as Record<string, unknown>[]) {
    const gId = (ev.g_event_id as string | null) ?? null;
    // 429 quota dépassé : on laisse g_dirty à true, la sync suivante reprendra.
    await sleep(120);
    try {
      if (ev.deleted_at) {
        if (gId) {
          const res = await gcal(
            token,
            `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(gId)}`,
            { method: 'DELETE' },
          );
          // 404/410 = déjà absent de Google, c'est le résultat voulu.
          if (res.status >= 400 && res.status !== 404 && res.status !== 410) throw new Error(`Google (${res.status})`);
        }
        await sb.from('events').delete().eq('user_id', uid).eq('id', ev.id);
        counters.deleted++;
        continue;
      }
      if (ev.g_readonly) {
        await sb.from('events').update({ g_dirty: false }).eq('user_id', uid).eq('id', ev.id);
        counters.skipped++;
        continue;
      }
      const path = gId
        ? `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(gId)}`
        : `/calendars/${encodeURIComponent(calendarId)}/events`;
      const res = await gcal(token, path, {
        method: gId ? 'PATCH' : 'POST',
        body: toGoogle(ev),
      });
      if (res.status >= 400) {
        const msg = (res.data as { error?: { message?: string } } | null)?.error?.message ?? `Google (${res.status})`;
        throw new Error(msg);
      }
      const g = (res.data ?? {}) as GEvent;
      await sb
        .from('events')
        .update({
          g_event_id: g.id ?? gId,
          g_etag: g.etag ?? null,
          g_dirty: false,
          g_synced_at: new Date().toISOString(),
        })
        .eq('user_id', uid)
        .eq('id', ev.id);
      counters.pushed++;
    } catch (e) {
      // Un événement en échec ne doit pas bloquer les suivants : on laisse
      // g_dirty à true pour réessayer à la prochaine sync, et on remonte
      // l'erreur pour que l'interface puisse l'afficher.
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      errors.push(`${ev.title ?? '(sans titre)'} : ${msg}`);
      counters.failed++;
    }
  }
  return { ...counters, errors };
}

function appUrl(req: Request, target?: string | null) {
  const fallback = Deno.env.get('APP_URL') ?? new URL(req.url).origin;
  return target && /^https?:\/\//.test(target) ? target : fallback;
}

/** L'action vient de la query (?action=…) ou du body JSON (supabase.functions.invoke). */
async function actionOf(req: Request): Promise<string> {
  const fromQuery = new URL(req.url).searchParams.get('action');
  if (fromQuery) return fromQuery;
  if (req.method !== 'POST') return '';
  try {
    const body = (await req.json()) as { action?: string };
    return body?.action ?? '';
  } catch {
    return '';
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  const action = await actionOf(req);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    if (action === 'authorize') {
      if (!CLIENT_ID || !STATE_SECRET) return json({ error: 'GOOGLE_NOT_CONFIGURED' }, 500);
      const uid = await userFromToken(req);
      if (!uid) return json({ error: 'UNAUTHORIZED' }, 401);
      // On renvoie l'URL plutôt qu'un 302 : l'app la suit via window.location,
      // ce qui permet d'envoyer l'Authorization sur cette requête. Le token ne
      // transite donc jamais dans l'URL. Le state signé prend le relais pour
      // le callback, que le navigateur atteint sans en-tête.
      const qs = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: url.searchParams.get('redirect_uri') ?? `${SUPABASE_URL}/functions/v1/google-calendar?action=callback`,
        response_type: 'code',
        access_type: 'offline',
        // On ne force pas 'consent' : sans cela Google ne renvoie pas de
        // refresh_token tant que l'utilisateur n'a pas révoqué l'accès.
        prompt: url.searchParams.get('prompt') ?? 'consent',
        include_granted_scopes: 'true',
        scope: SCOPE,
        state: await signState(uid),
      });
      return json({ url: `${GOOGLE_AUTH}?${qs}` });
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') ?? '';
      const back = appUrl(req, url.searchParams.get('app_url'));
      if (!code) return redirect(`${back}/agenda?gcal=error`);
      const uid = await readState(state);
      if (!uid) return redirect(`${back}/agenda?gcal=state`);

      const res = await fetch(GOOGLE_TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: url.searchParams.get('redirect_uri') ?? `${SUPABASE_URL}/functions/v1/google-calendar?action=callback`,
        }),
      });
      const payload = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        error_description?: string;
      };
      if (!res.ok || !payload.refresh_token) {
        return redirect(`${back}/agenda?gcal=denied`);
      }
      const email = await googleEmail(payload.access_token ?? '');
      await admin().from('calendar_connections').upsert(
        {
          user_id: uid,
          provider: PROVIDER,
          account_email: email,
          calendar_id: 'primary',
          access_token: payload.access_token ?? null,
          refresh_token: payload.refresh_token,
          token_expires_at: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
          sync_token: null,
          last_sync_at: null,
          last_error: null,
        },
        { onConflict: 'user_id,provider' },
      );
      return redirect(`${back}/agenda?gcal=connected`);
    }

    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const uid = await userFromToken(req);
    if (!uid) return json({ error: 'UNAUTHORIZED' }, 401);

    if (action === 'disconnect') {
      await admin().from('calendar_connections').delete().eq('user_id', uid).eq('provider', PROVIDER);
      // Les événements importés n'ont plus de sens sans la source, ceux
      // créés localement sont conservés.
      await admin().from('events').delete().eq('user_id', uid).not('g_event_id', 'is', null);
      return json({ ok: true });
    }

    if (action !== 'sync') return json({ error: 'UNKNOWN_ACTION' }, 400);

    const { token, calendarId, conn } = await fetchToken(uid);
    const result = { pushed: 0, pulled: 0, updated: 0, deleted: 0, skipped: 0, failed: 0, error: null as string | null };

    // 1) Tirer l'état de Google
    const got = await pull(uid, token, calendarId, (conn.sync_token as string | null) ?? null);
    if (got === null) {
      await admin()
        .from('calendar_connections')
        .update({ sync_token: null })
        .eq('user_id', uid)
        .eq('provider', PROVIDER);
      const full = await pull(uid, token, calendarId, null);
      if (full) Object.assign(result, full.counters);
    } else {
      Object.assign(result, got.counters);
    }

    // 2) Pousser les modifications locales
    const sent = await push(uid, token, calendarId);
    result.pushed += sent.pushed;
    result.deleted += sent.deleted;
    result.skipped += sent.skipped;
    result.failed += sent.failed;
    result.error = sent.errors[0] ?? null;

    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    if (message === 'NOT_CONNECTED') return json({ error: 'NOT_CONNECTED' }, 400);
    const uid = await userFromToken(req).catch(() => null);
    if (uid) {
      await admin()
        .from('calendar_connections')
        .update({ last_error: message })
        .eq('user_id', uid)
        .eq('provider', PROVIDER);
    }
    return json({ error: message }, 500);
  }
});

async function googleEmail(accessToken: string) {
  if (!accessToken) return null;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const info = (await res.json()) as { email?: string };
  return info.email ?? null;
}
