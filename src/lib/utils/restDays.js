/**
 * Rest Days utility for Loki OS protocol operations (Speaking Practice, Journal).
 * Days of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 * Default: Saturday (6) is set as Rest Day for Speaking Practice.
 */

export const DEFAULT_SPEAKING_REST_DAYS = [6] // Saturday default

export function getSpeakingRestDays() {
  if (typeof window === 'undefined') return DEFAULT_SPEAKING_REST_DAYS
  try {
    const val = localStorage.getItem('lokios_speaking_rest_days')
    if (val) return JSON.parse(val)
  } catch (e) {
    console.warn('Failed to parse rest days:', e)
  }
  return DEFAULT_SPEAKING_REST_DAYS
}

export function setSpeakingRestDays(daysArray) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lokios_speaking_rest_days', JSON.stringify(daysArray))
  }
}

export function isSpeakingRestDay(dateInput = new Date()) {
  const d = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : new Date(dateInput)
  const dayOfWeek = d.getDay() // 0 = Sun, 6 = Sat
  const restDays = getSpeakingRestDays()
  return restDays.includes(dayOfWeek)
}
