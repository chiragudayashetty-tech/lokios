'use client'

import { useEffect } from 'react'
import { useGameState } from '@/lib/hooks/useGameState'
import { syncAchievements } from '@/lib/stores/achievementStore'
import { celebrateSmall } from '@/lib/utils/celebrate'

/** Re-evaluates achievements whenever the shared game state reloads (#29). */
export default function AchievementService() {
  const game = useGameState()
  useEffect(() => {
    if (!game.ready || !game.userId) return
    const t = setTimeout(() => syncAchievements(game.userId, game), 3000)
    return () => clearTimeout(t)
  }, [game.ready, game.userId, game.xpRows, game.model]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = (e) => { if (e.detail?.type === 'achievement-unlocked') celebrateSmall(0.5, 0.2) }
    window.addEventListener('lokios:game', on)
    return () => window.removeEventListener('lokios:game', on)
  }, [])
  return null
}
