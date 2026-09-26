import { supabase } from './supabase';
import type { SyncResult } from './types';

const FN = 'google-calendar';

async function call<T>(action: string): Promise<T> {
  // La version de supabase-js utilisée ne gère pas les query params sur
  // functions.invoke : l'action passe dans le body.
  const { data, error } = await supabase.functions.invoke(FN, { body: { action } });
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.error) throw new Error(String(payload.error));
  return payload as T;
}

/** Démarre l'OAuth : l'app redirige le navigateur vers l'URL renvoyée. */
export async function startGoogleAuth(): Promise<void> {
  const { url } = await call<{ url: string }>('authorize');
  if (!url) throw new Error("Google n'a pas renvoyé d'URL d'autorisation");
  window.location.assign(url);
}

/** Tire puis pousse les modifications. */
export async function syncCalendar(): Promise<SyncResult> {
  return call<SyncResult>('sync');
}

/** Déconnecte le compte : les événements importés sont supprimés. */
export async function disconnectGoogle(): Promise<void> {
  await call<{ ok: true }>('disconnect');
}

export type OAuthOutcome = 'connected' | 'denied' | 'state' | 'error';

/** Lit le retour OAuth (?gcal=...) posé par la fonction sur l'URL. */
export function readOAuthOutcome(): OAuthOutcome | null {
  const value = new URLSearchParams(window.location.search).get('gcal');
  if (value === 'connected' || value === 'denied' || value === 'state' || value === 'error') {
    // On nettoie l'URL pour ne pas rejouer l'animation au rechargement.
    const clean = new URL(window.location.href);
    clean.searchParams.delete('gcal');
    window.history.replaceState({}, '', clean.toString());
    return value;
  }
  return null;
}
