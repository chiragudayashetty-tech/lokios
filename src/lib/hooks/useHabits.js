'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { XP_REWARDS } from '@/lib/constants'

export function useHabits() {
  const [habits, setHabits] = useState([])
  const [todayLogs, setTodayLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  const todayStr = new Date().toISOString().split('T')[0]

  const fetchHabits = useCallback(async () => {
    if (!user) {
      setHabits([])
      setTodayLogs([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Fetch habits and today's logs in parallel
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
          .eq('date', todayStr),
      ])

      if (habitsRes.error) throw habitsRes.error
      if (logsRes.error) throw logsRes.error

      setHabits(habitsRes.data || [])
      setTodayLogs(logsRes.data || [])
    } catch (error) {
      console.error('Error fetching habits:', error)
    } finally {
      setLoading(false)
    }
  }, [user, todayStr])

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  const toggleHabit = useCallback(async (habitId) => {
    if (!user) return null

    const existingLog = todayLogs.find((l) => l.habit_id === habitId)

    try {
      if (existingLog) {
        // Un-complete: delete the log
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('id', existingLog.id)

        if (error) throw error
        setTodayLogs((prev) => prev.filter((l) => l.id !== existingLog.id))
      } else {
        // Complete: create log
        const { data: newLog, error } = await supabase
          .from('habit_logs')
          .insert({
            user_id: user.id,
            habit_id: habitId,
            date: todayStr,
          })
          .select()
          .single()

        if (error) throw error
        setTodayLogs((prev) => [...prev, newLog])

        // Award XP
        const habit = habits.find((h) => h.id === habitId)
        await supabase.rpc('award_xp', {
          p_user_id: user.id,
          p_amount: XP_REWARDS.habit_complete,
          p_source_type: 'habit_complete',
          p_source_id: habitId,
          p_description: `Completed habit: ${habit?.title || 'Unknown'}`,
          p_stat_category: habit?.category || 'discipline',
        })

        // Update streak
        await supabase.rpc('update_streak', {
          p_user_id: user.id,
          p_habit_id: habitId,
        })
      }

      return true
    } catch (error) {
      console.error('Error toggling habit:', error)
      return null
    }
  }, [user, todayLogs, habits, todayStr])

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

  return { habits, todayLogs, loading, toggleHabit, addHabit }
}
