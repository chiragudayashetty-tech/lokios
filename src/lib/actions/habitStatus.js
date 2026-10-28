// One habit's status change for a date: the log row, its XP, the streak and the
// game rewards. Shared by the app (useHabitsInternal) and the Claude connector
// (/api/mcp), so both pay exactly the same XP.
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { escalatingPenalty, penaltyLabel } from '@/lib/utils/xpRules'
import { calculateAndUpdateStreak, applyStreakRewards } from '@/lib/utils/streakCalc'
import { applyHabitRewards } from '@/lib/utils/gamification'
import { syncWarRoomHabitChange } from '@/lib/utils/warRoomSync'
import { applyChainRewards } from '@/lib/utils/habitChains'
import { isMissingSchema } from '@/lib/utils/schema'

// habit_logs.completed_at (round-2 migration) orders habit chains; null = unknown
let logsHaveCompletedAt = null

/**
 * Calculates prior consecutive missed/failed scheduled days before targetDateStr for a habit.
 * Returns count of prior consecutive missed days.
 */
export function getConsecutiveMisses(habitId, targetDateStr, allLogs, habit) {
  if (!habit) return 0
  const freqDays = habit.frequency_days || [0, 1, 2, 3, 4, 5, 6]
  let consecutiveMisses = 0

  const cur = new Date(targetDateStr)
  for (let i = 1; i <= 30; i++) {
    cur.setDate(cur.getDate() - 1)
    const curStr = getLocalDateStr(cur)
    const dayOfWeek = cur.getDay()

    // Skip non-scheduled days for this habit
    if (!freqDays.includes(dayOfWeek)) continue

    const log = (allLogs || []).find(l => l.habit_id === habitId && l.date === curStr)
    const status = log ? log.status : null

    if (status === 'completed') {
      // Habit was completed on this scheduled day -> breaks consecutive miss chain
      break
    } else if (status === 'failed' || !status || status === 'none') {
      // Habit was missed or failed on a scheduled day
      consecutiveMisses++
    }
  }

  return consecutiveMisses
}

const getEscalatingPenalty = escalatingPenalty

/** Writes nextStatus ('completed' | 'failed' | 'rest' | 'blocked' | 'none') and settles XP. Returns the saved log (null for 'none'). */
export async function applyHabitStatus({ userId, habitId, habit, habits, monthLogs, existingLog, targetDate, currentStatus, nextStatus }) {
  const supabase = createClient()
  const user = { id: userId }
  const currentTodayStr = getLocalDateStr()
  const stableSourceId = `habit_${habitId}_${targetDate}`

  // 1. Remove previous XP for this specific habit on this target date cleanly
  await robustRemoveXP(user.id, null, stableSourceId)
  // Also clean up any legacy entries keyed by log ID if existingLog was from DB
  if (existingLog && existingLog.id && !existingLog.id.startsWith('opt_') && !existingLog.id.startsWith('virtual_fail_')) {
    await robustRemoveXP(user.id, null, existingLog.id)
  }

  let newLog = null;
  // 2. Database Sync in habit_logs
  if (nextStatus === 'none') {
    await supabase.from('habit_logs').delete().eq('user_id', user.id).eq('habit_id', habitId).eq('date', targetDate)
  } else {
    const row = { user_id: user.id, habit_id: habitId, date: targetDate, status: nextStatus }
    if (logsHaveCompletedAt !== false) row.completed_at = nextStatus === 'completed' ? new Date().toISOString() : null
    let { data: upsertedRows, error: upsertErr } = await supabase.from('habit_logs')
      .upsert(row, { onConflict: 'habit_id,date' })
      .select()
    if (upsertErr && 'completed_at' in row && isMissingSchema(upsertErr)) {
      logsHaveCompletedAt = false
      delete row.completed_at
      ;({ data: upsertedRows, error: upsertErr } = await supabase.from('habit_logs').upsert(row, { onConflict: 'habit_id,date' }).select())
    } else if (!upsertErr && 'completed_at' in row) {
      logsHaveCompletedAt = true
    }
    if (upsertErr) throw upsertErr
    if (upsertedRows && upsertedRows.length > 0) newLog = upsertedRows[0]
  }

  // 3. Award/Penalize New XP anchored to targetDate
  if (nextStatus === 'completed' || nextStatus === 'failed') {
    const targetDayOfWeek = new Date(targetDate).getDay()
    const freqDays = habit?.frequency_days || [0, 1, 2, 3, 4, 5, 6]
    const isBlocked = !freqDays.includes(targetDayOfWeek)
    const baseXP = habit?.xp_per_completion ? Math.max(5, parseInt(habit.xp_per_completion, 10)) : 25
    const createdAt = targetDate === currentTodayStr ? new Date().toISOString() : `${targetDate}T12:00:00.000Z`

    if (nextStatus === 'completed') {
      await robustAwardXP(
        user.id,
        isBlocked ? 0 : baseXP,
        'habit_complete',
        stableSourceId,
        `Completed routine: ${habit?.title || 'Unknown'}`,
        habit?.stat_category || 'discipline',
        createdAt
      )
    } else if (nextStatus === 'failed') {
      const priorMisses = getConsecutiveMisses(habitId, targetDate, monthLogs, habit)
      const { missStreak, multiplier, penaltyMagnitude } = getEscalatingPenalty(baseXP, priorMisses)
      const penaltyXP = isBlocked ? 0 : -penaltyMagnitude
      const reason = penaltyLabel(habit?.title || 'Unknown', { missStreak, multiplier, penaltyMagnitude })
      await robustAwardXP(
        user.id,
        penaltyXP,
        'habit_failed',
        stableSourceId,
        reason,
        habit?.stat_category || 'discipline',
        createdAt
      )
    }
  }

  // Persistently update War Room Battle HP in DB for ALL status transitions
  await syncWarRoomHabitChange(user.id, habitId, habit?.title || 'Habit', currentStatus, nextStatus)

  try {
    // Streak (>= 90% of scheduled habits), re-earnable milestones and the Perfect Day bonus
    const streak = await calculateAndUpdateStreak(user.id, habitId)
    await applyStreakRewards(user.id, streak, targetDate)
    // First win x2, critical hits and mastery tier-ups
    await applyHabitRewards({ userId: user.id, habit, dateStr: targetDate, completed: nextStatus === 'completed', wasCompleted: currentStatus === 'completed', model: streak })
    // Habit chains: bonus for doing this habit right after its predecessor
    const beforeLogs = monthLogs.filter(l => l.date === targetDate)
    const afterLogs = beforeLogs.filter(l => l.habit_id !== habitId)
    if (newLog) afterLogs.push(newLog.completed_at || nextStatus !== 'completed' ? newLog : { ...newLog, completed_at: new Date().toISOString() })
    await applyChainRewards({ userId: user.id, habits, beforeLogs, afterLogs, dateStr: targetDate })
  } catch (e) {
    console.error('Streak update failed:', e)
  }
  return newLog
}
