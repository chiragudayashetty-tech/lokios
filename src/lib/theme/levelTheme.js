import { RANK_CONFIG } from '@/lib/constants'
import { calculateLevel, xpForLevel, getRankForXp } from '@/lib/utils/xp'

const DEFAULT_PRIMARY = '#9B8CFF'

// Gem bands every 25 levels: Amethyst → Sapphire → Aurora → Opal.
const GEM_BANDS = {
  name: ['Amethyst', 'Sapphire', 'Aurora', 'Opal'],
  bg: ['#07060D', '#060812', '#050A0D', '#0A060D'],
  accent: ['#9B8CFF', '#6FA8FF', '#4FE0C0', '#FF8AD8'],
  accent2: ['#FF7AC6', '#9B8CFF', '#6FD3FF', '#FFB38A'],
  secondary: ['#1E1A3A', '#162447', '#123A36', '#3A1A36'],
  border: ['#2A2550', '#22386A', '#1D5A52', '#5A2A55'],
}

// Seasonal skin layered over the gem bands. Set to null when the arc ends.
// 'winter' also sets <html data-season="winter"> (frost aurora + snowfall in opal.css).
export const ACTIVE_SEASON = 'winter'

const WINTER_BANDS = {
  name: ['Frost', 'Glacier', 'Aurora', 'Polar'],
  bg: ['#050A14', '#050B16', '#04100F', '#0A0814'],
  accent: ['#8FD3FF', '#7FB2FF', '#7DE8E0', '#C4B5FD'],
  accent2: ['#B9A8FF', '#8FD3FF', '#A5F3FC', '#F0ABFC'],
  secondary: ['#12304A', '#152A52', '#0F3A3A', '#2A2152'],
  border: ['#1D4666', '#22386A', '#1D5A52', '#514C82'],
}

function gemTheme(level, season) {
  const bands = season === 'winter' ? WINTER_BANDS : GEM_BANDS
  const band = Math.min(bands.bg.length - 1, Math.floor(Math.max(0, level - 1) / 25))
  return {
    name: bands.name[band],
    bg: bands.bg[band],
    accent: bands.accent[band],
    accent2: bands.accent2[band],
    secondary: bands.secondary[band],
    border: bands.border[band],
  }
}

/** Read-only visual tokens derived from the level-by-level exact palette. */
/** `season` defaults to ACTIVE_SEASON; settings.theme.season can override it (#34). */
export function getThemeForXP(totalXp = 0, season = ACTIVE_SEASON) {
  const safeXp = Number.isFinite(Number(totalXp)) ? Number(totalXp) : 0
  const level = calculateLevel(Math.max(0, safeXp))
  const rank = getRankForXp(safeXp)
  const config = RANK_CONFIG[rank.code] || RANK_CONFIG.I
  
  // Lookup exact per-level theme (clamped between 1 and 100)
  const clampedLevel = Math.max(1, Math.min(100, level))
  const levelTheme = gemTheme(clampedLevel, season)

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
    season,
    cssVars: {
      '--saga-primary': primary,
      '--saga-secondary': secondary,
      '--saga-border': border,
      '--saga-bg': bg,
      '--saga-glow': String(glow),
      '--accent-primary': primary,
      '--accent-2': levelTheme.accent2,
      '--accent-glow': hexToRgba(primary, 0.3 + glow * 0.3),
      '--accent-subtle': hexToRgba(primary, 0.12),
      '--accent-hover': hexToRgba(primary, 0.86),
      '--accent-pressed': hexToRgba(primary, 0.7),
      '--hud-border-active': primary,
      '--game-gold': primary,
      '--game-cyan': '#6FD3FF',
      '--game-violet': primary,
      '--game-border-soft': hexToRgba(primary, 0.12),
      '--ambient-saga-glow': hexToRgba(primary, 0.08),
    },
    lifetimeXp: safeXp,
    currentLevelXp: xpForLevel(level),
  }
}

export function hexToRgba(hex, alpha) {
  const value = String(hex).replace('#', '')
  const normalized = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const int = Number.parseInt(normalized, 16)
  if (Number.isNaN(int)) return `rgba(156, 163, 175, ${alpha})`
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`
}
