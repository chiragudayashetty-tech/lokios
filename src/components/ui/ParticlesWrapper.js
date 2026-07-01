'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const ParticlesBackground = dynamic(
  () => import('./ParticlesBackground'),
  { ssr: false }
)

export default function ParticlesWrapper() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // Only render particles on desktop - they cause scroll jank and drain battery on phones
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!isDesktop) return null
  return <ParticlesBackground />
}
