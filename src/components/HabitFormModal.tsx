import { useState } from 'react';
import { createHabit, updateHabit } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { HabitIcon, PinIcon, UsersIcon, HourglassIcon, SendIcon, CalendarIcon, InfoIcon } from '@/lib/icons';
import { COLORS } from '@/lib/types';
import { HABIT_ICONS } from '@/lib/icons';
import { todayISO } from '@/lib/dates';
import type { Habit, FrequencyType, TrackingType } from '@/lib/types';

const WEEK_CHIPS: { iso: number; label: string }[] = [
  { iso: 1, label: 'L' },
  { iso: 2, label: 'M' },
  { iso: 3, label: 'M' },
  { iso: 4, label: 'J' },
  { iso: 5, label: 'V' },
  { iso: 6, label: 'S' },
  { iso: 7, label: 'D' },
];

const FREQUENCIES: { value: FrequencyType; label: string }[] = [
  { value: 'daily', label: 'Tous les jours' },
  { value: 'weekdays', label: 'Certains jours' },
  { value: 'weekly', label: 'X fois par semaine' },
  { value: 'challenge', label: 'Défi (21 ou 30 j)' },
];

const FREQ_HINTS: Record<FrequencyType, string> = {
  daily: 'L\u2019habitude se coche chaque jour.',
  weekdays: 'Seulement aux jours sélectionnés.',
  weekly: 'Objectif souple : X fois par semaine, à ton rythme.',
  challenge: 'Un objectif borné dans le temps : 21 ou 30 jours.',
};

