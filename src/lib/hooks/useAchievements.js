'use client'

import { useEffect, useState } from 'react'
import { useOSSlice } from '@/lib/context/OSContext'
import { achievementSnapshot, subscribeAchievements } from '@/lib/stores/achievementStore'

/** { list, earned: Map(id → earned_at), stats, missing, ready } — filled by AchievementService. */
export function useAchievements() {
  const { user } = useOSSlice('auth')
  const [snap, setSnap] = useState(achievementSnapshot)
  useEffect(() => subscribeAchievements(setSnap), [])
  return snap.userId === user?.id ? snap : { list: [], earned: new Map(), stats: null, missing: false, ready: false }
}
