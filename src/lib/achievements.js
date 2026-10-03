// Achievements (#29): definitions live in code. Each check(stats) returns
// { earned, progress, target }. Stats are built from the game state (xp ledger,
// streak model, records) plus a few small counts (see buildAchievementStats).

export const RARITY = {
  common: { label: 'Common', xp: 10, color: '#9aa3b5' },
  rare: { label: 'Rare', xp: 25, color: '#5bc8ff' },
  epic: { label: 'Epic', xp: 50, color: '#a78bfa' },
  legendary: { label: 'Legendary', xp: 100, color: '#ffd166' },
}

export const CATEGORIES = [
  'Streaks', 'Habits', 'Tasks', 'Missions', 'XP & levels', 'Bosses & bets',
  'Budget', 'Journal', 'Screen time', 'Sleep', 'Season',
]

const count = (n, target) => ({ earned: n >= target, progress: Math.min(n, target), target })
const flag = (ok) => ({ earned: !!ok, progress: ok ? 1 : 0, target: 1 })

/** id, name, description, category, rarity, icon (lucide name), check(stats) */
export const ACHIEVEMENTS = [
  // ── Streaks ──
  { id: 'streak_3', name: 'Spark', description: 'Reach a 3-day streak', category: 'Streaks', rarity: 'common', icon: 'Flame', check: (s) => count(s.longestStreak, 3) },
  { id: 'streak_7', name: 'One Week Strong', description: 'Reach a 7-day streak', category: 'Streaks', rarity: 'common', icon: 'Flame', check: (s) => count(s.longestStreak, 7) },
  { id: 'streak_14', name: 'Fortnight', description: 'Reach a 14-day streak', category: 'Streaks', rarity: 'rare', icon: 'Flame', check: (s) => count(s.longestStreak, 14) },
  { id: 'streak_30', name: 'Iron Will', description: 'Reach a 30-day streak', category: 'Streaks', rarity: 'epic', icon: 'Shield', check: (s) => count(s.longestStreak, 30) },
  { id: 'streak_100', name: 'Unbreakable', description: 'Reach a 100-day streak', category: 'Streaks', rarity: 'legendary', icon: 'Crown', check: (s) => count(s.longestStreak, 100) },
  { id: 'perfect_1', name: 'Flawless', description: 'Complete every scheduled habit in a day', category: 'Streaks', rarity: 'common', icon: 'Sparkles', check: (s) => count(s.perfectDays, 1) },
  { id: 'perfect_10', name: 'Perfectionist', description: '10 perfect days', category: 'Streaks', rarity: 'rare', icon: 'Sparkles', check: (s) => count(s.perfectDays, 10) },
  { id: 'perfect_week', name: 'Perfect Week', description: '7 perfect days in one week', category: 'Streaks', rarity: 'epic', icon: 'CalendarCheck', check: (s) => flag(s.perfectWeeks > 0) },
  { id: 'freeze_saved', name: 'Saved by the Freeze', description: 'A streak freeze kept your run alive', category: 'Streaks', rarity: 'rare', icon: 'Snowflake', check: (s) => count(s.freezesUsed, 1) },

  // ── Habits ──
  { id: 'first_blood', name: 'First Blood', description: 'Complete your first habit', category: 'Habits', rarity: 'common', icon: 'Zap', check: (s) => count(s.habitDone, 1) },
  { id: 'habits_50', name: 'Momentum', description: '50 habit completions', category: 'Habits', rarity: 'common', icon: 'Repeat', check: (s) => count(s.habitDone, 50) },
  { id: 'centurion', name: 'Centurion', description: '100 habit completions', category: 'Habits', rarity: 'rare', icon: 'Repeat', check: (s) => count(s.habitDone, 100) },
  { id: 'habits_500', name: 'Machine', description: '500 habit completions', category: 'Habits', rarity: 'epic', icon: 'Cog', check: (s) => count(s.habitDone, 500) },
  { id: 'habits_1000', name: 'Thousand Reps', description: '1,000 habit completions', category: 'Habits', rarity: 'legendary', icon: 'Mountain', check: (s) => count(s.habitDone, 1000) },
  { id: 'mastery_gold', name: 'Gold Standard', description: 'Reach Gold mastery on any habit', category: 'Habits', rarity: 'rare', icon: 'Medal', check: (s) => flag(s.masteryGold > 0) },
  { id: 'mastery_diamond', name: 'Mastery Diamond', description: 'Reach Diamond mastery on any habit', category: 'Habits', rarity: 'legendary', icon: 'Gem', check: (s) => flag(s.masteryDiamond > 0) },
  { id: 'chain_full', name: 'Chain Reaction', description: 'Complete a habit chain of 3+ in order', category: 'Habits', rarity: 'rare', icon: 'Link2', check: (s) => count(s.fullChains, 1) },
  { id: 'chain_10', name: 'Stacked', description: '10 complete habit chains', category: 'Habits', rarity: 'epic', icon: 'Link2', check: (s) => count(s.fullChains, 10) },
  { id: 'crit_5', name: 'Lucky Strikes', description: 'Land 5 critical hits', category: 'Habits', rarity: 'rare', icon: 'Target', check: (s) => count(s.crits, 5) },
  { id: 'chest_3', name: 'Treasure Hunter', description: 'Open 3 mystery chests', category: 'Habits', rarity: 'rare', icon: 'Gift', check: (s) => count(s.chests, 3) },

  // ── Tasks ──
  { id: 'tasks_1', name: 'Shipped', description: 'Complete your first task', category: 'Tasks', rarity: 'common', icon: 'CheckSquare', check: (s) => count(s.tasksDone, 1) },
  { id: 'tasks_25', name: 'Operator', description: '25 tasks completed', category: 'Tasks', rarity: 'common', icon: 'CheckSquare', check: (s) => count(s.tasksDone, 25) },
  { id: 'tasks_100', name: 'Executor', description: '100 tasks completed', category: 'Tasks', rarity: 'rare', icon: 'ListChecks', check: (s) => count(s.tasksDone, 100) },
  { id: 'tasks_500', name: 'Relentless', description: '500 tasks completed', category: 'Tasks', rarity: 'legendary', icon: 'Rocket', check: (s) => count(s.tasksDone, 500) },
  { id: 'blocks_10', name: 'Time Lord', description: 'Honor 10 calendar time blocks', category: 'Tasks', rarity: 'rare', icon: 'CalendarClock', check: (s) => count(s.blocksHonored, 10) },
  { id: 'inbox_zero_1', name: 'Clear Mind', description: 'Reach brain dump inbox zero', category: 'Tasks', rarity: 'common', icon: 'Inbox', check: (s) => count(s.inboxZero, 1) },
  { id: 'inbox_zero_10', name: 'Inbox Zero ×10', description: 'Inbox zero on 10 different days', category: 'Tasks', rarity: 'epic', icon: 'Inbox', check: (s) => count(s.inboxZero, 10) },

  // ── Missions ──
  { id: 'mission_1', name: 'Mission Accomplished', description: 'Complete a mission', category: 'Missions', rarity: 'rare', icon: 'Flag', check: (s) => count(s.missionsDone, 1) },
  { id: 'mission_5', name: 'Campaigner', description: 'Complete 5 missions', category: 'Missions', rarity: 'epic', icon: 'Flag', check: (s) => count(s.missionsDone, 5) },
  { id: 'main_quest', name: 'Main Character', description: 'Complete a main mission', category: 'Missions', rarity: 'epic', icon: 'Crown', check: (s) => count(s.mainDone, 1) },
  { id: 'milestones_10', name: 'Waypoints', description: 'Reach 10 milestones', category: 'Missions', rarity: 'rare', icon: 'MapPin', check: (s) => count(s.milestones, 10) },
  { id: 'portfolio_5', name: 'Proof of Work', description: 'Add 5 portfolio pieces', category: 'Missions', rarity: 'rare', icon: 'Briefcase', check: (s) => count(s.portfolio, 5) },

  // ── XP & levels ──
  { id: 'level_5', name: 'Initiate', description: 'Reach level 5', category: 'XP & levels', rarity: 'common', icon: 'TrendingUp', check: (s) => count(s.level, 5) },
  { id: 'level_10', name: 'Level 10', description: 'Reach level 10', category: 'XP & levels', rarity: 'rare', icon: 'TrendingUp', check: (s) => count(s.level, 10) },
  { id: 'level_25', name: 'Level 25', description: 'Reach level 25', category: 'XP & levels', rarity: 'epic', icon: 'TrendingUp', check: (s) => count(s.level, 25) },
  { id: 'level_50', name: 'Level 50', description: 'Reach level 50', category: 'XP & levels', rarity: 'legendary', icon: 'Crown', check: (s) => count(s.level, 50) },
  { id: 'xp_day_300', name: 'Big Day', description: 'Earn 300 XP in a single day', category: 'XP & levels', rarity: 'rare', icon: 'Zap', check: (s) => count(s.bestDayXp, 300) },
  { id: 'ghost_buster', name: 'Ghost Buster', description: 'Beat your best week', category: 'XP & levels', rarity: 'epic', icon: 'Ghost', check: (s) => count(s.weekRecordsBroken, 1) },

  // ── Bosses & bets ──
  { id: 'boss_1', name: 'Boss Slayer', description: 'Defeat a weekly boss', category: 'Bosses & bets', rarity: 'rare', icon: 'Swords', check: (s) => count(s.bosses, 1) },
  { id: 'boss_5', name: 'Boss Slayer ×5', description: 'Defeat 5 weekly bosses', category: 'Bosses & bets', rarity: 'epic', icon: 'Swords', check: (s) => count(s.bosses, 5) },
  { id: 'boss_10', name: 'Boss Slayer ×10', description: 'Defeat 10 weekly bosses', category: 'Bosses & bets', rarity: 'legendary', icon: 'Skull', check: (s) => count(s.bosses, 10) },
  { id: 'bet_won', name: 'Called It', description: 'Win a weekly bet', category: 'Bosses & bets', rarity: 'rare', icon: 'Dices', check: (s) => count(s.betsWon, 1) },
  { id: 'high_roller', name: 'High Roller', description: 'Win a 500 XP bet', category: 'Bosses & bets', rarity: 'legendary', icon: 'Dices', check: (s) => flag(s.bigBetWon) },

  // ── Budget ──
  { id: 'budget_first', name: 'Bookkeeper', description: 'Log your first expense', category: 'Budget', rarity: 'common', icon: 'Wallet', check: (s) => count(s.budgetDays, 1) },
  { id: 'penny_wise', name: 'Penny Wise', description: '7 days under your daily budget', category: 'Budget', rarity: 'rare', icon: 'PiggyBank', check: (s) => count(s.underBudgetDays, 7) },
  { id: 'frugal_30', name: 'Frugal Month', description: '30 days under your daily budget', category: 'Budget', rarity: 'epic', icon: 'PiggyBank', check: (s) => count(s.underBudgetDays, 30) },
  { id: 'jar_done', name: 'Jar Filled', description: 'Fully fund a savings jar', category: 'Budget', rarity: 'epic', icon: 'Trophy', check: (s) => count(s.jarsDone, 1) },

  // ── Journal ──
  { id: 'journal_1', name: 'Dear Diary', description: 'Write your first journal entry', category: 'Journal', rarity: 'common', icon: 'BookOpen', check: (s) => count(s.journal, 1) },
  { id: 'scribe', name: 'Scribe', description: '30 journal entries', category: 'Journal', rarity: 'rare', icon: 'BookOpen', check: (s) => count(s.journal, 30) },
  { id: 'chronicler', name: 'Chronicler', description: '100 journal entries', category: 'Journal', rarity: 'epic', icon: 'ScrollText', check: (s) => count(s.journal, 100) },
  { id: 'reviews_7', name: 'Reflective', description: '7 end-of-day reviews', category: 'Journal', rarity: 'common', icon: 'Moon', check: (s) => count(s.reviews, 7) },
  { id: 'debrief_4', name: 'Debriefed', description: 'Complete 4 weekly debriefs', category: 'Journal', rarity: 'rare', icon: 'ClipboardCheck', check: (s) => count(s.debriefs, 4) },

  // ── Screen time ──
  { id: 'screen_log_7', name: 'Self-Aware', description: 'Log screen time on 7 days', category: 'Screen time', rarity: 'common', icon: 'Smartphone', check: (s) => count(s.screenDays, 7) },
  { id: 'doom_low_7', name: 'Scroll Breaker', description: '7 days with ≤ 1h doomscrolling', category: 'Screen time', rarity: 'rare', icon: 'ShieldOff', check: (s) => count(s.lowDoomDays, 7) },
  { id: 'focus_3h_10', name: 'Deep Worker', description: '10 days with 3h+ focus', category: 'Screen time', rarity: 'epic', icon: 'Focus', check: (s) => count(s.focusDays, 10) },

  // ── Sleep ──
  { id: 'sleep_log_7', name: 'Sleep Tracker', description: 'Log 7 nights of sleep', category: 'Sleep', rarity: 'common', icon: 'BedDouble', check: (s) => count(s.sleepLogs, 7) },
  { id: 'night_owl_reformed', name: 'Night Owl Reformed', description: '7 nights with a sleep score of 70+', category: 'Sleep', rarity: 'rare', icon: 'Moon', check: (s) => count(s.goodSleep, 7) },
  { id: 'sleep_30', name: 'Well Rested', description: '30 nights with a sleep score of 70+', category: 'Sleep', rarity: 'epic', icon: 'Sunrise', check: (s) => count(s.goodSleep, 30) },

  // ── Season ──
  { id: 'season_t1', name: 'First Frost', description: 'Reach season tier 1', category: 'Season', rarity: 'common', icon: 'Snowflake', check: (s) => count(s.seasonTier, 1) },
  { id: 'season_t5', name: 'Deep Winter', description: 'Reach season tier 5', category: 'Season', rarity: 'rare', icon: 'Snowflake', check: (s) => count(s.seasonTier, 5) },
  { id: 'season_t10', name: 'Winter Arc Complete', description: 'Reach the final season tier', category: 'Season', rarity: 'legendary', icon: 'Mountain', check: (s) => count(s.seasonTier, 10) },
]

export const achievementXp = (a) => RARITY[a.rarity]?.xp || 10

/** Evaluate every achievement against stats. */
export function evaluateAchievements(stats) {
  return ACHIEVEMENTS.map((a) => {
    let r
    try { r = a.check(stats) } catch { r = { earned: false, progress: 0, target: 1 } }
    return { ...a, ...r }
  })
}
