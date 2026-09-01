import { RANK_CONFIG } from '@/lib/constants'
import { calculateLevel, xpForLevel, getRankForXp } from '@/lib/utils/xp'

const DEFAULT_PRIMARY = '#A7E8FF'

const WINTER_ARC = {
  bg: ['#050A14', '#071222', '#091A2E', '#0B2238'],
  accent: ['#A7E8FF', '#7DD3FC', '#67E8F9', '#C4B5FD'],
  secondary: ['#18344F', '#1D4666', '#245A78', '#3B3A68'],
  border: ['#17314A', '#205071', '#28728D', '#514C82'],
}

function winterTheme(level) {
  const band = Math.min(WINTER_ARC.bg.length - 1, Math.floor(Math.max(0, level - 1) / 25))
  return {
    bg: WINTER_ARC.bg[band],
    accent: WINTER_ARC.accent[band],
    secondary: WINTER_ARC.secondary[band],
    border: WINTER_ARC.border[band],
  }
}

/** Read-only visual tokens derived from the level-by-level exact palette. */
export function getThemeForXP(totalXp = 0) {
  const safeXp = Number.isFinite(Number(totalXp)) ? Number(totalXp) : 0
  const level = calculateLevel(Math.max(0, safeXp))
  const rank = getRankForXp(safeXp)
  const config = RANK_CONFIG[rank.code] || RANK_CONFIG.I
  
  // Lookup exact per-level theme (clamped between 1 and 100)
  const clampedLevel = Math.max(1, Math.min(100, level))
  const levelTheme = winterTheme(clampedLevel)

  const primary = levelTheme.accent || config.color || DEFAULT_PRIMARY
  const secondary = levelTheme.secondary || '#252D52'
  const bg = levelTheme.bg || '#05070D'
  const border = levelTheme.border || '#12182A'

  const bandMin = Math.max(0, config.minXp)
  const bandMax = Math.max(bandMin + 1, config.maxXp)
  const progressInBand = Math.max(0, Math.min(1, (safeXp - bandMin) / (bandMax - bandMin)))
  const glow = 0.2 + progressInBand * 0.35

  return {
    rank,
    level,
    levelTheme,
    progressInBand,
    cssVars: {
      '--saga-primary': primary,
      '--saga-secondary': secondary,
      '--saga-border': border,
      '--saga-bg': bg,
      '--saga-glow': String(glow),
      '--accent-primary': primary,
      '--accent-glow': hexToRgba(primary, glow),
      '--accent-subtle': hexToRgba(primary, 0.08),
      '--accent-hover': hexToRgba(primary, 0.86),
      '--accent-pressed': hexToRgba(primary, 0.7),
      '--hud-border-active': primary,
        '--game-gold': '#BFEFFF',
        '--game-cyan': '#67E8F9',
        '--game-violet': '#A5B4FC',
      '--game-border-soft': hexToRgba(primary, 0.12),
      '--ambient-saga-glow': hexToRgba(primary, 0.08),
    },
    lifetimeXp: safeXp,
    currentLevelXp: xpForLevel(level),
  }
}

function hexToRgba(hex, alpha) {
  const value = String(hex).replace('#', '')
  const normalized = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const int = Number.parseInt(normalized, 16)
  if (Number.isNaN(int)) return `rgba(156, 163, 175, ${alpha})`
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`
}
