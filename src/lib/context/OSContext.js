'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
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
import { useFocusInternal } from '@/lib/hooks/useFocusInternal'
import { getThemeForXP } from '@/lib/theme/levelTheme'
import { hydrateSettingsFromProfile } from '@/lib/settings'
import { getMilestones, ensureMilestones } from '@/lib/stores/milestoneStore'
import { progressOf, milestoneTaskStats } from '@/lib/utils/missions'
import { emitGame } from '@/lib/utils/gamification'

const OSContext = createContext(null)

// Per-slice contexts: a component that only needs habits re-renders only when
// habits change, instead of on every XP / task / journal update.
const SLICES = ['auth', 'habits', 'tasks', 'goals', 'xp', 'brainDump', 'journal', 'profile', 'calendar', 'characterStats', 'focus']
const SliceContexts = Object.fromEntries(SLICES.map(name => [name, createContext(null)]))

/**
 * The subsystem hooks return a fresh object every render. Keep the previous
 * object while every field is identical, so slice contexts only change when
 * that slice's data or callbacks actually changed.
 */
function useShallowStable(obj) {
  const ref = useRef(obj)
  const prev = ref.current
  if (prev !== obj) {
    const keys = Object.keys(obj)
    const same = prev && keys.length === Object.keys(prev).length && keys.every(k => Object.is(prev[k], obj[k]))
    if (!same) ref.current = obj
  }
  return ref.current
}

