// User-tunable rules and preferences. Cached in localStorage (instant, works
// offline) and synced to profiles.settings (jsonb) so every device matches.
// See supabase/migrations/20261005_profile_settings.sql.

import { createClient } from '@/lib/supabase/client'

export const DEFAULT_SETTINGS = {
  streakThreshold: 0.9,      // share of scheduled habits for a streak day
  penaltyCap: 2,             // max penalty multiplier for repeated misses
  autofailDays: 7,           // how many days back missed habits are auto-failed
  perfectDayXp: 50,          // bonus for completing every scheduled habit
  dailyBudget: 1000,         // ₹ daily allowance
  monthlyBills: 10000,       // ₹ monthly bills & subscriptions limit
  seasonStart: '2026-10-01', // Winter Arc season pass start
  reminderEnabled: false,    // evening "habits left" notification
  reminderTime: '21:00',
  sundayRecap: true,         // weekly scorecard popup on first open each Sunday
  // Round 2
  defaultHabitXp: 25,        // XP for new habits
  defaultTimeOfDay: 'anytime', // morning | afternoon | evening | anytime
  weekStart: 1,              // 1 = Monday, 0 = Sunday
  timeFormat: '24h',         // '12h' | '24h'
  dayBoundary: '00:00',      // a day ends at this time (night owls: '03:00')
  currency: '₹',
  habitReminders: {},        // { [habitId]: 'HH:MM' }
  streakNudge: false,        // "streak at risk" nudge
  streakNudgeTime: '22:00',
  theme: { season: 'auto', accent: 'level', snow: true, motion: 'auto', density: 'comfortable' },
  screenCaps: { social: 60, video: 60, games: 30, doom: 60 }, // daily caps in minutes (#44)
}

const KEY = 'lokios_settings'
const listeners = new Set()

/**
 * Merge stored values over the defaults, dropping anything null or of the wrong
 * type (old or hand-edited settings must never replace a default with junk).
 * Nested objects (theme) are merged key by key; free-form maps (habitReminders,
 * screenCaps) only need to be plain objects.
 */
export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const out = { ...DEFAULT_SETTINGS }
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
  for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
    let v = src[k]
    if (v == null) continue
    if (typeof def === 'number' && typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) v = Number(v)
    if (typeof def === 'number' && (typeof v !== 'number' || !Number.isFinite(v))) continue
    if (typeof def === 'boolean' && typeof v !== 'boolean') continue
    if (typeof def === 'string' && typeof v !== 'string') continue
    if (isObj(def)) {
      if (!isObj(v)) continue
      v = k === 'theme' ? normalizeTheme(v) : v
    }
    out[k] = v
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(out.dayBoundary)) out.dayBoundary = DEFAULT_SETTINGS.dayBoundary
  if (out.weekStart !== 0 && out.weekStart !== 1) out.weekStart = DEFAULT_SETTINGS.weekStart
  return out
}

function normalizeTheme(t) {
  const out = { ...DEFAULT_SETTINGS.theme }
  for (const [k, def] of Object.entries(DEFAULT_SETTINGS.theme)) if (t[k] != null && typeof t[k] === typeof def) out[k] = t[k]
  return out
}

export function getSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(KEY) || '{}'))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeLocal(settings, userId) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
    if (userId) {
      // Budget pages read these keys directly
      localStorage.setItem(`lokios_daily_budget_limit_${userId}`, String(settings.dailyBudget))
      localStorage.setItem(`lokios_monthly_bills_budget_${userId}`, String(settings.monthlyBills))
    }
  } catch {}
  listeners.forEach(fn => fn(settings))
}

/** Save a partial update locally and to the profile (ignored if the column doesn't exist yet). */
export async function saveSettings(patch, userId) {
  const next = { ...getSettings(), ...patch }
  writeLocal(next, userId)
  if (userId) {
    const { error } = await createClient().from('profiles').update({ settings: next }).eq('id', userId)
    if (error) return { synced: false, error }
  }
  return { synced: !!userId }
}

/** Adopt settings stored on the profile (called after login / profile fetch). */
export function hydrateSettingsFromProfile(profile, userId) {
  if (!profile?.settings || typeof profile.settings !== 'object') return
  const merged = normalizeSettings(profile.settings)
  if (JSON.stringify(merged) !== JSON.stringify(getSettings())) writeLocal(merged, userId)
}

export function onSettingsChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
