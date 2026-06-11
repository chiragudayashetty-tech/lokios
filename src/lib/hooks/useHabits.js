'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { XP_REWARDS } from '@/lib/constants'

export function useHabits() {
  const [habits, setHabits] = useState([])
  const [monthLogs, setMonthLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  const todayStr = new Date().toISOString().split('T')[0]

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

      // Calculate month range
      const now = new Date()
      const y = year ?? now.getFullYear()
      const m = month ?? now.getMonth() // 0-indexed
      const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const lastDay = new Date(y, m + 1, 0) // last day of month
      const lastDayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

      const [habitsRes, logsRes] = await Promise.all([
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
      ])

      if (habitsRes.error) throw habitsRes.error
      if (logsRes.error) throw logsRes.error

      setHabits(habitsRes.data || [])
      setMonthLogs(logsRes.data || [])
    } catch (error) {
      console.error('Error fetching habits:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  // Toggle a habit for any date (defaults to today)
  const toggleHabitForDate = useCallback(async (habitId, dateStr) => {
    if (!user) return null
    const targetDate = dateStr || todayStr

    const existingLog = monthLogs.find(
      (l) => l.habit_id === habitId && l.date === targetDate
    )

    try {
      if (existingLog) {
        // Un-complete: delete the log
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('id', existingLog.id)

        if (error) throw error
        setMonthLogs((prev) => prev.filter((l) => l.id !== existingLog.id))
      } else {
        // Complete: create log
        const { data: newLog, error } = await supabase
          .from('habit_logs')
          .insert({
            user_id: user.id,
            habit_id: habitId,
            date: targetDate,
          })
          .select()
          .single()

        if (error) throw error
        setMonthLogs((prev) => [...prev, newLog])

        // Award XP only if toggling today
        if (targetDate === todayStr) {
          const habit = habits.find((h) => h.id === habitId)
          await supabase.rpc('award_xp', {
            p_user_id: user.id,
            p_amount: XP_REWARDS.habit_complete,
            p_source_type: 'habit_complete',
            p_source_id: habitId,
            p_description: `Completed habit: ${habit?.title || 'Unknown'}`,
            p_stat_category: habit?.stat_category || 'discipline',
          })

          // Update streak
          try {
            await supabase.rpc('update_streak', { p_user_id: user.id })
          } catch (e) {
            // Streak function might expect different params
          }
        }
      }

      return true
    } catch (error) {
      console.error('Error toggling habit:', error)
      return null
    }
  }, [user, monthLogs, habits, todayStr])

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

  return {
    habits,
    todayLogs,
    monthLogs,
    loading,
    toggleHabit,
    toggleHabitForDate,
    addHabit,
    deleteHabit,
    fetchHabits,
  }
}
