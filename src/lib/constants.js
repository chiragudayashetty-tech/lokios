export const QUEST_CATEGORIES = [
  { id: 'beyond_tatva', name: 'Beyond Tatva', icon: 'Rocket', color: '#d4a843', stat_category: 'founder' },
  { id: 'personal_mission', name: 'Personal Mission', icon: 'Target', color: '#e74c3c', stat_category: 'discipline' },
  { id: 'learning', name: 'Learning', icon: 'BookOpen', color: '#3498db', stat_category: 'learning' },
  { id: 'other', name: 'Other', icon: 'Sparkles', color: '#9b59b6', stat_category: 'creation' },
  { id: 'founder', name: 'Founder (Legacy)', icon: 'Rocket', color: '#d4a843', stat_category: 'founder' },
  { id: 'discipline', name: 'Discipline (Legacy)', icon: 'Target', color: '#e74c3c', stat_category: 'discipline' },
  { id: 'personal_care', name: 'Personal Care (Legacy)', icon: 'Sparkles', color: '#9b59b6', stat_category: 'creation' },
  { id: 'fitness', name: 'Fitness (Legacy)', icon: 'Dumbbell', color: '#2ecc71', stat_category: 'fitness' }
];

export const STAT_CATEGORIES = [
  { id: 'founder', name: 'Founder', icon: 'Rocket', color: '#d4a843' },
  { id: 'discipline', name: 'Discipline', icon: 'Target', color: '#e74c3c' },
  { id: 'communication', name: 'Communication', icon: 'MessageSquare', color: '#2ecc71' },
  { id: 'learning', name: 'Learning', icon: 'BookOpen', color: '#3498db' },
  { id: 'creation', name: 'Creation', icon: 'Palette', color: '#9b59b6' },
  { id: 'strength', name: 'Strength', icon: 'Dumbbell', color: '#e67e22' },
];

export const RANK_CONFIG = {
  Fallen: { code: 'Fallen', name: 'The Fallen', minXp: -999999, maxXp: -1, icon: '💀', color: '#EF4444' },
  I:      { code: 'I',      name: 'Saga I',     minXp: 0,       maxXp: 999,      icon: '🛡️', color: '#9CA3AF' },
  II:     { code: 'II',     name: 'Saga II',    minXp: 1000,    maxXp: 4999,     icon: '🗡️', color: '#60A5FA' },
  III:    { code: 'III',    name: 'Saga III',   minXp: 5000,    maxXp: 14999,    icon: '◆', color: '#818CF8' },
  IV:     { code: 'IV',     name: 'Saga IV',    minXp: 15000,   maxXp: 34999,    icon: '⬡', color: '#A78BFA' },
  V:      { code: 'V',      name: 'Saga V',     minXp: 35000,   maxXp: 74999,    icon: '✦', color: '#C084FC' },
  VI:     { code: 'VI',     name: 'Saga VI',    minXp: 75000,   maxXp: 149999,   icon: '★', color: '#E879F9' },
  VII:    { code: 'VII',    name: 'Saga VII',   minXp: 150000,  maxXp: 299999,   icon: '♛', color: '#F59E0B' },
  VIII:   { code: 'VIII',   name: 'Saga VIII',  minXp: 300000,  maxXp: 9999999,  icon: '∞', color: '#FCD34D' }
};

export const XP_REWARDS = {
  task_complete: 10,
  habit_complete: 5,
  journal_full: 30,
  journal_partial: 15,
  goal_complete_main: 100,
  goal_complete_side: 50,
  goal_complete_weekly: 30,
  goal_complete_long_term: 200,
  brain_dump_capture: 2,
  streak_7_days: 50,
  streak_30_days: 200,
  streak_100_days: 500,
  daily_all_habits: 25,
  weekly_review: 40,
  FOCUS_HOUR: 60
};

export const DIFFICULTY_LEVELS = {
  NONE: { id: 'NONE', label: 'NONE', xp: 0, penalty: 0, color: 'var(--text-muted)' },
  EASY: { id: 'EASY', label: 'EASY', xp: 15, penalty: 0, color: 'var(--info)' },
  MEDIUM: { id: 'MEDIUM', label: 'MEDIUM', xp: 30, penalty: 10, color: 'var(--accent-primary)' },
  HARD: { id: 'HARD', label: 'HARD', xp: 60, penalty: 25, color: 'var(--warning)' },
  EXTREME: { id: 'EXTREME', label: 'EXTREME', xp: 120, penalty: 50, color: 'var(--danger)' }
};

export const MOOD_EMOJIS = [
  { value: 1, emoji: '😞', label: 'Terrible' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' }
];

export const TASK_TYPES = ['one_time', 'recurring', 'quest'];
export const GOAL_TYPES = ['main_quest', 'side_quest', 'long_term', 'weekly', 'daily'];
export const BRAIN_DUMP_TYPES = ['idea', 'task', 'goal', 'note', 'random'];
