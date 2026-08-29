-- ============================================================
-- HabitFlow — schéma complet Supabase
-- Exécuter dans : Supabase Dashboard -> SQL Editor (ou supabase db push)
-- ============================================================

-- ---------- PROFILES (miroir de auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Génère un pseudo unique à l'inscription (y.c. Google OAuth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  avatar text;
  i integer := 1;
begin
  base := lower(coalesce(
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user'
  ));
  base := regexp_replace(base, '[^a-z0-9_]', '_', 'g');
  if length(base) < 3 then base := 'user'; end if;
  avatar := coalesce(
    new.raw_user_meta_data ->> 'picture',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  candidate := base;
  loop
    begin
      insert into public.profiles (id, username, avatar_url)
      values (new.id, candidate, avatar);
      exit;
    exception when unique_violation then
      i := i + 1;
      candidate := base || i::text;
    end;
  end loop;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- HABITS ----------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '💪' check (char_length(emoji) <= 8),
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create index if not exists habits_user_idx on public.habits (user_id);

-- ---------- COMPLETIONS ----------
create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index if not exists completions_user_date_idx on public.completions (user_id, date);
create index if not exists completions_habit_idx on public.completions (habit_id);

-- ---------- FRIENDSHIPS (vraies amitiés uniquement) ----------
create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_b_idx on public.friendships (user_b);

-- ---------- FRIEND REQUESTS ----------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id)
);

create index if not exists requests_to_idx on public.friend_requests (to_id, status);
create index if not exists requests_from_idx on public.friend_requests (from_id, status);

-- une seule demande "en attente" par paire, dans les deux sens
create unique index if not exists requests_pending_uq on public.friend_requests (
  least(from_id, to_id),
  greatest(from_id, to_id)
) where status = 'pending';

-- ---------- FONCTIONS UTILISATEUR (atomicité + sécurité) ----------
-- Coche / décoche une habitude pour une date donnée
create or replace function public.toggle_habit(p_habit_id uuid, p_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.habits%rowtype;
  d date;
begin
  select * into h from public.habits
  where id = p_habit_id
  for update;
  if not found then
    raise exception 'Habitude introuvable';
  end if;
  if h.user_id <> auth.uid() then
    raise exception 'Cette habitude ne vous appartient pas';
  end if;
  d := coalesce(p_date, current_date);
  if exists (select 1 from public.completions where habit_id = p_habit_id and date = d) then
    delete from public.completions where habit_id = p_habit_id and date = d;
    return false;
  end if;
  insert into public.completions (habit_id, user_id, date)
  values (p_habit_id, auth.uid(), d);
  return true;
end $$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.friend_requests%rowtype;
  a uuid;
  b uuid;
begin
  select * into req from public.friend_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Demande introuvable'; end if;
  if req.to_id <> auth.uid() then
    raise exception 'Seul le destinataire peut répondre';
  end if;
  if req.status <> 'pending' then raise exception 'Demande déjà traitée'; end if;

  update public.friend_requests
  set status = 'accepted', responded_at = now()
  where id = p_request_id;

  a := least(req.from_id, req.to_id);
  b := greatest(req.from_id, req.to_id);
  insert into public.friendships (user_a, user_b) values (a, b) on conflict do nothing;
  return 'accepted';
end $$;

create or replace function public.decline_friend_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.friend_requests%rowtype;
begin
  select * into req from public.friend_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Demande introuvable'; end if;
  if req.to_id <> auth.uid() then raise exception 'Seul le destinataire peut répondre'; end if;
  if req.status <> 'pending' then raise exception 'Demande déjà traitée'; end if;
  update public.friend_requests
  set status = 'declined', responded_at = now()
  where id = p_request_id;
  return 'declined';
end $$;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.completions enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;

-- profiles : visibles par les connectés (recherche d'amis), modifiables par soi-même
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- habits : propre + visible par ses amis
create policy "habits_select_own" on public.habits
  for select to authenticated using (user_id = auth.uid());
create policy "habits_select_friends" on public.habits
  for select to authenticated using (
    exists (
      select 1 from public.friendships f
      where (f.user_a = habits.user_id and f.user_b = auth.uid())
         or (f.user_a = auth.uid() and f.user_b = habits.user_id)
    )
  );
create policy "habits_insert_own" on public.habits
  for insert to authenticated with check (user_id = auth.uid());
create policy "habits_update_own" on public.habits
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habits_delete_own" on public.habits
  for delete to authenticated using (user_id = auth.uid());

-- completions : propre + visible par ses amis
create policy "completions_select_own" on public.completions
  for select to authenticated using (user_id = auth.uid());
create policy "completions_select_friends" on public.completions
  for select to authenticated using (
    exists (
      select 1 from public.friendships f
      where (f.user_a = completions.user_id and f.user_b = auth.uid())
         or (f.user_a = auth.uid() and f.user_b = completions.user_id)
    )
  );
create policy "completions_insert_own" on public.completions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
  );
create policy "completions_delete_own" on public.completions
  for delete to authenticated using (user_id = auth.uid());

-- friendships : seuls les deux concernés
create policy "friendships_select" on public.friendships
  for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());
create policy "friendships_insert" on public.friendships
  for insert to authenticated with check (user_a = auth.uid() or user_b = auth.uid());
create policy "friendships_delete" on public.friendships
  for delete to authenticated using (user_a = auth.uid() or user_b = auth.uid());

-- friend_requests : participants seulement.
-- Les changements de statut passent UNIQUEMENT par les fonctions (security definer).
create policy "requests_select" on public.friend_requests
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy "requests_insert" on public.friend_requests
  for insert to authenticated with check (from_id = auth.uid());
create policy "requests_delete" on public.friend_requests
  for delete to authenticated using (from_id = auth.uid() or to_id = auth.uid());

grant execute on function public.toggle_habit(uuid, date) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;

-- ---------- REALTIME ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'habits'
  ) then
    alter publication supabase_realtime add table public.habits;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'completions'
  ) then
    alter publication supabase_realtime add table public.completions;
  end if;
end $$;