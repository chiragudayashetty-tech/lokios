// Quest Categories — each maps to a stat category for XP tracking
export const QUEST_CATEGORIES = [
  {
    id: 'founder',
    name: 'Founder',
    icon: '🚀',
    color: '#6c5ce7',
    stat_category: 'founder',
    defaultHabits: [
      'Work on product for 2 hours',
      'Reach out to 1 potential customer',
      'Review financials',
      'Write 1 social media post',
    ],
  },
  {
    id: 'fitness',
    name: 'Fitness',
    icon: '💪',
    color: '#22c55e',
    stat_category: 'fitness',
    defaultHabits: [
      'Workout for 45 minutes',
      'Drink 3L water',
      'Take 10,000 steps',
      'Stretch for 10 minutes',
    ],
  },
  {
    id: 'learning',
    name: 'Learning',
    icon: '📚',
    color: '#60A5FA',
    stat_category: 'learning',
    defaultHabits: [
      'Read for 30 minutes',
      'Complete 1 course lesson',
      'Practice a skill for 1 hour',
      'Write notes or summary',
    ],
  },
  {
    id: 'personal_care',
    name: 'Personal Care',
    icon: '✨',
    color: '#E879F9',
    stat_category: 'personal_care',
    defaultHabits: [
      'Morning skincare routine',
      'Evening skincare routine',
      'Grooming session',
      'Meditate for 10 minutes',
    ],
  },
  {
    id: 'discipline',
    name: 'Discipline',
    icon: '🎯',
    color: '#F59E0B',
    stat_category: 'discipline',
    defaultHabits: [
      'No social media before noon',
      'Screen time under 3 hours',
      'Wake up before 7 AM',
      'Deep focus block — 2 hours',
    ],
  },
]

// Rank Configuration — XP thresholds and display info
export const RANK_CONFIG = {
  E: {
    name: 'E-Rank',
    icon: '🥉',
    color: '#9CA3AF',
    gradient: 'linear-gradient(135deg, #9CA3AF, #6B7280)',
    minXp: 0,
    maxXp: 499,
  },
  D: {
    name: 'D-Rank',
    icon: '🥈',
    color: '#60A5FA',
    gradient: 'linear-gradient(135deg, #60A5FA, #3B82F6)',
    minXp: 500,
    maxXp: 1999,
  },
  C: {
    name: 'C-Rank',
    icon: '🥇',
    color: '#818CF8',
    gradient: 'linear-gradient(135deg, #818CF8, #6366F1)',
    minXp: 2000,
    maxXp: 4999,
  },
  B: {
    name: 'B-Rank',
    icon: '⭐',
    color: '#A78BFA',
    gradient: 'linear-gradient(135deg, #A78BFA, #8B5CF6)',
    minXp: 5000,
    maxXp: 9999,
  },
  A: {
    name: 'A-Rank',
    icon: '💎',
    color: '#C084FC',
    gradient: 'linear-gradient(135deg, #C084FC, #A855F7)',
    minXp: 10000,
    maxXp: 24999,
  },
  S: {
    name: 'S-Rank',
    icon: '👑',
    color: '#E879F9',
    gradient: 'linear-gradient(135deg, #E879F9, #D946EF)',
    minXp: 25000,
    maxXp: 49999,
  },
  Emperor: {
    name: 'Emperor',
    icon: '🏆',
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    minXp: 50000,
    maxXp: Infinity,
  },
}

// XP rewards for each action
export const XP_REWARDS = {
  task_complete: 10,
  habit_complete: 5,
  journal_full: 30,
  journal_partial: 15,
  goal_complete_main: 100,
  goal_complete_side: 50,
  goal_complete_weekly: 30,
  goal_complete_long_term: 200,
  brain_dump: 2,
  streak_bonus_7: 50,
  streak_bonus_30: 200,
  streak_bonus_100: 500,
  daily_all_habits: 25,
  weekly_review: 40,
}

// Mood levels for journal
export const MOOD_EMOJIS = [
  { value: 1, emoji: '😞', label: 'Terrible' },
  { value: 2, emoji: '😔', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

// Task types
export const TASK_TYPES = ['one_time', 'recurring', 'quest']

// Goal types
export const GOAL_TYPES = ['main_quest', 'side_quest', 'long_term', 'weekly']

// Brain dump item types
export const BRAIN_DUMP_TYPES = ['thought', 'idea', 'task', 'reminder', 'other']
