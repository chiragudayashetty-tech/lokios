// ── Loki OS War Room Persistent Battle Sync Engine ───────────────────────────

import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'

/**
 * Persistently updates War Room battle HP in Supabase whenever a habit status changes.
 * - Completed: -15 HP (deal damage to threat pool)
 * - Failed: +20 HP (threat level increases)
 * - Unmarked/Cleared: Reverts previous delta
 */
export async function syncWarRoomHabitChange(userId, habitId, habitTitle, oldStatus, newStatus) {
  if (typeof window === 'undefined' || !userId || !habitId) return null
  if (oldStatus === newStatus) return null

  try {
    const supabase = createClient()
    const { data: bpRow, error: fetchErr } = await supabase
      .from('user_blueprints')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchErr || !bpRow || !bpRow.battles || !Array.isArray(bpRow.battles)) return null

    let updated = false
    const battles = bpRow.battles.map(b => {
      const hasExplicitLinks = b.linked_habits && Array.isArray(b.linked_habits) && b.linked_habits.length > 0
      const isLinked = hasExplicitLinks ? b.linked_habits.includes(habitId) : true
      if (!isLinked) return b

      const currentHp = b.hp !== undefined ? b.hp : 50
      let delta = 0
      const actions = []

      // Calculate Net Delta between oldStatus and newStatus
      if (oldStatus === 'completed') delta += 15 // Revert previous -15
      if (oldStatus === 'failed') delta -= 20   // Revert previous +20

      if (newStatus === 'completed') {
        delta -= 15
        actions.push(`Completed routine "${habitTitle}" (-15 HP to threat)`)
      } else if (newStatus === 'failed') {
        delta += 20
        actions.push(`Failed routine "${habitTitle}" (+20 HP to threat)`)
      } else if (oldStatus === 'completed') {
        actions.push(`Cleared completion of "${habitTitle}" (+15 HP reverted)`)
      } else if (oldStatus === 'failed') {
        actions.push(`Cleared failure of "${habitTitle}" (-20 HP reverted)`)
      }

      if (delta === 0) return b

      const newHp = Math.max(0, Math.min(100, currentHp + delta))
      updated = true

      const logs = b.combat_logs || []
      actions.forEach(act => {
        logs.unshift({
          date: getLocalDateStr(new Date()),
          action: act,
          hpChange: delta
        })
      })

      return {
        ...b,
        hp: newHp,
        status: newHp === 0 ? 'defeated' : 'active',
        combat_logs: logs.slice(0, 30) // Keep latest 30 logs
      }
    })

    if (updated) {
      const { error: saveErr } = await supabase
        .from('user_blueprints')
        .update({ battles })
        .eq('id', bpRow.id)

      if (saveErr) console.error('Error saving updated War Room battles:', saveErr)

      // Dispatch global window event for instant UI update across components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lokios_battles_updated', { detail: battles }))
      }

      return battles
    }
  } catch (e) {
    console.error('Failed to sync War Room battle for habit change:', e)
  }
  return null
}

/**
 * Overnight / New Day Catch-up Evaluator:
 * Evaluates missed scheduled routines from previous days that were left completely unmarked.
 * Adds +20 HP penalty per missed routine to linked battle threats.
 * Carries forward battle.hp baseline without resetting!
 */
export async function syncWarRoomDailyEvaluator(userId) {
  if (typeof window === 'undefined' || !userId) return null

  try {
    const supabase = createClient()
    const todayStr = getLocalDateStr(new Date())

    const { data: bpRow, error: fetchErr } = await supabase
      .from('user_blueprints')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchErr || !bpRow) return null

    const lastEval = bpRow.last_evaluated_date
    if (lastEval === todayStr) {
      // Already evaluated for today
      return bpRow.battles || []
    }

    // New day detected! Process missed routines from yesterday
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = getLocalDateStr(yesterdayDate)

    const { data: habits } = await supabase.from('habits').select('*').eq('user_id', userId).eq('is_archived', false)
    const { data: yesterdayLogs } = await supabase.from('habit_logs').select('*').eq('user_id', userId).eq('date', yesterdayStr)

    const loggedIds = new Set((yesterdayLogs || []).map(l => l.habit_id))
    const yesterdayDayOfWeek = yesterdayDate.getDay()

    let battlesUpdated = false
    const battles = (bpRow.battles || []).map(b => {
      const hasExplicitLinks = b.linked_habits && Array.isArray(b.linked_habits) && b.linked_habits.length > 0
      const habitIdList = hasExplicitLinks ? b.linked_habits : (habits || []).map(h => h.id)

      let hpDelta = 0
      const actions = []

      habitIdList.forEach(habitId => {
        if (habitId === 'sys_screen_intel') return
        const habit = (habits || []).find(h => h.id === habitId)
        if (!habit) return

        const freqDays = habit.frequency_days || [0, 1, 2, 3, 4, 5, 6]
        const wasScheduled = freqDays.includes(yesterdayDayOfWeek)
        if (habit.created_at && yesterdayStr < getLocalDateStr(new Date(habit.created_at))) return

        // If routine was scheduled yesterday and left completely unmarked (not in loggedIds):
        if (wasScheduled && !loggedIds.has(habitId)) {
          hpDelta += 20
          actions.push(`Missed scheduled routine "${habit.title}" yesterday (+20 HP to threat)`)
        }
      })

      if (hpDelta > 0) {
        battlesUpdated = true
        const currentHp = b.hp !== undefined ? b.hp : 50
        const newHp = Math.min(100, currentHp + hpDelta)

        const logs = b.combat_logs || []
        actions.forEach(act => {
          logs.unshift({ date: todayStr, action: act, hpChange: 20 })
        })

        return {
          ...b,
          hp: newHp,
          status: newHp === 0 ? 'defeated' : 'active',
          combat_logs: logs.slice(0, 30)
        }
      }

      return b
    })

    // Update last_evaluated_date and battles in DB
    await supabase
      .from('user_blueprints')
      .update({
        battles,
        last_evaluated_date: todayStr
      })
      .eq('id', bpRow.id)

    if (battlesUpdated && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lokios_battles_updated', { detail: battles }))
    }

    return battles
  } catch (e) {
    console.error('Failed War Room daily evaluator:', e)
  }
  return null
}
