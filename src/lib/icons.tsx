import type { ReactNode, SVGProps } from 'react';

export type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>;

function Svg({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function BoltIcon(p: IconProps) {
  return <Svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></Svg>;
}
export function SunIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Svg>
  );
}
export function MoonIcon(p: IconProps) {
  return <Svg {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Svg>;
}
export function CheckIcon(p: IconProps) {
  return <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
}
export function CheckDoubleIcon(p: IconProps) {
  return <Svg {...p}><path d="M18 6 7 17l-4-4" /><path d="m22 10-7.5 7.5L13 16" /></Svg>;
}
export function XIcon(p: IconProps) {
  return <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
}
export function MenuIcon(p: IconProps) {
  return <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
}
export function DotsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}
export function SearchIcon(p: IconProps) {
  return <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></Svg>;
}
export function SendIcon(p: IconProps) {
  return <Svg {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></Svg>;
}
export function CalendarIcon(p: IconProps) {
  return <Svg {...p}><rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>;
}
export function CheckCircleIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 5-5" /></Svg>;
}
export function UsersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}
export function ChartIcon(p: IconProps) {
  return <Svg {...p}><path d="M3 21h18" /><path d="M7 21v-7M12 21V5M17 21v-12" /></Svg>;
}
export function FireIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}
export function TrophyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Svg>
  );
}
export function StarIcon(p: IconProps) {
  return <Svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" /></Svg>;
}
export function SmileIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </Svg>
  );
}
export function LockIcon(p: IconProps) {
  return <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2.5" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>;
}
export function HourglassIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 22h14M5 2h14" />
      <path d="M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" />
      <path d="M7 2v4.17a2 2 0 0 0 .59 1.41L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
    </Svg>
  );
}
export function HeartIcon(p: IconProps) {
  return <Svg {...p}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" /></Svg>;
}
export function FolderIcon(p: IconProps) {
  return <Svg {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></Svg>;
}
export function PinIcon(p: IconProps) {
  return <Svg {...p}><path d="M9 3v6l-2 2v2h10v-2l-2-2V3" /><path d="M12 13v8" /></Svg>;
}
export function SproutIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </Svg>
  );
}
export function PencilIcon(p: IconProps) {
  return <Svg {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Svg>;
}
export function TrashIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}
export function ChatIcon(p: IconProps) {
  return <Svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>;
}
export function PlusIcon(p: IconProps) {
  return <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
}
export function MinusIcon(p: IconProps) {
  return <Svg {...p}><path d="M5 12h14" /></Svg>;
}
export function InfoIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>;
}
export function UserIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 0 0-16 0" /></Svg>;
}
export function LogOutIcon(p: IconProps) {
  return <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg>;
}
export function MailIcon(p: IconProps) {
  return <Svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></Svg>;
}
export function ArrowLeftIcon(p: IconProps) {
  return <Svg {...p}><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></Svg>;
}
export function DownloadIcon(p: IconProps) {
  return <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></Svg>;
}

// ------------------------------------------------------------------ alertes / émojis -> icônes du formulaire

