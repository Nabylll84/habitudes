import { supabase } from './supabase';
import type { Message } from './types';

function errMsg(e: { message: string; hint?: string; code?: string } | null, fallback: string): never {
  throw new Error(e?.message || fallback);
}

export async function fetchConversation(peerId: string): Promise<Message[]> {
  const { data, error } = await supabase.rpc('get_messages', { p_peer_id: peerId });
  if (error) errMsg(error, 'Impossible de charger la conversation');
  return (data ?? []) as Message[];
}

export async function sendMessage(uid: string, peerId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ sender_id: uid, recipient_id: peerId, content });
  if (error) errMsg(error, "Impossible d'envoyer le message");
}

export async function markConversationRead(peerId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_read', { p_peer_id: peerId });
  if (error) errMsg(error, 'Impossible de marquer comme lu');
}

/** S'abonne à l'arrivée de nouveaux messages (RLS filtre : uniquement les siens). */
export function subscribeMessages(onEvent: () => void): () => void {
  const channel = supabase
    .channel('chat:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => onEvent())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}