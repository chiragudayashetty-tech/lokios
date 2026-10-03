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

export function getSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }
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
  const merged = { ...DEFAULT_SETTINGS, ...profile.settings }
  if (JSON.stringify(merged) !== JSON.stringify(getSettings())) writeLocal(merged, userId)
}

export function onSettingsChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
