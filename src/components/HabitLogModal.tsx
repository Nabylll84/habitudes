import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { toggleHabit, recordHabit, updateCompletionNote } from '@/lib/api';
import { lastDays, relativeDayLabel, shortDate, todayISO } from '@/lib/dates';
import { HabitIcon, CheckIcon } from '@/lib/icons';
import type { HabitState } from '@/lib/types';
import { celebrateBadges } from '@/lib/badges';

export function HabitLogModal({
  habit,
  onClose,
  onMutated,
}: {
  habit: HabitState;
  onClose: () => void;
  onMutated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const h = habit.habit;
  const isAmount = h.tracking_type === 'amount';
  const goal = h.goal_amount ?? null;
  const unit = h.goal_unit ?? '';
  const today = todayISO();
  const days = lastDays(14).reverse().map((d) => ({ date: d, isToday: d === today }));

  const [drafts, setDrafts] = useState<Record<string, { value: string; note: string }>>(() => {
    const out: Record<string, { value: string; note: string }> = {};
    for (const [d, v] of habit.values ?? []) {
      out[d] = { value: String(v.value), note: v.note ?? '' };
    }
    return out;
  });
  const [busyDate, setBusyDate] = useState<string | null>(null);

  const draft = (d: string) => drafts[d] ?? { value: '', note: '' };
  const setDraft = (d: string, patch: Partial<{ value: string; note: string }>) =>
    setDrafts((prev) => ({ ...prev, [d]: { ...(prev[d] ?? { value: '', note: '' }), ...patch } }));

  const hasRow = (d: string) => habit.values?.has(d) ?? false;

  const refresh = async () => {
    await onMutated();
    await celebrateBadges(toast);
  };

  const toggleDay = async (d: string) => {
    if (busyDate) return;
    setBusyDate(d);
    try {
      await toggleHabit(h.id, d);
      await refresh();
      toast('Jour mis à jour');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusyDate(null);
    }
  };

  const saveDay = async (d: string) => {
    if (busyDate) return;
    const { value, note } = draft(d);
    setBusyDate(d);
    try {
      if (isAmount) {
        const val = Number(value);
        if (value.trim() !== '' && (!Number.isFinite(val) || val < 0)) {
          toast('Valeur invalide', 'error');
          return;
        }
        if (val === 0 && hasRow(d)) {
          await toggleHabit(h.id, d);
        } else {
          await recordHabit(h.id, d, val, note || null);
        }
      } else {
        if (!hasRow(d)) {
          await toggleHabit(h.id, d);
        }
        await updateCompletionNote(h.id, d, note || null);
      }
      await refresh();
      toast('Enregistré');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusyDate(null);
    }
  };

  return (
    <Modal title={h.name} onClose={onClose} width={560}>
      <p className="confirm-message">
        <span className="row-emoji"><HabitIcon emoji={h.emoji} size={18} fallback={h.name.charAt(0)} /></span>
        Journal des 14 derniers jours — tu peux modifier les jours passés.
      </p>
      <div className="log-list">
        {days.map((d) => {
          const note = draft(d.date).note;
          const value = draft(d.date).value;
          const on = hasRow(d.date);
          const reached = isAmount && goal != null && Number(value) >= goal;
          return (
            <div className={`log-row ${on ? 'has' : ''}`} key={d.date}>
              <div className="log-date">
                <b>{d.isToday ? "Aujourd'hui" : relativeDayLabel(d.date)}</b>
                <small>{shortDate(d.date)}</small>
              </div>

              {isAmount ? (
                <div className="log-value">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={value}
                    placeholder="0"
                    onChange={(e) => setDraft(d.date, { value: e.target.value })}
                    aria-label={`Valeur du ${d.date}`}
                  />
                  {unit && <small>{unit}</small>}
                  {on && <span className={`badge-pill ${reached ? 'ok' : 'wait'}`}>{reached ? `objectif` : 'en cours'}</span>}
                </div>
              ) : (
                <button
                  className={`mini-toggle ${on ? 'on' : ''}`}
                  style={on ? { background: h.color, borderColor: h.color } : undefined}
                  onClick={() => toggleDay(d.date)}
                  aria-label={on ? 'Décocher' : 'Cocher'}
                  disabled={busyDate === d.date}
                >
                  {on && <CheckIcon size={13} />}
                </button>
              )}

              <div className="log-note">
                <input
                  value={note}
                  maxLength={280}
                  placeholder="Note…"
                  onChange={(e) => setDraft(d.date, { note: e.target.value })}
                  aria-label={`Note du ${d.date}`}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => saveDay(d.date)} disabled={busyDate === d.date}>
                  {busyDate === d.date ? '…' : 'OK'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  );
}