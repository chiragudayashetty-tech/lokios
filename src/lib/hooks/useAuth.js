'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get initial user with persistent cache fallback for mobile resume
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUser(user)
          if (typeof window !== 'undefined') {
            localStorage.setItem('lokios_cached_user', JSON.stringify(user))
          }
        } else {
          // Check session or fallback to cached user on mobile network delay
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            setUser(session.user)
            if (typeof window !== 'undefined') {
              localStorage.setItem('lokios_cached_user', JSON.stringify(session.user))
            }
          } else if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('lokios_cached_user')
            if (cached) {
              try { setUser(JSON.parse(cached)) } catch (e) {}
            }
          }
        }
      } catch (error) {
        console.error('Error getting user:', error)
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('lokios_cached_user')
          if (cached) {
            try { setUser(JSON.parse(cached)) } catch (e) {}
          }
        }
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lokios_cached_user')
          }
        } else if (session?.user) {
          setUser(session.user)
          if (typeof window !== 'undefined') {
            localStorage.setItem('lokios_cached_user', JSON.stringify(session.user))
          }
        }
        setLoading(false)
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lokios_cached_user')
    }
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }, [router])

  return { user, loading, signOut }
}
