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
  const prior = history.filter((l) => l.bedtime).map((l) => bedMinutesFromNoon(l.bedtime)).filter(Number.isFinite).slice(0, 7)
  if (prior.length < 3) return 25 // not enough nights to judge yet
  const off = Math.abs(bedMinutesFromNoon(bedtimeIso) - median(prior))
  if (off <= 30) return 25
  return clamp(25 * (1 - (off - 30) / 90), 0, 25)
}

/** history = previous logs, newest first (the night being scored excluded). */
export function sleepScore({ bedtime, wake_time: wake, quality }, history = []) {
  const minutes = Math.max(0, Math.round((new Date(wake) - new Date(bedtime)) / 60000)) || 0
  const score = Math.round(durationPoints(minutes) + consistencyPoints(bedtime, history) + clamp(Number(quality) || 0, 0, 5) * 5)
  return { minutes, score: Number.isFinite(score) ? clamp(score, 0, 100) : 0 }
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

/**
 * Sleep routine rule: asleep before 01:00, awake before 09:00, and 7–9 hours of sleep.
 * Times are local; a bedtime after 18:00 counts as "before 1am" for the next morning.
 */
export function sleepRoutineMet({ bedtime, wake_time: wake }) {
  const b = new Date(bedtime), w = new Date(wake)
  if (Number.isNaN(b.getTime()) || Number.isNaN(w.getTime())) return false
  const bedMin = b.getHours() * 60 + b.getMinutes()
  const sleptBefore1 = bedMin >= 18 * 60 || bedMin < 60
  const wokeBefore9 = w.getHours() * 60 + w.getMinutes() < 9 * 60
  const minutes = (w - b) / 60000
  return sleptBefore1 && wokeBefore9 && minutes >= 420 && minutes <= 540
}

/**
 * Sleep XP for one night, from the log (−30 … +40). Priorities:
 *  1. 7–9 h asleep: +20 · 6.5–7 / 9–9.5 h: +10 · 6–6.5 / 9.5–10 h: 0 · under 6 / over 10 h: −10
 *  2. asleep before 00:00: +10 · 00:00–00:30: +5 · 00:30–01:00: 0 · after 01:00: −10
 *  3. up before 09:30: +10 · 09:30–10:00: +5 · 10:00–10:30: 0 · after 10:30: −10
 */
export const SLEEP_XP = { duration: 20, durationNear: 10, bed: 10, bedNear: 5, wake: 10, wakeNear: 5, miss: -10 }
const band = (ok, near, neutral, full, half) => (ok ? full : near ? half : neutral ? 0 : SLEEP_XP.miss)
export function sleepXp({ bedtime, wake_time: wake }) {
  const b = new Date(bedtime), w = new Date(wake)
  if (Number.isNaN(b.getTime()) || Number.isNaN(w.getTime()) || w <= b) return null
  const minutes = Math.round((w - b) / 60000)
  const bm = b.getHours() * 60 + b.getMinutes()
  const after = bm >= 12 * 60 ? -1 : bm // minutes past midnight; evening bedtimes = -1
  const wm = w.getHours() * 60 + w.getMinutes()
  const parts = [
    { id: 'duration', label: '7–9 h asleep', detail: formatDuration(minutes), full: SLEEP_XP.duration,
      xp: band(minutes >= 420 && minutes <= 540, (minutes >= 390 && minutes < 420) || (minutes > 540 && minutes <= 570), (minutes >= 360 && minutes < 390) || (minutes > 570 && minutes <= 600), SLEEP_XP.duration, SLEEP_XP.durationNear) },
    { id: 'bed', label: 'Asleep before 12', detail: hhmmOf(bedtime), full: SLEEP_XP.bed,
      xp: band(after < 0 || after === 0, after > 0 && after <= 30, after > 30 && after <= 60, SLEEP_XP.bed, SLEEP_XP.bedNear) },
    { id: 'wake', label: 'Up before 9:30', detail: hhmmOf(wake), full: SLEEP_XP.wake,
      xp: band(wm < 570, wm >= 570 && wm <= 600, wm > 600 && wm <= 630, SLEEP_XP.wake, SLEEP_XP.wakeNear) },
  ].map((p) => ({ ...p, ok: p.xp === p.full, near: p.xp > 0 && p.xp < p.full, miss: p.xp < 0 }))
  return { minutes, parts, xp: parts.reduce((s, p) => s + p.xp, 0), max: SLEEP_XP.duration + SLEEP_XP.bed + SLEEP_XP.wake }
}

/**
 * Consecutive bad nights (any penalty part) ending the night before `date`. Unlogged nights are
 * skipped — they don't break the run — so not logging is no way out. A clean night ends it.
 */
export function badNightRun(date, logs = []) {
  let run = 0
  for (const l of [...logs].filter((x) => x.date < date && x.bedtime && x.wake_time).sort((a, b) => b.date.localeCompare(a.date))) {
    const sx = sleepXp(l)
    if (!sx) continue
    if (sx.parts.some((p) => p.xp < 0)) run++
    else break
  }
  return run
}

/** Sleep XP with the escalation: penalties double for every bad night in a row (×1, ×2, ×4, … no cap). */
export function sleepXpEscalated(night, history = []) {
  const sx = sleepXp(night)
  if (!sx) return null
  const penalty = sx.parts.reduce((s, p) => s + Math.min(0, p.xp), 0)
  if (!penalty) return { ...sx, multiplier: 1, streak: 0, penalty: 0 }
  const streak = badNightRun(night.date, history) + 1
  const multiplier = 2 ** (streak - 1)
  const bonus = sx.parts.reduce((s, p) => s + Math.max(0, p.xp), 0)
  return { ...sx, xp: bonus + penalty * multiplier, multiplier, streak, penalty: penalty * multiplier }
}
