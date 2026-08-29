import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchOwnHabits } from '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Ring, Skeleton, EmptyState } from '@/components/ui';
import { Heatmap } from '@/components/Heatmap';
import { HabitIcon, FireIcon, ChartIcon } from '@/lib/icons';
import type { HabitState } from '@/lib/types';
import { lastDays, relativeDayLabel, weekdayLabel, toISO, offsetDate } from '@/lib/dates';

export default function Stats() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [habits, setHabits] = useState<HabitState[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setHabits(await fetchOwnHabits(user.id));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);
  useRealtime('completions', 'user_id', user?.id, load);
  useRealtime('habits', 'user_id', user?.id, load);

  const stats = useMemo(() => {
    if (!habits) return null;
    const allTotal = habits.reduce((s, h) => s + h.dates.size, 0);
    const bestStreak = habits.reduce((s, h) => Math.max(s, h.streak), 0);
    const doneToday = habits.filter((h) => h.doneToday).length;
    const success = habits.length ? doneToday / habits.length : 0;

    // complétion moyenne par jour sur 14 jours (% des habitudes cochées par jour)
    const days14 = lastDays(14).map((d) => {
      const done = habits.filter((h) => h.dates.has(d)).length;
      return { date: d, count: habits.length ? Math.round((done / habits.length) * 100) : 0 };
    });

    // heatmap : nb de coches par jour sur 30 jours
    const last30 = lastDays(30).map((d) => ({
      date: d,
      count: habits.filter((h) => h.dates.has(d)).length,
    }));

    return { allTotal, bestStreak, doneToday, success, days14, last30 };
  }, [habits]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Bilan personnel</p>
          <h1>Statistiques</h1>
          <p className="muted">Ta progression, jour par jour.</p>
        </div>
        {stats && habits && habits.length > 0 && <Ring value={stats.success} />}
      </header>

      {habits === null ? (
        <>
          <Skeleton h={120} /><Skeleton h={240} />
        </>
      ) : habits.length === 0 ? (
        <EmptyState icon={<ChartIcon size={40} />} title="Pas encore de données" text="Crée une habitude et coche quelques jours pour voir tes stats." />
      ) : stats ? (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-num">{stats.allTotal}</span>
              <span className="stat-label">coches au total</span>
            </div>
            <div className="stat-card">
              <div className="stat-fire"><FireIcon size={22} /><span className="stat-num">{stats.bestStreak}</span></div>
              <span className="stat-label">meilleure série</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{stats.doneToday}/{habits.length}</span>
              <span className="stat-label">faits aujourd'hui</span>
            </div>
          </div>

          <h2 className="section-title">Taux de réussite — 14 derniers jours</h2>
          <div className="bars14">
            {stats.days14.map((d) => (
              <div key={d.date} className="bar-col" title={`${relativeDayLabel(d.date)} : ${d.count}%`}>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${d.count}%` }} />
                </div>
                <small>{d.date === toISO(offsetDate(0)) ? 'Auj.' : weekdayLabel(d.date)}</small>
              </div>
            ))}
          </div>

          <h2 className="section-title">Volume de coches — 30 derniers jours</h2>
          <Heatmap days={stats.last30} maxCount={Math.max(habits.length, 1)} />

          <h2 className="section-title">Détail par habitude</h2>
          <div className="table-card">
            {habits.map((h) => (
              <div className="table-row" key={h.habit.id}>
                <span className="cell-name">
                  <span className="row-emoji"><HabitIcon emoji={h.habit.emoji} size={22} fallback={h.habit.name.charAt(0)} /></span>
                  <span>{h.habit.name}</span>
                </span>
                <span className="cell-streak"><FireIcon size={14} /> {h.streak}</span>
                <span className="cell-total">
                  <b>{h.dates.size}</b> <span className="muted">coches</span>
                </span>
                <span className="cell-bar">
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.min(100, (h.dates.size / 90) * 100)}%` }} />
                  </div>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}