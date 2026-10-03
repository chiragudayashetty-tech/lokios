// Single source of truth for the XP economy (docs/xp-gamification-plan.md).
// Rules apply going forward only; existing ledger rows are never rewritten.

/** Penalty multipliers by consecutive misses: 1st ×1, 2nd ×1.5, 3rd+ capped at ×2. */
export const PENALTY_CAP = 2

export function escalatingPenalty(baseXP, priorMisses = 0) {
  const missStreak = Math.max(1, priorMisses + 1)
  const multiplier = Math.min(PENALTY_CAP, 1 + 0.5 * (missStreak - 1))
  return { missStreak, multiplier, penaltyMagnitude: Math.round(baseXP * multiplier) }
}

export function penaltyLabel(title, { missStreak, multiplier, penaltyMagnitude }, noun = 'routine') {
  return missStreak > 1
    ? `🚨 ESCALATING PENALTY (${missStreak} missed in a row): ${title} (-${penaltyMagnitude} XP, -${multiplier}x)`
    : `Missed ${noun}: ${title} (-${penaltyMagnitude} XP, -1x)`
}

/** Auto-fail only looks this many days back, so returning after a break can't wipe weeks of XP. */
export const AUTOFAIL_BACKFILL_DAYS = 7

/** A day counts towards the streak when at least this share of scheduled habits is done. */
export const STREAK_DAY_THRESHOLD = 0.9

/** Every scheduled habit done. */
export const PERFECT_DAY_XP = 50

/** Streak milestones: re-earnable every new streak run. */
export const STREAK_MILESTONES = [
  { days: 3, xp: 30, label: '🔥 3-day streak' },
  { days: 7, xp: 75, label: '🔥 7-day streak' },
  { days: 10, xp: 100, label: '🔥 10-day streak' },
  { days: 15, xp: 150, label: '🔥 15-day streak' },
  { days: 21, xp: 210, label: '🔥🔥 21-day streak — habit forged' },
  { days: 30, xp: 300, label: '🔥🔥 30-day streak' },
  { days: 45, xp: 450, label: '🔥🔥 45-day streak' },
  { days: 60, xp: 600, label: '🔥🔥 60-day streak' },
  { days: 75, xp: 750, label: '🔥🔥🔥 75-day streak' },
  { days: 100, xp: 1000, label: '🔥🔥🔥 100-day streak' },
  { days: 150, xp: 1500, label: '👑 150-day streak' },
  { days: 200, xp: 2000, label: '👑 200-day streak' },
  { days: 365, xp: 3650, label: '👑 365-day streak — a full year' },
]

/** Next milestone above the current streak (for "3 days → +75" hints). */
export function nextStreakMilestone(streak) {
  return STREAK_MILESTONES.find(m => m.days > streak) || null
}

/** Habits scheduled on a given local date (respecting frequency and creation date). */
export function habitsScheduledOn(habits, dateStr) {
  const dow = new Date(`${dateStr}T12:00:00`).getDay()
  return (habits || []).filter(h => {
    const freq = h.frequency_days || [0, 1, 2, 3, 4, 5, 6]
    if (!freq.includes(dow)) return false
    if (h.created_at && dateStr < String(h.created_at).slice(0, 10)) return false
    return true
  })
}

// ── Game layer (docs/xp-gamification-plan.md §8) ─────────────────────────────

/** Rules below apply from this date on (forward only). */
export const GAME_START_DATE = '2026-10-03'

/** Streak freezes: +1 per 7 qualifying days in a run, hold up to 3. */
export const FREEZE_START_DATE = GAME_START_DATE
export const FREEZE_EVERY_DAYS = 7
export const FREEZE_MAX = 3

/** Mystery chest on Perfect Days. */
export const CHEST_CHANCE = 0.25
export const CHEST_BASE_XP = 50
export const CHEST_MIN_MULT = 1.5
export const CHEST_MAX_MULT = 3

/** First habit completed today pays double; any completion has a 1-in-20 critical hit (×2). */
export const CRIT_CHANCE = 0.05

/** Weekly boss: weakest habit of the last 14 days; hit it 6 of 7 days. */
export const BOSS_XP = 200
export const BOSS_HITS = 6

/** Habit mastery tiers by lifetime completions. */
export const MASTERY_TIERS = [
  { id: 'bronze', label: 'Bronze', at: 30, xp: 50, color: '#E3A36B' },
  { id: 'silver', label: 'Silver', at: 60, xp: 100, color: '#D6E2F0' },
  { id: 'gold', label: 'Gold', at: 100, xp: 200, color: '#FFD166' },
  { id: 'diamond', label: 'Diamond', at: 200, xp: 400, color: '#8FD3FF' },
]
export function masteryTier(completions = 0) {
  return [...MASTERY_TIERS].reverse().find(t => completions >= t.at) || null
}
export function nextMasteryTier(completions = 0) {
  return MASTERY_TIERS.find(t => completions < t.at) || null
}

/** Winter Arc season pass: tiers by XP gained since the season started. */
export const SEASON = {
  id: 'winter',
  name: 'Winter Arc',
  start: '2026-10-01',
  tiers: [
    { at: 500, title: 'First Frost', xp: 25 },
    { at: 1500, title: 'Cold Start', xp: 50 },
    { at: 3000, title: 'Ice Veins', xp: 75 },
    { at: 5000, title: 'Frostbite', xp: 100 },
    { at: 7500, title: 'Blizzard', xp: 125 },
    { at: 10000, title: 'Permafrost', xp: 150 },
    { at: 13000, title: 'Glacier', xp: 175 },
    { at: 16500, title: 'Polar Night', xp: 200 },
    { at: 20500, title: 'Aurora', xp: 250 },
    { at: 25000, title: 'Survived Winter', xp: 500 },
  ],
}

/** Self-staked weekly bets on streak days (90%+ days) this week. */
export const BET_STAKES = [100, 250, 500]
export const BET_TARGETS = [4, 5, 6, 7]

/** Weekly debrief reward. */
export const DEBRIEF_XP = 50

/** Deterministic 0–1 roll from a string, so re-toggling never re-rolls a reward. */
export function seededRoll(key) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}
