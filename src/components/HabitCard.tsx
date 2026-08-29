import React, { useState } from 'react';
import type { HabitState } from '@/lib/types';
import { relativeDayLabel, weekdayLabel, dayNumber, lastDays } from '@/lib/dates';
import { HabitIcon, FireIcon, CheckIcon } from '@/lib/icons';

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

export function ToggleHabitCard({
  habit,
  onToggle,
  interactive = true,
}: {
  habit: HabitState;
  onToggle?: (h: HabitState) => Promise<void>;
  interactive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const { habit: h, dates, doneToday, streak } = habit;
  const week = lastDays(7).map((d) => ({ date: d, on: dates.has(d), label: weekdayLabel(d), num: dayNumber(d) }));

  const handle = async () => {
    if (!interactive || busy || !onToggle) return;
    setBusy(true);
    try {
      await onToggle(habit);
      if (!doneToday) setBurstKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`habit-card ${doneToday ? 'done' : ''}`} style={{ '--c': h.color } as React.CSSProperties}>
      <div className="card-glow" style={{ background: h.color }} />
      <div className="habit-top">
        <span className="habit-emoji"><HabitIcon emoji={h.emoji} size={24} fallback={h.name.charAt(0)} /></span>
        <div className="habit-title">
          <strong>{h.name}</strong>
          <span className="habit-streak"><FireIcon size={13} /> {streak} jour{streak > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="week-dots">
        {week.map((d) => (
          <div key={d.date} className={`wdot ${d.on ? 'on' : ''}`} title={`${relativeDayLabel(d.date)} — ${d.on ? 'fait' : 'à faire'}`}>
            <span className="wdot-dot" style={d.on ? { background: h.color } : undefined} />
            <small>{d.label}</small>
          </div>
        ))}
      </div>

      <button
        className={`check-btn ${doneToday ? 'checked' : ''}`}
        style={doneToday ? { background: h.color, borderColor: h.color } : undefined}
        onClick={handle}
        disabled={busy}
        aria-label={doneToday ? 'Décocher' : 'Cocher'}
        aria-pressed={doneToday}
      >
        {doneToday ? <CheckIcon size={26} /> : ''}
        {burstKey > 0 && doneToday && <Burst key={burstKey} />}
      </button>
    </div>
  );
}

export function ProfileHabitCard({ habit }: { habit: { name: string; emoji: string; color: string; doneToday: boolean; streak: number } }) {
  return (
    <div className={`habit-card done ${habit.doneToday ? 'done-friend' : ''}`} style={{ '--c': habit.color } as React.CSSProperties}>
      <div className="card-glow" style={{ background: habit.color }} />
      <div className="habit-top">
        <span className="habit-emoji"><HabitIcon emoji={habit.emoji} size={24} fallback={habit.name.charAt(0)} /></span>
        <div className="habit-title">
          <strong>{habit.name}</strong>
          <span className="habit-streak"><FireIcon size={13} /> {habit.streak} jour{habit.streak > 1 ? 's' : ''}</span>
        </div>
      </div>
      <span className={`badge-pill ${habit.doneToday ? 'ok' : 'wait'}`}>
        {habit.doneToday ? (<><CheckIcon size={12} /> Fait aujourd'hui</>) : 'Pas encore fait'}
      </span>
    </div>
  );
}