// "App day" helpers that respect Settings → day boundary (#45): with a 03:00
// boundary, 01:30 on Tuesday still counts as Monday.

import { getLocalDateStr } from '@/lib/utils/dates'
import { getSettings } from '@/lib/settings'

/** Minutes after midnight when the app day rolls over (0 = midnight). */
export function dayBoundaryMinutes(settings = getSettings()) {
  const [h, m] = String(settings.dayBoundary || '00:00').split(':').map(Number)
  const mins = (h || 0) * 60 + (m || 0)
  return Math.min(6 * 60, Math.max(0, mins))
}

/** The app's current date string (YYYY-MM-DD), shifted back before the day boundary. */
export function getAppDateStr(now = new Date(), settings) {
  const shift = dayBoundaryMinutes(settings)
  if (!shift) return getLocalDateStr(now)
  return getLocalDateStr(new Date(now.getTime() - shift * 60000))
}

/** Hour of the app day (0–23, may exceed 23 after midnight before the boundary). */
export function getAppHour(now = new Date(), settings) {
  const shift = dayBoundaryMinutes(settings)
  const h = now.getHours() + now.getMinutes() / 60
  return shift && h * 60 < shift ? h + 24 : h
}

/** Format HH:MM per Settings → time format. */
export function formatClock(hhmm, settings = getSettings()) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (settings.timeFormat !== '12h') return `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
  const ap = h >= 12 ? 'pm' : 'am'
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')}${ap}`
}

export const formatTimeOf = (date, settings) => {
  const d = new Date(date)
  return formatClock(`${d.getHours()}:${d.getMinutes()}`, settings)
}
