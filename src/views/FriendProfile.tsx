import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { fetchProfileView, removeFriend, areFriends, fetchReactions, reactToHabit, unreactHabit } from '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Avatar, Skeleton, EmptyState } from '@/components/ui';
import { Heatmap } from '@/components/Heatmap';
import { FriendHabitCard } from '@/components/FriendHabitCard';
import { Confirm } from '@/components/Modal';
import { ChatModal } from '@/components/ChatModal';
import { LockIcon, ArrowLeftIcon, ChatIcon } from '@/lib/icons';
import type { ProfileView, Reaction } from '@/lib/types';
import { shortDate } from '@/lib/dates';

function ReactionSub({ id, onEvent }: { id: string; onEvent: () => void }) {
  useRealtime('reactions', 'habit_id', id, onEvent);
  return null;
}

export default function FriendProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState<ProfileView | null>(null);
  const [canView, setCanView] = useState(true);
  const [reactions, setReactions] = useState<Map<string, Reaction[]>>(new Map());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const loadReactions = useCallback(async (habitIds: string[]) => {
    const entries = await Promise.all(habitIds.map(async (hid) => [hid, await fetchReactions(hid).catch(() => [] as Reaction[])] as const));
    setReactions(new Map(entries));
  }, []);

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const v = await fetchProfileView(id);
      const isFriend = v.isSelf || (await areFriends(user.id, id));
      setView(v);
      setCanView(isFriend);
      await loadReactions(v.habits.map((h) => h.id));
    } catch {
      setCanView(false);
    }
  }, [user, id, loadReactions]);

  useEffect(() => { load(); }, [load]);
  useRealtime('completions', 'user_id', id, load);
  useRealtime('habits', 'user_id', id, load);

  const afterMutation = async () => {
    if (view) await loadReactions(view.habits.map((h) => h.id));
  };

  const onReact = async (habitId: string, key: string) => {
    if (!user) return;
    try {
      await reactToHabit(user.id, habitId, key);
      await afterMutation();
      toast('Encouragement envoyé !');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const onUnreact = async (habitId: string) => {
    if (!user) return;
    try {
      await unreactHabit(user.id, habitId);
      await afterMutation();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

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
          icon={<LockIcon size={40} />}
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
      <button className="back-btn" onClick={() => navigate(-1)}><ArrowLeftIcon size={15} /> Retour</button>

      {view.habits.map((h) => (
        <ReactionSub key={h.id} id={h.id} onEvent={() => afterMutation()} />
      ))}

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
            <button className="btn btn-primary" onClick={() => setChatOpen(true)}><ChatIcon size={16} /> Discuter</button>
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
          {view.habits.map((h) => {
            const habit = {
              id: h.id,
              name: h.name,
              emoji: h.emoji,
              color: h.color,
              doneToday: h.doneToday,
              streak: h.streak,
            };
            return user ? (
              <FriendHabitCard
                key={h.id}
                habit={habit}
                uid={user.id}
                reactions={reactions.get(h.id) ?? []}
                onReact={(key) => onReact(h.id, key)}
                onUnreact={() => onUnreact(h.id)}
              />
            ) : null;
          })}
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