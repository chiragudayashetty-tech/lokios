import { RANK_CONFIG } from '@/lib/constants'
import { calculateLevel, xpForLevel, getRankForXp } from '@/lib/utils/xp'

const DEFAULT_PRIMARY = '#9CA3AF'

/** Read-only visual tokens derived from the existing XP/rank model. */
export function getThemeForXP(totalXp = 0) {
  const safeXp = Number.isFinite(Number(totalXp)) ? Number(totalXp) : 0
  const rank = getRankForXp(safeXp)
  const config = RANK_CONFIG[rank.code] || RANK_CONFIG.I
  const level = calculateLevel(Math.max(0, safeXp))
  const bandMin = Math.max(0, config.minXp)
  const bandMax = Math.max(bandMin + 1, config.maxXp)
  const progressInBand = Math.max(0, Math.min(1, (safeXp - bandMin) / (bandMax - bandMin)))
  const glow = 0.15 + progressInBand * 0.4
  const hueShift = Math.round(progressInBand * 8)
  const primary = config.color || DEFAULT_PRIMARY

  return {
    rank,
    level,
    progressInBand,
    cssVars: {
      '--saga-primary': primary,
      '--saga-glow': String(glow),
      '--saga-hue-shift': `${hueShift}deg`,
      '--accent-primary': primary,
      '--accent-secondary': primary,
      '--accent-glow': hexToRgba(primary, glow),
      '--accent-subtle': hexToRgba(primary, 0.08),
      '--accent-hover': hexToRgba(primary, 0.86),
      '--accent-pressed': hexToRgba(primary, 0.7),
      '--accent-gradient': `linear-gradient(135deg, ${primary}, ${primary})`,
      '--border-color': hexToRgba(primary, 0.18),
      '--hud-border': hexToRgba(primary, 0.14),
      '--hud-border-active': hexToRgba(primary, 0.38),
      '--game-gold': primary,
      '--game-cyan': primary,
      '--game-violet': primary,
      '--game-border': hexToRgba(primary, 0.22),
      '--game-border-soft': hexToRgba(primary, 0.1),
      '--game-surface': `color-mix(in srgb, ${primary} 5%, #0F131B)`,
      '--game-surface-raised': `color-mix(in srgb, ${primary} 9%, #171D28)`,
      '--bg-secondary': `color-mix(in srgb, ${primary} 3%, #0A0A0A)`,
      '--bg-tertiary': `color-mix(in srgb, ${primary} 6%, #111111)`,
      '--ambient-saga-glow': hexToRgba(primary, 0.08 * (glow / 0.55)),
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
