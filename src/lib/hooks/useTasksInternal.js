'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { XP_REWARDS, DIFFICULTY_LEVELS } from '@/lib/constants'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { getLocalDateStr } from '@/lib/utils/dates'

export function useTasksInternal() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const supabase = createClient()

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (err) {
      console.error('Error fetching tasks:', err)
      setError('Failed to load data. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const todayTasks = useMemo(() => {
    const today = new Date()
    const todayStr = getLocalDateStr(today)
    const dayOfWeek = today.getDay()

    return tasks.filter((task) => {
      // Match tasks due today
      if (task.due_date && task.due_date.split('T')[0] === todayStr) return true

      // Match recurring tasks that apply to today
      if (task.type === 'recurring' && task.recurrence_days) {
        return task.recurrence_days.includes(dayOfWeek)
      }

      // Incomplete one-time tasks with no due date
      if (!task.due_date && !task.completed_at && task.type === 'custom') return true

      return false
    })
  }, [tasks])

  const addTask = useCallback(async (data) => {
    if (!user) return null

    try {
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({ ...data, user_id: user.id })
        .select()
        .single()

      if (error) {
        console.error('Error adding task:', error)
        return { error }
      }
      setTasks((prev) => [newTask, ...prev])
      return { data: newTask }
    } catch (error) {
      console.error('Exception adding task:', error)
      return { error }
    }
  }, [user])

  const completeTask = useCallback(async (id, proofUrl = null) => {
    if (!user) return null

    try {
      const updates = { completed_at: new Date().toISOString(), status: 'completed' }
      if (proofUrl) {
        // Fetch current media_urls first
        const { data: curr } = await supabase.from('tasks').select('media_urls').eq('id', id).single()
        updates.media_urls = curr?.media_urls ? [...curr.media_urls, proofUrl] : [proofUrl]
      }

      const { data: updated, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // Dynamic XP Calculation based on Difficulty and Deadlines
      const task = tasks.find((t) => t.id === id)
      
      // Default to MEDIUM if no difficulty set
      const difficultyData = DIFFICULTY_LEVELS[task?.difficulty] || DIFFICULTY_LEVELS.MEDIUM
      let xpAward = difficultyData.xp

      // Check if overdue
      if (task?.due_date) {
        const today = getLocalDateStr()
        const dueDate = task.due_date.split('T')[0]
        if (dueDate < today) {
          // Overdue: Only award 50% XP
          xpAward = Math.floor(xpAward * 0.5)
        }
      }

      await robustAwardXP(
        user.id,
        xpAward,
        'task_complete',
        id,
        `Completed task: ${task?.title || 'Unknown'}`,
        task?.category || 'discipline'
      )

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Error completing task:', error)
      return null
    }
  }, [user, tasks])

  const undoCompleteTask = useCallback(async (id) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('tasks')
        .update({ completed_at: null, status: 'pending' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // Remove XP
      const todayStr = getLocalDateStr()
      await robustRemoveXP(user.id, 'task_complete', id, todayStr)

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Error undoing task completion:', error)
      return null
    }
  }, [user])

  const editTask = useCallback(async (id, updates) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Error editing task:', error)
      return null
    }
  }, [user])

  const deleteTask = useCallback(async (id) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setTasks((prev) => prev.filter((t) => t.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting task:', error)
      return false
    }
  }, [user])

  return {
    tasks,
    todayTasks,
    loading,
    error,
    fetchTasks,
    addTask,
    editTask,
    completeTask,
    undoCompleteTask,
    deleteTask,
  }
}
