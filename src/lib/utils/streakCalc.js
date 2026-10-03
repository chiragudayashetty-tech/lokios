import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { STREAK_DAY_THRESHOLD, STREAK_MILESTONES, PERFECT_DAY_XP, habitsScheduledOn } from '@/lib/utils/xpRules'

const LOOKBACK_DAYS = 400
const EXCUSED = new Set(['rest', 'blocked', 'skipped'])

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return getLocalDateStr(d)
}

async function fetchAllLogs(supabase, userId, sinceStr) {
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
 * Recomputes the global streak (a day counts when >= 90% of its scheduled habits
 * are done) and, optionally, one habit's own streak. Today never breaks a streak:
 * it only extends it once it qualifies.
 *
 * Returns { current, longest, runStart, dayStats(dateStr) } or null on failure.
 */
export async function calculateAndUpdateStreak(userId, habitId = null) {
  const supabase = createClient()
  try {
    const todayStr = getLocalDateStr()
    const sinceStr = shiftDate(todayStr, -LOOKBACK_DAYS)

    const [{ data: habits, error: habitsErr }, logs] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId),
      fetchAllLogs(supabase, userId, sinceStr),
    ])
    if (habitsErr) throw habitsErr

    const doneByDate = new Map()
    const excusedByDate = new Map()
    for (const l of logs) {
      const bucket = (l.status == null || l.status === 'completed') ? doneByDate : EXCUSED.has(l.status) ? excusedByDate : null
      if (!bucket) continue
      if (!bucket.has(l.date)) bucket.set(l.date, new Set())
      bucket.get(l.date).add(l.habit_id)
    }

    const dayStats = (dateStr) => {
      const excused = excusedByDate.get(dateStr) || new Set()
      const scheduled = scheduledHabits(habits, dateStr).filter(h => !excused.has(h.id))
      const done = doneByDate.get(dateStr) || new Set()
      const doneCount = scheduled.filter(h => done.has(h.id)).length
      const ratio = scheduled.length ? doneCount / scheduled.length : null
      return { scheduled: scheduled.length, done: doneCount, ratio, qualifies: ratio !== null && ratio >= STREAK_DAY_THRESHOLD, perfect: ratio === 1 }
    }

    // Walk oldest → newest to find the longest run and the current run
    const firstHabitDay = (habits || []).reduce((min, h) => {
      const d = h.created_at ? String(h.created_at).slice(0, 10) : todayStr
      return d < min ? d : min
    }, todayStr)
    let cursor = firstHabitDay > sinceStr ? firstHabitDay : sinceStr
    let run = 0, runStart = null, longest = 0
    while (cursor <= todayStr) {
      const stats = dayStats(cursor)
      if (stats.ratio === null) {
        // nothing scheduled: neither extends nor breaks
      } else if (stats.qualifies) {
        if (run === 0) runStart = cursor
        run++
        longest = Math.max(longest, run)
      } else if (cursor !== todayStr) {
        run = 0
        runStart = null
      }
      cursor = shiftDate(cursor, 1)
    }
    const current = run

    const { data: prof } = await supabase.from('profiles').select('longest_streak').eq('id', userId).single()
    const longestStreak = Math.max(prof?.longest_streak || 0, longest)
    const { error: updErr } = await supabase.from('profiles')
      .update({ current_streak: current, streak_days: current, longest_streak: longestStreak })
      .eq('id', userId)
    if (updErr) {
      // Before the v2 migration current_streak doesn't exist
      await supabase.from('profiles').update({ streak_days: current, longest_streak: longestStreak }).eq('id', userId)
    }

    // Per-habit streak (scheduled days only; today doesn't break it)
    if (habitId) {
      const habit = (habits || []).find(h => h.id === habitId)
      const freqDays = habit?.frequency_days || [0, 1, 2, 3, 4, 5, 6]
      let habitStreak = 0
      for (let i = 0; i < LOOKBACK_DAYS; i++) {
        const dateStr = shiftDate(todayStr, -i)
        const dow = new Date(`${dateStr}T12:00:00`).getDay()
        const done = doneByDate.get(dateStr)?.has(habitId)
        const excused = excusedByDate.get(dateStr)?.has(habitId)
        if (done) habitStreak++
        else if (freqDays.includes(dow) && !excused && i !== 0) break
      }
      await supabase.from('habits').update({ current_streak: habitStreak }).eq('id', habitId)
    }

    return { current, longest: longestStreak, runStart, dayStats }
  } catch (error) {
    console.error('Failed to calculate streak:', error)
    return null
  }
}

const awardedThisSession = new Set()

/**
 * Streak milestones (keyed per run, so they're re-earned after a rebuild) and the
 * Perfect Day bonus for `dateStr` (awarded at 100%, revoked if a habit is un-ticked).
 * Award calls are idempotent server-side; the Set only avoids repeat network calls.
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
  if (stats.perfect && stats.scheduled > 0) {
    await robustAwardXP(userId, PERFECT_DAY_XP, 'perfect_day', perfectId, `🏆 Perfect day — all ${stats.scheduled} scheduled habits done`, 'discipline', dateStr === getLocalDateStr() ? null : `${dateStr}T12:00:00`)
  } else {
    await robustRemoveXP(userId, 'perfect_day', perfectId)
  }
}
