import type { Habit } from './types';

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function offsetDate(offsetDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}

export function todayISO(): string {
  return toISO(new Date());
}

/** Ajoute/soustrait n jours à une date ISO. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Les n derniers jours (hier inclus), du plus ancien au plus récent */
export function lastDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(toISO(offsetDate(-i)));
  return out;
}

export function computeStreak(dates: Set<string>): number {
  let streak = 0;
  const seen = new Set(dates);
  for (let i = 0; i < 1000; i++) {
    const day = toISO(offsetDate(-i));
    if (!seen.has(day)) break;
    streak++;
  }
  return streak;
}

/** Jour de semaine ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekDay(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
}

/** L'habitude est-elle censée être faite ce jour-là (fréquence) ? */
export function isScheduledOn(
  habit: Pick<Habit, 'frequency_type' | 'weekdays' | 'challenge_days' | 'start_on'>,
  dateStr: string,
): boolean {
  switch (habit.frequency_type) {
    case 'weekdays':
      return (habit.weekdays ?? []).includes(isoWeekDay(dateStr));
    case 'challenge': {
      if (!habit.start_on) return true;
      const end = addDays(habit.start_on, (habit.challenge_days ?? 21) - 1);
      return dateStr >= habit.start_on && dateStr <= end;
    }
    default:
      return true; // daily et weekly (flexible)
  }
}

/** Série en cours, en tenant compte des jokers (streak freezes). */
export function computeHabitStreak(
  habit: Pick<Habit, 'frequency_type' | 'weekdays' | 'challenge_days' | 'start_on' | 'streak_freezes'>,
  dates: Set<string>,
): { streak: number; freezesUsed: number } {
  const seen = new Set(dates);
  let freezes = Math.max(0, habit.streak_freezes ?? 0);
  let streak = 0;
  let used = 0;
  const today = todayISO();
  for (let i = seen.has(today) ? 0 : 1; i < 1000; i++) {
    const day = toISO(offsetDate(-i));
    if (!isScheduledOn(habit, day)) continue;
    if (seen.has(day)) {
      streak++;
      continue;
    }
    if (freezes > 0 && streak > 0) {
      freezes--;
      used++;
      streak++;
      continue;
    }
    break;
  }
  return { streak, freezesUsed: used };
}

/** Plus longue série jamais atteinte. */
export function maxStreakOfDays(dates: Set<string>): number {
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

const WEEK_SHORT = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Libellé court de la fréquence d'une habitude. */
export function freqSummary(habit: Pick<Habit, 'frequency_type' | 'weekdays' | 'times_per_week' | 'challenge_days'>): string {
  switch (habit.frequency_type) {
    case 'weekdays': {
      const days = habit.weekdays ?? [];
      if (days.length === 0) return 'Certains jours';
      return days.map((d) => WEEK_SHORT[d]?.slice(0, 2) ?? d).join('\u00b7');
    }
    case 'weekly':
      return `${habit.times_per_week ?? 3}\u00d7 / sem.`;
    case 'challenge':
      return `Défi ${habit.challenge_days ?? 21} j`;
    default:
      return 'Chaque jour';
  }
}

const WEEKDAYS_LABEL = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

export function weekdayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return WEEKDAYS_LABEL[d.getDay()];
}

export function shortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
}

export function relativeDayLabel(dateStr: string): string {
  const today = todayISO();
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === toISO(offsetDate(-1))) return 'Hier';
  return shortDate(dateStr);
}

export function longToday(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function dayNumber(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDate();
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}