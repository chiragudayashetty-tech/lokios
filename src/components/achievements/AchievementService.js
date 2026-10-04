'use client'

import { useEffect } from 'react'
import { useGameState } from '@/lib/hooks/useGameState'
import { syncAchievements } from '@/lib/stores/achievementStore'
import AchievementUnlock from '@/components/achievements/AchievementUnlock'

/** Re-evaluates achievements whenever the shared game state reloads (#29) and shows unlocks. */
export default function AchievementService() {
  const game = useGameState()
  useEffect(() => {
    if (!game.ready || !game.userId) return
    const t = setTimeout(() => syncAchievements(game.userId, game), 3000)
    return () => clearTimeout(t)
  }, [game.ready, game.userId, game.xpRows, game.model]) // eslint-disable-line react-hooks/exhaustive-deps

  return <AchievementUnlock />
}