export function OSProvider({ children }) {
  const auth = useShallowStable(useAuth())
  
  // Initialize all subsystems exactly once at the root level, passing down the single shared auth.user
  const habits = useShallowStable(useHabitsInternal(auth.user))
  const tasks = useShallowStable(useTasksInternal(auth.user))
  const goals = useShallowStable(useGoalsInternal(auth.user))
  const xp = useShallowStable(useXPInternal(auth.user))
  const brainDump = useShallowStable(useBrainDumpInternal(auth.user))
  const journal = useShallowStable(useJournalInternal(auth.user))
  const profile = useShallowStable(useProfileInternal(auth.user))
  const calendar = useShallowStable(useCalendarInternal(auth.user))
  const characterStats = useShallowStable(useCharacterStatsInternal(auth.user))
  const focus = useShallowStable(useFocusInternal(auth.user, true))

  // Apply rank-derived visual tokens only. XP remains owned by existing profile/RPC flows.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const theme = getThemeForXP(profile?.profile?.total_xp || 0)
    Object.entries(theme.cssVars).forEach(([name, value]) => document.documentElement.style.setProperty(name, value))
    if (theme.season) document.documentElement.dataset.season = theme.season
    else delete document.documentElement.dataset.season
  }, [profile?.profile?.total_xp])

  // Settings saved on another device arrive with the profile
  useEffect(() => {
    if (profile?.profile) hydrateSettingsFromProfile(profile.profile, auth.user?.id)
  }, [profile?.profile, auth.user?.id])

  // Stable refs so the sync callback always calls the latest functions
  // without causing the useEffect to re-run (infinite loop fix)
  const profileRef = React.useRef(profile)
  const xpRef = React.useRef(xp)
  const habitsRef = React.useRef(habits)
  const tasksRef = React.useRef(tasks)
  useEffect(() => {
    profileRef.current = profile
    xpRef.current = xp
    habitsRef.current = habits
    tasksRef.current = tasks
  }, [profile, xp, habits, tasks])

  // Cross-device sync: Supabase Realtime + window focus/visibility
  useEffect(() => {
    if (!auth?.user?.id) return
    const supabase = createClient()
    const userId = auth.user.id
    
    let syncTimeout = null
    const debouncedSync = () => {
      if (syncTimeout) clearTimeout(syncTimeout)
      syncTimeout = setTimeout(() => {
        profileRef.current?.fetchProfile?.()
        habitsRef.current?.fetchHabits?.()
        tasksRef.current?.fetchTasks?.()
      }, 500)
    }

    let xpSyncTimeout = null
    const debouncedXpSync = () => {
      if (xpSyncTimeout) clearTimeout(xpSyncTimeout)
      xpSyncTimeout = setTimeout(() => {
        profileRef.current?.fetchProfile?.()
        xpRef.current?.fetchMomentum?.()
      }, 300)
    }

    const channel = supabase.channel(`os_sync_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs', filter: `user_id=eq.${userId}` }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'speaking_logs', filter: `user_id=eq.${userId}` }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_hours_logs', filter: `user_id=eq.${userId}` }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${userId}` }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_time_logs', filter: `user_id=eq.${userId}` }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xp_history', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          xpRef.current?.handleXpRealtime?.(payload)
        }
        debouncedXpSync()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, debouncedSync)
      .subscribe()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') debouncedSync()
    }
    window.addEventListener('focus', debouncedSync)
    // Local XP changes (award / revoke) refresh the profile immediately
    window.addEventListener('lokios:xp-changed', debouncedXpSync)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (syncTimeout) clearTimeout(syncTimeout)
      supabase.removeChannel(channel)
      window.removeEventListener('focus', debouncedSync)
      window.removeEventListener('lokios:xp-changed', debouncedXpSync)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [auth?.user?.id])

  /** Recompute a mission's cached progress (milestones 60% + tasks 40%, see utils/missions). */
  const syncMissionProgress = useCallback(async (goalId, taskList) => {
    const goal = goals.goals.find(g => g.id === goalId)
    if (!goal || goal.status === 'completed') return
    await ensureMilestones(auth.user?.id)
    const next = progressOf(goal, getMilestones(), taskList)
    if (next !== goal.progress) await goals.updateProgress(goal.id, Math.min(100, next))
  }, [goals, auth.user?.id])

  // Cross-Domain Orchestration Methods
  const completeOperation = useCallback(async (taskId, proofUrl = null, completionNote = null) => {
    // 1. Complete the underlying task
    const updatedTask = await tasks.completeTask(taskId, proofUrl, completionNote)

    // 2. If it belongs to a Mission (Goal), automate mission progress
    const task = updatedTask || tasks.tasks.find(t => t.id === taskId)
    if (task && task.goal_id) {
      const after = tasks.tasks.map(t => (t.id === taskId ? { ...t, status: 'completed' } : t))
      await syncMissionProgress(task.goal_id, after)
      // 3. Last open task of a milestone → offer to complete the milestone (#22)
      const milestone = task.milestone_id && getMilestones().find(m => m.id === task.milestone_id)
      if (milestone && !milestone.done_at) {
        const st = milestoneTaskStats(milestone.id, after)
        if (st.total > 0 && st.done === st.total) {
          emitGame('milestone-ready', { milestoneId: milestone.id, goalId: task.goal_id })
        }
      }
    }
    return updatedTask
  }, [tasks, syncMissionProgress])
  
  const deleteOperation = useCallback(async (taskId, revokeXp = true) => {
    const task = tasks.tasks.find(t => t.id === taskId)
    if (!task) return false
    
    const success = await tasks.deleteTask(taskId, revokeXp)
    if (success && task.goal_id) {
      await syncMissionProgress(task.goal_id, tasks.tasks.filter(t => t.id !== taskId))
    }
    if (success) {
      await profile.fetchProfile() // Refresh XP immediately
    }
    return success
  }, [tasks, profile, syncMissionProgress])

  const failOperation = useCallback(async (taskId, failureReason = null) => {
    const result = await tasks.failTask(taskId, failureReason)
    if (result) {
      await profile.fetchProfile() // Refresh XP immediately
    }
    return result
  }, [tasks, profile])

  const undoFailOperation = useCallback(async (taskId) => {
    const result = await tasks.undoFailTask(taskId)
    if (result) {
      await profile.fetchProfile() // Refresh XP immediately
    }
    return result
  }, [tasks, profile])

  const failMission = useCallback(async (goalId, failureReason = null) => {
    const result = await goals.failGoal(goalId, failureReason)
    if (result) {
      await profile.fetchProfile() // Refresh XP immediately
    }
    return result
  }, [goals, profile])

  const deleteMission = useCallback(async (goalId, revokeXp = true) => {
    const result = await goals.deleteGoal(goalId, revokeXp)
    if (result) {
      await profile.fetchProfile() // Refresh XP immediately
    }
    return result
  }, [goals, profile])

  const undoFailMission = useCallback(async (goalId) => {
    const result = await goals.undoFailGoal(goalId)
    if (result) {
      await profile.fetchProfile() // Refresh XP immediately
    }
    return result
  }, [goals, profile])

  const osState = useMemo(() => ({
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
    completeOperation,
    deleteOperation,
    syncMissionProgress,
    failOperation,
    undoFailOperation,
    failMission,
    deleteMission,
    undoFailMission,
  }), [
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
    completeOperation,
    deleteOperation,
    syncMissionProgress,
    failOperation,
    undoFailOperation,
    failMission,
    deleteMission,
    undoFailMission,
  ])

  return (
    <OSContext.Provider value={osState}>
      {SLICES.reduceRight((tree, name) => {
        const Ctx = SliceContexts[name]
        return <Ctx.Provider value={osState[name]}>{tree}</Ctx.Provider>
      }, children)}
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

/** Subscribe to one subsystem only, e.g. useOSSlice('habits'). Re-renders only when it changes. */
export function useOSSlice(name) {
  const ctx = SliceContexts[name]
  if (!ctx) throw new Error(`Unknown OS slice: ${name}`)
  return useContext(ctx) || {}
}
