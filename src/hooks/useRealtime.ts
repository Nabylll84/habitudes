import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * S'abonne aux changements d'une table filtrés sur une colonne (ex: user_id).
 * `onEvent` est appelé à chaque évènement + toutes les 30 s (filet de sécurité).
 */
export function useRealtime(table: string, column: string, value: string | undefined, onEvent: () => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    if (!value) return;
    const channel = supabase
      .channel(`rt:${table}:${value}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `${column}=eq.${value}` },
        () => cb.current()
      )
      .subscribe();
    const timer = setInterval(() => cb.current(), 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [table, column, value]);
}