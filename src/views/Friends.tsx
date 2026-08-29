import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import {
  fetchFriendOverview,
  fetchRequests,
  fetchRequestPreviews,
  searchProfiles,
  sendFriendRequest,
  cancelRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  areFriends,
  outgoingRequestId,
  incomingRequestId,
} from '@/lib/api';
import type { RequestPreview } from '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/components/Toast';
import { Avatar, EmptyState, Skeleton } from '@/components/ui';
import { Confirm } from '@/components/Modal';
import { ChatModal } from '@/components/ChatModal';
import { SearchIcon, HeartIcon, HourglassIcon, FireIcon, UsersIcon, ChatIcon, XIcon } from '@/lib/icons';
import type { FriendOverview, Profile } from '@/lib/types';

type Extra = { isFriend: boolean; outgoingId: string | null; incomingId: string | null };

export default function Friends() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<FriendOverview[] | null>(null);
  const [incoming, setIncoming] = useState<RequestPreview[]>([]);
  const [outgoing, setOutgoing] = useState<RequestPreview[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<(Profile & Extra)[] | null>(null);
  const [removing, setRemoving] = useState<FriendOverview | null>(null);
  const [chatPeer, setChatPeer] = useState<FriendOverview | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [f, r] = await Promise.all([
        fetchFriendOverview(user.id),
        fetchRequests(user.id).then((raw) => fetchRequestPreviews(raw.incoming, raw.outgoing)),
      ]);
      setFriends(f);
      setIncoming(r.incoming);
      setOutgoing(r.outgoing);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);
  useRealtime('completions', 'user_id', user?.id, load);

  const runSearch = useCallback(async (query: string) => {
    if (!user || !query.trim()) { setResults(null); return; }
    setBusy(true);
    try {
      const rows = await searchProfiles(query.trim(), user.id);
      const extra = await Promise.all(
        rows.map(async (p) => ({
          ...p,
          isFriend: await areFriends(user.id, p.id),
          outgoingId: await outgoingRequestId(user.id, p.id),
          incomingId: await incomingRequestId(user.id, p.id),
        }))
      );
      setResults(extra);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }, [user, toast]);

  const onSearchChange = (value: string) => {
    setQ(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => runSearch(value), 350);
  };

  const addFriend = async (p: Profile) => {
    if (!user) return;
    try {
      await sendFriendRequest(user.id, p.id);
      toast(`Demande d'ami envoyée à @${p.username}`);
      runSearch(q);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const onAcceptByRequestId = async (reqId: string, peerName: string) => {
    try {
      await acceptRequest(reqId);
      toast(`Amitié acceptée avec @${peerName}`);
      setResults(null);
      load();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const onAcceptIncoming = async (r: RequestPreview) => onAcceptByRequestId(r.id, r.peerName);

  const onDecline = async (reqId: string) => {
    try { await declineRequest(reqId); load(); if (results !== null) runSearch(q); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const onCancel = async (reqId: string) => {
    try { await cancelRequest(reqId); toast('Demande annulée'); load(); if (results !== null) runSearch(q); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const leaderboard = useMemo(() => {
    if (!friends) return [];
    return [...friends]
      .sort((a, b) => b.doneToday - a.doneToday || b.total - a.total || a.username.localeCompare(b.username))
      .slice(0, 3);
  }, [friends]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Réseau social</p>
          <h1>Amis</h1>
          <p className="muted">Suivez-vous, motivez-vous, progressez ensemble.</p>
        </div>
      </header>

      <div className="search-bar">
        <SearchIcon size={18} />
        <input
          value={q}
          placeholder="Rechercher un pseudo…"
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {busy && <span className="spinner" />}
      </div>

      {results !== null && (
        <div className="results">
          <p className="section-label">
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </p>
          {results.length === 0 ? (
            <p className="muted">Aucun compte ne porte ce pseudo.</p>
          ) : (
            results.map((p) => {
              let action: React.ReactNode;
              if (p.isFriend) {
                action = <button className="btn btn-ghost" onClick={() => navigate(`/u/${p.id}`)}>Voir profil</button>;
              } else if (p.incomingId) {
                action = (
                  <>
                    <button className="btn btn-primary" onClick={() => onAcceptByRequestId(p.incomingId!, p.username)}>Accepter</button>
                    <button className="btn btn-ghost" onClick={() => onDecline(p.incomingId!)}>Refuser</button>
                  </>
                );
              } else if (p.outgoingId) {
                action = <button className="btn btn-ghost" onClick={() => onCancel(p.outgoingId!)}>En attente…</button>;
              } else {
                action = <button className="btn btn-primary" onClick={() => addFriend(p)}>+ Ajouter</button>;
              }
              return (
                <div className="row-card" key={p.id}>
                  <Avatar profile={p} size={42} />
                  <div className="row-main">
                    <strong>@{p.username}</strong>
                    <span className="muted">
                      {p.isFriend ? 'Ami' : p.incomingId ? 'Demande reçue' : p.outgoingId ? 'Demande envoyée' : 'Utilisateur'}
                    </span>
                  </div>
                  <div className="row-actions">{action}</div>
                </div>
              );
            })
          )}
        </div>
      )}

      {incoming.length > 0 && (
        <section>
          <h2 className="section-title">Demandes reçues</h2>
          <div className="stack">
            {incoming.map((r) => (
              <div className="row-card" key={r.id}>
                <span className="avatar avatar-letter"><HeartIcon size={20} /></span>
                <div className="row-main">
                  <strong>@{r.peerName}</strong>
                  <span className="muted">veut t'ajouter en ami</span>
                </div>
                <div className="row-actions">
                  <button className="btn btn-primary" onClick={() => onAcceptIncoming(r)}>Accepter</button>
                  <button className="btn btn-ghost" onClick={() => onDecline(r.id)}>Refuser</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 className="section-title">Demandes envoyées</h2>
          <div className="stack">
            {outgoing.map((r) => (
              <div className="row-card" key={r.id}>
                <span className="avatar avatar-letter"><HourglassIcon size={20} /></span>
                <div className="row-main">
                  <strong>@{r.peerName}</strong>
                  <span className="muted">en attente de réponse</span>
                </div>
                <button className="btn btn-ghost" onClick={() => onCancel(r.id)}>Annuler</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Classement du jour</h2>
        {friends === null ? (
          <Skeleton h={130} />
        ) : leaderboard.length === 0 ? (
          <p className="muted">Ajoute des amis pour lancer le classement !</p>
        ) : (
          <div className="podium">
            {leaderboard.map((f, i) => (
              <button key={f.id} className="podium-item" onClick={() => navigate(`/u/${f.id}`)}>
                <span className={`podium-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : 'bronze'}`}>{i + 1}</span>
                <Avatar profile={f} size={44} />
                <strong>@{f.username}</strong>
<span className="muted">
                    {f.doneToday ? `${f.doneToday} faite${f.doneToday > 1 ? 's' : ''} aujourd'hui` : "rien encore aujourd'hui"} ·{' '}
                    <span className="ic"><FireIcon size={12} /> {f.bestStreak}</span>
                  </span>
                <span className="chip-streak"><FireIcon size={13} /> {f.bestStreak}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Mes amis ({friends?.length ?? 0})</h2>
        {friends === null ? (
          <Skeleton h={180} />
        ) : friends.length === 0 ? (
          <EmptyState icon={<UsersIcon size={40} />} title="Pas encore d'amis" text="Trouve un pseudo dans la recherche et envoie une demande." />
        ) : (
          <div className="stack">
            {friends.map((f) => (
              <div className="row-card friend" key={f.id} onClick={() => navigate(`/u/${f.id}`)}>
                <Avatar profile={f} size={46} />
                <div className="row-main">
                  <strong>@{f.username}</strong>
                  <span className="muted">
                    {f.habitsCount} habitude{f.habitsCount > 1 ? 's' : ''} ·{' '}
                    {f.doneToday ? `${f.doneToday} faite${f.doneToday > 1 ? 's' : ''} aujourd'hui` : "rien encore aujourd'hui"} ·{' '}
                    <span className="ic"><FireIcon size={12} /> {f.bestStreak}</span>
                  </span>
                </div>
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-chat" onClick={() => setChatPeer(f)}><ChatIcon size={16} /> Discuter</button>
                  <button className="btn btn-ghost" onClick={() => navigate(`/u/${f.id}`)}>Voir</button>
                  <button className="icon-btn danger" onClick={() => setRemoving(f)} title="Retirer"><XIcon size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {removing && (
        <Confirm
          title="Retirer cet ami ?"
          message={`@${removing.username} ne verra plus vos habitudes, et inversement.`}
          danger
          confirmLabel="Retirer"
          onConfirm={async () => {
            if (!user) return;
            try {
              await removeFriend(user.id, removing.id);
              toast(`@${removing.username} retiré`);
              load();
            } catch (e) {
              toast((e as Error).message, 'error');
            }
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}

      {friends?.map((f) => (
        <FriendRT key={f.id} userId={f.id} onEvent={load} />
      ))}

      {chatPeer && <ChatModal peer={chatPeer} onClose={() => setChatPeer(null)} />}
    </div>
  );
}

function FriendRT({ userId, onEvent }: { userId: string; onEvent: () => void }) {
  useRealtime('completions', 'user_id', userId, onEvent);
  return null;
}