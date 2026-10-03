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
