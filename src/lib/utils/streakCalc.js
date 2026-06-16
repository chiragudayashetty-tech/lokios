import { createClient } from '@/lib/supabase/client'

export async function calculateAndUpdateStreak(userId) {
  const supabase = createClient()
  try {
    const { data: allLogs } = await supabase.from('habit_logs').select('date').eq('user_id', userId)
    if (!allLogs) return 0
    
    const uniqueDates = [...new Set(allLogs.map(l => l.date))].sort().reverse()
    let streak = 0
    
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    
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
      const checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
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
    
    return streak
  } catch (error) {
    console.error('Failed to calculate streak:', error)
    return null
  }
}
