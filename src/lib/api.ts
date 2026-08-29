import { supabase } from './supabase';
import {
  Habit,
  HabitState,
  Profile,
  FriendRequest,
  FriendOverview,
  ProfileView,
} from './types';
import { computeStreak, todayISO, lastDays } from './dates';

type Row = Record<string, unknown>;

function errMsg(e: { message: string; hint?: string; code?: string } | null, fallback: string): never {
  throw new Error(e?.message || fallback);
}

// ---------------------------------------------------------------- habitudes

export async function fetchOwnHabits(uid: string): Promise<HabitState[]> {
  const [hRes, cRes] = await Promise.all([
    supabase.from('habits').select('id,name,emoji,color').eq('user_id', uid),
    supabase.from('completions').select('habit_id,date').eq('user_id', uid),
  ]);
  if (hRes.error) errMsg(hRes.error, 'Impossible de charger vos habitudes');

  const byHabit = new Map<string, Set<string>>();
  for (const row of (cRes.data ?? []) as Row[]) {
    const hid = String(row.habit_id);
    if (!byHabit.has(hid)) byHabit.set(hid, new Set());
    byHabit.get(hid)!.add(String(row.date));
  }
  const today = todayISO();
  return (hRes.data ?? []).map((h) => {
    const dates = byHabit.get(h.id) ?? new Set<string>();
    return {
      habit: h as Habit,
      dates,
      doneToday: dates.has(today),
      streak: computeStreak(dates),
    };
  });
}

export async function createHabit(uid: string, data: { name: string; emoji: string; color: string }) {
  const { data: row, error } = await supabase
    .from('habits')
    .insert({ user_id: uid, ...data })
    .select('id,name,emoji,color')
    .single();
  if (error) errMsg(error, "Impossible de créer l'habitude");
  return { habit: row as Habit, dates: new Set<string>(), doneToday: false, streak: 0 } as HabitState;
}

export async function updateHabit(id: string, patch: Partial<Habit>) {
  const { data: row, error } = await supabase
    .from('habits')
    .update(patch)
    .eq('id', id)
    .select('id,name,emoji,color')
    .single();
  if (error) errMsg(error, "Impossible de modifier l'habitude");
  return row as Habit;
}

export async function deleteHabit(id: string) {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) errMsg(error, "Impossible de supprimer l'habitude");
}

/** Coche/décoche via RPC (atomique côté serveur). Retourne { on, date } */
export async function toggleHabit(habitId: string, date: string) {
  const { data, error } = await supabase.rpc('toggle_habit', { p_habit_id: habitId, p_date: date });
  if (error) errMsg(error, 'Impossible de cocher');
  return { on: data === true, date };
}

// ---------------------------------------------------------------- amis

async function fetchFriendships() {
  const { data, error } = await supabase.from('friendships').select('user_a,user_b');
  if (error) errMsg(error, 'Impossible de charger vos amis');
  return (data ?? []) as Row[];
}

export async function fetchFriendIds(uid: string): Promise<string[]> {
  const rows = await fetchFriendships();
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(String(r.user_a) === uid ? String(r.user_b) : String(r.user_a));
  }
  return [...ids];
}

export async function fetchRequests(uid: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id,from_id,to_id,status,created_at')
    .eq('status', 'pending');
  if (error) errMsg(error, 'Impossible de charger les demandes');
  const rows = (data ?? []) as FriendRequest[];
  return {
    incoming: rows.filter((r) => r.to_id === uid),
    outgoing: rows.filter((r) => r.from_id === uid),
  };
}

export type RequestPreview = FriendRequest & { peerName: string };

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id,username').in('id', uniq);
  if (error) return new Map();
  return new Map((data ?? []).map((r) => [String((r as Row).id), String((r as Row).username)]));
}

export async function fetchRequestPreviews(incoming: FriendRequest[], outgoing: FriendRequest[]): Promise<{
  incoming: RequestPreview[];
  outgoing: RequestPreview[];
}> {
  const names = await namesFor([
    ...incoming.map((r) => r.from_id),
    ...outgoing.map((r) => r.to_id),
  ]);
  return {
    incoming: incoming.map((r) => ({ ...r, peerName: names.get(r.from_id) ?? '…' })),
    outgoing: outgoing.map((r) => ({ ...r, peerName: names.get(r.to_id) ?? '…' })),
  };
}

export async function fetchFriendOverview(uid: string): Promise<FriendOverview[]> {
  const ids = await fetchFriendIds(uid);
  if (ids.length === 0) return [];

  const [{ data: profs }, { data: habs }, { data: comps }] = await Promise.all([
    supabase.from('profiles').select('id,username,avatar_url').in('id', ids),
    supabase.from('habits').select('id,user_id').in('user_id', ids),
    supabase.from('completions').select('user_id,date').in('user_id', ids),
  ]);

  const pMap = new Map(ids.map((id) => [id, profileFrom((profs ?? []).find((p) => p.id === id))]));
  const habitCount = new Map<string, number>();
  for (const h of (habs ?? []) as Row[]) {
    const k = String(h.user_id);
    habitCount.set(k, (habitCount.get(k) ?? 0) + 1);
  }
  const datesByUser = new Map<string, Set<string>>();
  for (const c of (comps ?? []) as Row[]) {
    const k = String(c.user_id);
    if (!datesByUser.has(k)) datesByUser.set(k, new Set());
    datesByUser.get(k)!.add(String(c.date));
  }

  const today = todayISO();
  return ids
    .map((id) => {
      const dates = datesByUser.get(id) ?? new Set<string>();
      return {
        id,
        username: pMap.get(id)?.username ?? '…',
        avatar_url: pMap.get(id)?.avatar_url ?? null,
        habitsCount: habitCount.get(id) ?? 0,
        doneToday: dates.has(today) ? 1 : 0,
        bestStreak: computeStreak(dates),
        total: dates.size,
      };
    })
    .sort((a, b) => b.doneToday - a.doneToday || a.username.localeCompare(b.username));
}