function DumbbellIcon(p: IconProps) {
  return <Svg {...p}><path d="M6.5 7v10M17.5 7v10M3 9v6M21 9v6M6.5 12h11" /></Svg>;
}
function RunnerIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="4.5" r="1.7" />
      <path d="M10 7.5l2 1.5 1.5 3L16 12l2.5 3" />
      <path d="M9 20l2-5M15 20l-1.5-5L12 12.5" />
    </Svg>
  );
}
function BikeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="5.5" cy="17.5" r="3" />
      <circle cx="18.5" cy="17.5" r="3" />
      <path d="M5.5 17.5 9 10.5h3M12 10.5l3 3M15 13.5l3.5 4" />
      <path d="M12.5 10.5 11 7.5H7" />
    </Svg>
  );
}
function WeightsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="4.5" r="1.6" />
      <path d="M12 6.5 10 10.5l3 3" />
      <path d="M8 13.5 5 18M15 13.5 18 18M9 11l-4 7M15 11l4 7" />
    </Svg>
  );
}
function MeditateIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M12 6.5 9 11h6z" />
      <path d="M9 11l-3 6M15 11l3 6" />
      <path d="M12 11l-2 3 2 3 2-3z" />
    </Svg>
  );
}
function WaterIcon(p: IconProps) {
  return <Svg {...p}><path d="M12 2.7c2.7 4 4.8 6.6 4.8 9.3a4.8 4.8 0 0 1-9.6 0C7.2 9.3 9.3 6.7 12 2.7z" /></Svg>;
}
function SaladIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 13a8 8 0 0 0 16 0z" />
      <path d="M12 5c-1.5 1-2.5 2.5-2.5 4.5M16 6c-.3 1.7.2 3 0 4M8 6c.3 1.7-.2 3 0 4" />
    </Svg>
  );
}
function AppleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="13.5" r="5.5" />
      <path d="M12 8V6M12 6l2.5-.5" />
    </Svg>
  );
}
function BedIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 18V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9" />
      <path d="M3 18h18M3 13h18" />
      <path d="M7 12v3" />
    </Svg>
  );
}
function SleepyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8z" />
      <path d="M18 4l2 3 2-3" />
      <path d="M14.5 9l1.5 2 1.5-2" />
    </Svg>
  );
}
function BookIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Svg>
  );
}
function PenIcon(p: IconProps) {
  return <Svg {...p}><path d="m15 3 6 6L9 21l-7 1 1-7z" /></Svg>;
}
function BrainIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3a2.5 2.5 0 0 0-5 0 3 3 0 0 0-1 5.9A3 3 0 0 0 4 12a3 3 0 0 0 2 2.9 3 3 0 0 0 1.5 6A2.5 2.5 0 0 0 12 21a2.5 2.5 0 0 0 4.5-1.1 3 3 0 0 0 1.5-6A3 3 0 0 0 20 12a3 3 0 0 0-2-2.9 3 3 0 0 0-1-5.9 2.5 2.5 0 0 0-5-1.2z" />
      <path d="M12 3v18" />
    </Svg>
  );
}
function TargetIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></Svg>;
}
function WalkIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="13" cy="4" r="1.7" />
      <path d="M11 6.5l3 1.5 2 3" />
      <path d="M9 20l2.5-6 2-1.5-1.5 4 .5 4" />
    </Svg>
  );
}
function ToothIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5.5c1.6 0 2.6-.9 5.6-1 1.1 0 1.9.9 1.9 2.4 0 2.7-1 3.8-1 6.6 0 2.8-1 3.6-1.9 4.4-.8.6-1.3-1-1.3-2.2 0-1.3-.4 2.3-2.3 2.3S10.7 15.9 10.7 15.7c0 1.2-.5 2.8-1.3 2.2-2.1-1.7-2.9-3.2-2.9-6.6 0-2.3-1-3.4-1-6.2 0-2 .9-2.7 1.9-2.6 3.4.2 4.6 1 6.6 1z" />
    </Svg>
  );
}
function PillIcon(p: IconProps) {
  return <Svg {...p}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></Svg>;
}
function CleanIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 21H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1" />
      <path d="M9 8 3 14" />
      <path d="M11 6l1-2 4-2 2 1-1 3-3 2-2 1-1 2" />
      <path d="M12 8l4-4" />
    </Svg>
  );
}
function ShowerIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4h12c2 0 3 1.5 3 3.5S18 11 16 11h-4l-1 5" />
      <path d="M7 16l2-5" />
      <path d="M10 21l1-3M5.5 21l1-3" />
    </Svg>
  );
}
function NoPhoneIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07M2 2l20 20" />
      <path d="M3.1 6.55a19.9 19.9 0 0 0-1.1 6.37v3a2 2 0 0 0 2.18 2 .5.5 0 0 0 .3-.13M20.9 17.1a19.9 19.9 0 0 0 1.1-6.37v-3a2 2 0 0 0-2.18-2z" />
    </Svg>
  );
}
function LaptopIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M2 20h20M12 16v1" />
    </Svg>
  );
}
function GuitarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="6.5" cy="17.5" r="4" />
      <path d="M10 14 20 4" />
      <path d="M15 8l3 3-3 3-3-3z" />
    </Svg>
  );
}
function PawIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="5" r="1.6" />
      <circle cx="4" cy="6" r="1.6" />
      <path d="M11 6c-1.2 1.9-3.2 2.9-4.6 5.3-.8 1.4.4 3 1.9 3h5.4c1.5 0 2.7-1.6 1.9-3C14.2 8.9 12.2 7.9 11 6z" />
    </Svg>
  );
}
function CoinsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="9" r="7" />
      <path d="M9 6v6M7.2 8h3.6" />
      <circle cx="15.5" cy="15.5" r="6.5" />
    </Svg>
  );
}
function PaletteIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2C6.5 2 2 6.5 2 12c0 4.9 3.2 8 6.2 8 1.3 0 2.3-1.1 2.3-2.3 0-.8-.4-1.4-.8-1.8-1.2-1.2-1.7-2.4-.5-3.9 1.1-1.4 3.8-.6 6-.2 1 .2 2.4.3 3.2-.5 1.4-1.5 1.4-4.4.8-6.5C18.2 4 15.4 2 12 2z" />
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}
function AlarmIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M12 5V3M6 5 4 3M18 5l2-2" />
    </Svg>
  );
}

export const HABIT_ICONS = [
  'dumbbell', 'runner', 'bike', 'weights', 'meditate', 'water', 'salad', 'apple', 'bed', 'sleepy',
  'book', 'pen', 'brain', 'target', 'sun', 'walk', 'tooth', 'pill', 'clean', 'shower',
  'nophone', 'laptop', 'guitar', 'sprout', 'paw', 'coins', 'read', 'palette', 'talk', 'alarm',
] as const;

const HABIT_ICON_COMPONENTS: Record<string, (p: IconProps) => ReactNode> = {
  dumbbell: DumbbellIcon,
  runner: RunnerIcon,
  bike: BikeIcon,
  weights: WeightsIcon,
  meditate: MeditateIcon,
  water: WaterIcon,
  salad: SaladIcon,
  apple: AppleIcon,
  bed: BedIcon,
  sleepy: SleepyIcon,
  book: BookIcon,
  pen: PenIcon,
  brain: BrainIcon,
  target: TargetIcon,
  sun: SunIcon,
  walk: WalkIcon,
  tooth: ToothIcon,
  pill: PillIcon,
  clean: CleanIcon,
  shower: ShowerIcon,
  nophone: NoPhoneIcon,
  laptop: LaptopIcon,
  guitar: GuitarIcon,
  sprout: SproutIcon,
  paw: PawIcon,
  coins: CoinsIcon,
  read: BookIcon,
  palette: PaletteIcon,
  talk: ChatIcon,
  alarm: AlarmIcon,
};

/** Affiche l'icône d'une habitude (ou une lettre de secours si la valeur stockée est ancienne). */
export function HabitIcon({ emoji, size = 22, fallback }: { emoji: string; size?: number; fallback?: string }) {
  const C = HABIT_ICON_COMPONENTS[emoji];
  if (C) return <>{C({ size })}</>;
  if (fallback) return <span className="habit-glyph" style={{ fontSize: Math.round(size * 0.55) }}>{fallback}</span>;
  return null;
}