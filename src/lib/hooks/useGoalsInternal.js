'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { XP_REWARDS } from '@/lib/constants'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { getLocalDateStr } from '@/lib/utils/dates'

export function useGoalsInternal() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const supabase = createClient()

  const fetchGoals = useCallback(async () => {
    if (!user) {
      setGoals([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setGoals(data || [])
    } catch (err) {
      console.error('Error fetching goals:', err)
      setError('Failed to load data. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  // Grouped goal views
  const mainQuest = useMemo(
    () => goals.find((g) => g.type === 'main_quest' && g.status !== 'completed'),
    [goals]
  )

  const sideQuests = useMemo(
    () => goals.filter((g) => g.type === 'side_quest' && g.status !== 'completed'),
    [goals]
  )

  const longTermGoals = useMemo(
    () => goals.filter((g) => g.type === 'long_term' && g.status !== 'completed'),
    [goals]
  )

  const weeklyGoals = useMemo(
    () => goals.filter((g) => g.type === 'weekly' && g.status !== 'completed'),
    [goals]
  )

  const completedGoals = useMemo(
    () => goals.filter((g) => g.status === 'completed'),
    [goals]
  )

  const addGoal = useCallback(async (data) => {
    if (!user) return null

    try {
      const { data: newGoal, error } = await supabase
        .from('goals')
        .insert({ ...data, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      setGoals((prev) => [newGoal, ...prev])
      return { data: newGoal }
    } catch (error) {
      console.error('Error adding goal:', error)
      return { error }
    }
  }, [user])

  const updateGoal = useCallback(async (id, data) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('goals')
        .update(data)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)))
      return updated
    } catch (error) {
      console.error('Error updating goal:', error)
      return null
    }
  }, [user])

  const completeGoal = useCallback(async (id, proofUrl = null, skipXp = false) => {
    if (!user) return null

    try {
      const goal = goals.find((g) => g.id === id)
      if (!goal) return null

      const { data: updated, error } = await supabase
        .from('goals')
        .update({ completed_at: new Date().toISOString(), progress: 100, status: 'completed' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      if (proofUrl) {
        // Auto-create Portfolio Log
        await supabase.from('work_logs').insert([{
          user_id: user.id,
          title: `Mission Accomplished: ${goal.title}`,
          description: goal.description || 'Completed Mission.',
          type: 'other', // safe enum fallback
          date: getLocalDateStr(),
          media_urls: [proofUrl]
        }])
      }

      if (!skipXp) {
        // Determine XP based on goal type
        const xpMap = {
          main_quest: XP_REWARDS.goal_complete_main,
          side_quest: XP_REWARDS.goal_complete_side,
          weekly: XP_REWARDS.goal_complete_weekly,
          long_term: XP_REWARDS.goal_complete_long_term,
        }
        const xpAmount = xpMap[goal.type] || XP_REWARDS.goal_complete_side

        await robustAwardXP(
          user.id,
          xpAmount,
          'goal_complete',
          id,
          `Completed ${goal.type}: ${goal.title}`,
          goal.category || 'discipline'
        )
      }

      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)))
      return updated
    } catch (error) {
      console.error('Error completing goal:', error)
      return null
    }
  }, [user, goals])

  const undoCompleteGoal = useCallback(async (id) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('goals')
        .update({ completed_at: null, status: 'active' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      const todayStr = getLocalDateStr()
      await robustRemoveXP(user.id, 'goal_complete', id, todayStr)

      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)))
      return updated
    } catch (error) {
      console.error('Error undoing goal:', error)
      return null
    }
  }, [user])

  const failGoal = useCallback(async (id) => {
    if (!user) return null

    const goal = goals.find((g) => g.id === id)
    if (!goal) return null

    try {
      const { data: updated, error } = await supabase
        .from('goals')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // Determine XP penalty based on goal type
      const xpMap = {
        main_quest: XP_REWARDS.goal_complete_main,
        side_quest: XP_REWARDS.goal_complete_side,
        weekly: XP_REWARDS.goal_complete_weekly,
        long_term: XP_REWARDS.goal_complete_long_term,
      }
      const xpAmount = xpMap[goal.type] || XP_REWARDS.goal_complete_side

      await robustAwardXP(
        user.id,
        -50,
        'goal_failed',
        id,
        `Failed ${goal.type}: ${goal.title}`,
        goal.category || 'discipline'
      )

      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)))
      return updated
    } catch (error) {
      console.error('Error failing goal:', error)
      alert('Error failing goal: ' + (error?.message || error))
      return null
    }
  }, [user, goals])

  const deleteGoal = useCallback(async (id) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setGoals((prev) => prev.filter((g) => g.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting goal:', error)
      return false
    }
  }, [user])

  const togglePauseGoal = useCallback(async (id, currentStatus) => {
    if (!user) return null

    const newStatus = currentStatus === 'paused' ? 'active' : 'paused'

    try {
      const { data: updated, error } = await supabase
        .from('goals')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)))
      return updated
    } catch (error) {
      console.error('Error pausing goal:', error)
      return null
    }
  }, [user])

  const updateProgress = useCallback(async (id, progress) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('goals')
        .update({ progress })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)))
      return updated
    } catch (error) {
      console.error('Error updating progress:', error)
      return null
    }
  }, [user])

  return {
    goals,
    mainQuest,
    sideQuests,
    longTermGoals,
    weeklyGoals,
    completedGoals,
    loading,
    error,
    fetchGoals,
    addGoal,
    updateGoal,
    completeGoal,
    undoCompleteGoal,
    failGoal,
    deleteGoal,
    togglePauseGoal,
    updateProgress,
  }
}
