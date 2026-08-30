import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { updateUsername, updateAvatar, removeAvatar, isStorageAvatar } from '@/lib/api';
import { Avatar } from '@/components/ui';
import { ImageCropModal, type CropMime } from '@/components/ImageCropModal';
import { PencilIcon, LogOutIcon, SunIcon, MoonIcon, MailIcon, CameraIcon, TrashIcon } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

export function ProfileView() {
  const { user, profile, signOut, setProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cropName = useRef('');
  const cropMime = useRef<CropMime>('image/jpeg');

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

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Photo trop lourde (2 Mo max)', 'error');
      return;
    }
    cropName.current = file.name;
    cropMime.current = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    setCropSrc(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    setCropSrc((s) => {
      if (s) URL.revokeObjectURL(s);
      return null;
    });
  };

  const onCropped = async (file: File) => {
    if (!user || uploading) return;
    setUploading(true);
    try {
      const updated = await updateAvatar(user.id, file);
      setProfile(updated);
      closeCrop();
      toast('Photo de profil mise à jour');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const onRemoveAvatar = async () => {
    if (!user || uploading) return;
    setUploading(true);
    try {
      const updated = await removeAvatar(user.id);
      setProfile(updated);
      toast('Photo supprimée');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploading(false);
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

  const hasCustom = !!profile?.avatar_url && isStorageAvatar(profile.avatar_url);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Mon profil</h1>
      </header>

      <div className="profile-card">
        <button
          type="button"
          className="avatar-edit"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Changer ma photo de profil"
        >
          <Avatar profile={profile ?? { username: '?', avatar_url: null }} size={84} />
          <span className="avatar-edit-badge">
            {uploading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <CameraIcon size={15} />}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={onPickFile} />
        <h2>@{profile?.username ?? '…'}</h2>
        {user?.email && (
          <p className="profile-email"><MailIcon size={14} /> {user.email}</p>
        )}
        <small className="muted">
          {user?.app_metadata?.provider === 'google' ? 'Connecté via Google' : 'Compte email'}
        </small>
        {hasCustom && !uploading && (
          <button className="btn btn-ghost btn-sm" onClick={onRemoveAvatar}>
            <TrashIcon size={14} /> Retirer la photo
          </button>
        )}
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

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          name={cropName.current}
          mime={cropMime.current}
          onCancel={closeCrop}
          onComplete={onCropped}
        />
      )}
    </div>
  );
}