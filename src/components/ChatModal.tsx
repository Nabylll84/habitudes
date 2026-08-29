import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchConversation, markConversationRead, sendMessage, subscribeMessages } from '@/lib/chat';
import { useToast } from '@/components/Toast';
import { Avatar } from '@/components/ui';
import { relativeDayLabel } from '@/lib/dates';
import type { Message } from '@/lib/types';

type Peer = { id: string; username: string; avatar_url: string | null };

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatModal({ peer, onClose }: { peer: Peer; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = async (markRead = true) => {
    if (!user) return;
    try {
      const rows = await fetchConversation(peer.id);
      setMessages(rows);
      if (markRead) await markConversationRead(peer.id).catch(() => {});
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  useEffect(() => {
    load();
    const unsubscribe = subscribeMessages(() => load(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      unsubscribe();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    if (!user) return;
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    const temp: Message = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(),
      sender_id: user.id,
      recipient_id: peer.id,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, temp]);
    try {
      await sendMessage(user.id, peer.id, content);
      await load(false);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      toast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  const mine = (m: Message) => user?.id === m.sender_id;

  return (
    <div className="modal chat-surface" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="chat-card" role="dialog" aria-modal="true" aria-label={`Conversation avec ${peer.username}`}>
        <header className="chat-head">
          <Avatar profile={peer} size={38} />
          <div className="chat-head-meta">
            <strong>@{peer.username}</strong>
            <small>Chat privé</small>
          </div>
          <button className="icon-btn chat-close" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="chat-body">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <span className="chat-empty-emoji">👋</span>
              <p>Début de la conversation avec @{peer.username}.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const prevDay = i > 0 ? messages[i - 1].created_at.slice(0, 10) : null;
              const day = m.created_at.slice(0, 10);
              return (
                <React.Fragment key={m.id}>
                  {prevDay !== day && (
                    <div className="chat-day">{relativeDayLabel(day)}</div>
                  )}
                  <div className={`msg ${mine(m) ? 'mine' : ''}`}>
                    <div className="msg-bubble">{m.content}</div>
                    <span className="msg-meta">
                      {fmtTime(m.created_at)}
                      {mine(m) && <span className="msg-receipt">{m.read_at ? '✓✓' : '✓'}</span>}
                    </span>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <footer className="chat-foot">
          <input
            value={text}
            placeholder="Écris un message…"
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          />
          <button className="btn btn-primary chat-send" disabled={!text.trim() || sending} onClick={send}>
            {sending ? '…' : 'Envoyer'}
          </button>
        </footer>
      </div>
    </div>
  );
}