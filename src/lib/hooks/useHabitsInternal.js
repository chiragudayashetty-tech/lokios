'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { getLocalDateStr } from '@/lib/utils/dates'
import { calculateAndUpdateStreak } from '@/lib/utils/streakCalc'
import { syncWarRoomHabitChange } from '@/lib/utils/warRoomSync'

/**
 * Calculates prior consecutive missed/failed scheduled days before targetDateStr for a habit.
 * Returns count of prior consecutive missed days.
 */
function getConsecutiveMisses(habitId, targetDateStr, allLogs, habit) {
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

export function useHabitsInternal(user) {
  const [allHabits, setAllHabits] = useState([])
  const [monthLogs, setMonthLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const processingRef = useRef(new Set())
  const autoFailRanRef = useRef(false)
  const supabase = createClient()

  const todayStr = getLocalDateStr()

  const habits = useMemo(() => {
    return allHabits.filter((h) => h.is_active !== false)
  }, [allHabits])

  const stoppedHabits = useMemo(() => {
    return allHabits.filter((h) => h.is_active === false)
  }, [allHabits])

  // Derive todayLogs from monthLogs for backward compat
  const todayLogs = useMemo(() => {
    return monthLogs.filter((l) => l.date === todayStr)
  }, [monthLogs, todayStr])

  const fetchHabits = useCallback(async (year, month) => {
    if (!user) {
      setAllHabits([])
      setMonthLogs([])
      setLoading(false)
      return
    }

    try {
      if (!initialized) {
        setLoading(true)
      }
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

      const fetchedHabits = habitsRes.data || []
      fetchedHabits.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || new Date(a.created_at) - new Date(b.created_at))
      setAllHabits(fetchedHabits)
      setMonthLogs([...realLogs, ...virtualFailedLogs])
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
      } else if (nextStatus === 'rest') {
        return [...filtered, { id: optimisticId, habit_id: habitId, date: targetDate, status: 'rest' }]
      } else if (nextStatus === 'blocked') {
        return [...filtered, { id: optimisticId, habit_id: habitId, date: targetDate, status: 'blocked' }]
      }
      return filtered
    })

    try {
      // 1. XP Adjustments: Remove any XP given from the previous state
      // Find all real IDs from our local state to ensure we catch the exact ones causing UI issues!
      const localRealLogs = monthLogs.filter(l => l.habit_id === habitId && l.date === targetDate)
      
      for (const realLog of localRealLogs) {
        if (realLog.id.startsWith('virtual_fail_')) {
          const prefix = `virtual_fail_${habitId}_`
          if (realLog.id.startsWith(prefix)) {
            const createdAt = realLog.id.substring(prefix.length)
            const { data: xpRow } = await supabase.from('xp_history').select('id, amount').eq('user_id', user.id).eq('source_type', 'habit_failed').eq('source_id', habitId).eq('created_at', createdAt).single()
            if (xpRow) {
              await supabase.from('xp_history').delete().eq('id', xpRow.id)
              await navigator.locks.request('xp_update_lock', async () => {
                const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', user.id).single()
                if (prof) {
                  await supabase.from('profiles').update({ total_xp: Math.max(0, (prof.total_xp || 0) - xpRow.amount) }).eq('id', user.id)
                }
              })
            }
          }
        } else if (realLog.status === 'failed') {
          await robustRemoveXP(user.id, 'habit_failed', realLog.id)
        } else if (!realLog.status || realLog.status === 'completed') {
          await robustRemoveXP(user.id, 'habit_complete', realLog.id)
        }
      }

      const dbLogsOnly = localRealLogs.filter(l => !l.id.startsWith('virtual_fail_') && !l.id.startsWith('opt_'))
      let newLog;
      // 2. Database Sync
      if (nextStatus === 'none') {
        if (dbLogsOnly.length > 0) {
          for (const oldLog of dbLogsOnly) {
            await robustRemoveXP(user.id, 'habit_complete', oldLog.id)
            await robustRemoveXP(user.id, 'habit_failed', oldLog.id)
          }
          const { error: delErr } = await supabase.from('habit_logs').delete().in('id', dbLogsOnly.map(l => l.id))
          if (delErr) throw delErr
        }
      } else {
        if (dbLogsOnly.length > 0) {
          const targetId = dbLogsOnly[0].id
          const { data: updatedRows, error: updateErr } = await supabase.from('habit_logs')
            .update({ status: nextStatus })
            .eq('id', targetId)
            .select()
            
          if (updateErr) throw updateErr
          if (updatedRows && updatedRows.length > 0) newLog = updatedRows[0]
          
          if (dbLogsOnly.length > 1) {
            const extraIds = dbLogsOnly.slice(1).map(l => l.id)
            await supabase.from('habit_logs').delete().in('id', extraIds)
          }
        } else {
          // If no local logs existed (possible desync on past days), safely UPSERT
          const { data: insertedRows, error: insertErr } = await supabase.from('habit_logs')
            .upsert({ user_id: user.id, habit_id: habitId, date: targetDate, status: nextStatus }, { onConflict: 'habit_id,date' })
            .select()
          if (insertErr) throw insertErr
          newLog = insertedRows[0]
        }
      }
      
        
        // Update optimistic UI with real DB log
        setMonthLogs(prev => prev.map(l => l.id === optimisticId ? newLog : l))

        const habit = habits.find((h) => h.id === habitId)

        // Award New XP
        if (newLog) {
          const targetDayOfWeek = new Date(targetDate).getDay()
          const freqDays = habit?.frequency_days || [0, 1, 2, 3, 4, 5, 6]
          const isBlocked = !freqDays.includes(targetDayOfWeek)
          
          if (nextStatus === 'completed') {
            await robustAwardXP(user.id, isBlocked ? 0 : (habit?.xp_per_completion || 25), 'habit_complete', newLog.id, `Completed routine: ${habit?.title || 'Unknown'}`, habit?.stat_category || 'discipline')
          } else if (nextStatus === 'failed') {
            const priorMisses = getConsecutiveMisses(habitId, targetDate, monthLogs, habit)
            const isDoublePenalty = priorMisses >= 1
            const penaltyXP = isBlocked ? 0 : (isDoublePenalty ? -30 : -15)
            const reason = isDoublePenalty 
              ? `🚨 DOUBLE PENALTY (2+ Consecutive Misses): ${habit?.title || 'Unknown'}` 
              : `Failed routine: ${habit?.title || 'Unknown'}`
            await robustAwardXP(user.id, penaltyXP, 'habit_failed', newLog.id, reason, habit?.stat_category || 'discipline')
          }
        }

        // Persistently update War Room Battle HP in DB for ALL status transitions
        await syncWarRoomHabitChange(user.id, habitId, habit?.title || 'Habit', currentStatus, nextStatus)
      try { 
        await calculateAndUpdateStreak(user.id, habitId)

        // ── DAILY ALL-HABITS BONUS ──
        // Check if every active habit has a completed log for today
        if (nextStatus === 'completed' && targetDate === currentTodayStr && habits) {
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
            const allDone = habits.every(h => todayCompletedIds.has(h.id))
            if (allDone && habits.length > 0) {
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
      const payload = { created_at: new Date().toISOString(), is_active: true, ...data, user_id: user.id }
      const { data: newHabit, error } = await supabase
        .from('habits')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      setAllHabits((prev) => [...prev, newHabit])
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
      setAllHabits((prev) => prev.filter((h) => h.id !== habitId))
      return true
    } catch (error) {
      console.error('Error deleting habit:', error)
      return null
    }
  }, [user])

  const stopHabit = useCallback(async (habitId) => {
    if (!user) return null
    try {
      const stoppedAt = new Date().toISOString()
      const { error } = await supabase
        .from('habits')
        .update({ is_active: false, stopped_at: stoppedAt })
        .eq('id', habitId)
        .eq('user_id', user.id)

      if (error) {
        const { error: err2 } = await supabase
          .from('habits')
          .update({ is_active: false })
          .eq('id', habitId)
          .eq('user_id', user.id)
        if (err2) throw err2
      }

      setAllHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, is_active: false, stopped_at: stoppedAt } : h)))
      return true
    } catch (error) {
      console.error('Error stopping habit:', error)
      return null
    }
  }, [user])

  const resumeHabit = useCallback(async (habitId) => {
    if (!user) return null
    try {
      const { error } = await supabase
        .from('habits')
        .update({ is_active: true, stopped_at: null })
        .eq('id', habitId)
        .eq('user_id', user.id)

      if (error) {
        const { error: err2 } = await supabase
          .from('habits')
          .update({ is_active: true })
          .eq('id', habitId)
          .eq('user_id', user.id)
        if (err2) throw err2
      }

      setAllHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, is_active: true, stopped_at: null } : h)))
      return true
    } catch (error) {
      console.error('Error resuming habit:', error)
      return null
    }
  }, [user])

  const archiveHabit = useCallback(async (habitId) => {
    return stopHabit(habitId)
  }, [stopHabit])

  const updateHabit = useCallback(async (habitId, updates) => {
    if (!user) return null
    try {
      const { data, error } = await supabase.from('habits').update(updates).eq('id', habitId).eq('user_id', user.id).select().single()
      if (error) throw error
      setAllHabits((prev) => prev.map(h => h.id === habitId ? data : h))
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
    const sorted = [...habits]
    const index = sorted.findIndex(h => h.id === habitId)
    if (index === -1) return
    
    let swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return
    
    const [moved] = sorted.splice(index, 1)
    sorted.splice(swapIndex, 0, moved)
    
    const updatedHabits = sorted.map((h, i) => ({
      ...h,
      display_order: i + 1
    }))
    
    setAllHabits(updatedHabits)
    
    const supabase = createClient()
    await Promise.all(
      updatedHabits.map(h =>
        supabase.from('habits').update({ display_order: h.display_order }).eq('id', h.id).eq('user_id', user.id)
      )
    )
  }, [habits, user])

  const reorderHabitsByDrag = useCallback(async (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId || !user) return
    const sorted = [...habits]
    const dragIdx = sorted.findIndex(h => h.id === draggedId)
    const targetIdx = sorted.findIndex(h => h.id === targetId)
    if (dragIdx === -1 || targetIdx === -1) return

    const [moved] = sorted.splice(dragIdx, 1)
    sorted.splice(targetIdx, 0, moved)

    const updatedHabits = sorted.map((h, i) => ({
      ...h,
      display_order: i + 1
    }))

    setAllHabits(updatedHabits)

    const supabase = createClient()
    await Promise.all(
      updatedHabits.map(h =>
        supabase.from('habits').update({ display_order: h.display_order }).eq('id', h.id).eq('user_id', user.id)
      )
    )
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
              
              const priorMisses = getConsecutiveMisses(h.id, dateStr, recentLogs, h)
              const isDoublePenalty = priorMisses >= 1
              const penaltyXP = isDoublePenalty ? -30 : -15
              const reason = isDoublePenalty 
                ? `🚨 DOUBLE PENALTY (2+ Consecutive Misses): ${h.title}` 
                : `Missed routine: ${h.title}`
              await robustAwardXP(user.id, penaltyXP, 'habit_failed', h.id, reason, h.stat_category || 'discipline')
              
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
    stoppedHabits,
    allHabits,
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
    stopHabit,
    resumeHabit,
    archiveHabit: stopHabit,
    updateHabit,
    reorderHabits,
    reorderHabitsByDrag
  }
}
