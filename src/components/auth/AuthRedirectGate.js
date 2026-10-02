'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  return (
    <div className="flex-center min-h-screen bg-[#05070e] flex-col gap-3">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
        <img src="/icons/winter-warrior-logo.png" alt="Loki OS" className="w-8 h-8 opacity-80" />
      </div>
      <span className="font-mono text-xs text-muted tracking-widest uppercase animate-pulse">
        CONNECTING TO CONSOLE...
      </span>
    </div>
  )
}