function profileFrom(row: unknown): { username: string; avatar_url: string | null } | null {
  const r = row as Row | undefined;
  if (!r) return null;
  return {
    username: String(r.username),
    avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
  };
}

export async function searchProfiles(q: string, uid: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,avatar_url,created_at')
    .ilike('username', `%${q}%`)
    .neq('id', uid)
    .limit(12);
  if (error) errMsg(error, 'Recherche impossible');
  return (data ?? []) as Profile[];
}

export async function sendFriendRequest(uid: string, toId: string) {
  const { error } = await supabase.from('friend_requests').insert({ from_id: uid, to_id: toId });
  if (error) {
    if (error.code === '23505') throw new Error('Demande déjà envoyée à cet utilisateur');
    errMsg(error, "Impossible d'envoyer la demande");
  }
}

export async function cancelRequest(reqId: string) {
  const { error } = await supabase.from('friend_requests').delete().eq('id', reqId);
  if (error) errMsg(error, "Impossible d'annuler la demande");
}

export async function acceptRequest(reqId: string) {
  const { error } = await supabase.rpc('accept_friend_request', { p_request_id: reqId });
  if (error) errMsg(error, "Impossible d'accepter");
}

export async function declineRequest(reqId: string) {
  const { error } = await supabase.rpc('decline_friend_request', { p_request_id: reqId });
  if (error) errMsg(error, 'Impossible de refuser');
}

export async function removeFriend(uid: string, friendId: string) {
  const a = uid < friendId ? uid : friendId;
  const b = uid < friendId ? friendId : uid;
  const { error } = await supabase.from('friendships').delete().eq('user_a', a).eq('user_b', b);
  if (error) errMsg(error, 'Impossible de retirer cet ami');
}

export async function areFriends(uid: string, otherId: string): Promise<boolean> {
  const a = uid < otherId ? uid : otherId;
  const b = uid < otherId ? otherId : uid;
  const { data, error } = await supabase
    .from('friendships')
    .select('user_a')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function outgoingRequestId(uid: string, otherId: string): Promise<string | null> {
  const { data } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('from_id', uid)
    .eq('to_id', otherId)
    .eq('status', 'pending')
    .maybeSingle();
  return data ? String((data as Row).id) : null;
}

export async function incomingRequestId(uid: string, otherId: string): Promise<string | null> {
  const { data } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('from_id', otherId)
    .eq('to_id', uid)
    .eq('status', 'pending')
    .maybeSingle();
  return data ? String((data as Row).id) : null;
}

// ---------------------------------------------------------------- profils

export async function fetchProfile(id: string): Promise<{ profile: Profile; isSelf: boolean }> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) errMsg(error, 'Profil introuvable');
  const { data: me } = await supabase.auth.getUser();
  return { profile: data as Profile, isSelf: me.user?.id === id };
}

export async function updateUsername(id: string, username: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Ce pseudo est déjà pris');
    errMsg(error, 'Mise à jour impossible');
  }
  return data as Profile;
}

export async function fetchProfileView(targetId: string): Promise<ProfileView> {
  const [{ profile, isSelf }, hRes, cRes] = await Promise.all([
    fetchProfile(targetId),
    supabase.from('habits').select('id,name,emoji,color').eq('user_id', targetId),
    supabase.from('completions').select('habit_id,date').eq('user_id', targetId),
  ]);
  if (hRes.error || cRes.error) errMsg(null, 'Profil indisponible');

  const byHabit = new Map<string, Set<string>>();
  const dayCount = new Map<string, number>();
  for (const c of (cRes.data ?? []) as Row[]) {
    const hid = String(c.habit_id);
    const d = String(c.date);
    if (!byHabit.has(hid)) byHabit.set(hid, new Set());
    byHabit.get(hid)!.add(d);
    dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
  }

  const today = todayISO();
  const habits = (hRes.data ?? []).map((h) => {
    const set = byHabit.get(h.id) ?? new Set<string>();
    return {
      ...(h as Habit),
      doneToday: set.has(today),
      streak: computeStreak(set),
    };
  });

  const last30 = lastDays(30).map((d) => ({ date: d, count: dayCount.get(d) ?? 0 }));
  const last90 = lastDays(90).map((d) => ({ date: d, count: dayCount.get(d) ?? 0 }));

  const weekWindow = new Set(lastDays(8));
  const weekTotal = [...dayCount.entries()]
    .filter(([d]) => weekWindow.has(d))
    .reduce((s, [, c]) => s + c, 0);

  return {
    profile,
    isSelf,
    habits,
    last30,
    last90,
    totalCompletions: dayCount.size,
    weekTotal,
  };
}