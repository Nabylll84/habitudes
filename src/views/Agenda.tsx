import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { EventModal } from '@/components/EventModal';
import type { EventDraft } from '@/components/EventModal';
import { fetchEventsInRange, fetchCalendarStatus } from '@/lib/api';
import { startGoogleAuth, syncCalendar, disconnectGoogle, readOAuthOutcome } from '@/lib/googleCalendar';
import {
  addMonths, dayBounds, dayNumber, monthMatrix, monthTitle, occursOn,
  shortDate, timeLabel, todayISO, toISO, weekOf, weekdayLabel, minutesToHHMM,
} from '@/lib/dates';
import { PlusIcon, ArrowLeftIcon, LockIcon } from '@/lib/icons';
import type { CalendarEvent, CalendarStatus } from '@/lib/types';

type ViewMode = 'month' | 'week' | 'day';

const DAY_START = 7; // première heure affichée
const DAY_END = 22; // dernière heure affichée (exclusive)
const HOUR_PX = 48;

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function Agenda() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(todayISO());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [draft, setDraft] = useState<EventDraft | null>(null);

  // Fenêtre chargée : la vue demande toujours un peu de marge autour.
  const range = useMemo(() => {
    if (mode === 'day') {
      const b = dayBounds(anchor);
      return { from: new Date(b.start - 86400000).toISOString(), to: new Date(b.end + 86400000).toISOString() };
    }
    if (mode === 'week') {
      const days = weekOf(anchor);
      const first = dayBounds(days[0]).start;
      const last = dayBounds(days[6]).end;
      return { from: new Date(first).toISOString(), to: new Date(last).toISOString() };
    }
    const cells = monthMatrix(anchor);
    const first = dayBounds(cells[0]).start;
    const last = dayBounds(cells[41]).end;
    return { from: new Date(first).toISOString(), to: new Date(last).toISOString() };
  }, [mode, anchor]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [evs, st] = await Promise.all([
        fetchEventsInRange(range.from, range.to),
        fetchCalendarStatus(),
      ]);
      setEvents(evs);
      setStatus(st);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [user, range.from, range.to, toast]);

  useEffect(() => { void load(); }, [load]);

  // Retour de l'OAuth : on prévient puis on recharge l'état de la connexion.
  useEffect(() => {
    const outcome = readOAuthOutcome();
    if (!outcome) return;
    if (outcome === 'connected') {
      toast('Google Calendar connecté');
      setSyncing(true);
      void syncCalendar()
        .then(() => toast('Synchronisation terminée'))
        .catch((e) => toast((e as Error).message, 'error'))
        .finally(() => { setSyncing(false); void load(); });
      return;
    }
    if (outcome === 'denied') toast('Autorisation refusée par Google', 'error');
    else if (outcome === 'state') toast('Session OAuth invalide, réessaie', 'error');
    else toast('Erreur pendant la connexion Google', 'error');
    void load();
    // Au retour de l'OAuth, on veut un seul passage : le reste est géré par load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSync = async () => {
    if (!status?.connected) {
      try { await startGoogleAuth(); } catch (e) { toast((e as Error).message, 'error'); }
      return;
    }
    setSyncing(true);
    try {
      const r = await syncCalendar();
      const parts: string[] = [];
      if (r.pushed) parts.push(`${r.pushed} envoyé${r.pushed > 1 ? 's' : ''}`);
      if (r.pulled) parts.push(`${r.pulled} reçu${r.pulled > 1 ? 's' : ''}`);
      if (r.deleted) parts.push(`${r.deleted} supprimé${r.deleted > 1 ? 's' : ''}`);
      toast(parts.length ? `Synchronisé — ${parts.join(', ')}` : 'Tout est à jour');
      if (r.error) toast(`Google : ${r.error}`, 'error');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const onDisconnect = async () => {
    setSyncing(true);
    try {
      await disconnectGoogle();
      toast('Google Calendar déconnecté');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const shift = (dir: 1 | -1) => {
    if (mode === 'day') setAnchor(toISO(new Date(new Date(`${anchor}T00:00:00`).getTime() + dir * 86400000)));
    else if (mode === 'week') setAnchor(weekOf(anchor)[dir > 0 ? 6 : 0]);
    else setAnchor(addMonths(anchor, dir));
  };

  const title =
    mode === 'day' ? `${weekdayLabel(anchor)} ${shortDate(anchor)}`
    : mode === 'week' ? weekTitle(anchor)
    : monthTitle(anchor);

  const openNew = (dayISO: string, startHHMM?: string) => setDraft({ event: null, dayISO, startHHMM });
  const openEvent = (ev: CalendarEvent) => setDraft({ event: ev, dayISO: ev.starts_at.slice(0, 10) });

  const onDay = (ev: ReactMouseEvent, dayISO: string) => {
    // Clic dans la colonne : on ouvre à l'heure visée, arrondie au 1/2 d'heure.
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = Math.min(0.999, Math.max(0, (ev.clientY - rect.top) / rect.height));
    const minutes = DAY_START * 60 + ratio * ((DAY_END - DAY_START) * 60);
    openNew(dayISO, minutesToHHMM(Math.floor(minutes / 30) * 30));
  };

  return (
    <div className="page agenda">
      <div className="agenda-toolbar">
        <div className="agenda-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Période précédente"><ArrowLeftIcon size={17} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAnchor(todayISO())}>Aujourd'hui</button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Période suivante">
            <ArrowLeftIcon size={17} style={{ transform: 'scaleX(-1)' }} />
          </button>
          <h2 className="agenda-title">{title}</h2>
        </div>

        <div className="agenda-tools">
          <div className="seg seg-3">
            {(['month', 'week', 'day'] as ViewMode[]).map((m) => (
              <button key={m} className={`seg-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
                {m === 'month' ? 'Mois' : m === 'week' ? 'Semaine' : 'Jour'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => openNew(todayISO(), '09:00')}>
            <PlusIcon size={15} /> Nouvel événement
          </button>
        </div>
      </div>

      <div className="agenda-gcal">
        {status?.connected ? (
          <>
            <span className="gcal-dot" title={`Connecté : ${status.account_email ?? 'compte Google'}`} />
            <span className="gcal-email">{status.account_email ?? 'Google Calendar'}</span>
            {status.last_sync_at && <small>sync {new Date(status.last_sync_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small>}
            <button className="btn btn-ghost btn-sm" onClick={onSync} disabled={syncing}>
              {syncing ? <span className="spinner" style={{ width: 13, height: 13 }} /> : null} Synchroniser
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onDisconnect} disabled={syncing}>Déconnecter</button>
          </>
        ) : (
          <>
            <span className="gcal-hint">Agenda local</span>
            <button className="btn btn-ghost btn-sm" onClick={onSync} disabled={syncing}>
              {syncing ? <span className="spinner" style={{ width: 13, height: 13 }} /> : null} Connecter Google Calendar
            </button>
          </>
        )}
      </div>

      {status?.last_error && <div className="agenda-warn">Dernière erreur de sync : {status.last_error}</div>}

      {loading ? (
        <div className="agenda-loading"><span className="spinner" style={{ width: 22, height: 22 }} /></div>
      ) : mode === 'month' ? (
        <MonthGrid events={events} anchor={anchor} onPick={openEvent} onDay={openNew} />
      ) : mode === 'week' ? (
        <WeekGrid events={events} anchor={anchor} onPick={openEvent} onDay={onDay} />
      ) : (
        <DayGrid events={events} dayISO={anchor} onPick={openEvent} onDay={onDay} />
      )}

      {draft && user && (
        <EventModal uid={user.id} draft={draft} onClose={() => setDraft(null)} onSaved={load} />
      )}
    </div>
  );
}

function weekTitle(anchor: string) {
  const days = weekOf(anchor);
  const a = new Date(`${days[0]}T00:00:00`);
  const b = new Date(`${days[6]}T00:00:00`);
  const sameMonth = a.getMonth() === b.getMonth();
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('fr-FR', opts);
  return sameMonth
    ? `${fmt(a, { day: 'numeric' })} – ${fmt(b, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function eventColor(ev: CalendarEvent) {
  return ev.color ?? 'var(--accent)';
}

// ---------------------------------------------------------------- vue mois

function MonthGrid({ events, anchor, onPick, onDay }: {
  events: CalendarEvent[];
  anchor: string;
  onPick: (ev: CalendarEvent) => void;
  onDay: (dayISO: string) => void;
}) {
  const cells = monthMatrix(anchor);
  const today = todayISO();
  const month = new Date(`${anchor}T00:00:00`).getMonth();

  return (
    <div className="cal-month">
      <div className="cal-month-head">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="cal-month-grid">
        {cells.map((day) => {
          const dayEvents = events
            .filter((ev) => occursOn(ev.starts_at, ev.ends_at, day))
            .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at));
          const outside = new Date(`${day}T00:00:00`).getMonth() !== month;
          return (
            <div
              key={day}
              className={`cal-cell ${outside ? 'outside' : ''} ${day === today ? 'today' : ''}`}
              onClick={(e) => { if (e.target === e.currentTarget) onDay(day); }}
            >
              <div className="cal-cell-head">
                <button className="cal-daynum" onClick={() => onDay(day)} aria-label={`Ajouter le ${day}`}>
                  {dayNumber(day)}
                </button>
                {dayEvents.length > 3 && <small className="cal-more">+{dayEvents.length - 3}</small>}
              </div>
              <div className="cal-cell-events">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    className={`cal-chip ${ev.all_day ? 'allday' : ''}`}
                    style={{ borderLeftColor: eventColor(ev) }}
                    onClick={(e) => { e.stopPropagation(); onPick(ev); }}
                    title={ev.title}
                  >
                    {!ev.all_day && <span className="cal-chip-time">{timeLabel(ev.starts_at)}</span>}
                    {ev.g_readonly && <LockIcon size={9} />}
                    <span className="cal-chip-title">{ev.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- vue semaine / jour

/** Blocs positionnés en absolu pour un jour. */
function timedEvents(events: CalendarEvent[], dayISO: string) {
  const bounds = dayBounds(dayISO);
  const first = new Date(bounds.start).toISOString();
  const last = new Date(bounds.end).toISOString();
  return events
    .filter((ev) => !ev.all_day && ev.starts_at <= last && ev.ends_at >= first)
    .map((ev) => {
      const s = Math.max(bounds.start, new Date(ev.starts_at).getTime());
      const e = Math.min(bounds.end, new Date(ev.ends_at).getTime());
      const topMin = (s - bounds.start) / 60000 - DAY_START * 60;
      const durMin = Math.max(15, (e - s) / 60000);
      return { ev, top: topMin * (HOUR_PX / 60), height: Math.max(18, durMin * (HOUR_PX / 60)) };
    })
    .filter((b) => b.top + b.height > 0 && b.top < (DAY_END - DAY_START) * HOUR_PX)
    .sort((a, b) => a.top - b.top);
}

function allDayRow(events: CalendarEvent[], dayISO: string) {
  return events.filter((ev) => ev.all_day && occursOn(ev.starts_at, ev.ends_at, dayISO));
}

/** Répartit les blocs qui se chevauchent en colonnes. */
function layout(events: CalendarEvent[]) {
  const cols: CalendarEvent[][] = [];
  for (const ev of events) {
    const s = new Date(ev.starts_at).getTime();
    const e = new Date(ev.ends_at).getTime();
    let placed = false;
    for (const col of cols) {
      if (col.every((o) => new Date(o.ends_at).getTime() <= s || new Date(o.starts_at).getTime() >= e)) {
        col.push(ev);
        placed = true;
        break;
      }
    }
    if (!placed) cols.push([ev]);
  }
  return cols.map((col) => new Set(col.map((e) => e.id)));
}

function WeekGrid({ events, anchor, onPick, onDay }: {
  events: CalendarEvent[];
  anchor: string;
  onPick: (ev: CalendarEvent) => void;
  onDay: (ev: React.MouseEvent, dayISO: string) => void;
}) {
  const days = weekOf(anchor);
  const today = todayISO();

  return (
    <div className="cal-week">
      <div className="cal-week-head">
        <div className="cal-gutter" />
        {days.map((d) => (
          <div key={d} className={`cal-week-day ${d === today ? 'today' : ''}`}>
            <small>{weekdayLabel(d)}</small>
            <b>{dayNumber(d)}</b>
          </div>
        ))}
      </div>
      <div className="cal-week-body">
        <div className="cal-hours">
          {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
            <span key={i} style={{ height: HOUR_PX }}>{minutesToHHMM((DAY_START + i) * 60)}</span>
          ))}
        </div>
        {days.map((d) => {
          const timed = timedEvents(events, d);
          const allDay = allDayRow(events, d);
          const colSets = layout(timed.map((t) => t.ev));
          return (
            <div key={d} className={`cal-col ${d === today ? 'today' : ''}`} onClick={(e) => onDay(e, d)}>
              {allDay.map((ev) => (
                <button
                  key={ev.id}
                  className="cal-chip cal-allday"
                  style={{ borderLeftColor: eventColor(ev), background: `color-mix(in srgb, ${eventColor(ev)} 14%, var(--surface))` }}
                  onClick={(e) => { e.stopPropagation(); onPick(ev); }}
                >
                  {ev.g_readonly && <LockIcon size={9} />} {ev.title}
                </button>
              ))}
              {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                <div key={i} className="cal-slot" style={{ height: HOUR_PX }} />
              ))}
              <div className="cal-now" style={{ top: nowOffset(), display: nowOffset() < 0 ? 'none' : undefined }} />
              {timed.map((b) => {
                const colIndex = colSets.findIndex((set) => set.has(b.ev.id));
                const cols = colSets.length || 1;
                return (
                  <button
                    key={b.ev.id}
                    className="cal-block"
                    onClick={(e) => { e.stopPropagation(); onPick(b.ev); }}
                    style={{
                      top: b.top,
                      height: b.height,
                      left: `calc(${(colIndex / cols) * 100}% + 2px)`,
                      width: `calc(${100 / cols}% - 5px)`,
                      borderLeftColor: eventColor(b.ev),
                      background: `color-mix(in srgb, ${eventColor(b.ev)} 18%, var(--surface))`,
                    }}
                    title={`${b.ev.title} — ${timeLabel(b.ev.starts_at)}`}
                  >
                    <span className="cal-block-time">
                      {timeLabel(b.ev.starts_at)}{b.height > 34 ? ` – ${timeLabel(b.ev.ends_at)}` : ''}
                    </span>
                    <span className="cal-block-title">{b.ev.title}</span>
                    {b.ev.g_readonly && b.height > 52 && <LockIcon size={10} />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayGrid({ events, dayISO, onPick, onDay }: {
  events: CalendarEvent[];
  dayISO: string;
  onPick: (ev: CalendarEvent) => void;
  onDay: (ev: React.MouseEvent, dayISO: string) => void;
}) {
  const timed = timedEvents(events, dayISO);
  const allDay = allDayRow(events, dayISO);
  const colSets = layout(timed.map((t) => t.ev));
  const today = dayISO === todayISO();

  return (
    <div className="cal-week cal-day-view">
      <div className="cal-week-head">
        <div className="cal-gutter" />
        <div className={`cal-week-day ${today ? 'today' : ''}`}>
          <small>{weekdayLabel(dayISO)}</small>
          <b>{dayNumber(dayISO)}</b>
        </div>
      </div>
      <div className="cal-week-body">
        <div className="cal-hours">
          {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
            <span key={i} style={{ height: HOUR_PX }}>{minutesToHHMM((DAY_START + i) * 60)}</span>
          ))}
        </div>
        <div className={`cal-col ${today ? 'today' : ''}`} onClick={(e) => onDay(e, dayISO)}>
          {allDay.map((ev) => (
            <button
              key={ev.id}
              className="cal-chip cal-allday"
              style={{ borderLeftColor: eventColor(ev), background: `color-mix(in srgb, ${eventColor(ev)} 14%, var(--surface))` }}
              onClick={(e) => { e.stopPropagation(); onPick(ev); }}
            >
              {ev.g_readonly && <LockIcon size={9} />} {ev.title}
            </button>
          ))}
          {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
            <div key={i} className="cal-slot" style={{ height: HOUR_PX }} />
          ))}
          {today && <div className="cal-now" style={{ top: nowOffset() }} />}
          {timed.map((b) => {
            const colIndex = colSets.findIndex((set) => set.has(b.ev.id));
            const cols = colSets.length || 1;
            return (
              <button
                key={b.ev.id}
                className="cal-block"
                onClick={(e) => { e.stopPropagation(); onPick(b.ev); }}
                style={{
                  top: b.top,
                  height: b.height,
                  left: `calc(${(colIndex / cols) * 100}% + 2px)`,
                  width: `calc(${100 / cols}% - 5px)`,
                  borderLeftColor: eventColor(b.ev),
                  background: `color-mix(in srgb, ${eventColor(b.ev)} 18%, var(--surface))`,
                }}
              >
                <span className="cal-block-time">
                  {timeLabel(b.ev.starts_at)}{b.height > 34 ? ` – ${timeLabel(b.ev.ends_at)}` : ''}
                </span>
                <span className="cal-block-title">{b.ev.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Position de l'heure courante dans la grille (px), -1 si hors plage. */
function nowOffset() {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes() - DAY_START * 60;
  if (min < 0 || min > (DAY_END - DAY_START) * 60) return -1;
  return min * (HOUR_PX / 60);
}
