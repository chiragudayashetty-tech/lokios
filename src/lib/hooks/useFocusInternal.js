'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'

export const PRESETS = [
  { label: '15 MIN', mins: 15 },
  { label: '25 MIN', mins: 25 },
  { label: '45 MIN', mins: 45 },
  { label: '60 MIN', mins: 60 },
  { label: 'CUSTOM', mins: null },
]

export const CATEGORIES = [
  { id: 'beyond_tatva', label: 'Beyond Tatva', color: '#d4a843', stat: 'founder' },
  { id: 'learning', label: 'Learning', color: '#3498db', stat: 'learning' },
  { id: 'fitness', label: 'Fitness', color: '#2ecc71', stat: 'strength' },
  { id: 'personal', label: 'Personal', color: '#9b59b6', stat: 'discipline' },
  { id: 'communication', label: 'Communication', color: '#e67e22', stat: 'communication' },
  { id: 'creation', label: 'Creation', color: '#e74c3c', stat: 'creation' },
]

export function useFocusInternal(user, initialized) {
  // ── Setup State (before session) ──
  const [phase, setPhase] = useState('setup') // 'setup' | 'running' | 'done'
  const [selectedPreset, setSelectedPreset] = useState(1) // index into PRESETS (25 min default)
  const [customMins, setCustomMins] = useState(30)
  const [taskName, setTaskName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [saving, setSaving] = useState(false)

  // ── Timer State ──
  const [totalSeconds, setTotalSeconds] = useState(25 * 60)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isActive, setIsActive] = useState(false)
  const intervalRef = useRef(null)

  // ── Session Result ──
  const [sessionXp, setSessionXp] = useState(0)
  const [aborted, setAborted] = useState(false)

  // Sync timer when preset changes (only in setup phase)
  useEffect(() => {
    if (phase !== 'setup') return
    const preset = PRESETS[selectedPreset]
    if (preset.mins !== null) {
      const secs = preset.mins * 60
      setTotalSeconds(secs)
      setTimeLeft(secs)
    } else {
      const secs = Math.max(1, Math.min(180, customMins)) * 60
      setTotalSeconds(secs)
      setTimeLeft(secs)
    }
  }, [selectedPreset, customMins, phase])

  // Tick
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    if (timeLeft === 0 && isActive) {
      setIsActive(false)
      handleComplete(false) // Timer ran out naturally — full completion
    }
    return () => clearInterval(intervalRef.current)
  }, [isActive, timeLeft])

  // ── Start Session ──
  const startSession = useCallback(() => {
    setPhase('running')
    setIsActive(true)
  }, [])

  // ── Complete Session (called when timer hits 0 OR user clicks "Complete") ──
  const handleComplete = useCallback(async (earlyComplete = false) => {
    if (saving || !user) return
    setSaving(true)
    setIsActive(false)
    clearInterval(intervalRef.current)

    try {
      const elapsed = totalSeconds - timeLeft // seconds actually worked
      const elapsedMins = Math.floor(elapsed / 60)
      const durationHours = elapsed / 3600

      // XP rule: +10 XP base per session, +1 XP per every 5 minutes of focus (min 10)
      const xpEarned = Math.max(10, 10 + Math.floor(elapsedMins / 5))

      const supabase = createClient()
      if (elapsed > 60) { // Only log if at least 1 minute worked
        await supabase.from('work_logs').insert([{
          user_id: user.id,
          title: taskName || 'FOCUS SESSION',
          type: 'project_work',
          description: `Deep Focus: ${category.label} — ${elapsedMins} min`,
          date: getLocalDateStr(),
          duration: durationHours.toFixed(2),
          duration_unit: 'hours',
        }])
        await robustAwardXP(user.id, xpEarned, 'focus_complete', getLocalDateStr(), `🎯 Focus session: ${taskName || category.label} (${elapsedMins} min)`, category.stat)
        setSessionXp(xpEarned)
      }
      setAborted(false)
      setPhase('done')
    } catch (err) {
      console.error('Focus save error:', err)
    } finally {
      setSaving(false)
    }
  }, [saving, user, totalSeconds, timeLeft, taskName, category])

  // ── Abort Session (early quit with penalty) ──
  const handleAbort = useCallback(async () => {
    if (!confirm('Abort focus session? This will cost -5 XP for breaking concentration.')) return
    setSaving(true)
    setIsActive(false)
    clearInterval(intervalRef.current)

    try {
      if (user) {
        await robustAwardXP(user.id, -5, 'focus_abort', getLocalDateStr(), '❌ Focus session aborted early', 'discipline')
      }
      setAborted(true)
      setPhase('done')
    } catch (err) {
      console.error('Abort error:', err)
    } finally {
      setSaving(false)
    }
  }, [user])

  const resetTimer = useCallback(() => {
    setPhase('setup')
    const secs = PRESETS[selectedPreset].mins !== null ? PRESETS[selectedPreset].mins * 60 : customMins * 60
    setTotalSeconds(secs)
    setTimeLeft(secs)
    setSessionXp(0)
    setAborted(false)
  }, [selectedPreset, customMins])

  return {
    phase, setPhase,
    selectedPreset, setSelectedPreset,
    customMins, setCustomMins,
    taskName, setTaskName,
    category, setCategory,
    saving,
    totalSeconds,
    timeLeft, setTimeLeft,
    isActive, setIsActive,
    sessionXp,
    aborted,
    startSession,
    handleComplete,
    handleAbort,
    resetTimer
  }
}
