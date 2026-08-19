'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { XP_REWARDS, DIFFICULTY_LEVELS } from '@/lib/constants'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { getLocalDateStr } from '@/lib/utils/dates'

// Map quest/task category IDs to canonical stat_category keys used by XP page
const TASK_CATEGORY_TO_STAT = {
  beyond_tatva: 'founder',
  founder: 'founder',
  personal_mission: 'discipline',
  discipline: 'discipline',
  learning: 'learning',
  communication: 'communication',
  creation: 'creation',
  other: 'creation',
  personal_care: 'creation',
  fitness: 'strength',
  strength: 'strength',
  weekly_goal: 'discipline',
}
const toStatCat = (cat) => TASK_CATEGORY_TO_STAT[(cat || '').toLowerCase()] || 'discipline'

export function useTasksInternal(user) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const supabase = createClient()

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }

    try {
      if (!initialized) setLoading(true)
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
      setInitialized(true)
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
      if (task.status === 'completed' || task.status === 'cancelled') return false

      // Match tasks due today
      if (task.due_date && getLocalDateStr(new Date(task.due_date)) === todayStr) return true

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

  const completeTask = useCallback(async (id, proofUrl = null, completionNote = null) => {
    if (!user) return null

    try {
      let task = tasks.find((t) => t.id === id)
      if (!task) {
        const { data: dbTask } = await supabase.from('tasks').select('*').eq('id', id).eq('user_id', user.id).single()
        if (dbTask) task = dbTask
      }
      if (!task) throw new Error("Task not found")
      if (task.status === 'completed') return task // Idempotency guard

      const updates = { completed_at: new Date().toISOString(), status: 'completed' }
      if (proofUrl) {
        // Fetch current media_urls first
        const { data: curr } = await supabase.from('tasks').select('media_urls').eq('id', id).eq('user_id', user.id).single()
        updates.media_urls = curr?.media_urls ? [...curr.media_urls, proofUrl] : [proofUrl]
      }
      if (completionNote && completionNote.trim()) {
        const currDesc = task.description || ''
        const cleanNote = completionNote.trim()
        if (!currDesc.includes('[Completion Note]')) {
          updates.description = `${currDesc}\n\n[Completion Note]\n${cleanNote}`.trim()
        }
      }

      const { data: updated, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // Auto-create Portfolio / Proof of Work Log if proof or completion note is present
      if (proofUrl || (completionNote && completionNote.trim())) {
        try {
          await supabase.from('work_logs').insert([{
            user_id: user.id,
            title: `Operation Completed: ${task.title}`,
            description: completionNote ? completionNote.trim() : (task.description || 'Completed Operation.'),
            type: 'project_work',
            date: getLocalDateStr(),
            media_urls: proofUrl ? [proofUrl] : []
          }])
        } catch (logErr) {
          console.error("Error creating work_logs entry on task completion:", logErr)
        }
      }

      // Dynamic XP Calculation based on Difficulty and Overdue Days (-5 XP per day past deadline)
      const isWeeklyGoal = task?.category === 'weekly_goal' || (task?.description || '').includes('[Weekly Goal]')
      const diffKey = (task?.difficulty || 'MEDIUM').toUpperCase()
      const difficultyData = DIFFICULTY_LEVELS[diffKey] || DIFFICULTY_LEVELS.MEDIUM
      let baseXP = isWeeklyGoal ? 25 : difficultyData.xp
      let xpAward = baseXP
      let overdueDays = 0

      // Check if overdue: -5 XP per calendar day past deadline (non-weekly tasks)
      if (!isWeeklyGoal && task?.due_date) {
        const todayStr = getLocalDateStr()
        const cleanDueDate = task.due_date.substring(0, 10)
        if (cleanDueDate < todayStr) {
          const [tY, tM, tD] = todayStr.split('-').map(Number)
          const [dY, dM, dD] = cleanDueDate.split('-').map(Number)
          const todayUtc = Date.UTC(tY, tM - 1, tD)
          const dueUtc = Date.UTC(dY, dM - 1, dD)
          overdueDays = Math.max(1, Math.round((todayUtc - dueUtc) / (1000 * 60 * 60 * 24)))
          const penaltyDeduction = overdueDays * 5
          xpAward = Math.max(0, baseXP - penaltyDeduction)
        }
      }

      const descText = overdueDays > 0 
        ? `Completed task: ${task?.title || 'Unknown'} (+${xpAward} XP, -${overdueDays * 5} Overdue Penalty)`
        : `Completed task: ${task?.title || 'Unknown'}`

      await robustAwardXP(
        user.id,
        xpAward,
        'task_complete',
        id,
        descText,
        toStatCat(task?.category)
      )

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))

      // AUTO-CLONING ENGINE FOR RECURRING TASKS
      if (task.type === 'recurring' && task.recurrence_type && task.due_date) {
        const currentDueDate = new Date(task.due_date)
        const nextDueDate = new Date(currentDueDate)
        const recType = String(task.recurrence_type).toLowerCase()
        if (recType === 'daily') {
          nextDueDate.setDate(nextDueDate.getDate() + 1)
        } else if (recType === 'weekly' && task.recurrence_days && task.recurrence_days.length > 0) {
          let duration = 0
          if (task.description) {
            const match = task.description.match(/\[Duration:\s*(\d+)\]/i)
            if (match) duration = parseInt(match[1])
          }
          
          const anchorDate = new Date(currentDueDate)
          anchorDate.setDate(anchorDate.getDate() - duration)
          
          const currentDay = anchorDate.getDay()
          const sortedDays = [...task.recurrence_days].sort((a, b) => a - b)
          let nextDay = sortedDays.find(d => d > currentDay)
          let daysToAdd = 0
          if (nextDay !== undefined) {
            daysToAdd = nextDay - currentDay
          } else {
            daysToAdd = (7 - currentDay) + sortedDays[0]
          }
          
          nextDueDate.setTime(anchorDate.getTime())
          nextDueDate.setDate(nextDueDate.getDate() + daysToAdd + duration)
        } else {
          // Fallback if somehow it's neither but marked recurring
          nextDueDate.setDate(nextDueDate.getDate() + 7)
        }

        const cloneData = {
          user_id: user.id,
          title: task.title,
          description: task.description,
          difficulty: task.difficulty,
          type: 'recurring',
          category: task.category,
          recurrence_type: task.recurrence_type,
          recurrence_days: task.recurrence_days,
          due_date: nextDueDate.toISOString(),
          status: 'pending',
          goal_id: task.goal_id
        }

        const { data: newClone, error: cloneError } = await supabase
          .from('tasks')
          .insert([cloneData])
          .select()
          .single()

        if (!cloneError && newClone) {
          setTasks((prev) => [...prev, newClone])
        }
      }

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
      const task = tasks.find(t => t.id === id)
      await robustRemoveXP(user.id, 'task_complete', id)

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Error undoing task completion:', error)
      return null
    }
  }, [user, tasks])

  const failTask = useCallback(async (id, failureReason = null) => {
    if (!user) return null

    try {
      let task = tasks.find((t) => t.id === id)
      if (!task) {
        const { data: dbTask } = await supabase.from('tasks').select('*').eq('id', id).eq('user_id', user.id).single()
        if (dbTask) task = dbTask
      }
      if (!task || task.status === 'cancelled' || task.status === 'failed') return null

      const updates = { status: 'cancelled', completed_at: new Date().toISOString() }
      if (failureReason && failureReason.trim()) {
        const currDesc = task.description || ''
        const cleanReason = failureReason.trim()
        if (!currDesc.includes('[Failure Note]')) {
          updates.description = `${currDesc}\n\n[Failure Note]\n${cleanReason}`.trim()
        }
      }

      const { data: updated, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // Dynamic XP Penalty based on Difficulty (or -25 XP for weekly goals)
      const isWeeklyGoal = task?.category === 'weekly_goal' || (task?.description || '').includes('[Weekly Goal]')
      const diffKey = (task?.difficulty || 'MEDIUM').toUpperCase()
      const difficultyData = DIFFICULTY_LEVELS[diffKey] || DIFFICULTY_LEVELS.MEDIUM
      const penalty = isWeeklyGoal ? 25 : difficultyData.penalty

      if (penalty > 0) {
        await robustAwardXP(
          user.id,
          -penalty,
          'task_failed',
          id,
          `Failed task: ${task?.title || 'Unknown'}`,
          toStatCat(task?.category)
        )
      }

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Error failing task:', error)
      alert('Error failing task: ' + (error?.message || error))
      return null
    }
  }, [user, tasks])

  const undoFailTask = useCallback(async (id) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('tasks')
        .update({ status: 'pending', completed_at: null })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      await robustRemoveXP(user.id, 'task_failed', id)

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Error undoing failed task:', error)
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

  const deleteTask = useCallback(async (id, revokeXp = true) => {
    if (!user) return false

    try {
      const task = tasks.find((t) => t.id === id)
      if (revokeXp) {
        if (task?.status === 'completed') {
          await robustRemoveXP(user.id, 'task_complete', id)
        } else if (task?.status === 'cancelled') {
          await robustRemoveXP(user.id, 'task_failed', id)
        }
      }

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
  }, [user, tasks])

  const pushTaskToTomorrow = useCallback(async (id) => {
    if (!user) return null
    const task = tasks.find((t) => t.id === id)
    if (!task) return null

    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const nextDueStr = tomorrow.toISOString().split('T')[0]

      const { data: updated, error } = await supabase
        .from('tasks')
        .update({ due_date: nextDueStr })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // Procrastination XP penalty
      const diffKey = (task.difficulty || 'MEDIUM').toUpperCase()
      const difficultyData = DIFFICULTY_LEVELS[diffKey] || DIFFICULTY_LEVELS.MEDIUM
      if (difficultyData.id !== 'NONE' && difficultyData.penalty > 0) {
        await robustAwardXP(
          user.id,
          -difficultyData.penalty,
          'task_pushed',
          id,
          `Procrastination: Pushed ${task.title} to tomorrow`,
          toStatCat(task.category)
        )
      }

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Error pushing task:', error)
      return null
    }
  }, [user, tasks])

  return {
    tasks,
    todayTasks,
    loading,
    error,
    fetchTasks,
    addTask,
    editTask,
    completeTask,
    pushTaskToTomorrow,
    undoCompleteTask,
    deleteTask,
    failTask,
    undoFailTask
  }
}
