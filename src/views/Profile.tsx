import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { updateUsername } from '@/lib/api';
import { Avatar } from '@/components/ui';
import { PencilIcon, LogOutIcon, SunIcon, MoonIcon, MailIcon } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

export function ProfileView() {
  const { user, profile, signOut, setProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const saveName = async () => {
    if (!profile || !user) return;
    const val = name.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(val)) {
      toast('Pseudo : 3-20 caractères, lettres/chiffres/_', 'error');
      return;
    }
    if (val === profile.username) return;
    try {
      setSaving(true);
      const updated = await updateUsername(user.id, val);
      setProfile(updated);
      toast('Pseudo mis à jour');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
      navigate('/');
    } catch {
      toast('Échec de la déconnexion', 'error');
      setSigningOut(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Mon profil</h1>
      </header>

      <div className="profile-card">
        <Avatar profile={profile ?? { username: '?', avatar_url: null }} size={76} />
        <h2>@{profile?.username ?? '…'}</h2>
        {user?.email && (
          <p className="profile-email"><MailIcon size={14} /> {user.email}</p>
        )}
        <small className="muted">
          {user?.app_metadata?.provider === 'google' ? 'Connecté via Google' : 'Compte email'}
        </small>
      </div>

      <div className="profile-section">
        <h3>Pseudo</h3>
        <label className="field">
          <span>Pseudo public</span>
          <input
            value={name}
            maxLength={20}
            placeholder="Ton pseudo"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
        </label>
        <button className="btn btn-secondary profile-save" disabled={saving || name.trim() === profile?.username} onClick={saveName}>
          {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><PencilIcon size={15} /> Enregistrer</>}
        </button>
      </div>

      <div className="profile-section">
        <h3>Apparence</h3>
        <button className="opt-row opt-btn" onClick={toggle}>
          <span>{theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            {theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
          </span>
          <small className="muted">{theme === 'dark' ? 'Sombre' : 'Clair'}</small>
        </button>
      </div>

      <div className="profile-section">
        <button className="btn btn-danger profile-logout" disabled={signingOut} onClick={onSignOut}>
          {signingOut ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><LogOutIcon size={15} /> Se déconnecter</>}
        </button>
      </div>
    </div>
  );
}