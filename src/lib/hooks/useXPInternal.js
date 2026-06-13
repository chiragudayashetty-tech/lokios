'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export function useXPInternal() {
  const { user } = useAuth()
  const supabase = createClient()

  const awardXP = useCallback(async (amount, sourceType, sourceId, description, statCategory = 'discipline') => {
    if (!user) return null

    try {
      const { data, error } = await supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_amount: amount,
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_description: description,
        p_stat_category: statCategory,
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error awarding XP:', error)
      return null
    }
  }, [user])

  return { awardXP }
}
