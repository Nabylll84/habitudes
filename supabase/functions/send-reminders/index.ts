// Rappels email — STUB.
// À brancher plus tard, par exemple sur Resend (secrets : RESEND_API_KEY).
// Déclenchement : scheduler pg_cron qui fait un POST vers ce endpoint pour
// balayer les reminder_logs "pending" à la date du jour, envoyer l'email
// (habitude + lien), puis passer le statut à "sent"/"failed".
// Déploiement : supabase functions deploy send-reminders --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = new Date().toISOString().slice(0, 10);
  const { data: logs, error } = await supabase
    .from('reminder_logs')
    .select('id,user_id,habit_id,due_date')
    .eq('status', 'pending')
    .lte('due_date', today);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  // TODO envoyer les emails (Resend) et mettre à jour le statut des logs.
  return new Response(
    JSON.stringify({ scanned: logs?.length ?? 0, sent: 0 }),
    { headers: { 'content-type': 'application/json' } },
  );
});