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
  if (totalXp < 0) return { code: 'Fallen', ...RANK_CONFIG.Fallen }
  const level = calculateLevel(totalXp)
  return getRankForLevel(level)
}

/**
 * Get the rank config object directly for a given level.
 */
export function getRankForLevel(level) {
  if (level <= 0) return { code: 'Fallen', ...RANK_CONFIG.Fallen }
  if (level <= 10) return { code: 'I', ...RANK_CONFIG.I }
  if (level <= 17) return { code: 'II', ...RANK_CONFIG.II }
  if (level <= 26) return { code: 'III', ...RANK_CONFIG.III }
  if (level <= 38) return { code: 'IV', ...RANK_CONFIG.IV }
  if (level <= 54) return { code: 'V', ...RANK_CONFIG.V }
  if (level <= 77) return { code: 'VI', ...RANK_CONFIG.VI }
  if (level <= 99) return { code: 'VII', ...RANK_CONFIG.VII }
  return { code: 'VIII', ...RANK_CONFIG.VIII }
}
