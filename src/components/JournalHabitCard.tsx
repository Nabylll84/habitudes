import React, { useState } from 'react';
import type { HabitState } from '@/lib/types';
import { relativeDayLabel, weekdayLabel, dayNumber, lastDays, todayISO, freqSummary } from '@/lib/dates';
import { HabitIcon, FireIcon, CheckIcon, PlusIcon, MinusIcon, PencilIcon } from '@/lib/icons';
import { useToast } from '@/components/Toast';
import { celebrateBadges } from '@/lib/badges';

const BURST_COLORS = ['#6366f1', '#a855f7', '#22d3ee', '#34d399', '#fbbf24', '#f472b6'];

function Burst() {
  return (
    <div className="burst">
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} style={{ '--i': i, background: BURST_COLORS[i % BURST_COLORS.length] } as React.CSSProperties} />
      ))}
    </div>
  );
}

export function JournalHabitCard({
  habit,
  onToggleDay,
  onRecordValue,
  onOpenLog,
}: {
  habit: HabitState;
  onToggleDay: (h: HabitState) => Promise<void>;
  onRecordValue: (h: HabitState, date: string, value: number, note?: string | null) => Promise<void>;
  onOpenLog: (h: HabitState) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const h = habit.habit;
  const isAmount = h.tracking_type === 'amount';
  const today = todayISO();
  const week = lastDays(7).map((d) => ({ date: d, on: habit.dates.has(d), label: weekdayLabel(d), num: dayNumber(d) }));

  const cur = habit.values?.get(today)?.value ?? 0;
  const goal = h.goal_amount ?? null;
  const unit = h.goal_unit ?? '';
  const reached = habit.doneToday;
  const pct = goal && goal > 0 ? Math.min(100, Math.round((cur / goal) * 100)) : cur > 0 ? 100 : 0;

  const celebrate = async () => {
    try {
      await celebrateBadges(toast);
    } catch { /* ignoré */ }
  };

  const handleToggle = async () => {
    if (busy) return;
    const was = reached;
    setBusy(true);
    try {
      await onToggleDay(habit);
      if (!was) {
        setBurstKey((k) => k + 1);
        await celebrate();
      }
    } finally {
      setBusy(false);
    }
  };

  const step = async (delta: number) => {
    if (busy) return;
    const was = reached;
    setBusy(true);
    try {
      await onRecordValue(habit, today, Math.max(0, cur + delta));
      if (!was && cur + delta > 0 && (goal == null || cur + delta >= goal)) {
        setBurstKey((k) => k + 1);
        await celebrate();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`habit-card ${reached ? 'done' : ''}`} style={{ '--c': h.color } as React.CSSProperties}>
      <div className="card-glow" style={{ background: h.color }} />
      <div className="habit-top">
        <span className="habit-emoji"><HabitIcon emoji={h.emoji} size={24} fallback={h.name.charAt(0)} /></span>
        <div className="habit-title">
          <strong>{h.name}</strong>
          <span className="habit-meta">
            <span className="habit-streak"><FireIcon size={13} /> {habit.streak} j</span>
            <span className="habit-freq">{freqSummary(h)}</span>
            {isAmount && goal != null && unit && (
              <span className="habit-goal">{goal} {unit}/jour</span>
            )}
            {(h.streak_freezes ?? 0) > 0 && <span className="habit-freezes">{h.streak_freezes} joker{(h.streak_freezes ?? 0) > 1 ? 's' : ''}</span>}
          </span>
        </div>
        <button className="icon-btn habit-log-btn" onClick={() => onOpenLog(habit)} title="Journal de la semaine" aria-label="Journal">
          <PencilIcon size={15} />
        </button>
      </div>

      <div className="week-dots">
        {week.map((d) => (
          <div key={d.date} className={`wdot ${d.on ? 'on' : ''}`} title={`${relativeDayLabel(d.date)} — ${d.on ? 'fait' : 'à faire'}`}>
            <span className="wdot-dot" style={d.on ? { background: h.color } : undefined} />
            <small>{d.label}</small>
          </div>
        ))}
      </div>

      {isAmount ? (
        <div className={`amount-area ${reached ? 'reached' : ''}`}>
          <div className="amount-progress">
            <div className="amount-fill" style={{ width: `${pct}%`, background: h.color }} />
          </div>
          <div className="amount-row">
            <button className="step-btn" onClick={() => step(-1)} disabled={busy || cur === 0} aria-label="Diminuer">
              <MinusIcon size={16} />
            </button>
            <span className="amount-value">
              <b>{cur}</b> {unit} <small>sur {goal}{goal != null && unit ? ` ${unit}` : ''}</small>
            </span>
            <button className="step-btn" onClick={() => step(1)} disabled={busy} aria-label="Ajouter une unité">
              <PlusIcon size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          className={`check-btn ${reached ? 'checked' : ''}`}
          style={reached ? { background: h.color, borderColor: h.color } : undefined}
          onClick={handleToggle}
          disabled={busy}
          aria-label={reached ? 'Décocher' : 'Cocher'}
          aria-pressed={reached}
        >
          {reached ? <CheckIcon size={26} /> : ''}
          {burstKey > 0 && reached && <Burst key={burstKey} />}
        </button>
      )}
    </div>
  );
}