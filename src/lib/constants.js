export const QUEST_CATEGORIES = [
  { id: 'founder', name: 'Founder', icon: 'Rocket', color: '#d4a843', stat_category: 'founder' },
  { id: 'discipline', name: 'Discipline', icon: 'Target', color: '#e74c3c', stat_category: 'discipline' },
  { id: 'learning', name: 'Learning', icon: 'BookOpen', color: '#3498db', stat_category: 'learning' },
  { id: 'personal_care', name: 'Personal Care', icon: 'Sparkles', color: '#9b59b6', stat_category: 'creation' },
  { id: 'fitness', name: 'Fitness', icon: 'Dumbbell', color: '#2ecc71', stat_category: 'fitness' }
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
  E: { code: 'E', name: 'E-Rank', minXp: 0, maxXp: 999, icon: '◻', color: '#9CA3AF' },
  D: { code: 'D', name: 'D-Rank', minXp: 1000, maxXp: 4999, icon: '◈', color: '#60A5FA' },
  C: { code: 'C', name: 'C-Rank', minXp: 5000, maxXp: 14999, icon: '◆', color: '#818CF8' },
  B: { code: 'B', name: 'B-Rank', minXp: 15000, maxXp: 34999, icon: '⬡', color: '#A78BFA' },
  A: { code: 'A', name: 'A-Rank', minXp: 35000, maxXp: 74999, icon: '✦', color: '#C084FC' },
  S: { code: 'S', name: 'S-Rank', minXp: 75000, maxXp: 149999, icon: '★', color: '#E879F9' },
  Emperor: { code: 'Emperor', name: 'Emperor', minXp: 150000, maxXp: 9999999, icon: '♛', color: '#F59E0B' }
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
  weekly_review: 40
};

export const DIFFICULTY_LEVELS = {
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
