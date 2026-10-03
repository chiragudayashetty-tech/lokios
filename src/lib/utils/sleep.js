// Sleep score (#24): duration 50 + consistency 25 + quality 25 = 0–100.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

/** Minutes of a bedtime measured from noon, so 23:00 and 01:00 sit next to each other. */
export const bedMinutesFromNoon = (iso) => {
  const d = new Date(iso)
  return ((d.getHours() + 12) % 24) * 60 + d.getMinutes()
}

export function median(list) {
  if (!list.length) return null
  const s = [...list].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Duration points: full for 7.5–9h, linear to 0 at 4h and 12h. */
export function durationPoints(minutes) {
  const h = minutes / 60
  if (h >= 7.5 && h <= 9) return 50
  if (h < 7.5) return clamp(50 * (h - 4) / 3.5, 0, 50)
  return clamp(50 * (12 - h) / 3, 0, 50)
}

/** Consistency points: full within ±30 min of the 7-night median bedtime, 0 beyond ±2h. */
export function consistencyPoints(bedtimeIso, history = []) {
  const prior = history.filter((l) => l.bedtime).slice(0, 7).map((l) => bedMinutesFromNoon(l.bedtime))
  if (prior.length < 3) return 25 // not enough nights to judge yet
  const off = Math.abs(bedMinutesFromNoon(bedtimeIso) - median(prior))
  if (off <= 30) return 25
  return clamp(25 * (1 - (off - 30) / 90), 0, 25)
}

/** history = previous logs, newest first (the night being scored excluded). */
export function sleepScore({ bedtime, wake_time: wake, quality }, history = []) {
  const minutes = Math.max(0, Math.round((new Date(wake) - new Date(bedtime)) / 60000))
  const score = Math.round(durationPoints(minutes) + consistencyPoints(bedtime, history) + clamp(Number(quality) || 0, 0, 5) * 5)
  return { minutes, score: clamp(score, 0, 100) }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Bedtime / wake timestamps for a wake-up date from "HH:MM" inputs (bedtime may be the night before).
 * Returns null while an input is empty or partial (a cleared time field sends '').
 */
export function sleepWindow(dateStr, bedHHMM, wakeHHMM) {
  if (!HHMM.test(bedHHMM || '') || !HHMM.test(wakeHHMM || '')) return null
  const wake = new Date(`${dateStr}T${wakeHHMM}:00`)
  const bed = new Date(`${dateStr}T${bedHHMM}:00`)
  if (Number.isNaN(wake.getTime()) || Number.isNaN(bed.getTime())) return null
  if (bed >= wake) bed.setDate(bed.getDate() - 1)
  return { bedtime: bed.toISOString(), wake_time: wake.toISOString() }
}

export const hhmmOf = (iso) => {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const formatDuration = (minutes) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`

export function scoreTone(score) {
  if (score >= 85) return { label: 'Excellent', color: 'var(--success)' }
  if (score >= 70) return { label: 'Good', color: 'var(--info)' }
  if (score >= 50) return { label: 'Fair', color: 'var(--warning)' }
  return { label: 'Poor', color: 'var(--danger)' }
}
