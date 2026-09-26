import { useState } from 'react';
import { Modal, Confirm } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { createEvent, updateEvent, deleteEvent } from '@/lib/api';
import { fromLocalInput, toLocalInput, todayISO } from '@/lib/dates';
import { COLORS } from '@/lib/types';
import { LockIcon, TrashIcon, InfoIcon } from '@/lib/icons';
import type { CalendarEvent } from '@/lib/types';

/** Événement en cours d'édition ; `dayISO` sert de date de départ à la création. */
export type EventDraft = {
  event: CalendarEvent | null;
  dayISO: string;
  /** Position dans la grille (vue semaine / jour), "HH:MM". */
  startHHMM?: string;
};

export function EventModal({ uid, draft, onClose, onSaved }: {
  uid: string;
  draft: EventDraft;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const ev = draft.event;

  const init = () => {
    const start = ev ? toLocalInput(ev.starts_at) : `${draft.dayISO}T${draft.startHHMM ?? '09:00'}`;
    const end = ev ? toLocalInput(ev.ends_at) : minutesPlus(start.slice(11), 60);
    return {
      title: ev?.title ?? '',
      description: ev?.description ?? '',
      location: ev?.location ?? '',
      color: ev?.color ?? COLORS[0],
      allDay: ev?.all_day ?? false,
      day: start.slice(0, 10),
      start: start.slice(11, 16),
      // Un événement sur la journée entière finit à 23:59.
      end: ev?.all_day ? '23:59' : end.slice(11, 16),
    };
  };

  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const readonly = Boolean(ev?.g_readonly);

  const save = async () => {
    const title = f.title.trim();
    if (!title) { toast('Titre obligatoire', 'error'); return; }
    if (title.length > 200) { toast('Titre trop long (200 max)', 'error'); return; }
    if (!f.day) { toast('Date invalide', 'error'); return; }

    let startsAt: string;
    let endsAt: string;
    if (f.allDay) {
      // Journée entière : minuit -> 23:59:59.999 local.
      startsAt = new Date(`${f.day}T00:00:00`).toISOString();
      endsAt = new Date(`${f.day}T23:59:59.999`).toISOString();
    } else {
      if (!f.start || !f.end) { toast('Heures invalides', 'error'); return; }
      startsAt = fromLocalInput(`${f.day}T${f.start}`);
      endsAt = fromLocalInput(`${f.day}T${f.end}`);
      if (endsAt < startsAt) { toast("La fin ne peut pas précéder le début", 'error'); return; }
    }

    setSaving(true);
    try {
      const input = {
        title,
        description: f.description.trim() || null,
        location: f.location.trim() || null,
        color: f.color,
        all_day: f.allDay,
        starts_at: startsAt,
        ends_at: endsAt,
      };
      if (ev) await updateEvent(ev.id, input);
      else await createEvent(uid, input);
      await onSaved();
      toast(ev ? 'Événement modifié' : 'Événement créé');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!ev) return;
    setSaving(true);
    try {
      await deleteEvent(ev.id);
      await onSaved();
      toast('Événement supprimé');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={ev ? (readonly ? 'Événement Google' : "Modifier l'événement") : 'Nouvel événement'} onClose={onClose} width={560}>
      {readonly && (
        <p className="confirm-message">
          <LockIcon size={14} /> Cet événement vient de Google Calendar : consulte-le ou modifie-le depuis Google.
        </p>
      )}

      <div className="form-grid">
        <label className="field form-span-2">
          <span>Titre</span>
          <input
            autoFocus
            value={f.title}
            maxLength={200}
            disabled={readonly}
            placeholder="Ex : Réunion d'équipe, kiné…"
            onChange={(e) => set('title', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !readonly && save()}
          />
        </label>

        <div className="field form-span-2">
          <span>Type</span>
          <div className="seg">
            <button type="button" className={`seg-btn ${!f.allDay ? 'active' : ''}`} disabled={readonly} onClick={() => set('allDay', false)}>
              Horodaté
            </button>
            <button type="button" className={`seg-btn ${f.allDay ? 'active' : ''}`} disabled={readonly} onClick={() => set('allDay', true)}>
              Journée entière
            </button>
          </div>
        </div>

        <label className="field form-span-2">
          <span>Date</span>
          <input
            type="date"
            value={f.day}
            disabled={readonly}
            onChange={(e) => set('day', e.target.value)}
          />
        </label>

        {!f.allDay && (
          <div className="form-grid-inline form-span-2">
            <label className="field">
              <span>Début</span>
              <input type="time" value={f.start} disabled={readonly} onChange={(e) => set('start', e.target.value)} />
            </label>
            <label className="field">
              <span>Fin</span>
              <input type="time" value={f.end} disabled={readonly} onChange={(e) => set('end', e.target.value)} />
            </label>
          </div>
        )}

        <label className="field form-span-2">
          <span>Lieu <small>(optionnel)</small></span>
          <input
            value={f.location}
            maxLength={200}
            disabled={readonly}
            placeholder="Ex : Salle 3, Paris"
            onChange={(e) => set('location', e.target.value)}
          />
        </label>

        <label className="field form-span-2">
          <span>Description <small>(optionnel)</small></span>
          <textarea
            value={f.description}
            maxLength={2000}
            rows={3}
            disabled={readonly}
            placeholder="Détails, lien de visio…"
            onChange={(e) => set('description', e.target.value)}
          />
        </label>

        <div className="field form-span-2">
          <span>Couleur</span>
          <div className="color-grid">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-swatch ${c === f.color ? 'selected' : ''}`}
                style={{ background: c }}
                disabled={readonly}
                onClick={() => set('color', c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {ev?.g_dirty && (
          <small className="field-hint form-span-2">
            <InfoIcon size={12} /> Modifications en attente d'envoi vers Google Calendar.
          </small>
        )}
      </div>

      <div className="modal-actions">
        {ev && !readonly && (
          <button className="btn btn-ghost btn-danger" onClick={() => setConfirming(true)} disabled={saving}>
            <TrashIcon size={14} /> Supprimer
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        {!readonly && (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '…' : ev ? 'Enregistrer' : 'Créer'}
          </button>
        )}
      </div>

      {confirming && ev && (
        <Confirm
          title="Supprimer l'événement ?"
          message={`« ${ev.title} » sera aussi retiré de Google Calendar.`}
          confirmLabel="Supprimer"
          danger
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Modal>
  );
}

function minutesPlus(hhmm: string, delta: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.max(0, Math.min(24 * 60 - 1, (h || 0) * 60 + (m || 0) + delta));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function NewEventQuickModal({ uid, onClose, onSaved }: {
  uid: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  return (
    <EventModal
      uid={uid}
      draft={{ event: null, dayISO: todayISO() }}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
