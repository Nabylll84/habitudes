export const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#facc15',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#64748b',
];

export type TrackingType = 'binary' | 'amount';

export type FrequencyType = 'daily' | 'weekdays' | 'weekly' | 'challenge';

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  created_at?: string;
  tracking_type?: TrackingType;
  goal_amount?: number | null;
  goal_unit?: string | null;
  frequency_type?: FrequencyType;
  weekdays?: number[] | null;
  times_per_week?: number | null;
  challenge_days?: number | null;
  start_on?: string | null;
  category?: string | null;
  sort_order?: number;
  pinned?: boolean;
  visible_shared?: boolean;
  streak_freezes?: number;
  reminder_enabled?: boolean;
  reminder_time?: string | null;
  reminder_days?: number[] | null;
};

export type HabitCompletion = {
  id: string;
  habit_id: string;
  date: string;
  value: number;
  note: string | null;
};

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
};

export type FriendRequest = {
  id: string;
  from_id: string;
  to_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

export type FriendOverview = {
  id: string;
  username: string;
  avatar_url: string | null;
  habitsCount: number;
  doneToday: number;
  bestStreak: number;
  total: number;
};

export type DailyCount = { date: string; count: number };

export type ProfileView = {
  profile: Profile;
  isSelf: boolean;
  habits: (Habit & { doneToday: boolean; streak: number })[];
  last30: DailyCount[];
  last90: DailyCount[];
  totalCompletions: number;
  weekTotal: number;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

/** Ensemble de dates cochées par habitude */
export type HabitData = {
  habit: Habit;
  dates: Set<string>;
};

export type HabitState = HabitData & {
  doneToday: boolean;
  streak: number;
  /** valeur & note par date (habitudes à compteur) */
  values?: Map<string, { value: number; note: string | null }>;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon_key: string;
};

export type UserBadge = {
  badge_id: string;
  earned_at: string;
};

export type Reaction = {
  id: string;
  habit_id: string;
  from_id: string;
  emoji_key: string;
  created_at: string;
};