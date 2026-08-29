import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { fetchProfileView, removeFriend, areFriends } from '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Avatar, Skeleton, EmptyState } from '@/components/ui';
import { Heatmap } from '@/components/Heatmap';
import { ProfileHabitCard } from '@/components/HabitCard';
import { Confirm } from '@/components/Modal';
import { ChatModal } from '@/components/ChatModal';
import type { ProfileView } from '@/lib/types';
import { shortDate } from '@/lib/dates';

export default function FriendProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState<ProfileView | null>(null);
  const [canView, setCanView] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const v = await fetchProfileView(id);
      const isFriend = v.isSelf || (await areFriends(user.id, id));
      setView(v);
      setCanView(isFriend);
    } catch {
      setCanView(false);
    }
  }, [user, id]);

  useEffect(() => { load(); }, [load]);
  useRealtime('completions', 'user_id', id, load);
  useRealtime('habits', 'user_id', id, load);

  const onRemove = async () => {
    if (!user || !id) return;
    try {
      await removeFriend(user.id, id);
      toast('Ami retiré');
      navigate('/amis');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (!view) {
    return (
      <div className="page">
        <Skeleton h={260} />
        <Skeleton h={200} />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="page">
        <EmptyState
          emoji="🔒"
          title="Profil privé"
          text="Vous devez être amis pour voir les habitudes de cet utilisateur."
        />
        <div className="center-row">
          <Link className="btn btn-primary" to="/amis">Retour aux amis</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>← Retour</button>

      <div className="profile-header">
        <Avatar profile={view.profile} size={72} />
        <div>
          <h1>@{view.profile.username}</h1>
          <p className="muted">
            {view.isSelf ? 'Ce profil est le vôtre' : 'Ami'} · inscrit le {shortDate(view.profile.created_at.slice(0, 10))}
          </p>
        </div>
        {!view.isSelf && view.profile && (
          <div className="profile-actions">
            <button className="btn btn-primary" onClick={() => setChatOpen(true)}>💬 Discuter</button>
            <button className="btn btn-ghost" onClick={() => setConfirmRemove(true)}>Retirer l'ami</button>
          </div>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-num">{view.totalCompletions}</span>
          <span className="stat-label">coches au total</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{view.weekTotal}</span>
          <span className="stat-label">cette semaine</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{view.habits.reduce((s, h) => s + h.streak, 0)}</span>
          <span className="stat-label">jours de streak</span>
        </div>
      </div>

      <h2 className="section-title">30 derniers jours</h2>
      <Heatmap days={view.last30} />

      <h2 className="section-title">Habitudes ({view.habits.length})</h2>
      {view.habits.length === 0 ? (
        <p className="muted">Aucune habitude partagée pour l'instant.</p>
      ) : (
        <div className="card-grid">
          {view.habits.map((h) => (
            <ProfileHabitCard key={h.id} habit={h} />
          ))}
        </div>
      )}

      {confirmRemove && view.profile && (
        <Confirm
          title="Retirer cet ami ?"
          message={`@${view.profile.username} ne verra plus vos habitudes, et inversement.`}
          danger
          confirmLabel="Retirer"
          onConfirm={onRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}

      {chatOpen && view.profile && (
        <ChatModal peer={view.profile} onClose={() => setChatOpen(false)} />
      )}
    </div>
  );
}