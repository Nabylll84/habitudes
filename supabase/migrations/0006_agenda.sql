-- ============================================================
-- HabitFlow — 0006 : agenda + liaison Google Calendar
-- Exécuter après 0005 dans : Supabase Dashboard -> SQL Editor
-- ============================================================
--
-- Deux tables :
--   public.events               les événements de l'agenda (CRUD direct par le client)
--   public.calendar_connections le OAuth Google (refresh token)
--
-- Sécurité : calendar_connections n'a AUCUNE policy pour `authenticated`.
-- Les tokens ne sont donc lisibles que par l'Edge Function `google-calendar`
-- (qui utilise la service_role) et par le SQL Editor. L'interface ne lit
-- l'état de la connexion que via calendar_connection_status(), qui ne
-- renvoie aucun secret.

-- ---------------------------------------------------------------- événements

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  location text,
  color text,
  all_day boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- liaison Google Calendar
  g_event_id text,
  g_etag text,
  -- l'événement est une instance issue d'une série récurrente Google : lecture seule
  g_readonly boolean not null default false,
  -- modification locale non encore poussée vers Google
  g_dirty boolean not null default true,
  g_synced_at timestamptz,
  -- suppression logique : purgée après avoir été poussée vers Google
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates_order check (ends_at >= starts_at),
  -- g_event_id nul = événement purement local, la contrainte ne s'applique pas
  constraint events_google_unique unique (user_id, g_event_id)
);

create index if not exists events_user_start_idx on public.events (user_id, starts_at);
create index if not exists events_user_end_idx on public.events (user_id, ends_at);
create index if not exists events_pending_push_idx on public.events (user_id) where g_dirty;
create index if not exists events_deleted_idx on public.events (user_id) where deleted_at is not null;

-- updated_at maintenu automatiquement (les écritures viennent du client ET de l'Edge Function)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

alter table public.events enable row level security;

-- L'agenda est strictement privé : uniquement son propriétaire.
drop policy if exists "events_select_own" on public.events;
create policy "events_select_own" on public.events
  for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own" on public.events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "events_update_own" on public.events;
create policy "events_update_own" on public.events
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own" on public.events
  for delete to authenticated
  using (user_id = auth.uid());

-- Suppression logique : la policy select filtre déjà deleted_at, donc
-- `update` suffit à faire disparaître l'événement côté interface.
create or replace function public.soft_delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
     set deleted_at = now(),
         -- un événement lu seul (série Google) ne peut pas être poussé
         g_dirty = case when g_readonly then false else true end
   where id = p_event_id
     and user_id = auth.uid();
end;
$$;

grant execute on function public.soft_delete_event(uuid) to authenticated;

-- Evenements d'une plage, pour une vue calendrier. SECURITY DEFINER car la
-- policy select exclut les lignes supprimées logiquement (l'Edge Function a
-- besoin de les voir pour les purger).
create or replace function public.events_in_range(
  p_from timestamptz,
  p_to timestamptz
)
returns setof public.events
language sql
stable
security definer
set search_path = public
as $$
  select *
    from public.events
   where user_id = auth.uid()
     and deleted_at is null
     and starts_at < p_to
     and ends_at >= p_from
   order by starts_at;
$$;

grant execute on function public.events_in_range(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------- connexion Google

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google',
  account_email text,
  calendar_id text not null default 'primary',
  -- secrets : jamais exposés au client (aucune policy select)
  access_token text,
  refresh_token text not null,
  token_expires_at timestamptz,
  -- curseur de sync incrémentale Google (peut être invalidé -> 410 Gone)
  sync_token text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists calendar_connections_user_idx on public.calendar_connections (user_id);

alter table public.calendar_connections enable row level security;
-- Volontairement aucune policy : l'accès passe par l'Edge Function (service_role).

drop trigger if exists calendar_connections_touch_updated_at on public.calendar_connections;
create trigger calendar_connections_touch_updated_at
  before update on public.calendar_connections
  for each row execute function public.touch_updated_at();

-- Etat de la connexion, sans secret, pour afficher le bouton de sync.
create or replace function public.calendar_connection_status()
returns table (
  connected boolean,
  account_email text,
  calendar_id text,
  last_sync_at timestamptz,
  last_error text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    true,
    c.account_email,
    c.calendar_id,
    c.last_sync_at,
    c.last_error
  from public.calendar_connections c
  where c.user_id = auth.uid() and c.provider = 'google'
  limit 1;
$$;

grant execute on function public.calendar_connection_status() to authenticated;

-- ---------------------------------------------------------------- realtime

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
