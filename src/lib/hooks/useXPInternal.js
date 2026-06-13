'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { robustAwardXP } from '@/lib/utils/xpFallback'

export function useXPInternal() {
  const { user } = useAuth()
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

  return { awardXP }
}
