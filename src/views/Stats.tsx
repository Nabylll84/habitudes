import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchOwnHabits, fetchCompletions } from '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Ring, Skeleton, EmptyState } from '@/components/ui';
import { Heatmap } from '@/components/Heatmap';
import { HabitIcon, FireIcon, ChartIcon, DownloadIcon } from '@/lib/icons';
import type { HabitState, HabitCompletion } from '@/lib/types';
import { lastDays, relativeDayLabel, weekdayLabel, toISO, offsetDate, isScheduledOn, todayISO } from '@/lib/dates';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Stats() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [habits, setHabits] = useState<HabitState[] | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);

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

    const days14 = lastDays(14).map((d) => {
      const done = habits.filter((h) => h.dates.has(d)).length;
      return { date: d, count: habits.length ? Math.round((done / habits.length) * 100) : 0 };
    });

    const last30 = lastDays(30).map((d) => ({
      date: d,
      count: habits.filter((h) => h.dates.has(d)).length,
    }));

    const window30 = lastDays(30);
    const byHabit = habits.map((h) => {
      const scheduled = window30.filter((d) => isScheduledOn(h.habit, d));
      const done = scheduled.filter((d) => h.dates.has(d)).length;
      const rate = scheduled.length ? done / scheduled.length : 0;
      return { hs: h, rate, done, scheduled: scheduled.length };
    });

    return { allTotal, bestStreak, doneToday, success, days14, last30, byHabit };
  }, [habits]);

  const doExport = async (kind: 'csv' | 'json') => {
    if (!user || !habits) return;
    setExporting(kind);
    try {
      const comps = await fetchCompletions(user.id);
      const name = (id: string) => habits.find((h) => h.habit.id === id)?.habit.name ?? id;
      if (kind === 'json') {
        download(
          `habitflow-${todayISO()}.json`,
          JSON.stringify({ exportedAt: new Date().toISOString(), habits: habits.map((h) => h.habit), completions: comps }, null, 2),
          'application/json',
        );
      } else {
        const rows = comps.map((c: HabitCompletion) => [
          name(c.habit_id),
          c.date,
          c.value,
          (c.note ?? '').replace(/"/g, '""'),
        ]);
        const csv = [
          'Habitude;Date;Valeur;Note',
          ...rows.map((r) => r.map((x) => `"${x}"`).join(';')),
        ].join('\n');
        download(`habitflow-${todayISO()}.csv`, csv, 'text/csv');
      }
      toast('Export téléchargé');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Bilan personnel</p>
          <h1>Statistiques</h1>
          <p className="muted">Ta progression, jour par jour.</p>
        </div>
        {stats && habits && habits.length > 0 && (
          <div className="head-actions">
            <Ring value={stats.success} />
            <div className="export-row">
              <button className="btn btn-ghost btn-sm" onClick={() => doExport('csv')} disabled={exporting !== null}>
                <DownloadIcon size={14} /> {exporting === 'csv' ? '…' : 'CSV'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => doExport('json')} disabled={exporting !== null}>
                <DownloadIcon size={14} /> {exporting === 'json' ? '…' : 'JSON'}
              </button>
            </div>
          </div>
        )}
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
              <span className="stat-label">validations au total</span>
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

          <h2 className="section-title">Volume de validations — 30 derniers jours</h2>
          <Heatmap days={stats.last30} maxCount={Math.max(habits.length, 1)} />

          <h2 className="section-title">Détail par habitude</h2>
          <div className="table-card">
            {stats.byHabit.map(({ hs, rate, done, scheduled }) => (
              <div className="table-row" key={hs.habit.id}>
                <span className="cell-name">
                  <span className="row-emoji"><HabitIcon emoji={hs.habit.emoji} size={22} fallback={hs.habit.name.charAt(0)} /></span>
                  <span>{hs.habit.name}</span>
                </span>
                <span className="cell-streak"><FireIcon size={14} /> {hs.streak}</span>
                <span className="cell-total">
                  <b>{hs.dates.size}</b> <span className="muted">validations</span>
                </span>
                <span className="cell-rate" title={`${done}/${scheduled} jours prévus sur 30`}>
                  {scheduled > 0 ? `${Math.round(rate * 100)}%` : '—'}
                </span>
                <span className="cell-bar">
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.round(rate * 100)}%` }} />
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