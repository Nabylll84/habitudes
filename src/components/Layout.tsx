import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo, Avatar } from './ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useToast } from './Toast';
import { updateUsername } from '@/lib/api';
import { Modal } from './Modal';

const NAV = [
  { to: '/', label: 'Journal', icon: '📅', end: true },
  { to: '/habits', label: 'Habitudes', icon: '✅' },
  { to: '/amis', label: 'Amis', icon: '👥' },
  { to: '/stats', label: 'Stats', icon: '📈' },
];

export function Layout() {
  const { user, profile, signOut, setProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const onSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch {
      toast('Échec de la déconnexion', 'error');
    }
  };

  const openRename = () => {
    setName(profile?.username ?? '');
    setRenameOpen(true);
    setMenuOpen(false);
  };

  const saveName = async () => {
    if (!profile || !user) return;
    const val = name.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(val)) {
      toast('Pseudo : 3-20 caractères, lettres/chiffres/_', 'error');
      return;
    }
    try {
      setSaving(true);
      const updated = await updateUsername(user.id, val);
      setProfile(updated);
      setRenameOpen(false);
      toast('Pseudo mis à jour ✨');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo size={34} />
          <span className="brand-name">HabitFlow</span>
          <button
            className="icon-btn theme-toggle"
            onClick={toggle}
            title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
            aria-label="Basculer le thème"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="icon-btn sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Fermer">✕</button>
        </div>
        <nav className="side-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <Avatar profile={profile ?? { username: '?', avatar_url: null }} size={34} />
          <div className="user-meta">
            <strong>@{profile?.username}</strong>
            <small>{user?.app_metadata?.provider === 'google' ? 'Connecté via Google' : user?.email ?? 'Connecté'}</small>
          </div>
          <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            ⋮
          </button>
          {menuOpen && (
            <div className="user-menu">
              <button onClick={openRename}>✏️ Changer de pseudo</button>
              <button className="danger" onClick={onSignOut}>Se déconnecter</button>
            </div>
          )}
        </div>
      </aside>

      <button className="hamburger" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">☰</button>
      <button
        className="theme-btn-mobile"
        onClick={toggle}
        title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
        aria-label="Basculer le thème"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bn-item ${isActive ? 'active' : ''}`}
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </NavLink>
        ))}
      </nav>

      {renameOpen && (
        <Modal title="Changer mon pseudo" onClose={() => setRenameOpen(false)}>
          <label className="field">
            <span>Pseudo</span>
            <input
              value={name}
              maxLength={20}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
          </label>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setRenameOpen(false)}>Annuler</button>
            <button className="btn btn-primary" disabled={saving} onClick={saveName}>
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}