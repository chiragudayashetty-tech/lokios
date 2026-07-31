'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'

export function useXPInternal(user) {
  const supabase = createClient()

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

  return { awardXP, deductXP }
}
