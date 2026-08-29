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