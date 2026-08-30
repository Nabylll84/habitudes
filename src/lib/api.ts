import { supabase } from './supabase';
import {
  Habit,
  HabitState,
  HabitCompletion,
  Profile,
  FriendRequest,
  FriendOverview,
  ProfileView,
  Badge,
  UserBadge,
  Reaction,
} from './types';
import { computeStreak, computeHabitStreak, todayISO, lastDays } from './dates';

type Row = Record<string, unknown>;

const HABIT_COLS = 'id,name,emoji,color,tracking_type,goal_amount,goal_unit,frequency_type,weekdays,times_per_week,challenge_days,start_on,category,sort_order,pinned,visible_shared,streak_freezes,reminder_enabled,reminder_time,reminder_days,created_at';

function errMsg(e: { message: string; hint?: string; code?: string } | null, fallback: string): never {
  throw new Error(e?.message || fallback);
}

// ---------------------------------------------------------------- habitudes

export async function fetchOwnHabits(uid: string): Promise<HabitState[]> {
  const [hRes, cRes] = await Promise.all([
    supabase.from('habits').select(HABIT_COLS).eq('user_id', uid),
    supabase.from('completions').select('habit_id,date,value,note').eq('user_id', uid),
  ]);
  if (hRes.error) errMsg(hRes.error, 'Impossible de charger vos habitudes');

  const valsByHabit = new Map<string, Map<string, { value: number; note: string | null }>>();
  for (const row of (cRes.data ?? []) as Row[]) {
    const hid = String(row.habit_id);
    const d = String(row.date);
    const value = typeof row.value === 'number' ? row.value : Number(row.value ?? 0);
    const note = typeof row.note === 'string' ? row.note : null;
    if (!valsByHabit.has(hid)) valsByHabit.set(hid, new Map());
    (valsByHabit.get(hid) as Map<string, { value: number; note: string | null }>).set(d, { value, note });
  }
  const today = todayISO();
  return (hRes.data ?? []).map((h) => {
    const habit = h as Habit;
    const vals = valsByHabit.get(habit.id) ?? new Map();
    const done = (d: string) => {
      const v = vals.get(d);
      if (!v) return false;
      if (habit.tracking_type === 'amount') {
        const goal = habit.goal_amount ?? null;
        return goal == null ? v.value > 0 : v.value >= goal;
      }
      return true;
    };
    const dates = new Set<string>([...vals.keys()].filter((d) => done(d)));
    return {
      habit,
      dates,
      doneToday: dates.has(today),
      streak: computeHabitStreak(habit, dates).streak,
      values: vals,
    };
  });
}

export async function createHabit(uid: string, data: Partial<Habit> & { name: string; emoji: string; color: string }) {
  const { data: row, error } = await supabase
    .from('habits')
    .insert({ user_id: uid, ...data })
    .select(HABIT_COLS)
    .single();
  if (error) errMsg(error, "Impossible de créer l'habitude");
  return { habit: row as Habit, dates: new Set<string>(), doneToday: false, streak: 0 } as HabitState;
}

