'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { XP_REWARDS } from '@/lib/constants'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { getLocalDateStr } from '@/lib/utils/dates'

export function useHabitsInternal() {
  const [habits, setHabits] = useState([])
  const [monthLogs, setMonthLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const processingRef = useRef(new Set())
  const { user } = useAuth()
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
        date: xp.created_at.split('T')[0],
        status: 'failed'
      }))

      setHabits(habitsRes.data || [])
      setMonthLogs([...realLogs, ...virtualFailedLogs])
      
      // Admin one-time DB clear script if flag not found (Reset tracking from Jun 15)
      if (typeof window !== 'undefined' && !localStorage.getItem('daily_ops_reset_v3')) {
        await supabase.from('habit_logs').delete().lt('date', '2026-06-15')
        await supabase.from('xp_history').delete().in('source_type', ['habit_complete', 'habit_failed']).lt('created_at', '2026-06-15T00:00:00Z')
        localStorage.setItem('daily_ops_reset_v3', 'done')
        // Filter out locally immediately
        setMonthLogs(prev => prev.filter(l => l.date >= '2026-06-15'))
      }

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
  const cycleHabitState = useCallback(async (habitId, dateStr) => {
    if (!user) return null
    const targetDate = dateStr || todayStr

    const existingLog = monthLogs.find((l) => l.habit_id === habitId && l.date === targetDate)
    const currentStatus = existingLog ? (existingLog.status || 'completed') : 'none'
    
    let nextStatus = 'completed'
    if (currentStatus === 'completed') nextStatus = 'failed'
    if (currentStatus === 'failed') nextStatus = 'none'

    const procKey = `${habitId}_${targetDate}_cycle`
    if (processingRef.current.has(procKey)) return null
    processingRef.current.add(procKey)

    try {
      if (nextStatus === 'completed') {
        const { data: newLog, error } = await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habitId, date: targetDate }).select().single()
        if (error) throw error
        setMonthLogs(prev => [...prev, newLog])
        if (targetDate === todayStr) {
          const habit = habits.find((h) => h.id === habitId)
          await robustAwardXP(user.id, habit?.xp_per_completion || 25, 'habit_complete', habitId, `Completed routine: ${habit?.title || 'Unknown'}`, habit?.stat_category || 'discipline')
        }
      } else if (nextStatus === 'failed') {
        if (existingLog && existingLog.status !== 'failed') {
          await supabase.from('habit_logs').delete().eq('id', existingLog.id)
          if (targetDate === todayStr) {
            await robustRemoveXP(user.id, 'habit_complete', habitId, targetDate)
          }
        }
        const habit = habits.find((h) => h.id === habitId)
        await robustAwardXP(user.id, -15, 'habit_failed', habitId, `Failed routine: ${habit?.title || 'Unknown'}`, habit?.stat_category || 'discipline')
        setMonthLogs((prev) => [...prev.filter(l => l.id !== existingLog?.id), { id: `virtual_fail_${habitId}_${crypto.randomUUID()}`, habit_id: habitId, date: targetDate, status: 'failed' }])
      } else if (nextStatus === 'none') {
        await robustRemoveXP(user.id, 'habit_failed', habitId, targetDate)
        setMonthLogs((prev) => prev.filter(l => !(l.habit_id === habitId && l.date === targetDate)))
      }

      try { await supabase.rpc('update_streak', { p_user_id: user.id }) } catch (e) {}
      return true
    } catch (error) {
      console.error('Error cycling habit:', error)
      return null
    } finally {
      processingRef.current.delete(procKey)
    }
  }, [user, habits, monthLogs, todayStr])

  // Backward-compat wrapper
  const toggleHabitForDate = useCallback(async (habitId, dateStr, newStatus) => {
    // Use the cycle if forced, or just call cycle
    return cycleHabitState(habitId, dateStr)
  }, [cycleHabitState])

  // Backward-compat wrapper
  const toggleHabit = useCallback(async (habitId) => {
    return toggleHabitForDate(habitId, todayStr)
  }, [toggleHabitForDate, todayStr])

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
    try {
      const { error } = await supabase.from('habits').update({ is_active: false }).eq('id', habitId)
      if (error) throw error
      setHabits((prev) => prev.filter((h) => h.id !== habitId))
    } catch (error) {
      console.error('Error archiving habit:', error)
    }
  }, [])

  const updateHabit = useCallback(async (habitId, updates) => {
    try {
      const { data, error } = await supabase.from('habits').update(updates).eq('id', habitId).select().single()
      if (error) throw error
      setHabits((prev) => prev.map(h => h.id === habitId ? data : h))
      return data
    } catch (error) {
      console.error('Error updating habit:', error)
      return null
    }
  }, [])

  const reorderHabits = useCallback(async (habitId, direction) => {
    const sorted = [...habits].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const index = sorted.findIndex(h => h.id === habitId)
    if (index === -1) return
    
    let swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return
    
    const habitA = sorted[index]
    const habitB = sorted[swapIndex]
    const tempTime = habitA.created_at
    habitA.created_at = habitB.created_at
    habitB.created_at = tempTime
    
    const newSorted = [...sorted].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    setHabits(newSorted)
    
    await Promise.all([
      supabase.from('habits').update({ created_at: habitA.created_at }).eq('id', habitA.id),
      supabase.from('habits').update({ created_at: habitB.created_at }).eq('id', habitB.id)
    ])
  }, [habits])

  // Auto-fail untouched habits
  useEffect(() => {
    if (!initialized || !user || habits.length === 0) return
    
    const runAutoFail = async () => {
      if (localStorage.getItem('daily_ops_autofail_ran_today') === todayStr) return
      
      const RESET_DATE = new Date('2026-06-15T00:00:00Z')
      const now = new Date()
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      
      let createdAny = false
      for (let d = new Date(RESET_DATE); d <= yesterday; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        for (const h of habits) {
          const hasLog = monthLogs.some(l => l.habit_id === h.id && l.date === dateStr)
          if (!hasLog) {
            const procKey = `${h.id}_${dateStr}_autofail`
            if (!processingRef.current.has(procKey)) {
              processingRef.current.add(procKey)
              await robustAwardXP(user.id, -15, 'habit_failed', h.id, `Missed routine: ${h.title}`, h.stat_category || 'discipline')
              setMonthLogs(prev => [...prev, { id: `virtual_fail_${h.id}_auto_${Date.now()}`, habit_id: h.id, date: dateStr, status: 'failed' }])
              createdAny = true
            }
          }
        }
      }
      
      if (createdAny) {
        try { await supabase.rpc('update_streak', { p_user_id: user.id }) } catch (e) {}
      }
      localStorage.setItem('daily_ops_autofail_ran_today', todayStr)
    }
    
    runAutoFail()
  }, [initialized, user, habits, monthLogs, todayStr])

  return {
    habits,
    monthLogs,
    todayLogs,
    loading,
    error,
    fetchHabits,
    cycleHabitState,
    toggleHabit,
    addHabit,
    deleteHabit,
    archiveHabit,
    updateHabit,
    reorderHabits
  }
}
