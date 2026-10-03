import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { STREAK_DAY_THRESHOLD, STREAK_MILESTONES, PERFECT_DAY_XP, habitsScheduledOn, FREEZE_START_DATE, FREEZE_EVERY_DAYS, FREEZE_MAX } from '@/lib/utils/xpRules'
import { applyChestReward } from '@/lib/utils/gamification'

export const LOOKBACK_DAYS = 400
const EXCUSED = new Set(['rest', 'blocked', 'skipped'])

export function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return getLocalDateStr(d)
}

export async function fetchAllLogs(supabase, userId, sinceStr) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id, date, status')
      .eq('user_id', userId)
      .gte('date', sinceStr)
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return rows
}

/** Habits that existed (and were not yet stopped) on a date and are scheduled that weekday. */
function scheduledHabits(habits, dateStr) {
  return habitsScheduledOn(habits, dateStr).filter(h => {
    if (h.is_active !== false) return true
    const stopped = h.stopped_at ? String(h.stopped_at).slice(0, 10) : null
    return stopped ? dateStr < stopped : false
  })
}

/**
 * Pure streak model shared by the streak writer, widgets, heatmap and rewards.
 * - A day qualifies at >= 90% of its scheduled habits (rest/blocked excused).
 * - Today never breaks a streak; it only extends it once it qualifies.
 * - Streak freezes (from FREEZE_START_DATE): +1 per 7 qualifying days in a run
 *   (max 3); a missed past day consumes one instead of breaking the run.
 */
export function buildStreakModel(habits = [], logs = [], todayStr = getLocalDateStr()) {
  const doneByDate = new Map()
  const excusedByDate = new Map()
  const doneCountByHabit = new Map()
  for (const l of logs) {
    const isDone = l.status == null || l.status === 'completed'
    const bucket = isDone ? doneByDate : EXCUSED.has(l.status) ? excusedByDate : null
    if (!bucket) continue
    if (!bucket.has(l.date)) bucket.set(l.date, new Set())
    bucket.get(l.date).add(l.habit_id)
    if (isDone) doneCountByHabit.set(l.habit_id, (doneCountByHabit.get(l.habit_id) || 0) + 1)
  }

  const statsCache = new Map()
  const dayStats = (dateStr) => {
    if (statsCache.has(dateStr)) return statsCache.get(dateStr)
    const excused = excusedByDate.get(dateStr) || new Set()
    const scheduled = scheduledHabits(habits, dateStr).filter(h => !excused.has(h.id))
    const done = doneByDate.get(dateStr) || new Set()
    const doneCount = scheduled.filter(h => done.has(h.id)).length
    const ratio = scheduled.length ? doneCount / scheduled.length : null
    const stats = {
      scheduled: scheduled.length,
      done: doneCount,
      totalDone: done.size,
      ratio,
      qualifies: ratio !== null && ratio >= STREAK_DAY_THRESHOLD,
      perfect: ratio === 1,
    }
    statsCache.set(dateStr, stats)
    return stats
  }

  const sinceStr = shiftDate(todayStr, -LOOKBACK_DAYS)
  const firstHabitDay = habits.reduce((min, h) => {
    const d = h.created_at ? String(h.created_at).slice(0, 10) : todayStr
    return d < min ? d : min
  }, todayStr)

  let cursor = firstHabitDay > sinceStr ? firstHabitDay : sinceStr
  let run = 0, runStart = null, longest = 0, freezes = 0, earnedInRun = 0
  const frozenDates = new Set()
  while (cursor <= todayStr) {
    const stats = dayStats(cursor)
    const freezeEra = cursor >= FREEZE_START_DATE
    if (stats.ratio === null) {
      // nothing scheduled: neither extends nor breaks
    } else if (stats.qualifies) {
      if (run === 0) { runStart = cursor; earnedInRun = 0 }
      run++
      longest = Math.max(longest, run)
      if (freezeEra && Math.floor(run / FREEZE_EVERY_DAYS) > earnedInRun) {
        earnedInRun = Math.floor(run / FREEZE_EVERY_DAYS)
        freezes = Math.min(FREEZE_MAX, freezes + 1)
      }
    } else if (cursor !== todayStr) {
      if (run > 0 && freezeEra && freezes > 0) {
        freezes--
        frozenDates.add(cursor)
      } else {
        run = 0
        runStart = null
      }
    }
    cursor = shiftDate(cursor, 1)
  }

  return { current: run, longest, runStart, freezes, frozenDates, dayStats, doneByDate, doneCountByHabit, todayStr }
}

