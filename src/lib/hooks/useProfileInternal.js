'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useProfileInternal(user) {
  const [profile, setProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('lokios_cached_profile')
        if (cached) return JSON.parse(cached)
      } catch (e) {}
    }
    return null
  })
  const [loading, setLoading] = useState(!profile)
  const [initialized, setInitialized] = useState(false)
  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    try {
      if (!initialized && !profile) setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setProfile(data)
      if (typeof window !== 'undefined' && data) {
        localStorage.setItem('lokios_cached_profile', JSON.stringify(data))
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [user, initialized, profile])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const updateProfile = useCallback(async (data) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      setProfile(updated)
      if (typeof window !== 'undefined' && updated) {
        localStorage.setItem('lokios_cached_profile', JSON.stringify(updated))
      }
      return updated
    } catch (error) {
      console.error('Error updating profile:', error)
      return null
    }
  }, [user])

  return { profile, loading, updateProfile, fetchProfile }
}