export function HabitFormModal({
  uid,
  editing,
  nextSort = 0,
  onClose,
  onSaved,
}: {
  uid: string;
  editing: Habit | null;
  nextSort?: number;
  onClose: () => void;
  onSaved: (habit: Habit, isNew: boolean) => void | Promise<void>;
}) {
  const { toast } = useToast();
  const init = (): {
    name: string; emoji: string; color: string;
    tracking: TrackingType; goal: string; unit: string;
    freq: FrequencyType; weekdays: number[]; times: number; challengeDays: number;
    category: string; pinned: boolean; visible: boolean; freezes: number;
    remind: boolean; remindTime: string;
  } => ({
    name: editing?.name ?? '',
    emoji: editing?.emoji ?? HABIT_ICONS[0],
    color: editing?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
    tracking: editing?.tracking_type ?? 'binary',
    goal: editing?.goal_amount != null ? String(editing.goal_amount) : '',
    unit: editing?.goal_unit ?? '',
    freq: editing?.frequency_type ?? 'daily',
    weekdays: editing?.weekdays ?? [],
    times: editing?.times_per_week ?? 3,
    challengeDays: editing?.challenge_days ?? 21,
    category: editing?.category ?? '',
    pinned: editing?.pinned ?? false,
    visible: editing?.visible_shared ?? true,
    freezes: editing?.streak_freezes ?? 0,
    remind: editing?.reminder_enabled ?? false,
    remindTime: editing?.reminder_time?.slice(0, 5) ?? '08:30',
  });

  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const toggleWeekday = (iso: number) => {
    const on = f.weekdays.includes(iso);
    set('weekdays', on ? f.weekdays.filter((d) => d !== iso) : [...f.weekdays, iso].sort());
  };

  const save = async () => {
    const name = f.name.trim();
    if (!name) { toast('Nom obligatoire', 'error'); return; }
    if (name.length > 60) { toast('Nom trop long (60 max)', 'error'); return; }
    let goal: number | null = null;
    if (f.tracking === 'amount') {
      goal = Number(f.goal);
      if (!Number.isFinite(goal) || goal <= 0) { toast('Objectif invalide (nombre positif)', 'error'); return; }
    }
    if (f.freq === 'weekdays' && f.weekdays.length === 0) { toast('Choisis au moins un jour', 'error'); return; }

    const base = { name, emoji: f.emoji, color: f.color };
    const patch: Partial<Habit> = {
      tracking_type: f.tracking,
      goal_amount: goal,
      goal_unit: f.tracking === 'amount' && f.unit.trim() ? f.unit.trim() : null,
      frequency_type: f.freq,
      weekdays: f.freq === 'weekdays' ? f.weekdays : null,
      times_per_week: f.freq === 'weekly' ? f.times : null,
      challenge_days: f.freq === 'challenge' ? f.challengeDays : null,
      start_on: f.freq === 'challenge' ? editing?.start_on ?? todayISO() : null,
      category: f.category.trim() ? f.category.trim() : null,
      pinned: f.pinned,
      visible_shared: f.visible,
      streak_freezes: f.freezes,
      reminder_enabled: f.remind,
      reminder_time: f.remind && f.remindTime ? `${f.remindTime}:00` : null,
      reminder_days: null,
    };

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateHabit(editing.id, { ...base, ...patch });
        await onSaved(updated, false);
        toast('Habitude modifiée');
      } else {
        const created = await createHabit(uid, { ...base, ...patch, sort_order: nextSort });
        await onSaved(created.habit, true);
        toast('Habitude créée');
      }
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? "Modifier l'habitude" : 'Nouvelle habitude'} onClose={onClose} width={560}>
      <div className="form-grid">
        <label className="field form-span-2">
          <span>Nom</span>
          <div className="lead-input">
            <button
              type="button"
              className="lead-emoji"
              style={{ background: `color-mix(in srgb, ${f.color} 16%, var(--surface))`, color: f.color }}
              onClick={() => {
                const key = f.emoji as (typeof HABIT_ICONS)[number];
                const next = HABIT_ICONS[(HABIT_ICONS.indexOf(key) + 1) % HABIT_ICONS.length];
                set('emoji', next);
              }}
              aria-label="Changer d'icône"
              title="Changer d'icône"
            >
              <HabitIcon emoji={f.emoji} size={20} />
            </button>
            <input
              autoFocus
              value={f.name}
              maxLength={60}
              placeholder="Ex : Boire de l'eau, Lire 20 min…"
              onChange={(e) => set('name', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
          </div>
        </label>

        <label className="field form-span-2">
          <span>Icône</span>
          <div className="emoji-grid">
            {HABIT_ICONS.map((k) => (
              <button
                type="button"
                key={k}
                className={`emoji-opt ${k === f.emoji ? 'selected' : ''}`}
                onClick={() => set('emoji', k)}
                aria-label={k}
              >
                <HabitIcon emoji={k} size={22} />
              </button>
            ))}
          </div>
        </label>

        <label className="field form-span-2">
          <span>Couleur</span>
          <div className="color-grid">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-swatch ${c === f.color ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => set('color', c)}
                aria-label={c}
              />
            ))}
          </div>
        </label>

        <div className="field form-span-2">
          <span>Mode de suivi</span>
          <div className="seg">
            <button type="button" className={`seg-btn ${f.tracking === 'binary' ? 'active' : ''}`} onClick={() => set('tracking', 'binary')}>
              Cocher (fait / pas fait)
            </button>
            <button type="button" className={`seg-btn ${f.tracking === 'amount' ? 'active' : ''}`} onClick={() => set('tracking', 'amount')}>
              Compteur (objectif)
            </button>
          </div>
        </div>

        {f.tracking === 'amount' && (
          <div className="form-grid-inline form-span-2">
            <label className="field">
              <span>Objectif / jour</span>
              <input
                type="number"
                min={0}
                step="any"
                value={f.goal}
                inputMode="decimal"
                placeholder="Ex : 8"
                onChange={(e) => set('goal', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Unité <small>(optionnel)</small></span>
              <input
                value={f.unit}
                maxLength={20}
                placeholder="Ex : verres"
                onChange={(e) => set('unit', e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="field form-span-2">
          <span>Fréquence</span>
          <div className="radio-row">
            {FREQUENCIES.map((fq) => (
              <button
                type="button"
                key={fq.value}
                className={`chip ${f.freq === fq.value ? 'on' : ''}`}
                onClick={() => set('freq', fq.value)}
              >
                {fq.label}
              </button>
            ))}
          </div>
          <small className="field-hint"><InfoIcon size={12} /> {FREQ_HINTS[f.freq]}</small>
        </div>

        {f.freq === 'weekdays' && (
          <div className="field form-span-2">
            <span>Jours de la semaine</span>
            <div className="week-chips">
              {WEEK_CHIPS.map((w) => (
                <button
                  type="button"
                  key={w.iso}
                  className={`chip wchip ${f.weekdays.includes(w.iso) ? 'on' : ''}`}
                  onClick={() => toggleWeekday(w.iso)}
                  aria-label={`Jour ${w.iso}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {f.freq === 'weekly' && (
          <label className="field form-span-2">
            <span>Nombre de fois par semaine</span>
            <div className="stepper-row">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  type="button"
                  key={n}
                  className={`chip wchip ${f.times === n ? 'on' : ''}`}
                  onClick={() => set('times', n)}
                >
                  {n}×
                </button>
              ))}
            </div>
          </label>
        )}

        {f.freq === 'challenge' && (
          <label className="field form-span-2">
            <span>Durée du défi</span>
            <div className="stepper-row">
              {[21, 30].map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`chip wchip ${f.challengeDays === d ? 'on' : ''}`}
                  onClick={() => set('challengeDays', d)}
                >
                  {d} jours
                </button>
              ))}
            </div>
          </label>
        )}

        <label className="field form-span-2">
          <span>Catégorie <small>(optionnel)</small></span>
          <input
            value={f.category}
            maxLength={30}
            placeholder="Ex : Santé, Sport, Travail…"
            onChange={(e) => set('category', e.target.value)}
          />
        </label>

        <div className="field form-span-2">
          <span>Options</span>
          <div className="opt-list">
            <label className="opt-row">
              <span><PinIcon size={14} /> Épingler en haut</span>
              <input type="checkbox" checked={f.pinned} onChange={(e) => set('pinned', e.target.checked)} />
            </label>
            <label className="opt-row">
              <span><UsersIcon size={14} /> Visible par mes amis</span>
              <input type="checkbox" checked={f.visible} onChange={(e) => set('visible', e.target.checked)} />
            </label>
            <div className="opt-row">
              <span><HourglassIcon size={14} /> Jokers (protègent la série)</span>
              <select value={f.freezes} onChange={(e) => set('freezes', Number(e.target.value))} className="mini-select">
                {[0, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="opt-row">
              <span><SendIcon size={14} /> Rappel par email</span>
              <input type="checkbox" checked={f.remind} onChange={(e) => set('remind', e.target.checked)} />
            </div>
            {f.remind && (
              <div className="opt-row">
                <span><CalendarIcon size={14} /> À quelle heure ?</span>
                <input type="time" value={f.remindTime} onChange={(e) => set('remindTime', e.target.value)} className="mini-time" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? '…' : editing ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </Modal>
  );
}