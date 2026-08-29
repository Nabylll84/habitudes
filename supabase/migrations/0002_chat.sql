-- ============================================================
-- HabitFlow — chat entre amis
-- Exécuter dans : Supabase Dashboard -> SQL Editor (ou supabase db push)
-- ============================================================

-- ---------- MESSAGES ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists messages_pair_idx on public.messages (
  least(sender_id, recipient_id),
  greatest(sender_id, recipient_id),
  created_at
);
create index if not exists messages_recipient_unread_idx on public.messages (recipient_id) where read_at is null;

-- ---------- FONCTIONS (atomicité + sécurité) ----------
-- Récupère la conversation entre l'utilisateur courant et un ami
create or replace function public.get_messages(p_peer_id uuid)
returns setof public.messages
language sql
security definer
set search_path = public
as $$
  select m.*
  from public.messages m
  where (m.recipient_id = auth.uid() and m.sender_id = p_peer_id)
     or (m.sender_id = auth.uid() and m.recipient_id = p_peer_id)
  order by m.created_at asc;
$$;

-- Marque comme lus tous les messages reçus d'un ami. Retourne le nombre marqué.
create or replace function public.mark_messages_read(p_peer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.messages
  set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_peer_id and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.messages enable row level security;

-- select : expéditeur ou destinataire uniquement (Realtime inclus)
create policy "messages_select_participants" on public.messages
  for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

-- insert : seulement pour soi, et uniquement vers un ami accepté
create policy "messages_insert_friends" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.friendships f
      where (f.user_a = sender_id and f.user_b = recipient_id)
         or (f.user_a = recipient_id and f.user_b = sender_id)
    )
  );

-- update / delete : interdits directement, tout passe par la fonction mark_messages_read

grant execute on function public.get_messages(uuid) to authenticated;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- ---------- REALTIME ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;