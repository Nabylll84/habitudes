import type { HabitState } from './types';
import { computeStreak, todayISO } from './dates';

/** Applique un toggle localement sans attendre le serveur (UI instantanée). */
export function flipHabit(list: HabitState[], habitId: string, date: string, on: boolean): HabitState[] {
  const today = todayISO();
  return list.map((h) => {
    if (h.habit.id !== habitId) return h;
    const dates = new Set(h.dates);
    if (on) dates.add(date);
    else dates.delete(date);
    return { ...h, dates, doneToday: dates.has(today), streak: computeStreak(dates) };
  });
}

export function toggleInList(list: HabitState[], habitId: string): HabitState[] {
  const h = list.find((x) => x.habit.id === habitId);
  return h ? flipHabit(list, habitId, todayISO(), !h.doneToday) : list;
}