'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  // Refs, not state deps: depending on `profile` made every fetch recreate
  // fetchProfile, re-trigger the effect below and refetch in an endless loop.
  const hasDataRef = useRef(!!profile)
  const userId = user?.id
  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }

    try {
      if (!hasDataRef.current) setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      hasDataRef.current = true
      setProfile(data)
      if (typeof window !== 'undefined' && data) {
        localStorage.setItem('lokios_cached_profile', JSON.stringify(data))
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is a per-render singleton wrapper
  }, [userId])

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
