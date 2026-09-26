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

/**
 * La semaine calendaire du lundi au dimanche (7 dates ISO, ordre croissant).
 * Contrairement à lastDays(), la fenêtre ne glisse pas : une colonne reste
 * toujours le même jour de la semaine.
 */
export function currentWeek(ref: Date = new Date()): string[] {
  return weekOf(toISO(ref));
}

/** Lundi → dimanche de la semaine contenant dateStr. */
export function weekOf(dateStr: string): string[] {
  const d = new Date(`${dateStr}T00:00:00`);
  const monday = new Date(d);
  monday.setDate(d.getDate() - (isoWeekDay(dateStr) - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return toISO(x);
  });
}

/** Les 6 semaines (42 jours) de la vue mois, lundi → dimanche. */
export function monthMatrix(dateStr: string): string[] {
  const d = new Date(`${dateStr}T00:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - (isoWeekDay(toISO(first)) - 1));
  return Array.from({ length: 42 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return toISO(x);
  });
}

/** Décale de n mois, en bornant le jour au dernier jour du mois cible. */
export function addMonths(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISO(d);
}

export function monthTitle(dateStr: string): string {
  const s = new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** La date ISO est-elle dans le futur (au-delà d'aujourd'hui) ? */
export function isFuture(dateStr: string): boolean {
  return dateStr > todayISO();
}

/** Bornes d'une journée locale (00:00:00.000 → 23:59:59.999), DST inclus. */
export function dayBounds(dayISO: string): { start: number; end: number } {
  const s = new Date(`${dayISO}T00:00:00`);
  const next = new Date(s);
  next.setDate(s.getDate() + 1);
  return { start: s.getTime(), end: next.getTime() - 1 };
}

/** L'événement couvre-t-il ce jour-là ? (true si la moindre minute est commune) */
export function occursOn(startsAt: string, endsAt: string, dayISO: string): boolean {
  const { start, end } = dayBounds(dayISO);
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  return s <= end && e >= start;
}

/** "09:30" → minutes depuis minuit. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes depuis minuit → "09:30". */
export function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Un instant ISO → "HH:30" heure locale. */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Un instant ISO → "AAAA-MM-JJTHH:30" (valeur d'un input datetime-local). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${toISO(d)}T${minutesToHHMM(d.getHours() * 60 + d.getMinutes())}`;
}

/** "AAAA-MM-JJTHH:30" (heure locale) → instant ISO. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
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