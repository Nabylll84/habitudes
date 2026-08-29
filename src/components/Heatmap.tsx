type CS = import('react').CSSProperties;

export function Heatmap({ days, maxCount }: { days: { date: string; count: number }[]; maxCount?: number }) {
  const max = maxCount ?? Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="heatmap" role="img" aria-label="Progression des 30 derniers jours">
      {days.map((d) => {
        const alpha = d.count === 0 ? 0 : Math.max(0.22, d.count / max);
        return (
          <span
            key={d.date}
            className="heat-cell"
            style={{ '--a': alpha } as CS}
            title={`${d.date} — ${d.count} habitude${d.count > 1 ? 's' : ''}`}
          />
        );
      })}
    </div>
  );
}

export function SparkBars({ counts, maxCount }: { counts: { date: string; count: number }[]; maxCount: number }) {
  const max = Math.max(1, maxCount);
  return (
    <div className="sparkbars">
      {counts.map((d) => (
        <div key={d.date} className="spark-col" title={`${d.date} — ${d.count} habitude${d.count > 1 ? 's' : ''}`}>
          <span
            className="spark-bar"
            style={{ '--h': `${Math.round((d.count / max) * 100)}%`, background: 'var(--accent)' } as CS}
          />
          <small>{new Date(`${d.date}T00:00:00`).getDate()}</small>
        </div>
      ))}
    </div>
  );
}