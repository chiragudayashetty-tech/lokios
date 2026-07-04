import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'

export async function calculateAndUpdateStreak(userId, habitId = null) {
  const supabase = createClient()
  try {
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const sixtyDaysAgoStr = getLocalDateStr(sixtyDaysAgo)

    // 1. GLOBAL PROFILE STREAK
    const { data: allLogs } = await supabase.from('habit_logs').select('date').eq('user_id', userId).gte('date', sixtyDaysAgoStr).or('status.eq.completed,status.is.null')
    if (allLogs) {
      const uniqueDates = [...new Set(allLogs.map(l => l.date))].sort().reverse()
      let streak = 0
      
      const today = new Date()
      const todayStr = getLocalDateStr(today)
      
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = getLocalDateStr(yesterday)
      
      let checkDate = new Date(today)
      
      if (uniqueDates.includes(todayStr)) {
        streak = 1
        checkDate = new Date(yesterday)
      } else if (uniqueDates.includes(yesterdayStr)) {
        streak = 1
        checkDate = new Date(yesterday)
        checkDate.setDate(checkDate.getDate() - 1)
      }
      
      while (streak > 0) {
        const checkStr = getLocalDateStr(checkDate)
        if (uniqueDates.includes(checkStr)) {
          streak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }
      
      const { data: prof } = await supabase.from('profiles').select('longest_streak').eq('id', userId).single()
      await supabase.from('profiles').update({ 
        current_streak: streak, 
        longest_streak: Math.max(prof?.longest_streak || 0, streak) 
      }).eq('id', userId)
    }

    // 2. INDIVIDUAL HABIT STREAK
    if (habitId) {
      const { data: habit } = await supabase.from('habits').select('frequency_days').eq('id', habitId).single()
      const freqDays = habit?.frequency_days || [0,1,2,3,4,5,6]

      const { data: habitLogs } = await supabase.from('habit_logs').select('date').eq('user_id', userId).eq('habit_id', habitId).gte('date', sixtyDaysAgoStr).or('status.eq.completed,status.is.null')
      if (habitLogs) {
        const uniqueDates = [...new Set(habitLogs.map(l => l.date))]
        let habitStreak = 0
        
        let checkDate = new Date()
        
        for (let i = 0; i < 60; i++) {
          const checkStr = getLocalDateStr(checkDate)
          const isOffDay = !freqDays.includes(checkDate.getDay())
          const isCompleted = uniqueDates.includes(checkStr)

          if (isCompleted) {
            habitStreak++
          } else if (!isOffDay) {
            // It's an active day and wasn't completed.
            // If it's today, we don't break the streak (they still have time).
            if (i !== 0) {
              break // Streak broken!
            }
          }
          checkDate.setDate(checkDate.getDate() - 1)
        }
        
        await supabase.from('habits').update({ current_streak: habitStreak }).eq('id', habitId)
      }
    }
    
    return true
  } catch (error) {
    console.error('Failed to calculate streak:', error)
    return null
  }
}
