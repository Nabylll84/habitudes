import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchBadgesWithProgress, awardBadges } from '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Skeleton } from '@/components/ui';
import { badgeIcon } from '@/lib/badges';

type BadgeRow = Awaited<ReturnType<typeof fetchBadgesWithProgress>>[number];

export default function Badges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setBadges(await fetchBadgesWithProgress(user.id));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);
  useRealtime('user_badges', 'user_id', user?.id, load);

  const check = async () => {
    setChecking(true);
    try {
      const newly = await awardBadges();
      if (newly.length > 0) toast(`Badge débloqué : ${newly.join(', ')}`);
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setChecking(false);
    }
  };

  const earned = badges?.filter((b) => b.earned).length ?? 0;
  const total = badges?.length ?? 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Motivation</p>
          <h1>Trophées</h1>
          <p className="muted">
            {total > 0 ? `${earned}/${total} badges débloqués` : 'Débloque des badges en tenant tes habitudes.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={check} disabled={checking}>
          {checking ? '…' : 'Vérifier mes badges'}
        </button>
      </header>

      {badges === null ? (
        <div className="badge-grid"><Skeleton h={150} /><Skeleton h={150} /><Skeleton h={150} /></div>
      ) : (
        <div className="badge-grid">
          {badges.map((b) => (
            <div key={b.id} className={`badge-card ${b.earned ? 'earned' : 'locked'}`}>
              <span className="badge-ico">{badgeIcon(b.icon_key, 30)}</span>
              <strong>{b.name}</strong>
              <p>{b.description}</p>
              {b.earned
                ? <span className="badge-earned-at">Obtenu{b.earned_at ? ` le ${b.earned_at.slice(0, 10)}` : ''}</span>
                : <span className="badge-lock">À débloquer</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}