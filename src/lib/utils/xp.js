import { RANK_CONFIG } from '@/lib/constants'

/**
 * Calculate level from total XP.
 * Formula: floor(sqrt(xp / 50)) + 1
 */
export function calculateLevel(totalXp) {
  if (totalXp <= 0) return 1
  return Math.floor(Math.sqrt(totalXp / 50)) + 1
}

/**
 * Calculate XP required to reach a given level.
 * Inverse of calculateLevel: 50 * (level - 1)^2
 */
export function xpForLevel(level) {
  if (level <= 1) return 0
  return 50 * Math.pow(level - 1, 2)
}

/**
 * Calculate progress towards the next level.
 * Returns { current, required, percentage }
 */
export function xpToNextLevel(totalXp) {
  const currentLevel = calculateLevel(totalXp)
  const currentLevelXp = xpForLevel(currentLevel)
  const nextLevelXp = xpForLevel(currentLevel + 1)
  const required = nextLevelXp - currentLevelXp
  const current = totalXp - currentLevelXp

  return {
    current,
    required,
    percentage: required > 0 ? Math.min((current / required) * 100, 100) : 100,
  }
}

/**
 * Get the rank config object for a given XP total.
 */
export function getRankForXp(totalXp) {
  const ranks = Object.entries(RANK_CONFIG)
  for (let i = ranks.length - 1; i >= 0; i--) {
    const [code, config] = ranks[i]
    if (totalXp >= config.minXp) {
      return { code, ...config }
    }
  }
  return { code: 'F', ...RANK_CONFIG.F }
}
