import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { Logo } from '@/components/ui';

const FEATURES = [
  { emoji: '📅', text: 'Suis tes habitudes au quotidien' },
  { emoji: '🔥', text: 'Enchaîne les séries et les streaks' },
  { emoji: '👥', text: 'Ajoute tes amis, suivez-vous mutuellement' },
  { emoji: '⚡', text: 'Mises à jour en temps réel' },
];

export default function Login() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [search] = useSearchParams();
  const err = search.get('error');

  const signIn = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (e) {
      const msg = (e as Error).message;
      toast(msg.includes('Configuration') ? 'Google OAuth non configuré coté Supabase' : msg, 'error');
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-orb orb-a" />
      <div className="login-orb orb-b" />
      <main className="login-card">
        <div className="login-brand">
          <Logo size={56} />
          <h1>HabitFlow</h1>
          <p className="tagline">Tes habitudes, ta meilleure version.</p>
        </div>

        <ul className="feature-list">
          {FEATURES.map((f) => (
            <li key={f.text}>
              <span className="fi">{f.emoji}</span> {f.text}
            </li>
          ))}
        </ul>

        {err && <p className="login-error">{err}</p>}

        <button className="google-btn" onClick={signIn} disabled={busy}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
          </svg>
          {busy ? 'Connexion…' : 'Continuer avec Google'}
        </button>

        <p className="login-foot">
          Crée des habitudes, coche chaque jour, et reste motivé avec tes amis.
        </p>
      </main>
    </div>
  );
}