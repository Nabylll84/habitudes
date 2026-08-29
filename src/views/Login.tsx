import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/ui';
import { CalendarIcon, FireIcon, UsersIcon, BoltIcon } from '@/lib/icons';

const FEATURES = [
  { icon: <CalendarIcon size={18} />, text: 'Suis tes habitudes au quotidien' },
  { icon: <FireIcon size={18} />, text: 'Enchaîne les séries et les streaks' },
  { icon: <UsersIcon size={18} />, text: 'Ajoute tes amis, suivez-vous mutuellement' },
  { icon: <BoltIcon size={18} />, text: 'Mises à jour en temps réel' },
];

type Mode = 'signin' | 'signup';

function msgFor(e: unknown): string {
  const m = (e as Error).message;
  const map: Record<string, string> = {
    'Invalid login credentials': 'Email ou mot de passe incorrect.',
    'Email not confirmed': 'Email non confirmé. Vérifie ta boîte mail.',
    'User already registered': 'Un compte existe déjà avec cet email.',
    'Password should be at least 6 characters':
      'Le mot de passe doit contenir au moins 6 caractères.',
    'Unable to validate email address': 'Adresse email invalide.',
  };
  for (const [k, v] of Object.entries(map)) {
    if (m.includes(k)) return v;
  }
  return m;
}

export default function Login() {
  const [search] = useSearchParams();
  const err = search.get('error');

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);

  const signInGoogle = async () => {
    setBusyGoogle(true);
    setLocalErr(null);
    setInfo(null);
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
      const msg = msgFor(e);
      setLocalErr(msg.includes('Configuration') ? 'Google OAuth non configuré côté Supabase' : msg);
      setBusyGoogle(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    setInfo(null);
    if (password.length < 6) {
      setLocalErr('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setBusyEmail(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('Compte créé ! Vérifie tes e-mails pour confirmer ton adresse avant de te connecter.');
        }
      }
    } catch (e) {
      setLocalErr(msgFor(e));
    } finally {
      setBusyEmail(false);
    }
  };

  const errorText = localErr ?? err;

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
              <span className="fi">{f.icon}</span> {f.text}
            </li>
          ))}
        </ul>

        {info && <p className="login-info">{info}</p>}
        {errorText && <p className="login-error">{errorText}</p>}

        <button className="google-btn" onClick={signInGoogle} disabled={busyGoogle}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
          </svg>
          {busyGoogle ? 'Connexion…' : 'Continuer avec Google'}
        </button>

        <div className="login-divider">ou</div>

        <form className="login-form" onSubmit={submit}>
          <div className="login-tabs">
            <button
              type="button"
              className={mode === 'signin' ? 'tab active' : 'tab'}
              onClick={() => { setMode('signin'); setLocalErr(null); }}
            >
              Se connecter
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'tab active' : 'tab'}
              onClick={() => { setMode('signup'); setLocalErr(null); }}
            >
              Créer un compte
            </button>
          </div>

          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 caractères minimum"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={busyEmail}>
            {busyEmail
              ? 'Envoi…'
              : mode === 'signin'
                ? 'Se connecter'
                : 'Créer mon compte'}
          </button>
        </form>

        <p className="login-foot">
          Crée des habitudes, coche chaque jour, et reste motivé avec tes amis.
        </p>
      </main>
    </div>
  );
}