'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import WinterLoader from '@/components/ui/WinterLoader'

export default function AuthRedirectGate() {
  const router = useRouter()

  useEffect(() => {
    // 1. Instant check for cached user in localStorage (0ms on mobile PWA & browsers)
    let cachedUser = null
    try {
      const raw = localStorage.getItem('lokios_cached_user')
      if (raw) cachedUser = JSON.parse(raw)
    } catch (e) {}

    if (cachedUser) {
      router.replace('/dashboard')
      return
    }

    // 2. Check Supabase client session
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        try {
          localStorage.setItem('lokios_cached_user', JSON.stringify(session.user))
        } catch (e) {}
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    }).catch(() => {
      router.replace('/login')
    })
  }, [router])

  return <WinterLoader label="Waking up your console" fullscreen />
}
