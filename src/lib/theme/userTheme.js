// Theme picker (#34): settings.theme → <html> attributes + accent override.
// ACTIVE_SEASON is only the default; 'auto' follows it.
import { ACTIVE_SEASON, getThemeForXP, hexToRgba } from '@/lib/theme/levelTheme'

export const SEASONS = [
  { id: 'auto', label: 'Auto', hint: ACTIVE_SEASON ? `Follows the active season (${ACTIVE_SEASON})` : 'No season is running' },
  { id: 'winter', label: 'Winter arc', hint: 'Frost palette, aurora and snow' },
  { id: 'none', label: 'Classic', hint: 'Gem palette, no seasonal effects' },
]

export const ACCENTS = [
  { id: 'level', label: 'By level', color: null },
  { id: 'amethyst', label: 'Amethyst', color: '#9B8CFF', color2: '#FF7AC6' },
  { id: 'sapphire', label: 'Sapphire', color: '#6FA8FF', color2: '#9B8CFF' },
  { id: 'ice', label: 'Ice', color: '#8FD3FF', color2: '#B9A8FF' },
  { id: 'aurora', label: 'Aurora', color: '#4FE0C0', color2: '#6FD3FF' },
  { id: 'opal', label: 'Opal', color: '#FF8AD8', color2: '#FFB38A' },
  { id: 'ember', label: 'Ember', color: '#FFB547', color2: '#FF7A7A' },
]

export const DEFAULT_THEME = { season: 'auto', accent: 'level', snow: true, motion: 'auto', density: 'comfortable' }

export function resolveSeason(theme) {
  const pref = theme?.season || 'auto'
  if (pref === 'none') return null
  if (pref === 'auto') return ACTIVE_SEASON || null
  return pref
}

function accentVars(accent) {
  const a = ACCENTS.find((x) => x.id === accent)
  if (!a?.color) return null
  return {
    '--accent-primary': a.color,
    '--saga-primary': a.color,
    '--accent-2': a.color2,
    '--accent-glow': hexToRgba(a.color, 0.45),
    '--accent-subtle': hexToRgba(a.color, 0.12),
    '--accent-hover': hexToRgba(a.color, 0.86),
    '--accent-pressed': hexToRgba(a.color, 0.7),
    '--hud-border-active': a.color,
    '--game-gold': a.color,
    '--game-violet': a.color,
    '--game-border-soft': hexToRgba(a.color, 0.12),
    '--ambient-saga-glow': hexToRgba(a.color, 0.08),
  }
}

/** Apply level tokens + the user's theme choices to <html>. Safe to call repeatedly. */
export function applyUserTheme(themePref, totalXp = 0) {
  if (typeof document === 'undefined') return
  const t = { ...DEFAULT_THEME, ...(themePref || {}) }
  const root = document.documentElement
  const season = resolveSeason(t)
  const vars = { ...getThemeForXP(totalXp, season).cssVars, ...(accentVars(t.accent) || {}) }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  const set = (k, v) => { if (v) root.dataset[k] = v; else delete root.dataset[k] }
  set('season', season)
  set('snow', t.snow === false ? 'off' : null)
  set('motion', t.motion === 'reduced' ? 'reduced' : null)
  set('density', t.density === 'compact' ? 'compact' : null)
}

/** Runs before hydration (root layout) so the saved theme paints on the first frame. */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('lokios_settings')||'{}').theme||{};var r=document.documentElement;var p=s.season||'auto';var a=${JSON.stringify(ACTIVE_SEASON || '')};var season=p==='none'?'':p==='auto'?a:p;if(season)r.dataset.season=season;else delete r.dataset.season;if(s.snow===false)r.dataset.snow='off';if(s.motion==='reduced')r.dataset.motion='reduced';if(s.density==='compact')r.dataset.density='compact';var acc=${JSON.stringify(Object.fromEntries(ACCENTS.filter((x) => x.color).map((x) => [x.id, x.color])))}[s.accent];if(acc){r.style.setProperty('--accent-primary',acc);r.style.setProperty('--saga-primary',acc);}}catch(e){}})();`
