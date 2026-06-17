import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'

export async function calculateAndUpdateStreak(userId, habitId = null) {
  const supabase = createClient()
  try {
    // 1. GLOBAL PROFILE STREAK
    const { data: allLogs } = await supabase.from('habit_logs').select('date').eq('user_id', userId)
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
      const { data: habitLogs } = await supabase.from('habit_logs').select('date').eq('user_id', userId).eq('habit_id', habitId)
      if (habitLogs) {
        const uniqueDates = [...new Set(habitLogs.map(l => l.date))].sort().reverse()
        let habitStreak = 0
        
        const today = new Date()
        const todayStr = getLocalDateStr(today)
        
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = getLocalDateStr(yesterday)
        
        let checkDate = new Date(today)
        
        if (uniqueDates.includes(todayStr)) {
          habitStreak = 1
          checkDate = new Date(yesterday)
        } else if (uniqueDates.includes(yesterdayStr)) {
          habitStreak = 1
          checkDate = new Date(yesterday)
          checkDate.setDate(checkDate.getDate() - 1)
        }
        
        while (habitStreak > 0) {
          const checkStr = getLocalDateStr(checkDate)
          if (uniqueDates.includes(checkStr)) {
            habitStreak++
            checkDate.setDate(checkDate.getDate() - 1)
          } else {
            break
          }
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
