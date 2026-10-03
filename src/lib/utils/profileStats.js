// Profile (#43): XP per character stat → level on the same curve as the main level.
import { calculateLevel } from '@/lib/utils/xp'

export const STATS = [
  { id: 'founder', label: 'Founder' },
  { id: 'discipline', label: 'Discipline' },
  { id: 'communication', label: 'Communication' },
  { id: 'learning', label: 'Learning' },
  { id: 'creation', label: 'Creation' },
  { id: 'strength', label: 'Strength' },
]
const ALIAS = { fitness: 'strength', personal_care: 'creation', other: 'creation' }

/** rows: [{ amount, stat_category }] or a { stat: xp } map (public profile). */
export function statLevels(rows) {
  const xp = Object.fromEntries(STATS.map((s) => [s.id, 0]))
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (!(r.amount > 0)) continue
      const k = ALIAS[r.stat_category] || r.stat_category || 'discipline'
      if (k in xp) xp[k] += r.amount
    }
  } else if (rows && typeof rows === 'object') {
    for (const [k0, v] of Object.entries(rows)) { const k = ALIAS[k0] || k0; if (k in xp) xp[k] += Number(v) || 0 }
  }
  return STATS.map((s) => ({ ...s, xp: xp[s.id], level: calculateLevel(xp[s.id]) }))
}
