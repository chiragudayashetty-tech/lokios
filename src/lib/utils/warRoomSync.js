// ── Loki OS War Room Persistent Battle Sync Engine ───────────────────────────

import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'

/**
 * Persistently updates War Room battle HP when a habit status changes.
 * - Completed: -15 HP (deal damage to threat pool)
 * - Failed/Missed: +20 HP (threat level increases)
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
      return battles
    }
  } catch (e) {
    console.error('Failed to sync War Room battle for habit change:', e)
  }
  return null
}

/**
 * ── Complete War Room Recalculation Engine ──
 * Evaluates active habits and completed operations/tasks over recent days.
 * Deducts -15 HP per completed habit/operation, adds +20 HP per missed/failed habit.
 * Rewards perfect days with 0 HP (Suppressed/Defeated) and updates Supabase permanently!
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

    // 7-day rolling window for completed operations & habit executions
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = getLocalDateStr(sevenDaysAgo)

    const { data: habits } = await supabase.from('habits').select('*').eq('user_id', userId).eq('is_archived', false)
    const { data: recentHabitLogs } = await supabase.from('habit_logs').select('*').eq('user_id', userId).gte('date', sevenDaysAgoStr)
    const { data: recentCompletedTasks } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('status', 'completed')

    let battlesUpdated = false
    const battles = (bpRow.battles || []).map(b => {
      const hasExplicitLinks = b.linked_habits && Array.isArray(b.linked_habits) && b.linked_habits.length > 0
      const habitIdList = hasExplicitLinks ? b.linked_habits : (habits || []).map(h => h.id)

      // 1. Damage from completed habits
      const completedHabitCount = (recentHabitLogs || []).filter(l => 
        l.status === 'completed' && habitIdList.includes(l.habit_id)
      ).length

      // 2. Damage from completed operations/tasks
      const completedTaskCount = (recentCompletedTasks || []).length

      // 3. Threat from failed habits
      const failedHabitCount = (recentHabitLogs || []).filter(l => 
        l.status === 'failed' && habitIdList.includes(l.habit_id)
      ).length

      // 4. Threat from missed scheduled habits over past 3 days
      let missedCount = 0
      for (let i = 1; i <= 3; i++) {
        const checkDate = new Date()
        checkDate.setDate(checkDate.getDate() - i)
        const checkDateStr = getLocalDateStr(checkDate)
        const checkDayOfWeek = checkDate.getDay()

        const dayLogs = (recentHabitLogs || []).filter(l => l.date === checkDateStr)
        const dayCompletedIds = new Set(dayLogs.filter(l => l.status === 'completed').map(l => l.habit_id))

        habitIdList.forEach(hId => {
          const h = (habits || []).find(item => item.id === hId)
          if (!h) return
          const freqDays = h.frequency_days || [0, 1, 2, 3, 4, 5, 6]
          if (h.created_at && checkDateStr < getLocalDateStr(new Date(h.created_at))) return

          if (freqDays.includes(checkDayOfWeek) && !dayCompletedIds.has(hId)) {
            missedCount++
          }
        })
      }

      // Base HP starts at 100. Deduct 15 HP per completed habit & task. Add 20 HP per missed/failed habit.
      const netHp = 100 - (completedHabitCount * 15) - (completedTaskCount * 15) + (missedCount * 20) + (failedHabitCount * 20)
      const calculatedHp = Math.max(0, Math.min(100, netHp))

      if (b.hp !== calculatedHp) {
        battlesUpdated = true
      }

      return {
        ...b,
        hp: calculatedHp,
        status: calculatedHp === 0 ? 'defeated' : 'active'
      }
    })

    // Update last_evaluated_date and battles in DB
    await supabase
      .from('user_blueprints')
      .update({
        battles,
        last_evaluated_date: todayStr
      })
      .eq('id', bpRow.id)

    return battles
  } catch (e) {
    console.error('Failed War Room daily evaluator:', e)
  }
  return null
}
