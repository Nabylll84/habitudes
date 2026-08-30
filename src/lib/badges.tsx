import type { ReactNode } from 'react';
import { FireIcon, TrophyIcon, FolderIcon, CheckCircleIcon, StarIcon, HeartIcon, SmileIcon } from './icons';
import { awardBadges } from './api';

export type ToastFn = (msg: string, type?: 'success' | 'error' | 'info') => void;

/** Appelle le serveur pour débloquer les badges gagnés et annonce les nouveaux. */
export async function celebrateBadges(toast: ToastFn): Promise<void> {
  try {
    const newly = await awardBadges();
    if (newly.length > 0) {
      toast(`Badge débloqué : ${newly.map((b) => BADGE_LABELS[b] ?? b).join(', ')}`, 'success');
    }
  } catch {
    // silencieux : les badges se débloqueront à la prochaine validation
  }
}

export const BADGE_LABELS: Record<string, string> = {
  first_done: 'Première fois',
  streak_7: 'En feu',
  streak_30: 'Accro',
  streak_100: 'Légende',
  challenge_21: 'Défi 21 jours',
  challenge_30: 'Défi 30 jours',
  five_habits: 'Agile',
  ten_habits: 'Machine',
};

export const REACTION_KEYS = ['fire', 'star', 'heart', 'smile'] as const;

export const REACTION_LABELS: Record<string, string> = {
  fire: 'Bravo',
  star: 'Champion',
  heart: 'Courage',
  smile: 'Trop bien',
};

export const BADGE_ICONS: Record<string, (p: { size?: number }) => ReactNode> = {
  fire: (p) => <FireIcon size={p.size ?? 26} />,
  trophy: (p) => <TrophyIcon size={p.size ?? 26} />,
  folder: (p) => <FolderIcon size={p.size ?? 26} />,
  target: (p) => <CheckCircleIcon size={p.size ?? 26} />,
  star: (p) => <StarIcon size={p.size ?? 26} />,
};

export const REACTION_ICONS: Record<string, (p: { size?: number }) => ReactNode> = {
  fire: (p) => <FireIcon size={p.size ?? 16} />,
  star: (p) => <StarIcon size={p.size ?? 16} />,
  heart: (p) => <HeartIcon size={p.size ?? 16} />,
  smile: (p) => <SmileIcon size={p.size ?? 16} />,
};

export function badgeIcon(key: string, size = 26): ReactNode {
  return (BADGE_ICONS[key] ?? BADGE_ICONS.star)({ size });
}