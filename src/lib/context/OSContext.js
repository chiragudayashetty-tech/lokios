'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr } from '@/lib/utils/dates'
import { useHabitsInternal } from '@/lib/hooks/useHabitsInternal'
import { useTasksInternal } from '@/lib/hooks/useTasksInternal'
import { useGoalsInternal } from '@/lib/hooks/useGoalsInternal'
import { useXPInternal } from '@/lib/hooks/useXPInternal'
import { useBrainDumpInternal } from '@/lib/hooks/useBrainDumpInternal'
import { useJournalInternal } from '@/lib/hooks/useJournalInternal'
import { useProfileInternal } from '@/lib/hooks/useProfileInternal'
import { useCalendarInternal } from '@/lib/hooks/useCalendarInternal'
import { useCharacterStatsInternal } from '@/lib/hooks/useCharacterStatsInternal'
import { useUserConfigInternal } from '@/lib/hooks/useUserConfigInternal'
import { useFocusInternal } from '@/lib/hooks/useFocusInternal'

const OSContext = createContext(null)

export function OSProvider({ children }) {
  const auth = useAuth()
  
  // Initialize all subsystems exactly once at the root level
  const habits = useHabitsInternal()
  const tasks = useTasksInternal()
  const goals = useGoalsInternal()
  const xp = useXPInternal()
  const brainDump = useBrainDumpInternal()
  const journal = useJournalInternal()
  const profile = useProfileInternal()
  const calendar = useCalendarInternal()
  const characterStats = useCharacterStatsInternal()
  const userConfig = useUserConfigInternal()
  const focus = useFocusInternal(auth.user, true)

  const [booting, setBooting] = useState(true)

  // Wait for critical systems to load before rendering the OS
  useEffect(() => {
    if (!auth.loading && !profile.loading && !habits.loading && !tasks.loading) {
      
      // Temporal Sync removed: Penalties are now strictly handled by useHabitsInternal.js runAutoFail
      
      setBooting(false)
    }
  }, [auth.loading, profile.loading, habits.loading, tasks.loading])

  const osState = {
    auth,
    habits,
    tasks,
    goals,
    focus,
    xp,
    brainDump,
    journal,
    profile,
    calendar,
    characterStats,
    userConfig,
    
    // Cross-Domain Orchestration Methods
    completeOperation: useCallback(async (taskId, proofUrl = null) => {
      const task = tasks.tasks.find(t => t.id === taskId)
      if (!task) return null

      const wasAlreadyCompleted = task.status === 'completed'

      // 1. Complete the underlying task
      const updatedTask = await tasks.completeTask(taskId, proofUrl)

      // 2. If it belongs to a Mission (Goal), automate mission progress
      if (task.goal_id) {
        const goal = goals.goals.find(g => g.id === task.goal_id)
        if (goal && goal.status !== 'completed') {
          // Find all tasks for this goal to calculate proper percentage
          const goalTasks = tasks.tasks.filter(t => t.goal_id === task.goal_id)
          const completedGoalTasks = goalTasks.filter(t => t.status === 'completed' || t.id === taskId).length
          const totalGoalTasks = goalTasks.length || 1
          
          const newProgress = Math.min(100, Math.round((completedGoalTasks / totalGoalTasks) * 100))
          await goals.updateProgress(goal.id, newProgress)

          // Mission progress updates, but NEVER auto-completes. User must manually verify and close missions.
        }
      }
      return updatedTask
    }, [tasks, goals, xp]),
    
    deleteOperation: useCallback(async (taskId, revokeXp = true) => {
      const task = tasks.tasks.find(t => t.id === taskId)
      if (!task) return false
      
      const success = await tasks.deleteTask(taskId, revokeXp)
      if (success && task.goal_id) {
        const goal = goals.goals.find(g => g.id === task.goal_id)
        if (goal && goal.status !== 'completed') {
          const goalTasks = tasks.tasks.filter(t => t.goal_id === task.goal_id && t.id !== taskId)
          const completedGoalTasks = goalTasks.filter(t => t.status === 'completed').length
          const totalGoalTasks = goalTasks.length || 1
          
          const newProgress = Math.min(100, Math.round((completedGoalTasks / totalGoalTasks) * 100))
          await goals.updateProgress(goal.id, newProgress)
        }
      }
      if (success) {
        await profile.fetchProfile() // Refresh XP immediately
      }
      return success
    }, [tasks, goals, profile]),

    failOperation: useCallback(async (taskId) => {
      const result = await tasks.failTask(taskId)
      if (result) {
        await profile.fetchProfile() // Refresh XP immediately
      }
      return result
    }, [tasks, profile]),

    undoFailOperation: useCallback(async (taskId) => {
      const result = await tasks.undoFailTask(taskId)
      if (result) {
        await profile.fetchProfile() // Refresh XP immediately
      }
      return result
    }, [tasks, profile]),

    failMission: async (goalId) => {
      const result = await goals.failGoal(goalId)
      if (result) {
        await profile.fetchProfile() // Refresh XP immediately
      }
      return result
    },

    deleteMission: async (goalId, revokeXp = true) => {
      const result = await goals.deleteGoal(goalId, revokeXp)
      if (result) {
        await profile.fetchProfile() // Refresh XP immediately
      }
      return result
    },

    undoFailMission: async (goalId) => {
      const result = await goals.undoFailGoal(goalId)
      if (result) {
        await profile.fetchProfile() // Refresh XP immediately
      }
      return result
    }
  }

  if (booting) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a] flex-col gap-4">
        <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-info border-l-transparent rounded-full animate-spin"></div>
        <div className="font-mono text-sm tracking-widest text-primary animate-pulse">LOKI OS BOOT SEQUENCE...</div>
      </div>
    )
  }

  return (
    <OSContext.Provider value={osState}>
      {children}
    </OSContext.Provider>
  )
}

export function useOS() {
  const context = useContext(OSContext)
  if (!context) {
    throw new Error('useOS must be used within an OSProvider')
  }
  return context
}
