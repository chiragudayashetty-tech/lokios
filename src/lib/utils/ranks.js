import { RANK_CONFIG } from '@/lib/constants'

/**
 * Get display info for a rank code.
 * Returns { name, icon, color, gradient }
 */
export function getRankDisplay(rank) {
  const config = RANK_CONFIG[rank]
  if (!config) return getRankDisplay('E')

  return {
    name: config.name,
    icon: config.icon,
    color: config.color,
    gradient: config.gradient,
  }
}

/**
 * Get progress percentage towards the next rank.
 */
export function getRankProgress(totalXp, currentRank) {
  const config = RANK_CONFIG[currentRank]
  if (!config) return 0

  // Already at max rank
  if (config.maxXp === Infinity) return 100

  const rankCodes = Object.keys(RANK_CONFIG)
  const currentIndex = rankCodes.indexOf(currentRank)
  const nextRank = rankCodes[currentIndex + 1]
  if (!nextRank) return 100

  const nextConfig = RANK_CONFIG[nextRank]
  const range = nextConfig.minXp - config.minXp
  const progress = totalXp - config.minXp

  return Math.min(Math.max((progress / range) * 100, 0), 100)
}

/**
 * Get all ranks sorted by minXp (ascending).
 */
export function getAllRanks() {
  return Object.entries(RANK_CONFIG)
    .map(([code, config]) => ({ code, ...config }))
    .sort((a, b) => a.minXp - b.minXp)
}
