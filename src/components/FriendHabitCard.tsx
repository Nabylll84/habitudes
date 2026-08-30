import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { HabitIcon, FireIcon, CheckIcon, PlusIcon } from '@/lib/icons';
import { REACTION_KEYS, REACTION_ICONS, REACTION_LABELS } from '@/lib/badges';
import type { Reaction } from '@/lib/types';

export function FriendHabitCard({
  habit,
  uid,
  reactions = [],
  onReact,
  onUnreact,
}: {
  habit: { id: string; name: string; emoji: string; color: string; doneToday: boolean; streak: number };
  uid: string;
  reactions?: Reaction[];
  onReact: (key: string) => void;
  onUnreact: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const mine = reactions.find((r) => r.from_id === uid);

  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reactions) m.set(r.emoji_key, (m.get(r.emoji_key) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [reactions]);

  return (
    <div className={`habit-card done ${habit.doneToday ? 'done-friend' : ''}`} style={{ '--c': habit.color } as CSSProperties}>
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

      <div className="reaction-bar">
        {groups.map(([key, count]) => (
          <button
            key={key}
            className={`reaction-chip ${mine?.emoji_key === key ? 'mine' : ''}`}
            title={`${REACTION_LABELS[key] ?? key} · ${count}`}
            onClick={() => (mine?.emoji_key === key ? onUnreact() : onReact(key))}
          >
            {REACTION_ICONS[key]?.({ size: 14 })}
            <small>{count}</small>
          </button>
        ))}
        {groups.length === 0 && !picker && <small className="reaction-empty">Soutiens-le !</small>}
        <button className="reaction-add" onClick={() => setPicker((v) => !v)} aria-label="Réagir">
          <PlusIcon size={14} />
        </button>
        {picker && (
          <div className="reaction-picker">
            {REACTION_KEYS.map((k) => (
              <button
                key={k}
                className={`reaction-opt ${mine?.emoji_key === k ? 'mine' : ''}`}
                title={REACTION_LABELS[k]}
                onClick={() => {
                  onReact(k);
                  setPicker(false);
                }}
              >
                {REACTION_ICONS[k]?.({ size: 16 })}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}