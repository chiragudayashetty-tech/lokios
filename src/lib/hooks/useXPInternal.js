'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { calculateDailyMomentum } from '@/lib/utils/dailyMomentum'
import { getLocalDateStr } from '@/lib/utils/dates'

export function useXPInternal(user) {
  const supabase = createClient()
  const [dailyMomentum, setDailyMomentum] = useState(() => calculateDailyMomentum())

  const fetchMomentum = useCallback(async () => {
    if (!user) {
      setDailyMomentum(calculateDailyMomentum())
      return
    }

    const start = new Date()
    start.setDate(start.getDate() - 2)
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

  return { awardXP, deductXP, dailyMomentum, fetchMomentum }
}
