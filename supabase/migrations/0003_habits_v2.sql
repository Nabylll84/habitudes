-- ============================================================
-- HabitFlow — habits v2 : objectifs, fréquences, catégories,
-- épinglage, visibilité, jokers, rappels, réactions, badges
-- Exécuter dans : Supabase Dashboard -> SQL Editor (ou supabase db push)
-- ============================================================

-- ---------- HABITS : nouvelles colonnes ----------
alter table public.habits
  add column if not exists tracking_type text not null default 'binary'
    check (tracking_type in ('binary', 'amount')),
  add column if not exists goal_amount numeric,
  add column if not exists goal_unit text,
  add column if not exists frequency_type text not null default 'daily'
    check (frequency_type in ('daily', 'weekdays', 'weekly', 'challenge')),
  add column if not exists weekdays smallint[]
    check (weekdays is null or (weekdays <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(weekdays) >= 1)),
  add column if not exists times_per_week smallint
    check (times_per_week is null or times_per_week between 1 and 7),
  add column if not exists challenge_days smallint
    check (challenge_days is null or challenge_days between 1 and 365),
  add column if not exists start_on date,
  add column if not exists category text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists pinned boolean not null default false,
  add column if not exists visible_shared boolean not null default true,
  add column if not exists streak_freezes smallint not null default 0,
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists reminder_time time,
  add column if not exists reminder_days smallint[]
    check (reminder_days is null or (reminder_days <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(reminder_days) >= 1));

create index if not exists habits_category_idx on public.habits (user_id, category);
create index if not exists habits_order_idx on public.habits (user_id, sort_order, pinned desc);

-- ---------- COMPLETIONS : valeur (compteur) + note ----------
alter table public.completions
  add column if not exists value numeric not null default 0,
  add column if not exists note text;

-- ---------- REACTIONS (encouragements entre amis) ----------
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  emoji_key text not null check (char_length(emoji_key) between 1 and 20),
  created_at timestamptz not null default now(),
  unique (from_id, habit_id)
);

create index if not exists reactions_habit_idx on public.reactions (habit_id);

-- ---------- BADGES (catalogue + acquisition) ----------
create table if not exists public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

insert into public.badges (id, name, description, icon_key) values
  ('first_done',    'Première fois',   'Valide ta première habitude.',       'target'),
  ('streak_7',      'En feu',          'Atteins une série de 7 jours.',      'fire'),
  ('streak_30',     'Accro',           'Atteins une série de 30 jours.',     'fire'),
  ('streak_100',    'Légende',         'Atteins une série de 100 jours.',    'fire'),
  ('challenge_21',  'Défi 21 jours',   'Termine un défi de 21 jours.',       'trophy'),
  ('challenge_30',  'Défi 30 jours',   'Termine un défi de 30 jours.',       'trophy'),
  ('five_habits',   'Agile',           '5 habitudes actives.',               'folder'),
  ('ten_habits',    'Machine',         '10 habitudes actives.',              'folder')
on conflict (id) do nothing;

-- ---------- REMINDER LOGS (rappels email, balayés par l'Edge Function) ----------
create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  due_date date not null,
  email_to text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (habit_id, due_date)
);

create index if not exists reminder_logs_pending_idx on public.reminder_logs (user_id, status);

