'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, animate } from 'framer-motion'
import { Shield, ShieldAlert, Flame, TrendingUp, TrendingDown } from 'lucide-react'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { SAGA_TITLES } from '@/lib/constants'
import { nextStreakMilestone } from '@/lib/utils/xpRules'

const STATE_STYLE = {
  'AT RISK': { color: 'var(--danger)', Icon: ShieldAlert },
  RECOVERY: { color: 'var(--info)', Icon: Shield },
  SURGING: { color: 'var(--success)', Icon: Flame },
  STEADY: { color: 'var(--accent-primary)', Icon: Shield },
}

function netColor(n) {
  return n < 0 ? 'var(--danger)' : n > 0 ? 'var(--success)' : 'var(--accent-primary)'
}

/** Animates a number from its previous value to the new one. */
function CountUp({ value, format = (n) => n.toLocaleString() }) {
  const ref = useRef(null)
  const from = useRef(0)
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = format(Math.round(v)) },
    })
    from.current = value
    return () => controls.stop()
  }, [value, format])
  return <span ref={ref}>{format(0)}</span>
}

const signed = (n) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString())

export default function CharacterCapsuleHUD({ profile, dailyMomentum }) {
  // Cached profile keeps the HUD populated on cold start before Supabase responds
  const [cachedProfile, setCachedProfile] = useState(null)
  useEffect(() => {
    if (profile) return
    try {
      const raw = localStorage.getItem('lokios_cached_profile')
      if (raw) setCachedProfile(JSON.parse(raw))
    } catch {}
  }, [profile])

  const effectiveProfile = profile || cachedProfile
  const totalXp = effectiveProfile?.total_xp || 0
  const level = calculateLevel(totalXp)
  const xpProgress = xpToNextLevel(totalXp)
  const rank = getRankForXp(totalXp)
  const rankTitle = SAGA_TITLES[rank.code] || rank.name || 'The Spark'

  const todayNet = dailyMomentum?.todayNet || 0
  const trend3Day = dailyMomentum?.threeDayNet || 0
  const state = dailyMomentum?.state || 'STEADY'
  const { color: stateColor, Icon: StateIcon } = STATE_STYLE[state] || STATE_STYLE.STEADY
  const sparklineBars = dailyMomentum?.sparkline || []

  const streak = effectiveProfile?.current_streak ?? effectiveProfile?.streak_days ?? 0
  const nextMilestone = nextStreakMilestone(streak)

  const toNext = Math.max(0, xpProgress.required - xpProgress.current)
  const pct = Math.max(4, Math.min(100, Math.round(xpProgress.percentage)))

  return (
    <div className="flex justify-center w-full px-1 mb-5">
      <div className="loki-capsule-hud premium-xp-hud">

        {/* ── Level gem + saga ── */}
        <Link href="/xp" className="flex items-center gap-2.5 shrink-0 min-w-0" style={{ color: 'inherit' }}>
          <motion.div
            className="relative grid place-items-center w-9 h-9 rounded-xl shrink-0"
            style={{
              background: 'var(--accent-gradient)',
              boxShadow: '0 6px 18px -6px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.4)',
            }}
            whileHover={{ rotate: -8, scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="rgba(255,255,255,0.28)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M2 9H22M12 2L8 9L12 22L16 9L12 2Z" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
          </motion.div>
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-extrabold text-[15px] leading-none text-white">Lv. {level}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Saga {rank.code}</span>
            </div>
            <span className="font-display font-semibold text-[11px] mt-0.5 truncate" style={{ color: 'var(--accent-primary)' }}>
              {rankTitle}
            </span>
          </div>
        </Link>

        {/* ── Level progress ── */}
        <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0 px-1.5" style={{ maxWidth: 340 }}>
          <div className="capsule-track" style={{ height: 8, borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
            <motion.div
              className="capsule-fill"
              style={{ height: '100%', borderRadius: 999 }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted font-mono">
            <span className="hidden sm:inline font-semibold text-secondary">
              {xpProgress.current.toLocaleString()} / {xpProgress.required.toLocaleString()} XP
            </span>
            <span className="sm:hidden font-bold" style={{ color: netColor(todayNet) }}>
              {signed(todayNet)} XP today
            </span>
            <span>{toNext.toLocaleString()} to Lv. {level + 1}</span>
          </div>
        </div>

        {/* ── 3-day trend (desktop) ── */}
        {sparklineBars.length > 0 && (
          <div className="hidden lg:flex items-center gap-4 pl-4 shrink-0" style={{ borderLeft: '1px solid var(--border-color)' }}>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted font-semibold">3-day trend</span>
              <div className="flex items-center gap-1 mt-0.5 text-xs font-bold font-mono" style={{ color: trend3Day < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {trend3Day >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                <span>{signed(trend3Day)} XP</span>
              </div>
            </div>
            <div className="flex items-end gap-[3px] h-5">
              {sparklineBars.slice(-5).map((bar, idx) => (
                <motion.div
                  key={idx}
                  className="w-1 rounded-full"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(12, bar.heightPct)}%` }}
                  transition={{ delay: 0.3 + idx * 0.06, type: 'spring', stiffness: 300, damping: 18 }}
                  style={{ backgroundColor: bar.isPositive ? 'var(--success)' : 'var(--danger)' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Streak + next milestone ── */}
        <div
          className="hidden md:flex items-center gap-2 pl-3 shrink-0"
          style={{ borderLeft: '1px solid var(--border-color)' }}
          title={nextMilestone ? `${nextMilestone.days - streak} more day${nextMilestone.days - streak === 1 ? '' : 's'} at 90%+ of habits → +${nextMilestone.xp} XP` : 'Legendary streak'}
        >
          <motion.span
            style={{ display: 'flex', color: streak > 0 ? 'var(--warning)' : 'var(--text-disabled)' }}
            animate={streak > 0 ? { scale: [1, 1.15, 1] } : { scale: 1 }}
            transition={streak > 0 ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
          >
            <Flame size={16} />
          </motion.span>
          <div className="flex flex-col justify-center">
            <span className="font-display font-extrabold text-sm leading-none text-white font-mono">{streak}d streak</span>
            {nextMilestone && (
              <span className="text-[10px] font-semibold text-muted mt-0.5 whitespace-nowrap">
                {nextMilestone.days - streak}d → <span style={{ color: 'var(--success)' }}>+{nextMilestone.xp} XP</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Today + momentum state ── */}
        <Link href="/xp" className="flex items-center gap-2.5 shrink-0 pl-3" style={{ color: 'inherit', borderLeft: '1px solid var(--border-color)' }}>
          <div className="hidden sm:flex flex-col justify-center text-right">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted font-semibold">Today</span>
            <div className="font-display font-extrabold text-sm leading-none font-mono" style={{ color: netColor(todayNet) }}>
              <CountUp value={todayNet} format={signed} /> <span className="text-[10px] font-semibold text-muted">XP</span>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em]"
            style={{
              color: stateColor,
              background: `color-mix(in oklab, ${stateColor} 14%, transparent)`,
              border: `1px solid color-mix(in oklab, ${stateColor} 38%, transparent)`,
              boxShadow: state === 'SURGING' ? `0 0 16px -4px ${stateColor}` : 'none',
            }}
          >
            <motion.span
              style={{ display: 'flex' }}
              animate={state === 'SURGING' ? { scale: [1, 1.25, 1], rotate: [0, -8, 0] } : { scale: 1 }}
              transition={state === 'SURGING' ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
            >
              <StateIcon size={12} />
            </motion.span>
            <span>{state}</span>
          </div>
        </Link>

      </div>
    </div>
  )
}
