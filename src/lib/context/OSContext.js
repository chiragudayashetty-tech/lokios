'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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
    xp,
    brainDump,
    journal,
    profile,
    calendar,
    characterStats,
    userConfig,
    
    // Cross-Domain Orchestration Methods
    completeOperation: async (taskId, proofUrl = null) => {
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

          // 3. Automate Mission Completion if 100%
          if (newProgress >= 100) {
            // Pass skipXp = wasAlreadyCompleted to avoid re-awarding goal XP if task was already completed and this is just a re-submission/proof update.
            await goals.completeGoal(goal.id, proofUrl, wasAlreadyCompleted)
            
            // 4. If Mission is completed, Automate Battle Damage (Main Quest)
            if (!wasAlreadyCompleted) {
              const mainQuest = goals.goals.find((g) => g.type === 'main_quest' && g.status !== 'completed')
              if (mainQuest && mainQuest.progress !== undefined) {
                 // Deal 15% damage to the Main Battle for completing a Mission
                 const newBattleHealth = Math.max(0, mainQuest.progress - 15)
                 await goals.updateProgress(mainQuest.id, newBattleHealth)
                 
                 xp.awardXP(100, 'battle_damage', mainQuest.id, 'Dealt damage to active Battle by completing Mission', 'combat')
                 
                 if (newBattleHealth <= 0) {
                   await goals.completeGoal(mainQuest.id)
                 }
              }
            }
          }
        }
      }
      return updatedTask
    },
    
    deleteOperation: async (taskId) => {
      const task = tasks.tasks.find(t => t.id === taskId)
      if (!task) return false
      
      const success = await tasks.deleteTask(taskId)
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
      return success
    },

    failOperation: async (taskId) => {
      const result = await tasks.failTask(taskId)
      if (result) {
        await xp.fetchProfile() // Refresh XP immediately
      }
      return result
    },

    undoFailOperation: async (taskId) => {
      const result = await tasks.undoFailTask(taskId)
      if (result) {
        await xp.fetchProfile() // Refresh XP immediately
      }
      return result
    },

    failMission: async (goalId) => {
      const result = await goals.failGoal(goalId)
      if (result) {
        await xp.fetchProfile() // Refresh XP immediately
      }
      return result
    },

    undoFailMission: async (goalId) => {
      const result = await goals.undoFailGoal(goalId)
      if (result) {
        await xp.fetchProfile() // Refresh XP immediately
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
