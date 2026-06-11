'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { XP_REWARDS } from '@/lib/constants'

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
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
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const getTodayTasks = useCallback(() => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
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

      if (error) throw error
      setTasks((prev) => [newTask, ...prev])
      return newTask
    } catch (error) {
      console.error('Error adding task:', error)
      return null
    }
  }, [user])

  const completeTask = useCallback(async (id) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('tasks')
        .update({ completed_at: new Date().toISOString(), status: 'completed' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // Award XP
      const task = tasks.find((t) => t.id === id)
      await supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_amount: XP_REWARDS.task_complete,
        p_source_type: 'task_complete',
        p_source_id: id,
        p_description: `Completed task: ${task?.title || 'Unknown'}`,
        p_stat_category: task?.category || 'discipline',
      })

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
    todayTasks: getTodayTasks(),
    loading,
    addTask,
    editTask,
    completeTask,
    undoCompleteTask,
    deleteTask,
  }
}
