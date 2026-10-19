// Vacation days: earned, never claimed for free. Every 3 levels earns one day,
// at most 5 can sit in the bank. On a vacation day nothing can cost XP and
// the day neither extends nor breaks the streak.
import { getSettings, saveSettings } from '@/lib/settings'
import { getLocalDateStr } from '@/lib/utils/dates'

export const VACATION = { levelsPerDay: 3, maxBank: 5, maxAheadDays: 30 }

export const vacationDays = (settings = getSettings()) => settings.vacationDays || []
export const isVacationDay = (date, settings) => !!date && vacationDays(settings).includes(date)

/** earned = lifetime days from levels, available = what can be claimed now (bank capped at 5). */
export function vacationStatus(level, settings = getSettings()) {
  const used = vacationDays(settings).length
  const earned = Math.floor(Math.max(0, level || 0) / VACATION.levelsPerDay)
  const unbanked = Math.max(0, earned - used)
  const available = Math.min(VACATION.maxBank, unbanked)
  const nextAtLevel = (Math.floor((level || 0) / VACATION.levelsPerDay) + 1) * VACATION.levelsPerDay
  return { earned, used, available, waiting: unbanked - available, nextAtLevel }
}

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }

/** Claim a vacation day: today or a future day, only from the earned bank. */
export async function claimVacation(date, level, userId) {
  const today = getLocalDateStr()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Pick a date')
  if (date < today) throw new Error('Past days cannot become vacation days')
  if (date > addDays(today, VACATION.maxAheadDays)) throw new Error(`Book at most ${VACATION.maxAheadDays} days ahead`)
  if (isVacationDay(date)) throw new Error('Already a vacation day')
  if (vacationStatus(level).available < 1) throw new Error(`No vacation days in the bank — next one at level ${vacationStatus(level).nextAtLevel}`)
  return saveSettings({ vacationDays: [...vacationDays(), date].sort() }, userId)
}

/** Only a future booking can be returned to the bank; once the day starts it is spent. */
export async function cancelVacation(date, userId) {
  if (date <= getLocalDateStr()) throw new Error('A vacation day that has started cannot be returned')
  return saveSettings({ vacationDays: vacationDays().filter((d) => d !== date) }, userId)
}