export async function updateHabit(id: string, patch: Partial<Habit>) {
  const { data: row, error } = await supabase
    .from('habits')
    .update(patch)
    .eq('id', id)
    .select(HABIT_COLS)
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

/** Enregistre la valeur d'un compteur pour une date (habitude "amount"). */
export async function recordHabit(habitId: string, date: string, value: number, note?: string | null) {
  const { data, error } = await supabase.rpc('record_habit', {
    p_habit_id: habitId,
    p_date: date,
    p_value: value,
    p_note: note ?? null,
  });
  if (error) errMsg(error, "Impossible d'enregistrer");
  return data === true;
}

/** Met à jour la note d'une complétion (habitude binaire ou compteur). */
export async function updateCompletionNote(habitId: string, date: string, note: string | null) {
  const { error } = await supabase.rpc('update_completion_note', {
    p_habit_id: habitId,
    p_date: date,
    p_note: note,
  });
  if (error) errMsg(error, "Impossible de modifier la note");
}

/** Demande au serveur d'attribuer les badges gagnés. Retourne leurs ids. */
export async function awardBadges(): Promise<string[]> {
  const { data, error } = await supabase.rpc('maybe_award_badges');
  if (error) errMsg(error, 'Badges indisponibles');
  return (data ?? []) as string[];
}

/** Toutes les complétions de l'utilisateur (export CSV/JSON, stats). */
export async function fetchCompletions(uid: string): Promise<HabitCompletion[]> {
  const { data, error } = await supabase
    .from('completions')
    .select('id,habit_id,date,value,note')
    .eq('user_id', uid);
  if (error) errMsg(error, 'Impossible de charger vos données');
  return (data ?? []) as HabitCompletion[];
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

const AVATAR_BASE = supabase.storage.from('avatars').getPublicUrl('x').data.publicUrl.slice(0, -1);

export function isStorageAvatar(url: string): boolean {
  return url.startsWith(AVATAR_BASE);
}

export async function updateAvatar(id: string, file: File): Promise<Profile> {
  if (file.size > 2 * 1024 * 1024) throw new Error('Photo trop lourde (2 Mo max)');
  const ext = /\.(jpe?g|png|webp|gif)$/i.test(file.name)
    ? file.name.split('.').pop()!.toLowerCase()
    : 'jpg';
  const path = `${id}/avatar-${Date.now()}.${ext}`;

  const { profile: before } = await fetchProfile(id);
  const old = before.avatar_url && isStorageAvatar(before.avatar_url)
    ? before.avatar_url.slice(AVATAR_BASE.length)
    : null;

  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (upErr) errMsg(upErr, "Impossible d'envoyer la photo");

  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    await supabase.storage.from('avatars').remove([path]).catch(() => {});
    errMsg(error, 'Mise à jour impossible');
  }

  if (old) await supabase.storage.from('avatars').remove([old]).catch(() => {});
  return data as Profile;
}

export async function removeAvatar(id: string): Promise<Profile> {
  const { profile } = await fetchProfile(id);
  let old: string | null = null;
  if (profile.avatar_url && isStorageAvatar(profile.avatar_url)) {
    old = profile.avatar_url.slice(AVATAR_BASE.length);
  }
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) errMsg(error, 'Mise à jour impossible');
  if (old) await supabase.storage.from('avatars').remove([old]).catch(() => {});
  return data as Profile;
}

export async function fetchProfileView(targetId: string): Promise<ProfileView> {
  const [{ profile, isSelf }, hRes, cRes] = await Promise.all([
    fetchProfile(targetId),
    supabase.from('habits').select(HABIT_COLS).eq('user_id', targetId),
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

// ---------------------------------------------------------------- badges

/** Catalogue des badges + ceux déjà gagnés par l'utilisateur. */
export async function fetchBadgesWithProgress(uid: string): Promise<(Badge & { earned: boolean; earned_at: string | null })[]> {
  const [bRes, uRes] = await Promise.all([
    supabase.from('badges').select('id,name,description,icon_key'),
    supabase.from('user_badges').select('badge_id,earned_at').eq('user_id', uid),
  ]);
  if (bRes.error) errMsg(bRes.error, 'Badges indisponibles');
  const owned = new Map(
    ((uRes.data ?? []) as UserBadge[]).map((b) => [b.badge_id, b.earned_at]),
  );
  return (bRes.data ?? [])
    .map((b) => {
      const bd = b as Badge;
      return { ...bd, earned: owned.has(bd.id), earned_at: owned.get(bd.id) ?? null };
    })
    .sort((a, b) => Number(b.earned) - Number(a.earned) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- réactions

/** Réactions posées sur une habitude (tous les amis, encodées par clé). */
export async function fetchReactions(habitId: string): Promise<Reaction[]> {
  const { data, error } = await supabase
    .from('reactions')
    .select('id,habit_id,from_id,emoji_key,created_at')
    .eq('habit_id', habitId);
  if (error) errMsg(error, 'Réactions indisponibles');
  return (data ?? []) as Reaction[];
}

/** Pose (ou met à jour) sa réaction sur l'habitude d'un ami. */
export async function reactToHabit(uid: string, habitId: string, emojiKey: string) {
  const { error } = await supabase
    .from('reactions')
    .upsert({ from_id: uid, habit_id: habitId, emoji_key: emojiKey }, { onConflict: 'from_id,habit_id' });
  if (error) errMsg(error, "Impossible d'envoyer la réaction");
}

/** Retire sa réaction d'une habitude. */
export async function unreactHabit(uid: string, habitId: string) {
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('from_id', uid)
    .eq('habit_id', habitId);
  if (error) errMsg(error, 'Impossible de retirer la réaction');
}