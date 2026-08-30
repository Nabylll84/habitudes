import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { fetchOwnHabits, toggleHabit, recordHabit } from '@/lib/api';
import { flipHabit, setHabitValue } from '@/lib/optimistic';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Ring, EmptyState, Skeleton } from '@/components/ui';
import { HabitLogModal } from '@/components/HabitLogModal';
import { JournalHabitCard } from '@/components/JournalHabitCard';
import type { HabitState } from '@/lib/types';
import { greeting, longToday, todayISO } from '@/lib/dates';
import { SproutIcon } from '@/lib/icons';

export default function Journal() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<HabitState[] | null>(null);
  const [logHabit, setLogHabit] = useState<HabitState | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchOwnHabits(user.id);
      setHabits(data);
      setLogHabit((prev) => (prev ? data.find((h) => h.habit.id === prev.habit.id) ?? null : null));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);
  useRealtime('habits', 'user_id', user?.id, load);
  useRealtime('completions', 'user_id', user?.id, load);

  const onToggleDay = async (hs: HabitState) => {
    const id = hs.habit.id;
    const date = todayISO();
    const next = !hs.doneToday;
    setHabits((prev) => (prev ? flipHabit(prev, hs.habit, date, next) : prev));
    try {
      await toggleHabit(id, date);
    } catch (e) {
      setHabits((prev) => (prev ? flipHabit(prev, hs.habit, date, !next) : prev));
      toast((e as Error).message, 'error');
    }
  };

  const onRecordValue = async (hs: HabitState, date: string, value: number, note?: string | null) => {
    const id = hs.habit.id;
    setHabits((prev) => (prev ? setHabitValue(prev, id, date, value, note) : prev));
    try {
      if (value === 0) {
        await toggleHabit(id, date);
      } else {
        await recordHabit(id, date, value, note ?? null);
      }
    } catch (e) {
      setHabits((prev) => (prev ? setHabitValue(prev, id, date, value, note) : prev));
      toast((e as Error).message, 'error');
    }
  };

  const doneCount = habits?.filter((h) => h.doneToday).length ?? 0;
  const total = habits?.length ?? 0;
  const pct = total ? doneCount / total : 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{longToday()}</p>
          <h1>{greeting()}{profile ? `, ${profile.username.split(/[_.]/)[0]}` : ''}</h1>
          {total > 0 && (
            <p className="muted">
              {pct === 1
                ? 'Tout est fait. Journée parfaite.'
                : doneCount === 0
                  ? 'Allons-y ! Coche ta première habitude.'
                  : `${doneCount}/${total} habitude${total > 1 ? 's' : ''} validée${doneCount > 1 ? 's' : ''}`}
            </p>
          )}
        </div>
        {total > 0 && <Ring value={pct} />}
      </header>

      {habits === null ? (
        <div className="card-grid">
          <Skeleton h={210} /><Skeleton h={210} /><Skeleton h={210} />
        </div>
      ) : habits.length === 0 ? (
        <EmptyState
          icon={<SproutIcon size={40} />}
          title="Commence ta toute première habitude"
          text="Sport, lecture, eau, méditation… choisis ce que tu veux améliorer."
        />
      ) : (
        <div className="card-grid">
          {habits.map((h) => (
            <JournalHabitCard
              key={h.habit.id}
              habit={h}
              onToggleDay={onToggleDay}
              onRecordValue={onRecordValue}
              onOpenLog={setLogHabit}
            />
          ))}
        </div>
      )}

      {habits && habits.length > 0 && (
        <button className="btn btn-ghost btn-add-row" onClick={() => navigate('/habits')}>
          + Ajouter une habitude
        </button>
      )}

      {logHabit && <HabitLogModal habit={logHabit} onClose={() => setLogHabit(null)} onMutated={load} />}
    </div>
  );
}