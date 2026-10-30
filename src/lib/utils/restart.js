// Restart lock: a reset window before a fresh start. Until RESTART_DATE only the
// pages in OPEN_DURING_LOCK work; everything else shows the restart screen. Lock
// days count as rest days (no penalties, no auto-fails, streak paused).
import { getLocalDateStr } from '@/lib/utils/dates'

export const LOCK_FROM = '2026-10-30'
export const RESTART_DATE = '2026-11-01'
export const OPEN_DURING_LOCK = ['/tasks', '/goals', '/budget', '/settings', '/profile']

export const isLockDay = (date) => !!date && date >= LOCK_FROM && date < RESTART_DATE

export function isLockedPath(pathname, today = getLocalDateStr()) {
  if (!isLockDay(today)) return false
  return !OPEN_DURING_LOCK.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function daysToRestart(today = getLocalDateStr()) {
  return Math.round((new Date(`${RESTART_DATE}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000)
}
