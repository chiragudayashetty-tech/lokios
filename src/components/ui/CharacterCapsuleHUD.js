'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AlertTriangle, Shield, TrendingUp } from 'lucide-react'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { SAGA_TITLES } from '@/lib/constants'

export default function CharacterCapsuleHUD({ profile, dailyMomentum }) {
  const totalXp = profile?.total_xp || 0
  const level = calculateLevel(totalXp)
  const xpProgress = xpToNextLevel(totalXp)
  const rank = getRankForXp(totalXp)
  const rankTitle = SAGA_TITLES[rank.code] || rank.name || 'The Spark'

  const todayNet = dailyMomentum?.todayNet || 0
  const trend3Day = dailyMomentum?.threeDayNet || 0
  const state = dailyMomentum?.state || 'STEADY'
  const now = new Date()
  const monthDayStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
  const weekdayStr = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const toNext = Math.max(0, xpProgress.required - xpProgress.current)
  const tone = state === 'AT RISK' ? 'danger' : state === 'RECOVERY' ? 'info' : state === 'SURGING' ? 'success' : 'neutral'
  const StateIcon = state === 'AT RISK' ? AlertTriangle : state === 'SURGING' ? TrendingUp : Shield

  return (
    <div className="w-full flex justify-center px-2 sm:px-4 mb-6">
      <div className="loki-capsule-hud premium-hud" data-tone={tone}>
        <Link href="/xp" className="premium-hud-level">
          <span className="premium-hud-level-number">{level}</span>
          <span><small>Level {rank.code}</small><strong>{rankTitle}</strong></span>
        </Link>

        <Link href="/xp" className="premium-hud-progress">
          <span className="premium-hud-label">Level progress</span>
          <span className="premium-hud-track">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, Math.min(100, xpProgress.percentage))}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </span>
          <span className="premium-hud-meta">{xpProgress.current.toLocaleString()} / {xpProgress.required.toLocaleString()} XP <em>{toNext.toLocaleString()} left</em></span>
        </Link>

        <Link href="/xp" className="premium-hud-momentum">
          <span className="premium-hud-label">Today</span>
          <strong>{todayNet >= 0 ? `+${todayNet}` : todayNet} XP</strong>
          <span className="premium-hud-meta">3-day {trend3Day >= 0 ? `+${trend3Day}` : trend3Day}</span>
        </Link>

        <Link href="/xp" className="premium-hud-status">
          <span className="premium-hud-date"><strong>{monthDayStr}</strong><small>{weekdayStr}</small></span>
          <span className="premium-hud-state"><StateIcon size={14} /><span>{state}</span></span>
        </Link>
      </div>
    </div>
  )
}
