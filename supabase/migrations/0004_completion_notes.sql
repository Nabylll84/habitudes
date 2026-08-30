-- ============================================================
-- HabitFlow — notes/commentaires sur une complétion
-- Exécuter dans : Supabase Dashboard -> SQL Editor (ou supabase db push)
-- ============================================================

create or replace function public.update_completion_note(p_habit_id uuid, p_date date, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.completions c
  set note = p_note
  from public.habits h
  where h.id = c.habit_id
    and c.habit_id = p_habit_id
    and c.date = coalesce(p_date, current_date)
    and h.user_id = auth.uid();
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Complétion introuvable';
  end if;
end $$;

grant execute on function public.update_completion_note(uuid, date, text) to authenticated;