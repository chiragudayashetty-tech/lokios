'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { calculateDailyMomentum } from '@/lib/utils/dailyMomentum'
import { getLocalDateStr } from '@/lib/utils/dates'

export function useXPInternal(user) {
  const supabase = createClient()
  const [dailyMomentum, setDailyMomentum] = useState(() => calculateDailyMomentum())
  const [feedbackEvents, setFeedbackEvents] = useState([])
  const seenEventIds = useRef(new Set())

  const fetchMomentum = useCallback(async () => {
    if (!user) {
      setDailyMomentum(calculateDailyMomentum())
      return
    }

    const start = new Date()
    start.setDate(start.getDate() - 6)
    const { data, error } = await createClient()
      .from('xp_history')
      .select('amount, created_at')
      .eq('user_id', user.id)
      .gte('created_at', getLocalDateStr(start))

    if (error) {
      console.warn('Failed to load daily momentum:', error)
      return
    }
    setDailyMomentum(calculateDailyMomentum(data || []))
  }, [user])

  useEffect(() => {
    fetchMomentum()
  }, [fetchMomentum])

  const handleXpRealtime = useCallback((payload) => {
    const row = payload?.new
    const amount = Number(row?.amount)
    if (typeof window === 'undefined' || !row || !Number.isFinite(amount) || amount === 0 || !row.id || seenEventIds.current.has(row.id)) return
    seenEventIds.current.add(row.id)
    const source = String(row.source_type || 'EXECUTION').replaceAll('_', ' ').toUpperCase()
    const event = { id: row.id, amount, source }
    setFeedbackEvents(previous => [...previous.slice(-2), event])
    window.setTimeout(() => {
      setFeedbackEvents(previous => previous.filter(item => item.id !== row.id))
    }, 4200)
  }, [])

  const dismissFeedback = useCallback((id) => {
    setFeedbackEvents(previous => previous.filter(item => item.id !== id))
  }, [])

  const awardXP = useCallback(async (amount, sourceType, sourceId, description, statCategory = 'discipline') => {
    if (!user) return null

    try {
      await robustAwardXP(user.id, amount, sourceType, sourceId, description, statCategory)
      return true
    } catch (error) {
      console.error('Error awarding XP:', error)
      return null
    }
  }, [user])

  const deductXP = useCallback(async (amount, sourceType, sourceId, description) => {
    if (!user) return null

    try {
      await robustRemoveXP(user.id, sourceType, sourceId, amount, description)
      return true
    } catch (error) {
      console.error('Error deducting XP:', error)
      return null
    }
  }, [user])

  return { awardXP, deductXP, dailyMomentum, fetchMomentum, feedbackEvents, handleXpRealtime, dismissFeedback }
}
