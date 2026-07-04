'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { getLocalDateStr } from '@/lib/utils/dates'
import { calculateAndUpdateStreak } from '@/lib/utils/streakCalc'

export function useHabitsInternal(user) {
  const [habits, setHabits] = useState([])
  const [monthLogs, setMonthLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const processingRef = useRef(new Set())
  const autoFailRanRef = useRef(false)
  const supabase = createClient()

  const todayStr = getLocalDateStr()

  // Derive todayLogs from monthLogs for backward compat
  const todayLogs = useMemo(() => {
    return monthLogs.filter((l) => l.date === todayStr)
  }, [monthLogs, todayStr])

  const fetchHabits = useCallback(async (year, month) => {
    if (!user) {
      setHabits([])
      setMonthLogs([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Calculate month range
      const now = new Date()
      const y = year ?? now.getFullYear()
      const m = month ?? now.getMonth() // 0-indexed
      const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const lastDay = new Date(y, m + 1, 0) // last day of month
      const lastDayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

      const [habitsRes, logsRes, xpRes] = await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('habit_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', firstDay)
          .lte('date', lastDayStr),
        supabase
          .from('xp_history')
          .select('source_id, created_at')
          .eq('user_id', user.id)
          .eq('source_type', 'habit_failed')
          .gte('created_at', firstDay)
      ])

      if (habitsRes.error) throw habitsRes.error
      if (logsRes.error) throw logsRes.error

      // Merge real logs with virtual failed logs from xp_history
      const realLogs = logsRes.data || []
      const virtualFailedLogs = (xpRes.data || []).map(xp => ({
        id: `virtual_fail_${xp.source_id}_${xp.created_at}`,
        habit_id: xp.source_id,
        date: getLocalDateStr(new Date(xp.created_at)),
        status: 'failed'
      }))

      setHabits(habitsRes.data || [])
      setMonthLogs([...realLogs, ...virtualFailedLogs])
      
      // Admin one-time DB clear script if flag not found (Reset tracking from Jun 15)
      // Removed destructive DB reset to prevent accidental data loss.

    } catch (err) {
      console.error('Error fetching habits:', err)
      setError(err.message || JSON.stringify(err) || 'Failed to load data. Please refresh and try again.')
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [user])

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  // Cycle habit state: none -> completed -> failed -> none
  const cycleHabitState = useCallback(async (habitId, dateStr, forceStatus = null) => {
    if (!user) return null
    const currentTodayStr = getLocalDateStr()
    const targetDate = dateStr || currentTodayStr

    const existingLog = monthLogs.find((l) => l.habit_id === habitId && l.date === targetDate)
    const currentStatus = existingLog ? (existingLog.status || 'completed') : 'none'
    
    let nextStatus = forceStatus
    if (!nextStatus) {
      nextStatus = 'completed'
      if (currentStatus === 'completed') nextStatus = 'failed'
      if (currentStatus === 'failed') nextStatus = 'none'
    }

    // Skip if we are trying to force a status that is already the current status
    if (forceStatus && currentStatus === forceStatus) return true;

    const procKey = `${habitId}_${targetDate}_cycle`
    if (processingRef.current.has(procKey)) return null
    processingRef.current.add(procKey)

    // Optimistic UI Update
    const optimisticId = `opt_${habitId}_${crypto.randomUUID()}`
    setMonthLogs(prev => {
      const filtered = prev.filter(l => !(l.habit_id === habitId && l.date === targetDate))
      if (nextStatus === 'completed') {
        return [...filtered, { id: optimisticId, habit_id: habitId, date: targetDate, status: 'completed' }]
      } else if (nextStatus === 'failed') {
        return [...filtered, { id: optimisticId, habit_id: habitId, date: targetDate, status: 'failed' }]
      } else if (nextStatus === 'blocked') {
        return [...filtered, { id: optimisticId, habit_id: habitId, date: targetDate, status: 'blocked' }]
      }
      return filtered
    })

    try {
      // 1. XP Adjustments: Remove any XP given from the previous state
      // Query DB to find real log IDs to remove XP correctly (bypass optimistic UI bugs)
      const { data: realLogs } = await supabase.from('habit_logs').select('id, status').eq('user_id', user.id).eq('habit_id', habitId).eq('date', targetDate)
      if (realLogs && realLogs.length > 0) {
        for (const realLog of realLogs) {
          if (realLog.status === 'failed') {
            await robustRemoveXP(user.id, 'habit_failed', realLog.id)
          } else if (!realLog.status || realLog.status === 'completed') {
            await robustRemoveXP(user.id, 'habit_complete', realLog.id)
          }
        }
      }

      // 2. Database Sync
      if (nextStatus === 'none') {
        // Find all real IDs for this date and delete them (handles duplicates)
        const { data: rows } = await supabase.from('habit_logs').select('id').eq('user_id', user.id).eq('habit_id', habitId).eq('date', targetDate)
        if (rows && rows.length > 0) {
          await supabase.from('habit_logs').delete().in('id', rows.map(r => r.id))
        }
      } else {
        // Try UPDATE first to avoid constraint conflicts or RLS delete silent fails
        const { data: updatedRows, error: updateErr } = await supabase.from('habit_logs')
          .update({ status: nextStatus })
          .eq('user_id', user.id)
          .eq('habit_id', habitId)
          .eq('date', targetDate)
          .select()
          
        let newLog;
        if (!updateErr && updatedRows && updatedRows.length > 0) {
          newLog = updatedRows[0]
          // If duplicates were spawned by previous bugs, clean them up safely by explicit ID
          if (updatedRows.length > 1) {
            const extraIds = updatedRows.slice(1).map(r => r.id)
            await supabase.from('habit_logs').delete().in('id', extraIds)
          }
        } else {
          // If no rows were updated (none existed), gracefully INSERT
          const { data: insertedRows, error: insertErr } = await supabase.from('habit_logs')
            .insert({ user_id: user.id, habit_id: habitId, date: targetDate, status: nextStatus })
            .select()
          if (insertErr) throw insertErr
          newLog = insertedRows[0]
        }
        
        // Update optimistic UI with real DB log
        setMonthLogs(prev => prev.map(l => l.id === optimisticId ? newLog : l))

        // Award New XP
        if (newLog) {
          const habit = habits.find((h) => h.id === habitId)
          const targetDayOfWeek = new Date(targetDate).getDay()
          const freqDays = habit?.frequency_days || [0, 1, 2, 3, 4, 5, 6]
          const isBlocked = !freqDays.includes(targetDayOfWeek)
          
          if (nextStatus === 'completed') {
            await robustAwardXP(user.id, isBlocked ? 0 : (habit?.xp_per_completion || 25), 'habit_complete', newLog.id, `Completed routine: ${habit?.title || 'Unknown'}`, habit?.stat_category || 'discipline')
          } else if (nextStatus === 'failed') {
            await robustAwardXP(user.id, isBlocked ? 0 : -15, 'habit_failed', newLog.id, `Failed routine: ${habit?.title || 'Unknown'}`, habit?.stat_category || 'discipline')
          }
        }
      }

      try { 
        await calculateAndUpdateStreak(user.id, habitId)
        const { data } = await supabase.from('habits').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: true })
        if (data) setHabits(data)

        // ── DAILY ALL-HABITS BONUS ──
        // Check if every active habit has a completed log for today
        if (nextStatus === 'completed' && targetDate === currentTodayStr && data) {
          const dailyBonusKey = `daily_all_bonus_${currentTodayStr}`
          if (!localStorage.getItem(dailyBonusKey)) {
            // Get the latest monthLogs state to check completion
            const todayCompletedIds = new Set()
            // Include the one we just completed
            todayCompletedIds.add(habitId)
            // Plus existing completed logs for today
            monthLogs.forEach(l => {
              if (l.date === currentTodayStr && (!l.status || l.status === 'completed')) {
                todayCompletedIds.add(l.habit_id)
              }
            })
            const allDone = data.every(h => todayCompletedIds.has(h.id))
            if (allDone && data.length > 0) {
              await robustAwardXP(user.id, XP_REWARDS.daily_all_habits || 25, 'daily_all_complete', currentTodayStr, '🏆 100% OPERATIONAL — All daily ops completed!', 'discipline')
              localStorage.setItem(dailyBonusKey, 'true')
            }
          }
        }

        // ── STREAK MILESTONE REWARDS ──
        const { data: profileData } = await supabase.from('profiles').select('streak_days').eq('id', user.id).single()
        if (profileData?.streak_days) {
          const streak = profileData.streak_days
          const milestones = [
            { days: 7, xp: XP_REWARDS.streak_7_days || 50, label: '🔥 7-Day Streak!' },
            { days: 30, xp: XP_REWARDS.streak_30_days || 200, label: '🔥🔥 30-Day Streak!' },
            { days: 100, xp: XP_REWARDS.streak_100_days || 500, label: '🔥🔥🔥 100-Day Streak!' }
          ]
          for (const milestone of milestones) {
            if (streak >= milestone.days) {
              const streakKey = `streak_reward_${milestone.days}`
              if (!localStorage.getItem(streakKey)) {
                await robustAwardXP(user.id, milestone.xp, 'streak_milestone', `streak_${milestone.days}`, `${milestone.label} — ${milestone.xp} XP bonus unlocked!`, 'discipline')
                localStorage.setItem(streakKey, 'true')
              }
            }
          }
        }
      } catch (e) {
        console.error('Streak update failed:', e)
      }
      return true
    } catch (error) {
      console.error('Error cycling habit:', error)
      alert(`SYSTEM ERROR: ${error.message || JSON.stringify(error)}`)
      // DEBUG: Log error to xp_history so I can read it
      supabase.from('xp_history').insert({
        user_id: user.id,
        amount: 0,
        source_type: 'error_log',
        source_id: habitId,
        description: String(error.message || JSON.stringify(error))
      }).then()
      
      // Rollback optimistic update
      setMonthLogs(prev => {
        const filtered = prev.filter(l => l.id !== optimisticId)
        if (existingLog) {
          return [...filtered, existingLog]
        }
        return filtered
      })
      return null
    } finally {
      processingRef.current.delete(procKey)
    }
  }, [user, habits, monthLogs, todayStr])

  // Backward-compat wrapper
  const toggleHabitForDate = useCallback(async (habitId, dateStr, newStatus) => {
    return cycleHabitState(habitId, dateStr, newStatus)
  }, [cycleHabitState])

  // Simple toggle checking/unchecking for UI elements
  const toggleHabit = useCallback(async (habitId) => {
    const existingLog = monthLogs.find((l) => l.habit_id === habitId && l.date === todayStr)
    const currentStatus = existingLog ? (existingLog.status || 'completed') : 'none'
    const nextStatus = currentStatus === 'completed' ? 'none' : 'completed'
    return cycleHabitState(habitId, todayStr, nextStatus)
  }, [monthLogs, todayStr, cycleHabitState])

  const addHabit = useCallback(async (data) => {
    if (!user) return null

    try {
      const { data: newHabit, error } = await supabase
        .from('habits')
        .insert({ ...data, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      setHabits((prev) => [...prev, newHabit])
      return newHabit
    } catch (error) {
      console.error('Error adding habit:', error)
      return null
    }
  }, [user])

  const deleteHabit = useCallback(async (habitId) => {
    if (!user) return null
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id)
      if (error) throw error
      setHabits((prev) => prev.filter((h) => h.id !== habitId))
      return true
    } catch (error) {
      console.error('Error deleting habit:', error)
      return null
    }
  }, [user])

  const archiveHabit = useCallback(async (habitId) => {
    if (!user) return
    try {
      const { error } = await supabase.from('habits').update({ is_active: false }).eq('id', habitId).eq('user_id', user.id)
      if (error) throw error
      setHabits((prev) => prev.filter((h) => h.id !== habitId))
    } catch (error) {
      console.error('Error archiving habit:', error)
    }
  }, [user])

  const updateHabit = useCallback(async (habitId, updates) => {
    if (!user) return null
    try {
      const { data, error } = await supabase.from('habits').update(updates).eq('id', habitId).eq('user_id', user.id).select().single()
      if (error) throw error
      setHabits((prev) => prev.map(h => h.id === habitId ? data : h))
      return data
    } catch (error) {
      console.error('Error updating habit:', error)
      if (typeof window !== 'undefined') {
        alert("DB Update Error: " + (error.message || JSON.stringify(error)))
      }
      return null
    }
  }, [user])

  const reorderHabits = useCallback(async (habitId, direction) => {
    const sorted = [...habits].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const index = sorted.findIndex(h => h.id === habitId)
    if (index === -1) return
    
    let swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return
    
    const habitA = { ...sorted[index] }
    const habitB = { ...sorted[swapIndex] }
    const tempTime = habitA.created_at
    habitA.created_at = habitB.created_at
    habitB.created_at = tempTime
    
    sorted[index] = habitA
    sorted[swapIndex] = habitB
    
    const newSorted = [...sorted].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    setHabits(newSorted)
    
    await Promise.all([
      supabase.from('habits').update({ created_at: habitA.created_at }).eq('id', habitA.id).eq('user_id', user.id),
      supabase.from('habits').update({ created_at: habitB.created_at }).eq('id', habitB.id).eq('user_id', user.id)
    ])
  }, [habits, user])

  // Auto-fail untouched habits
  useEffect(() => {
    if (!initialized || !user || habits.length === 0 || autoFailRanRef.current) return
    
    const runAutoFail = async () => {
      if (localStorage.getItem('daily_ops_autofail_ran_today') === todayStr) {
        autoFailRanRef.current = true
        return
      }
      
      const storedResetDate = localStorage.getItem('last_reset_date')
      // Default to June 29th, 2026 so users returning at the end of June aren't retroactively penalized for the whole month
      const RESET_DATE = storedResetDate ? new Date(storedResetDate) : new Date('2026-06-29T00:00:00Z')
      const now = new Date()
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(now.getDate() - 30)

      let globalStartDate = Math.max(RESET_DATE.getTime(), thirtyDaysAgo.getTime())
      for (const h of habits) {
        const hc = new Date(h.created_at).getTime()
        if (hc < globalStartDate) globalStartDate = hc // Wait, we actually want the oldest possible start date across all habits, bounded by 30 days ago.
      }
      globalStartDate = Math.max(globalStartDate, thirtyDaysAgo.getTime(), RESET_DATE.getTime())
      
      const { data: recentLogs } = await supabase
        .from('habit_logs')
        .select('habit_id, date')
        .eq('user_id', user.id)
        .gte('date', getLocalDateStr(new Date(globalStartDate)))

      const logMap = new Set((recentLogs || []).map(l => `${l.habit_id}_${l.date}`))
      
      let createdAny = false
      let newVirtualLogs = []
      let dbInsertPayloads = []
      
      for (const h of habits) {
        const habitCreatedDate = new Date(h.created_at)
        let startDate = new Date(Math.max(RESET_DATE.getTime(), habitCreatedDate.getTime(), thirtyDaysAgo.getTime()))
        
        for (let d = new Date(startDate); ; d.setDate(d.getDate() + 1)) {
          const dateStr = getLocalDateStr(d)
          if (dateStr >= todayStr) break // NEVER auto-fail today or future dates!
          
          const dayOfWeek = d.getDay()
          const freqDays = h.frequency_days || [0, 1, 2, 3, 4, 5, 6]
          
          // Skip auto-fail if today is not a scheduled day for this habit
          if (!freqDays.includes(dayOfWeek)) continue;

          if (!logMap.has(`${h.id}_${dateStr}`)) {
            const procKey = `${h.id}_${dateStr}_autofail`
            if (!processingRef.current.has(procKey)) {
              processingRef.current.add(procKey)
              await robustAwardXP(user.id, -15, 'habit_failed', h.id, `Missed routine: ${h.title}`, h.stat_category || 'discipline')
              
              const failId = `virtual_fail_${h.id}_auto_${Date.now()}_${Math.random()}`
              newVirtualLogs.push({ id: failId, habit_id: h.id, date: dateStr, status: 'failed' })
              dbInsertPayloads.push({ user_id: user.id, habit_id: h.id, date: dateStr, status: 'failed' })
              createdAny = true
            }
          }
        }
      }
      
      if (dbInsertPayloads.length > 0) {
        await supabase.from('habit_logs').insert(dbInsertPayloads)
      }
      
      if (newVirtualLogs.length > 0) {
        setMonthLogs(prev => {
          // Only add logs that belong to the currently viewed month (monthLogs might only be partial)
          return [...prev, ...newVirtualLogs]
        })
      }
      
      if (createdAny) {
        try { await calculateAndUpdateStreak(user.id) } catch (e) { console.error('Streak update failed:', e) }
      }
      localStorage.setItem('daily_ops_autofail_ran_today', todayStr)
      autoFailRanRef.current = true
    }
    
    runAutoFail()
  }, [initialized, user, habits, todayStr]) // Omitted monthLogs from deps to prevent loop

  return {
    habits,
    monthLogs,
    todayLogs,
    loading,
    error,
    fetchHabits,
    cycleHabitState,
    toggleHabit,
    toggleHabitForDate,
    addHabit,
    deleteHabit,
    archiveHabit,
    updateHabit,
    reorderHabits
  }
}
