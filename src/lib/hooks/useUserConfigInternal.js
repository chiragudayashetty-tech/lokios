'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_CONFIG = {
  current_mission: '',
  current_enemy: '',
  current_bottleneck: '',
  current_arc: '',
  class: 'Founder',
  who_i_want_to_become: '',
  main_mission: '',
  twelve_month_goal: '',
  income_goal: '',
  current_weaknesses: [],
  current_strengths: [],
  core_values: [],
  skills_to_master: [],
  books_to_read: [],
  vision: '',
  purpose: '',
  future_plans: '',
  battles: []
}

export function useUserConfigInternal(user) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchConfig = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('notification_prefs')
        .eq('id', user.id)
        .single()
      
      if (data?.notification_prefs) {
        setConfig({ ...DEFAULT_CONFIG, ...data.notification_prefs })
      }
      setLoading(false)
    }
    fetchConfig()
  }, [user])

  const updateConfig = useCallback(async (updates) => {
    if (!user) return
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ notification_prefs: newConfig })
      .eq('id', user.id)
  }, [user, config])

  return { config, loading, updateConfig }
}
