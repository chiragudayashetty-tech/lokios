'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { escalatingPenalty, penaltyLabel, AUTOFAIL_BACKFILL_DAYS } from '@/lib/utils/xpRules'
import { isVacationDay } from '@/lib/utils/vacation'
import { getLocalDateStr } from '@/lib/utils/dates'
import { applyHabitStatus, getConsecutiveMisses } from '@/lib/actions/habitStatus'
import { calculateAndUpdateStreak } from '@/lib/utils/streakCalc'
import { enqueue, isOffline, registerOfflineHandler } from '@/lib/utils/offlineQueue'

// Penalty escalation lives in lib/utils/xpRules (x1, x1.5, capped at x2)
const getEscalatingPenalty = escalatingPenalty

export function useHabitsInternal(user) {
  const [allHabits, setAllHabits] = useState([])
  const [monthLogs, setMonthLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const processingRef = useRef(new Set())
  const autoFailRanRef = useRef(false)
  const supabase = createClient()

  const todayStr = getLocalDateStr()

  const habits = useMemo(() => {
    return allHabits.filter((h) => h.is_active !== false)
  }, [allHabits])

  const stoppedHabits = useMemo(() => {
    return allHabits.filter((h) => h.is_active === false)
  }, [allHabits])

  // Derive todayLogs from monthLogs for backward compat
  const todayLogs = useMemo(() => {
    return monthLogs.filter((l) => l.date === todayStr)
  }, [monthLogs, todayStr])

  const fetchHabits = useCallback(async (year, month) => {
    if (!user) {
      setAllHabits([])
      setMonthLogs([])
      setLoading(false)
      return
    }

    try {
      if (!initialized) {
        setLoading(true)
      }
      setError(null)

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
          .order('created_at', { ascending: true }),
        supabase
          .from('habit_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', firstDay)
          .lte('date', lastDayStr)
      ])

      if (habitsRes.error) throw habitsRes.error
      if (logsRes.error) throw logsRes.error

      const realLogs = logsRes.data || []
      const fetchedHabits = habitsRes.data || []

      // Sleep is scored from the sleep log now (7–9 h, before 12, up before 9:30) — retire the
      // old "Sleep Routine" habit so it stops counting in habits, streaks and Focus. History stays.
      for (const h of fetchedHabits) {
        if (h.is_active !== false && /sleep\s*routine/i.test(h.title || '')) {
          h.is_active = false
          h.stopped_at = h.stopped_at || new Date().toISOString()
          supabase.from('habits').update({ is_active: false, stopped_at: h.stopped_at }).eq('id', h.id).eq('user_id', user.id)
            .then(({ error }) => { if (error) supabase.from('habits').update({ is_active: false }).eq('id', h.id).eq('user_id', user.id) })
        }
      }

      // Read local custom order map
      const savedOrderMap = new Map()
      if (typeof window !== 'undefined' && user?.id) {
        try {
          const rawOrder = localStorage.getItem(`lokios_habit_order_${user.id}`)
          if (rawOrder) {
            const parsed = JSON.parse(rawOrder)
            if (Array.isArray(parsed)) {
              parsed.forEach((id, idx) => savedOrderMap.set(id, idx + 1))
            } else if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([id, idx]) => savedOrderMap.set(id, Number(idx)))
            }
          }
        } catch (e) {
          console.warn('Failed to parse local habit order:', e)
        }
      }

      fetchedHabits.sort((a, b) => {
        const orderA = a.display_order ?? (typeof a.order === 'number' ? a.order : null) ?? (typeof a.sort_order === 'number' ? a.sort_order : null) ?? (typeof a.position === 'number' ? a.position : null) ?? savedOrderMap.get(a.id) ?? 99999
        const orderB = b.display_order ?? (typeof b.order === 'number' ? b.order : null) ?? (typeof b.sort_order === 'number' ? b.sort_order : null) ?? (typeof b.position === 'number' ? b.position : null) ?? savedOrderMap.get(b.id) ?? 99999
        return (orderA - orderB) || (new Date(a.created_at) - new Date(b.created_at))
      })

      setAllHabits(fetchedHabits)
      setMonthLogs(realLogs)
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
  const cycleHabitState = useCallback(async (habitId, dateStr, forceStatus = null, opts = {}) => {
    if (!user) return null
    const currentTodayStr = getLocalDateStr()
    const targetDate = dateStr || currentTodayStr

    const existingLog = monthLogs.find((l) => l.habit_id === habitId && l.date === targetDate)
    const currentStatus = existingLog ? (existingLog.status || 'completed') : 'none'
    
    let nextStatus = forceStatus
    if (!nextStatus) {
      nextStatus = 'completed'
      if (currentStatus === 'completed') nextStatus = 'failed'
      if (currentStatus === 'failed') nextStatus = 'none'
    }

    // Skip if we are trying to force a status that is already the current status
    if (forceStatus && currentStatus === forceStatus && !opts.replay) return true;

    const procKey = `${habitId}_${targetDate}_cycle`
    if (processingRef.current.has(procKey)) return null
    processingRef.current.add(procKey)

    // Optimistic UI Update
    const optimisticId = `opt_${habitId}_${targetDate}`
    setMonthLogs(prev => {
      const filtered = prev.filter(l => !(l.habit_id === habitId && l.date === targetDate))
      if (nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'rest' || nextStatus === 'blocked') {
        return [...filtered, { id: optimisticId, habit_id: habitId, date: targetDate, status: nextStatus }]
      }
      return filtered
    })

    // Offline: keep the optimistic tick and sync it when the connection returns
    if (isOffline() && !opts.replay) {
      enqueue({ type: 'habit', key: `habit_${habitId}_${targetDate}`, habitId, date: targetDate, status: nextStatus })
      processingRef.current.delete(procKey)
      return true
    }

    try {
      const habit = habits.find((h) => h.id === habitId)
      const newLog = await applyHabitStatus({ userId: user.id, habitId, habit, habits, monthLogs, existingLog, targetDate, currentStatus, nextStatus })

      // Update local state with real DB log
      setMonthLogs(prev => {
        const withoutOpt = prev.filter(l => l.id !== optimisticId)
        return newLog ? [...withoutOpt, newLog] : withoutOpt
      })

      return true
    } catch (error) {
      console.error('Error cycling habit:', error)
      alert(`SYSTEM ERROR: ${error.message || JSON.stringify(error)}`)
      // DEBUG: Log error to xp_history so I can read it
      supabase.from('xp_history').insert({
        user_id: user.id,
        amount: 0,
        source_type: 'error_log',
        source_id: habitId,
        description: String(error.message || JSON.stringify(error))
      }).then()
      
      // Rollback optimistic update
      setMonthLogs(prev => {
        const filtered = prev.filter(l => l.id !== optimisticId)
        if (existingLog) {
          return [...filtered, existingLog]
        }
        return filtered
      })
      return null
    } finally {
      processingRef.current.delete(procKey)
    }
  }, [user, habits, monthLogs, todayStr])

  // Backward-compat wrapper
  // Replay ticks made offline once we're back online
  useEffect(() => {
    if (!user || !initialized) return
    registerOfflineHandler('habit', (op) => cycleHabitState(op.habitId, op.date, op.status, { replay: true }))
  }, [user, initialized, cycleHabitState])

  const toggleHabitForDate = useCallback(async (habitId, dateStr, newStatus) => {
    return cycleHabitState(habitId, dateStr, newStatus)
  }, [cycleHabitState])

  // Simple toggle checking/unchecking for UI elements
  const toggleHabit = useCallback(async (habitId) => {
    const existingLog = monthLogs.find((l) => l.habit_id === habitId && l.date === todayStr)
    const currentStatus = existingLog ? (existingLog.status || 'completed') : 'none'
    const nextStatus = currentStatus === 'completed' ? 'none' : 'completed'
    return cycleHabitState(habitId, todayStr, nextStatus)
  }, [monthLogs, todayStr, cycleHabitState])

  const addHabit = useCallback(async (data) => {
    if (!user) return null

    try {
      const nextOrder = (habits?.length || 0) + 1
      const payload = { created_at: new Date().toISOString(), is_active: true, display_order: nextOrder, ...data, user_id: user.id }
      let newHabit = null
      const { data: inserted, error } = await supabase
        .from('habits')
        .insert(payload)
        .select()
        .single()

      if (error) {
        const fallbackPayload = { ...payload }
        delete fallbackPayload.display_order
        const { data: fallbackInserted, error: fallbackError } = await supabase
          .from('habits')
          .insert(fallbackPayload)
          .select()
          .single()
        if (fallbackError) throw fallbackError
        newHabit = fallbackInserted
      } else {
        newHabit = inserted
      }

      if (newHabit) {
        setAllHabits((prev) => [...prev, newHabit])
        if (typeof window !== 'undefined' && user?.id) {
          try {
            const raw = localStorage.getItem(`lokios_habit_order_${user.id}`)
            const currentOrder = raw ? JSON.parse(raw) : []
            if (Array.isArray(currentOrder) && !currentOrder.includes(newHabit.id)) {
              localStorage.setItem(`lokios_habit_order_${user.id}`, JSON.stringify([...currentOrder, newHabit.id]))
            }
          } catch (e) {}
        }
      }
      return newHabit
    } catch (error) {
      console.error('Error adding habit:', error)
      return null
    }
  }, [user, habits?.length])

  const deleteHabit = useCallback(async (habitId) => {
    if (!user) return null
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id)
      if (error) throw error
      setAllHabits((prev) => prev.filter((h) => h.id !== habitId))
      if (typeof window !== 'undefined' && user?.id) {
        try {
          const raw = localStorage.getItem(`lokios_habit_order_${user.id}`)
          const currentOrder = raw ? JSON.parse(raw) : []
          if (Array.isArray(currentOrder)) {
            localStorage.setItem(`lokios_habit_order_${user.id}`, JSON.stringify(currentOrder.filter(id => id !== habitId)))
          }
        } catch (e) {}
      }
      return true
    } catch (error) {
      console.error('Error deleting habit:', error)
      return null
    }
  }, [user])

  const stopHabit = useCallback(async (habitId) => {
    if (!user) return null
    try {
      const stoppedAt = new Date().toISOString()
      const currentHabit = allHabits.find((h) => h.id === habitId)
      const cleanDesc = (currentHabit?.description || '').replace(/\[STOPPED(?:_AT)?:[^\]]+\]/gi, '').trim()
      const newDesc = cleanDesc ? `${cleanDesc} [STOPPED:${stoppedAt}]` : `[STOPPED:${stoppedAt}]`

      const { error } = await supabase
        .from('habits')
        .update({ is_active: false, stopped_at: stoppedAt, description: newDesc, updated_at: stoppedAt })
        .eq('id', habitId)
        .eq('user_id', user.id)

      if (error) {
        // Fallback without stopped_at column if column does not exist
        const { error: err2 } = await supabase
          .from('habits')
          .update({ is_active: false, description: newDesc, updated_at: stoppedAt })
          .eq('id', habitId)
          .eq('user_id', user.id)
        if (err2) {
          await supabase.from('habits').update({ is_active: false }).eq('id', habitId).eq('user_id', user.id)
        }
      }

      setAllHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, is_active: false, stopped_at: stoppedAt, description: newDesc, updated_at: stoppedAt } : h)))

      if (typeof window !== 'undefined' && user?.id) {
        try {
          const raw = localStorage.getItem(`lokios_stopped_habits_${user.id}`)
          const map = raw ? JSON.parse(raw) : {}
          map[habitId] = stoppedAt
          localStorage.setItem(`lokios_stopped_habits_${user.id}`, JSON.stringify(map))
        } catch (e) {}
      }

      return true
    } catch (error) {
      console.error('Error stopping habit:', error)
      return null
    }
  }, [user, allHabits])

  const resumeHabit = useCallback(async (habitId) => {
    if (!user) return null
    try {
      const currentHabit = allHabits.find((h) => h.id === habitId)
      const cleanDesc = (currentHabit?.description || '').replace(/\[STOPPED(?:_AT)?:[^\]]+\]/gi, '').trim() || null
      const nowIso = new Date().toISOString()

      const { error } = await supabase
        .from('habits')
        .update({ is_active: true, stopped_at: null, description: cleanDesc, updated_at: nowIso })
        .eq('id', habitId)
        .eq('user_id', user.id)

      if (error) {
        const { error: err2 } = await supabase
          .from('habits')
          .update({ is_active: true, description: cleanDesc, updated_at: nowIso })
          .eq('id', habitId)
          .eq('user_id', user.id)
        if (err2) {
          await supabase.from('habits').update({ is_active: true }).eq('id', habitId).eq('user_id', user.id)
        }
      }

      setAllHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, is_active: true, stopped_at: null, description: cleanDesc, updated_at: nowIso } : h)))

      if (typeof window !== 'undefined' && user?.id) {
        try {
          const raw = localStorage.getItem(`lokios_stopped_habits_${user.id}`)
          if (raw) {
            const map = JSON.parse(raw)
            delete map[habitId]
            localStorage.setItem(`lokios_stopped_habits_${user.id}`, JSON.stringify(map))
          }
        } catch (e) {}
      }

      return true
    } catch (error) {
      console.error('Error resuming habit:', error)
      return null
    }
  }, [user, allHabits])

  const archiveHabit = useCallback(async (habitId) => {
    return stopHabit(habitId)
  }, [stopHabit])

  const updateHabit = useCallback(async (habitId, updates) => {
    if (!user) return null
    try {
      const { data, error } = await supabase.from('habits').update(updates).eq('id', habitId).eq('user_id', user.id).select().single()
      if (error) throw error
      setAllHabits((prev) => prev.map(h => h.id === habitId ? data : h))
      return data
    } catch (error) {
      console.error('Error updating habit:', error)
      if (typeof window !== 'undefined') {
        alert("DB Update Error: " + (error.message || JSON.stringify(error)))
      }
      return null
    }
  }, [user])

  const reorderHabits = useCallback(async (habitId, direction) => {
    if (!user) return
    const activeHabits = [...habits]
    const index = activeHabits.findIndex(h => h.id === habitId)
    if (index === -1) return
    
    let swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= activeHabits.length) return
    
    const [moved] = activeHabits.splice(index, 1)
    activeHabits.splice(swapIndex, 0, moved)
    
    const updatedActive = activeHabits.map((h, i) => ({
      ...h,
      display_order: i + 1
    }))

    // Keep stopped habits intact in allHabits so they are not dropped
    const currentStopped = allHabits.filter(h => h.is_active === false)
    const updatedAll = [...updatedActive, ...currentStopped]
    setAllHabits(updatedAll)

    // Save exact order array in localStorage for 100% instant and unbreakable persistence
    const orderIds = updatedActive.map(h => h.id)
    if (typeof window !== 'undefined' && user?.id) {
      try {
        localStorage.setItem(`lokios_habit_order_${user.id}`, JSON.stringify(orderIds))
      } catch (e) {}
    }

    // Persist to Supabase with progressive fallbacks
    const supabase = createClient()
    for (const h of updatedActive) {
      try {
        const { error: err1 } = await supabase
          .from('habits')
          .update({ display_order: h.display_order })
          .eq('id', h.id)
          .eq('user_id', user.id)

        if (err1) {
          await supabase.from('habits').update({ order: h.display_order }).eq('id', h.id).eq('user_id', user.id)
        }
      } catch (e) {
        console.warn('Failed to sync habit order to DB (local storage preserved):', e)
      }
    }
  }, [habits, allHabits, user])

  const reorderHabitsByDrag = useCallback(async (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId || !user) return
    const activeHabits = [...habits]
    const dragIdx = activeHabits.findIndex(h => h.id === draggedId)
    const targetIdx = activeHabits.findIndex(h => h.id === targetId)
    if (dragIdx === -1 || targetIdx === -1) return

    const [moved] = activeHabits.splice(dragIdx, 1)
    activeHabits.splice(targetIdx, 0, moved)

    const updatedActive = activeHabits.map((h, i) => ({
      ...h,
      display_order: i + 1
    }))

    // Keep stopped habits intact in allHabits
    const currentStopped = allHabits.filter(h => h.is_active === false)
    const updatedAll = [...updatedActive, ...currentStopped]
    setAllHabits(updatedAll)

    // Save exact order array in localStorage
    const orderIds = updatedActive.map(h => h.id)
    if (typeof window !== 'undefined' && user?.id) {
      try {
        localStorage.setItem(`lokios_habit_order_${user.id}`, JSON.stringify(orderIds))
      } catch (e) {}
    }

    // Persist to Supabase with progressive fallbacks
    const supabase = createClient()
    for (const h of updatedActive) {
      try {
        const { error: err1 } = await supabase
          .from('habits')
          .update({ display_order: h.display_order })
          .eq('id', h.id)
          .eq('user_id', user.id)

        if (err1) {
          await supabase.from('habits').update({ order: h.display_order }).eq('id', h.id).eq('user_id', user.id)
        }
      } catch (e) {
        console.warn('Failed to sync habit order to DB (local storage preserved):', e)
      }
    }
  }, [habits, allHabits, user])

  // Auto-fail untouched habits
  useEffect(() => {
    if (!initialized || !user || habits.length === 0 || autoFailRanRef.current) return
    
    const runAutoFail = async () => {
      if (localStorage.getItem('daily_ops_autofail_ran_today') === todayStr) {
        autoFailRanRef.current = true
        return
      }
      
      const storedResetDate = localStorage.getItem('last_reset_date')
      // Default to June 29th, 2026 so users returning at the end of June aren't retroactively penalized for the whole month
      const RESET_DATE = storedResetDate ? new Date(storedResetDate) : new Date('2026-06-29T00:00:00Z')
      const now = new Date()
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      
      // Only look back AUTOFAIL_BACKFILL_DAYS so a break can't trigger weeks of penalties at once
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(now.getDate() - AUTOFAIL_BACKFILL_DAYS)

      let globalStartDate = Math.max(RESET_DATE.getTime(), thirtyDaysAgo.getTime())
      for (const h of habits) {
        const hc = new Date(h.created_at).getTime()
        if (hc < globalStartDate) globalStartDate = hc // Wait, we actually want the oldest possible start date across all habits, bounded by 30 days ago.
      }
      globalStartDate = Math.max(globalStartDate, thirtyDaysAgo.getTime(), RESET_DATE.getTime())
      
      const { data: recentLogs } = await supabase
        .from('habit_logs')
        .select('habit_id, date')
        .eq('user_id', user.id)
        .gte('date', getLocalDateStr(new Date(globalStartDate)))

      const logMap = new Set((recentLogs || []).map(l => `${l.habit_id}_${l.date}`))
      
      let createdAny = false
      let newVirtualLogs = []
      let dbInsertPayloads = []
      
      for (const h of habits) {
        const habitCreatedDate = new Date(h.created_at)
        let startDate = new Date(Math.max(RESET_DATE.getTime(), habitCreatedDate.getTime(), thirtyDaysAgo.getTime()))
        
        for (let d = new Date(startDate); ; d.setDate(d.getDate() + 1)) {
          const dateStr = getLocalDateStr(d)
          if (dateStr >= todayStr) break // NEVER auto-fail today or future dates!
          if (isVacationDay(dateStr)) continue // vacation: nothing is failed
          
          const dayOfWeek = d.getDay()
          const freqDays = h.frequency_days || [0, 1, 2, 3, 4, 5, 6]
          
          // Skip auto-fail if today is not a scheduled day for this habit
          if (!freqDays.includes(dayOfWeek)) continue;

          if (!logMap.has(`${h.id}_${dateStr}`)) {
            const procKey = `${h.id}_${dateStr}_autofail`
            if (!processingRef.current.has(procKey)) {
              processingRef.current.add(procKey)
              
              const baseXP = h.xp_per_completion ? Math.max(5, parseInt(h.xp_per_completion, 10)) : 25
              const priorMisses = getConsecutiveMisses(h.id, dateStr, recentLogs, h)
              const { missStreak, multiplier, penaltyMagnitude } = getEscalatingPenalty(baseXP, priorMisses)
              const penaltyXP = -penaltyMagnitude
              const reason = penaltyLabel(h.title, { missStreak, multiplier, penaltyMagnitude })

              const stableSourceId = `habit_${h.id}_${dateStr}`
              const createdAt = `${dateStr}T12:00:00.000Z`
              await robustAwardXP(user.id, penaltyXP, 'habit_failed', stableSourceId, reason, h.stat_category || 'discipline', createdAt)
              
              newVirtualLogs.push({ id: stableSourceId, habit_id: h.id, date: dateStr, status: 'failed' })
              dbInsertPayloads.push({ user_id: user.id, habit_id: h.id, date: dateStr, status: 'failed' })
              createdAny = true
            }
          }
        }
      }
      
      if (dbInsertPayloads.length > 0) {
        await supabase.from('habit_logs').upsert(dbInsertPayloads, { onConflict: 'habit_id,date' })
      }
      
      if (newVirtualLogs.length > 0) {
        setMonthLogs(prev => {
          const newKeys = new Set(newVirtualLogs.map(l => `${l.habit_id}_${l.date}`))
          const filtered = prev.filter(l => !newKeys.has(`${l.habit_id}_${l.date}`))
          return [...filtered, ...newVirtualLogs]
        })
      }
      
      if (createdAny) {
        try { await calculateAndUpdateStreak(user.id) } catch (e) { console.error('Streak update failed:', e) }
      }
      localStorage.setItem('daily_ops_autofail_ran_today', todayStr)
      autoFailRanRef.current = true
    }
    
    runAutoFail()
  }, [initialized, user, habits, todayStr]) // Omitted monthLogs from deps to prevent loop

  return {
    habits,
    stoppedHabits,
    allHabits,
    monthLogs,
    todayLogs,
    loading,
    error,
    fetchHabits,
    cycleHabitState,
    toggleHabit,
    toggleHabitForDate,
    addHabit,
    deleteHabit,
    stopHabit,
    resumeHabit,
    archiveHabit: stopHabit,
    updateHabit,
    reorderHabits,
    reorderHabitsByDrag
  }
}
