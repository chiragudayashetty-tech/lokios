'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { calculateDailyMomentum } from '@/lib/utils/dailyMomentum'
import { backfillRecentScreenTimeXP } from '@/lib/utils/screenTimeXP'

export function useXPInternal(user) {
  const supabase = createClient()
  const [dailyMomentum, setDailyMomentum] = useState(() => calculateDailyMomentum())
  const [feedbackEvents, setFeedbackEvents] = useState([])
  const recentToasts = useRef(new Map())
  const seenEventIds = useRef(new Set())
  const hasBackfilledScreenTime = useRef(false)

  const fetchMomentum = useCallback(async () => {
    if (!user) {
      setDailyMomentum(calculateDailyMomentum())
      return
    }

    // Automatically ensure recent screen time logs have their XP recorded
    if (!hasBackfilledScreenTime.current) {
      hasBackfilledScreenTime.current = true
      try {
        await backfillRecentScreenTimeXP(user.id)
      } catch (e) {
        console.warn('Screen time XP backfill skipped:', e)
      }
    }

    // Local midnight six days ago (a "YYYY-MM-DDT00:00Z" string would be UTC midnight)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 6)
    const { data, error } = await createClient()
      .from('xp_history')
      .select('amount, created_at, source_type')
      .eq('user_id', user.id)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) {
      console.warn('Failed to load daily momentum:', error)
      return
    }
    setDailyMomentum(calculateDailyMomentum(data || []))
  }, [user])

  useEffect(() => {
    fetchMomentum()
  }, [fetchMomentum])

  const pushFeedback = useCallback((id, amount, source) => {
    if (!Number.isFinite(amount) || amount === 0 || seenEventIds.current.has(id)) return
    seenEventIds.current.add(id)
    const event = { id, amount, source }
    setFeedbackEvents(previous => [...previous.slice(-2), event])
    window.setTimeout(() => {
      setFeedbackEvents(previous => previous.filter(item => item.id !== id))
    }, 4200)
  }, [])

  // Toasts come from local XP events (see xpFallback notifyXpChanged), so they
  // work even when Supabase Realtime isn't enabled; realtime only refreshes data.
  const handleXpRealtime = useCallback(() => {}, [])

  useEffect(() => {
    let timer = null
    const onXp = (e) => {
      const d = e.detail || {}
      if (!d.silent) {
        const label = String(d.description || d.sourceType || 'XP').replace(/s[#[^]]+]$/, '').replace(/s*([^)]*XP[^)]*)s*$/i, '')
        // One toast per award: the same source + amount re-announced within 15s (save + sync echo) is dropped
        const key = `${d.sourceId || d.sourceType || 'xp'}:${d.amount}`
        const now = Date.now()
        if ((recentToasts.current.get(key) || 0) <= now - 15000) {
          recentToasts.current.set(key, now)
          pushFeedback(`${key}_${now}`, Number(d.amount), label.length > 48 ? label.slice(0, 47) + '…' : label)
        }
      }
      clearTimeout(timer)
      timer = setTimeout(() => { fetchMomentum() }, 400)
    }
    window.addEventListener('lokios:xp-changed', onXp)
    return () => { window.removeEventListener('lokios:xp-changed', onXp); clearTimeout(timer) }
  }, [pushFeedback, fetchMomentum])

  const dismissFeedback = useCallback((id) => {
    setFeedbackEvents(previous => previous.filter(item => item.id !== id))
  }, [])

  const awardXP = useCallback(async (amount, sourceType, sourceId, description, statCategory = 'discipline', customCreatedAt = null) => {
    if (!user) return null

    try {
      await robustAwardXP(user.id, amount, sourceType, sourceId, description, statCategory, customCreatedAt)
      await fetchMomentum()
      return true
    } catch (error) {
      console.error('Error awarding XP:', error)
      return null
    }
  }, [user, fetchMomentum])

  const deductXP = useCallback(async (amount, sourceType, sourceId, description) => {
    if (!user) return null

    try {
      await robustRemoveXP(user.id, sourceType, sourceId, amount, description)
      await fetchMomentum()
      return true
    } catch (error) {
      console.error('Error deducting XP:', error)
      return null
    }
  }, [user, fetchMomentum])

  return { awardXP, deductXP, dailyMomentum, fetchMomentum, feedbackEvents, handleXpRealtime, dismissFeedback }
}