/**
 * Recomputes the global streak and (optionally) one habit's own streak, saves
 * them to the profile, and returns the model for reward logic.
 */
export async function calculateAndUpdateStreak(userId, habitId = null) {
  const supabase = createClient()
  try {
    const todayStr = getLocalDateStr()
    const [{ data: habits, error: habitsErr }, logs] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId),
      fetchAllLogs(supabase, userId, shiftDate(todayStr, -LOOKBACK_DAYS)),
    ])
    if (habitsErr) throw habitsErr

    const model = buildStreakModel(habits || [], logs, todayStr)

    const { data: prof } = await supabase.from('profiles').select('longest_streak').eq('id', userId).single()
    const longestStreak = Math.max(prof?.longest_streak || 0, model.longest)
    const { error: updErr } = await supabase.from('profiles')
      .update({ current_streak: model.current, streak_days: model.current, longest_streak: longestStreak })
      .eq('id', userId)
    if (updErr) {
      // Before the v2 migration current_streak doesn't exist
      await supabase.from('profiles').update({ streak_days: model.current, longest_streak: longestStreak }).eq('id', userId)
    }

    // Per-habit streak (scheduled days only; today doesn't break it)
    if (habitId) {
      const habit = (habits || []).find(h => h.id === habitId)
      const freqDays = habit?.frequency_days || [0, 1, 2, 3, 4, 5, 6]
      let habitStreak = 0
      for (let i = 0; i < LOOKBACK_DAYS; i++) {
        const dateStr = shiftDate(todayStr, -i)
        const dow = new Date(`${dateStr}T12:00:00`).getDay()
        const done = model.doneByDate.get(dateStr)?.has(habitId)
        if (done) habitStreak++
        else if (freqDays.includes(dow) && i !== 0) break
      }
      await supabase.from('habits').update({ current_streak: habitStreak }).eq('id', habitId)
    }

    return { ...model, longest: longestStreak, habits: habits || [] }
  } catch (error) {
    console.error('Failed to calculate streak:', error)
    return null
  }
}

const awardedThisSession = new Set()

/**
 * Streak milestones (keyed per run, so they're re-earned after a rebuild), the
 * Perfect Day bonus for `dateStr` (revoked if a habit is un-ticked) and the
 * Perfect Day mystery chest. Award calls are idempotent; the Set only avoids
 * repeat network calls.
 */
export async function applyStreakRewards(userId, streak, dateStr = getLocalDateStr()) {
  if (!userId || !streak) return
  const { current, runStart, dayStats } = streak

  if (runStart) {
    for (const m of STREAK_MILESTONES) {
      if (current < m.days) break
      const sourceId = `streak_${m.days}_${runStart}`
      if (awardedThisSession.has(sourceId)) continue
      awardedThisSession.add(sourceId)
      await robustAwardXP(userId, m.xp, 'streak_milestone', sourceId, `${m.label} — +${m.xp} XP bonus`, 'discipline')
    }
  }

  const stats = dayStats(dateStr)
  const perfectId = `perfect_day_${dateStr}`
  const isPerfect = stats.perfect && stats.scheduled > 0
  if (isPerfect) {
    await robustAwardXP(userId, PERFECT_DAY_XP, 'perfect_day', perfectId, `🏆 Perfect day — all ${stats.scheduled} scheduled habits done`, 'discipline', dateStr === getLocalDateStr() ? null : `${dateStr}T12:00:00`)
  } else {
    await robustRemoveXP(userId, 'perfect_day', perfectId)
  }
  await applyChestReward(userId, dateStr, isPerfect)
}
