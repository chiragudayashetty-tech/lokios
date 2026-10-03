// Screen intel (#44): categories, targets, discipline score and cap streaks.

// Fixed categorical order (validated palette, dark surface); "uncategorized" is a neutral.
export const SCREEN_CATEGORIES = [
  { id: 'social', label: 'Social', color: '#3987e5' },
  { id: 'video', label: 'Video', color: '#d95926' },
  { id: 'productivity', label: 'Productivity', color: '#199e70' },
  { id: 'messaging', label: 'Messaging', color: '#c98500' },
  { id: 'games', label: 'Games', color: '#d55181' },
  { id: 'other', label: 'Other', color: '#9085e9' },
]
export const UNCATEGORIZED = { id: 'uncategorized', label: 'Uncategorized', color: '#5b5a73' }

/** Daily targets used by the XP rule (see screenTimeScore.js). */
export const TARGETS = [
  { id: 'total', label: 'Screen', unit: 'h', target: 6, lowerIsBetter: true, value: (l) => Number(l?.total_hours) || 0 },
  { id: 'doom', label: 'Doomscroll', unit: 'm', target: 60, lowerIsBetter: true, value: (l) => Number(l?.doom_scroll_minutes) || 0 },
  { id: 'focus', label: 'Focus', unit: 'h', target: 3, lowerIsBetter: false, value: (l) => Number(l?.focus_hours) || 0 },
  { id: 'streaming', label: 'Streaming', unit: 'h', target: 1, lowerIsBetter: true, value: (l) => Number(l?.streaming_hours) || 0 },
]

/** Existing digital discipline score: no doom 40 + low unfocused time 35 + low streaming 25. */
export function disciplineScore(log) {
  if (!log) return null
  const total = Number(log.total_hours) || 0
  const focus = Number(log.focus_hours) || 0
  const doom = Number(log.doom_scroll_minutes) || 0
  const streaming = Number(log.streaming_hours) || 0
  const unfocused = Math.max(0, total - focus)
  return Math.round(Math.max(0, 40 * (1 - doom / 120)) + Math.max(0, 35 * (1 - unfocused / 5)) + Math.max(0, 25 * (1 - streaming / 3)))
}

/** Minutes per category for a log; the rest of the total is "uncategorized". */
export function categoryMinutes(log) {
  const cats = log?.categories && typeof log.categories === 'object' ? log.categories : {}
  const out = {}
  let sum = 0
  for (const c of SCREEN_CATEGORIES) { const v = Math.max(0, Number(cats[c.id]) || 0); out[c.id] = v; sum += v }
  out.uncategorized = Math.max(0, Math.round((Number(log?.total_hours) || 0) * 60 - sum))
  return out
}

const dayGap = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000)

/**
 * Consecutive logged days (newest first) where `minutesOf(log)` stayed at or under `cap`.
 * The run must reach today or yesterday; a missing day, or `minutesOf` returning null
 * (no data for that metric), ends it.
 */
export function capStreak(logsDesc, cap, minutesOf, today) {
  if (today) logsDesc = logsDesc.filter((l) => l.date <= today) // e.g. an import dated in another timezone
  if (!logsDesc.length || (today && dayGap(today, logsDesc[0].date) > 1)) return 0
  let run = 0
  let prev = null
  for (const l of logsDesc) {
    if (prev && dayGap(prev, l.date) !== 1) break
    const m = minutesOf(l)
    if (m == null || m > cap) break
    run++
    prev = l.date
  }
  return run
}

/** Category minutes for a cap, or null when the day has no category split. */
export function capMinutes(log, id) {
  if (id === 'doom') return log?.doom_scroll_minutes == null ? null : Number(log.doom_scroll_minutes) || 0
  const cats = log?.categories
  if (!cats || typeof cats !== 'object' || !Object.keys(cats).length) return null
  return Math.max(0, Number(cats[id]) || 0)
}

export const CAP_LABELS = { social: 'Social', video: 'Video', games: 'Games', messaging: 'Messaging', doom: 'Doomscroll' }
export const DEFAULT_CAPS = { social: 60, video: 60, games: 30, doom: 60 }
