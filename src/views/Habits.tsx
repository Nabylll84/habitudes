import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { createHabit, deleteHabit, fetchOwnHabits, updateHabit, toggleHabit } from '@/lib/api';
import { flipHabit } from '@/lib/optimistic';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Modal, Confirm } from '@/components/Modal';
import { EmptyState, Skeleton } from '@/components/ui';
import { EMOJIS, COLORS } from '@/lib/types';
import type { HabitState, Habit } from '@/lib/types';
import { lastDays, weekdayLabel, dayNumber, relativeDayLabel } from '@/lib/dates';

export default function Habits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [habits, setHabits] = useState<HabitState[] | null>(null);
  const [modal, setModal] = useState<null | { editing: Habit | null }>(null);
  const [confirmDel, setConfirmDel] = useState<Habit | null>(null);

  // formulaire
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💪');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

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

  const openCreate = () => {
    setName(''); setEmoji('💪'); setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    setModal({ editing: null });
  };
  const openEdit = (h: Habit) => {
    setName(h.name); setEmoji(h.emoji); setColor(h.color);
    setModal({ editing: h });
  };

  const save = async () => {
    if (!user) return;
    const val = name.trim();
    if (!val) { toast('Nom obligatoire', 'error'); return; }
    if (val.length > 60) { toast('Nom trop long (60 max)', 'error'); return; }
    setSaving(true);
    try {
      if (modal?.editing) {
        const updated = await updateHabit(modal.editing.id, { name: val, emoji, color });
        setHabits((prev) => (prev ?? []).map((h) => (h.habit.id === updated.id ? { ...h, habit: updated } : h)));
        toast('Habitude modifiée');
      } else {
        const created = await createHabit(user.id, { name: val, emoji, color });
        setHabits((prev) => [...(prev ?? []), created]);
        toast('Habitude créée 🎉');
      }
      setModal(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
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

  const toggleDay = async (id: string, date: string) => {
    const h = habits?.find((x) => x.habit.id === id);
    const on = !(h?.dates.has(date) ?? false);
    setHabits((prev) => (prev ? flipHabit(prev, id, date, on) : prev));
    try {
      await toggleHabit(id, date);
    } catch (e) {
      toast((e as Error).message, 'error');
      load();
    }
  };

  const week = lastDays(7);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Mes routines</p>
          <h1>Habitudes</h1>
          <p className="muted">Coche les 7 derniers jours, modifie ou supprime.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nouvelle</button>
      </header>

      {habits === null ? (
        <Skeleton h={220} />
      ) : habits.length === 0 ? (
        <EmptyState emoji="🗂️" title="Aucune habitude" text="Cliquez sur « + Nouvelle » pour créer ta première routine." />
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

          {habits.map((h) => (
            <div className="table-row" key={h.habit.id}>
              <span className="cell-name">
                <span className="row-emoji">{h.habit.emoji}</span>
                <span>{h.habit.name}</span>
              </span>
              {week.map((d) => {
                const on = h.dates.has(d);
                return (
                  <button
                    key={d}
                    className={`day-btn ${on ? 'on' : ''}`}
                    style={on ? { background: h.habit.color, borderColor: h.habit.color } : undefined}
                    onClick={() => toggleDay(h.habit.id, d)}
                    aria-label={`${h.habit.name} le ${d}`}
                  />
                );
              })}
              <span className="cell-streak">🔥 {h.streak}</span>
              <span className="cell-actions">
                <button className="icon-btn" onClick={() => openEdit(h.habit)} title="Modifier">✏️</button>
                <button className="icon-btn danger" onClick={() => setConfirmDel(h.habit)} title="Supprimer">🗑️</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal.editing ? "Modifier l'habitude" : 'Nouvelle habitude'} onClose={() => setModal(null)}>
          <label className="field">
            <span>Nom</span>
            <input
              autoFocus
              value={name}
              maxLength={60}
              placeholder="Ex : Boire 2L d'eau"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
          </label>
          <label className="field">
            <span>Émoji</span>
            <div className="emoji-grid">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  className={`emoji-opt ${e === emoji ? 'selected' : ''}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </label>
          <label className="field">
            <span>Couleur</span>
            <div className="color-grid">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`color-swatch ${c === color ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </label>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Annuler</button>
            <button className="btn btn-primary" disabled={saving} onClick={save}>
              {saving ? '…' : modal.editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </Modal>
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