import type { Habit, HabitState } from './types';
import { computeHabitStreak, todayISO } from './dates';

/** Applique un toggle localement sans attendre le serveur (UI instantanée). */
export function flipHabit(list: HabitState[], habit: Habit, date: string, on: boolean): HabitState[] {
  const today = todayISO();
  return list.map((h) => {
    if (h.habit.id !== habit.id) return h;
    const dates = new Set(h.dates);
    if (on) dates.add(date);
    else dates.delete(date);
    return { ...h, dates, doneToday: dates.has(today), streak: computeHabitStreak(habit, dates).streak };
  });
}

/** Met à jour localement une valeur de compteur (habitude "amount"). */
export function setHabitValue(list: HabitState[], habitId: string, date: string, value: number, note?: string | null): HabitState[] {
  const today = todayISO();
  return list.map((h) => {
    if (h.habit.id !== habitId) return h;
    const values = new Map(h.values ?? []);
    if (value > 0) values.set(date, { value, note: note === undefined ? (values.get(date)?.note ?? null) : note });
    else values.delete(date);
    const habit = h.habit;
    const isAmount = habit.tracking_type === 'amount';
    const done = (d: string) => {
      const v = values.get(d);
      if (!v) return false;
      if (isAmount) {
        const goal = habit.goal_amount ?? null;
        return goal == null ? v.value > 0 : v.value >= goal;
      }
      return true;
    };
    const dates = new Set<string>([...values.keys()].filter((d) => done(d)));
    return { ...h, values, dates, doneToday: dates.has(today), streak: computeHabitStreak(habit, dates).streak };
  });
}