'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useCharacterStatsInternal(user) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchStats = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('character_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (data) {
        setStats({
          founder: { xp: data.founder_xp || 0, level: data.founder_level || 1 },
          discipline: { xp: data.discipline_xp || 0, level: data.discipline_level || 1 },
          learning: { xp: data.learning_xp || 0, level: data.learning_level || 1 },
          communication: { xp: data.communication_xp || 0, level: data.communication_level || 1 },
          creation: { xp: data.creation_xp || 0, level: data.creation_level || 1 },
          strength: { xp: data.strength_xp || 0, level: data.strength_level || 1 },
        })
      }
      setLoading(false)
    }
    fetchStats()
  }, [user])

  return { stats, loading }
}