-- ---------- FONCTIONS ----------
-- Plus longue série de jours validés pour une habitude
create or replace function public.max_streak_days(p_habit_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  with done as (
    select date,
           date - (dense_rank() over (order by date))::int as island
    from (
      select distinct date
      from public.completions
      where habit_id = p_habit_id
    ) c
  ),
  islands as (
    select island, count(*) as days
    from done
    group by island
  )
  select coalesce(max(days), 0)::int from islands;
$$;

-- Enregistre/maj la valeur d'un compteur pour une date (habitudes "amount").
-- Retourne true en cas de succès.
create or replace function public.record_habit(p_habit_id uuid, p_date date, p_value numeric, p_note text default null)
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
  if h.tracking_type <> 'amount' then
    raise exception 'Cette habitude n''est pas un compteur';
  end if;
  d := coalesce(p_date, current_date);
  insert into public.completions (habit_id, user_id, date, value, note)
  values (p_habit_id, auth.uid(), d, coalesce(p_value, 0), p_note)
  on conflict (habit_id, date)
  do update set value = excluded.value,
                note = coalesce(excluded.note, public.completions.note);
  return true;
end $$;

-- Attribue les badges nouvellement gagnés. Retourne la liste gagnée à l'instant T.
create or replace function public.maybe_award_badges()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  awarded text[] := '{}';
  r record;
  s integer;
begin
  if uid is null then
    raise exception 'Non authentifié';
  end if;

  -- Première habitude validée
  if exists (select 1 from public.completions where user_id = uid)
     and not exists (select 1 from public.user_badges where user_id = uid and badge_id = 'first_done') then
    insert into public.user_badges (user_id, badge_id) values (uid, 'first_done') on conflict do nothing;
    awarded := array_append(awarded, 'first_done');
  end if;

  -- Nombre d'habitudes actives
  s := (select count(*) from public.habits where user_id = uid);
  if s >= 5 and not exists (select 1 from public.user_badges where user_id = uid and badge_id = 'five_habits') then
    insert into public.user_badges (user_id, badge_id) values (uid, 'five_habits') on conflict do nothing;
    awarded := array_append(awarded, 'five_habits');
  end if;
  if s >= 10 and not exists (select 1 from public.user_badges where user_id = uid and badge_id = 'ten_habits') then
    insert into public.user_badges (user_id, badge_id) values (uid, 'ten_habits') on conflict do nothing;
    awarded := array_append(awarded, 'ten_habits');
  end if;

  -- Défis 21/30 jours terminés
  if exists (
    select 1 from public.habits h
    where h.user_id = uid and h.frequency_type = 'challenge' and h.challenge_days = 21
      and (select count(*) from public.completions c
           where c.habit_id = h.id and c.value >= coalesce(h.goal_amount, 0)) >= 21
  ) and not exists (select 1 from public.user_badges where user_id = uid and badge_id = 'challenge_21') then
    insert into public.user_badges (user_id, badge_id) values (uid, 'challenge_21') on conflict do nothing;
    awarded := array_append(awarded, 'challenge_21');
  end if;
  if exists (
    select 1 from public.habits h
    where h.user_id = uid and h.frequency_type = 'challenge' and h.challenge_days = 30
      and (select count(*) from public.completions c
           where c.habit_id = h.id and c.value >= coalesce(h.goal_amount, 0)) >= 30
  ) and not exists (select 1 from public.user_badges where user_id = uid and badge_id = 'challenge_30') then
    insert into public.user_badges (user_id, badge_id) values (uid, 'challenge_30') on conflict do nothing;
    awarded := array_append(awarded, 'challenge_30');
  end if;

  -- Séries records
  for r in select id from public.habits where user_id = uid loop
    s := public.max_streak_days(r.id);
    if s >= 7 and not exists (select 1 from public.user_badges where user_id = uid and badge_id = 'streak_7') then
      insert into public.user_badges (user_id, badge_id) values (uid, 'streak_7') on conflict do nothing;
      awarded := array_append(awarded, 'streak_7');
    end if;
    if s >= 30 and not exists (select 1 from public.user_badges where user_id = uid and badge_id = 'streak_30') then
      insert into public.user_badges (user_id, badge_id) values (uid, 'streak_30') on conflict do nothing;
      awarded := array_append(awarded, 'streak_30');
    end if;
    if s >= 100 and not exists (select 1 from public.user_badges where user_id = uid and badge_id = 'streak_100') then
      insert into public.user_badges (user_id, badge_id) values (uid, 'streak_100') on conflict do nothing;
      awarded := array_append(awarded, 'streak_100');
    end if;
  end loop;

  return awarded;
end $$;

grant execute on function public.max_streak_days(uuid) to authenticated;
grant execute on function public.record_habit(uuid, date, numeric, text) to authenticated;
grant execute on function public.maybe_award_badges() to authenticated;

-- ---------- ROW LEVEL SECURITY ----------
-- Visibilité des habitudes entre amis : on ne voit que les habitudes visibles
drop policy if exists "habits_select_friends" on public.habits;
create policy "habits_select_friends" on public.habits
  for select to authenticated using (
    exists (
      select 1 from public.friendships f
      where (f.user_a = habits.user_id and f.user_b = auth.uid())
         or (f.user_a = auth.uid() and f.user_b = habits.user_id)
    )
    and habits.visible_shared
  );

-- Idem pour les complétions : on ne voit que celles des habitudes visibles
drop policy if exists "completions_select_friends" on public.completions;
create policy "completions_select_friends" on public.completions
  for select to authenticated using (
    exists (
      select 1 from public.habits h
      where h.id = completions.habit_id and h.visible_shared
    )
    and exists (
      select 1 from public.friendships f
      where (f.user_a = completions.user_id and f.user_b = auth.uid())
         or (f.user_a = auth.uid() and f.user_b = completions.user_id)
    )
  );

alter table public.reactions enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.reminder_logs enable row level security;

-- badges : catalogue lisible par tous les connectés, gain via fonction uniquement
create policy "badges_select_all" on public.badges
  for select to authenticated using (true);

-- user_badges : chacun voit ses badges (attribution via maybe_award_badges)
create policy "user_badges_select_own" on public.user_badges
  for select to authenticated using (user_id = auth.uid());

-- réactions : le propriétaire de l'habitude + ses amis (habitude visible)
drop policy if exists "reactions_select_viewable" on public.reactions;
create policy "reactions_select_viewable" on public.reactions
  for select to authenticated using (
    exists (
      select 1 from public.habits h
      where h.id = reactions.habit_id and h.user_id = auth.uid()
    )
    or exists (
      select 1 from public.habits h
      join public.friendships f
        on (f.user_a = h.user_id and f.user_b = auth.uid())
        or (f.user_a = auth.uid() and f.user_b = h.user_id)
      where h.id = reactions.habit_id and h.visible_shared
    )
  );

drop policy if exists "reactions_insert_friend" on public.reactions;
create policy "reactions_insert_friend" on public.reactions
  for insert to authenticated with check (
    from_id = auth.uid()
    and exists (
      select 1 from public.habits h
      join public.friendships f
        on (f.user_a = h.user_id and f.user_b = auth.uid())
        or (f.user_a = auth.uid() and f.user_b = h.user_id)
      where h.id = reactions.habit_id and h.visible_shared
    )
  );

drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own" on public.reactions
  for delete to authenticated using (from_id = auth.uid());

-- reminder_logs : visible par l'utilisateur concerné uniquement
-- (l'écriture se fera côté service/Edge Function, pas depuis le client)
create policy "reminder_logs_select_own" on public.reminder_logs
  for select to authenticated using (user_id = auth.uid());

-- ---------- REALTIME ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reactions'
  ) then
    alter publication supabase_realtime add table public.reactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_badges'
  ) then
    alter publication supabase_realtime add table public.user_badges;
  end if;
end $$;