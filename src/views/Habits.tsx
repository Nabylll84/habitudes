import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { deleteHabit, fetchOwnHabits, toggleHabit } from '@/lib/api';
import { flipHabit } from '@/lib/optimistic';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { HabitFormModal } from '@/components/HabitFormModal';
import { Confirm } from '@/components/Modal';
import { EmptyState, Skeleton } from '@/components/ui';
import { HabitIcon, FireIcon, TrashIcon, FolderIcon, PinIcon, PencilIcon } from '@/lib/icons';
import type { HabitState, Habit } from '@/lib/types';
import { lastDays, weekdayLabel, dayNumber, relativeDayLabel } from '@/lib/dates';

export default function Habits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [habits, setHabits] = useState<HabitState[] | null>(null);
  const [modal, setModal] = useState<null | { editing: Habit | null }>(null);
  const [confirmDel, setConfirmDel] = useState<Habit | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setHabits(await fetchOwnHabits(user.id));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);
  useRealtime('habits', 'user_id', user?.id, load);
  useRealtime('completions', 'user_id', user?.id, load);

  const pushState = (habit: Habit): HabitState => ({
    habit, dates: new Set<string>(), doneToday: false, streak: 0,
  });

  const onSaved = async (habit: Habit, isNew: boolean) => {
    if (isNew) {
      setHabits((prev) => [...(prev ?? []), pushState(habit)]);
    } else {
      setHabits((prev) => (prev ?? []).map((h) => (h.habit.id === habit.id ? { ...h, habit } : h)));
      await load();
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteHabit(confirmDel.id);
      setHabits((prev) => (prev ?? []).filter((h) => h.habit.id !== confirmDel.id));
      toast('Habitude supprimée');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
    setConfirmDel(null);
  };

  const toggleDay = async (hs: HabitState, date: string) => {
    const on = !(hs.dates.has(date) ?? false);
    setHabits((prev) => (prev ? flipHabit(prev, hs.habit, date, on) : prev));
    try {
      await toggleHabit(hs.habit.id, date);
    } catch (e) {
      toast((e as Error).message, 'error');
      load();
    }
  };

  const week = lastDays(7);
  const sorted = [...(habits ?? [])].sort((a, b) =>
    (Number(b.habit.pinned) - Number(a.habit.pinned)) ||
    ((a.habit.sort_order ?? 0) - (b.habit.sort_order ?? 0)) ||
    a.habit.name.localeCompare(b.habit.name)
  );

  const groups: { label: string; items: HabitState[] }[] = [];
  for (const h of sorted) {
    const label = h.habit.category ?? 'Sans catégorie';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(h);
    else groups.push({ label, items: [h] });
  }

  const maxSort = sorted.reduce((m, h) => Math.max(m, h.habit.sort_order ?? 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Mes routines</p>
          <h1>Habitudes</h1>
          <p className="muted">Objectifs, fréquences et catégories. Les compteurs se remplissent depuis le Journal.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ editing: null })}>+ Nouvelle</button>
      </header>

      {habits === null ? (
        <Skeleton h={220} />
      ) : habits.length === 0 ? (
        <EmptyState icon={<FolderIcon size={40} />} title="Aucune habitude" text="Cliquez sur « + Nouvelle » pour créer ta première routine." />
      ) : (
        <div className="table-card">
          <div className="table-head">
            <span className="cell-name">Habitude</span>
            {week.map((d) => (
              <span key={d} className="cell-day" title={relativeDayLabel(d)}>
                <small>{weekdayLabel(d)}</small>
                <b>{dayNumber(d)}</b>
              </span>
            ))}
            <span className="cell-streak">Série</span>
            <span className="cell-actions" />
          </div>

          {groups.map((g) => (
            <div className="table-group" key={g.label}>
              <div className="table-group-head">
                {g.label === 'Sans catégorie' ? <FolderIcon size={13} /> : <PinIcon size={13} />} {g.label}
              </div>
              {g.items.map((hs) => {
                const h = hs.habit;
                const isAmount = h.tracking_type === 'amount';
                const goal = h.goal_amount ?? null;
                return (
                  <div className="table-row" key={h.id}>
                    <span className="cell-name">
                      {h.pinned && <span title="Épinglée"><PinIcon size={13} className="cell-pin" /></span>}
                      <span className="row-emoji"><HabitIcon emoji={h.emoji} size={22} fallback={h.name.charAt(0)} /></span>
                      <span className="cell-name-text">
                        {h.name}
                        <small className="cell-sub">
                          {isAmount ? `objectif ${goal}${h.goal_unit ? ` ${h.goal_unit}` : ''}` : 'cocher'}
                          {!h.visible_shared ? ' · privée' : ''}
                        </small>
                      </span>
                    </span>
                    {week.map((d) => {
                      const v = hs.values?.get(d);
                      if (isAmount) {
                        const val = v?.value ?? 0;
                        const ok = goal != null ? val >= goal : val > 0;
                        return (
                          <span
                            key={d}
                            className={`cell-day amount-cell ${ok ? 'on' : ''}`}
                            style={ok ? { color: h.color } : undefined}
                            title={v ? `${val}${h.goal_unit ? ` ${h.goal_unit}` : ''} — modifiable dans le Journal` : 'À faire'}
                          >
                            <b>{v ? val : '·'}</b>
                          </span>
                        );
                      }
                      const on = hs.dates.has(d);
                      return (
                        <button
                          key={d}
                          className={`day-btn ${on ? 'on' : ''}`}
                          style={on ? { background: h.color, borderColor: h.color } : undefined}
                          onClick={() => toggleDay(hs, d)}
                          title={relativeDayLabel(d)}
                          aria-label={`${h.name} le ${d}`}
                        />
                      );
                    })}
                    <span className="cell-streak"><FireIcon size={14} /> {hs.streak}</span>
                    <span className="cell-actions">
                      <button className="icon-btn" onClick={() => setModal({ editing: h })} title="Modifier">
                        <PencilIcon size={17} />
                      </button>
                      <button className="icon-btn danger" onClick={() => setConfirmDel(h)} title="Supprimer"><TrashIcon size={17} /></button>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {modal && user && (
        <HabitFormModal
          uid={user.id}
          editing={modal.editing}
          nextSort={maxSort + 1}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}

      {confirmDel && (
        <Confirm
          title="Supprimer l'habitude ?"
          message={`« ${confirmDel.name} » et tout son historique disparaîtront.`}
          danger
          confirmLabel="Supprimer"
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}