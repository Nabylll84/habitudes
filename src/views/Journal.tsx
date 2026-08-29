import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { fetchOwnHabits, toggleHabit } from '@/lib/api';
import { toggleInList } from '@/lib/optimistic';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Ring, EmptyState, Skeleton } from '@/components/ui';
import { ToggleHabitCard } from '@/components/HabitCard';
import type { HabitState } from '@/lib/types';
import { greeting, longToday, todayISO } from '@/lib/dates';
import { SproutIcon } from '@/lib/icons';

export default function Journal() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<HabitState[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchOwnHabits(user.id);
      setHabits(data);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);
  useRealtime('habits', 'user_id', user?.id, load);
  useRealtime('completions', 'user_id', user?.id, load);

  const onToggle = async (h: HabitState) => {
    if (!user) return;
    const id = h.habit.id;
    const date = todayISO();
    const next = !h.doneToday;
    setHabits((prev) => (prev ? toggleInList(prev, id) : prev));
    try {
      await toggleHabit(id, date);
      if (next) {
        const msgs = ['Bien joué !', 'Coche !', 'Tu assures', 'Streak lancé', "Rien ne t'arrête"];
        toast(msgs[Math.floor(Math.random() * msgs.length)]);
      }
    } catch (e) {
      setHabits((prev) => (prev ? toggleInList(prev, id) : prev));
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
                  : `${doneCount}/${total} habitude${total > 1 ? 's' : ''} cochée${doneCount > 1 ? 's' : ''}`}
            </p>
          )}
        </div>
        {total > 0 && <Ring value={pct} />}
      </header>

      {habits === null ? (
        <div className="card-grid">
          <Skeleton h={190} /><Skeleton h={190} /><Skeleton h={190} />
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
            <ToggleHabitCard key={h.habit.id} habit={h} onToggle={onToggle} />
          ))}
        </div>
      )}

      {habits && habits.length > 0 && (
        <button className="btn btn-ghost btn-add-row" onClick={() => navigate('/habits')}>
          + Ajouter une habitude
        </button>
      )}
    </div>
  );
}