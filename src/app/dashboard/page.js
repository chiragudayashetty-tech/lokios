'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Shield, AlertTriangle, Zap, Swords, Smartphone,
  Moon, Brain, DollarSign, Repeat, Flame, ChevronDown,
  ChevronUp, Lock, Check, ClipboardList, Crosshair,
  CheckSquare, Monitor, BookOpen, Trophy, User, Activity
} from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import IntelligenceFeed from '@/components/ui/IntelligenceFeed'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { RANK_CONFIG } from '@/lib/constants'
import { getLocalDateStr } from '@/lib/utils/dates'

// Arc definitions — tied 1-to-1 with RANK_CONFIG keys, purely narrative/UI
const ARC_CONFIG = [
  { rank: 'E',       name: 'The Awakening',      flavor: 'You just woke up.' },
  { rank: 'D',       name: 'Discipline Rebuild',  flavor: 'The grind no one sees.' },
  { rank: 'C',       name: 'The Forge',           flavor: "Shaped by pressure." },
  { rank: 'B',       name: 'The Surge',           flavor: 'Momentum compounds.' },
  { rank: 'A',       name: 'Apex Protocol',       flavor: 'Elite territory.' },
  { rank: 'S',       name: 'Legend Mode',         flavor: 'Near mythical.' },
  { rank: 'Emperor', name: 'The Apex',            flavor: 'Final form.' },
]

// Battle icon map (unchanged)
const BATTLE_ICONS = {
  'Phone Addiction':       Smartphone,
  'Porn Consumption':      Shield,
  'Inconsistent Execution':Repeat,
  'Fear of Selling':       DollarSign,
  'Poor Sleep Discipline': Moon,
  'Overthinking':          Brain,
}

const SEVERITY_COLORS = {
  extreme: '#FF3B3B',
  high:    'var(--danger)',
  medium:  'var(--accent-primary)',
  low:     'var(--info)',
}

// Quick-nav tiles that replace the heatmap
const NAV_TILES = [
  { href: '/quests',        icon: Crosshair,    label: 'Daily Ops'    },
  { href: '/tasks',         icon: CheckSquare,  label: 'Operations'   },
  { href: '/goals',         icon: Target,       label: 'Missions'     },
  { href: '/screen-time',   icon: Monitor,      label: 'Screen Intel' },
  { href: '/journal',       icon: BookOpen,     label: 'Journal'      },
  { href: '/xp',            icon: Trophy,       label: 'XP Matrix'    },
  { href: '/profile',       icon: User,         label: 'Profile'      },
  { href: '/weekly-review', icon: ClipboardList,label: 'Debrief'      },
]

export default function MissionControl() {
  const { user } = useAuth()

  const {
    profile: { profile },
    goals:   { mainQuest },
    habits:  { todayLogs },
  } = useOS()

  const [battles, setBattles]         = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [xpToday, setXpToday]         = useState(0)
  const [arcExpanded, setArcExpanded] = useState(false)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // Fetch battles (unchanged logic)
  useEffect(() => {
    async function fetchBattles() {
      const sb = createClient()
      const { data } = await sb.from('user_blueprints').select('battles').single()
      if (data?.battles) setBattles(data.battles.filter(b => b.status !== 'defeated'))
    }
    fetchBattles()
  }, [])

  // Fetch today's XP (read-only, sums positive xp_history rows for today)
  useEffect(() => {
    async function fetchXpToday() {
      if (!user) return
      const sb = createClient()
      const { data } = await sb
        .from('xp_history')
        .select('amount')
        .eq('user_id', user.id)
        .gte('created_at', getLocalDateStr(new Date()))
      if (data) setXpToday(data.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0))
    }
    fetchXpToday()
  }, [user, todayLogs])

  // ── Derived values ────────────────────────────────────────────────────────
  const totalXp       = profile?.total_xp       || 0
  const currentStreak = profile?.current_streak ?? profile?.streak_days ?? 0
  const longestStreak = profile?.longest_streak ?? 0

  const currentLevel                                           = calculateLevel(totalXp)
  const { current: xpInLevel, required: xpForNextLevel, percentage: levelPct } = xpToNextLevel(totalXp)
  const xpNeeded     = Math.max(0, xpForNextLevel - xpInLevel)
  const currentRank  = getRankForXp(totalXp)
  const arcColor     = RANK_CONFIG[currentRank.code]?.color || '#9CA3AF'
  const currentArc   = ARC_CONFIG.find(a => a.rank === currentRank.code) || ARC_CONFIG[0]

  // Day pressure
  const hoursLeft = +(24 - currentTime.getHours() - currentTime.getMinutes() / 60).toFixed(1)
  const dayPct    = Math.round(((currentTime.getHours() * 60 + currentTime.getMinutes()) / 1440) * 100)
  const dayUrgency = dayPct > 80 ? 'danger' : dayPct > 60 ? 'warning' : 'ok'

  // Streak display
  const flameColor = currentStreak >= 30 ? '#F59E0B' : currentStreak >= 7 ? '#f97316' : '#ef4444'

  return (
    <AppShell>
      <div className="page-container relative max-w-[1600px]">

        <style dangerouslySetInnerHTML={{ __html: `
          :root { --arc-color: ${arcColor}; }
          .arc-glow { box-shadow: 0 0 40px ${arcColor}18, 0 0 80px ${arcColor}08; }
          .tile-hover:hover { background: ${arcColor}15 !important; border-color: ${arcColor} !important; }
          .bento-grid {
            display: grid; grid-template-columns: 1fr; gap: 20px;
          }
          @media (min-width: 1024px) {
            .bento-grid { grid-template-columns: repeat(12, 1fr); }
            .col-8 { grid-column: span 8; }
            .col-4 { grid-column: span 4; }
          }
        ` }} />

        {/* ══════════════════════════════════════════════════════════════════
            ARC HERO HEADER
            Data: profile.total_xp → rank, level, XP bar, arc name
        ══════════════════════════════════════════════════════════════════ */}
        <motion.header
          className="mb-5 arc-glow relative overflow-hidden"
          style={{
            padding: '24px 28px',
            background: `linear-gradient(130deg, #111111 0%, #0a0a0a 60%, ${arcColor}0a 100%)`,
            borderLeft: `4px solid ${arcColor}`,
            borderTop: `1px solid ${arcColor}22`,
            borderRight: `1px solid ${arcColor}0a`,
            borderBottom: `1px solid ${arcColor}0a`,
          }}
          layout
        >
          {/* Background glow */}
          <div style={{
            position: 'absolute', top: '-40%', right: '-5%',
            width: '300px', height: '300px', borderRadius: '50%',
            background: arcColor, opacity: 0.05, filter: 'blur(60px)',
            pointerEvents: 'none',
          }} />

          <div className="flex flex-wrap items-center gap-5 relative z-10">

            {/* Rank badge */}
            <div
              className="flex flex-col items-center justify-center shrink-0"
              style={{
                width: '64px', height: '64px',
                border: `2px solid ${arcColor}`,
                background: `${arcColor}12`,
              }}
            >
              <span style={{ fontSize: '26px', lineHeight: 1 }}>{currentRank.icon}</span>
              <span className="font-mono tracking-widest mt-0.5" style={{ fontSize: '8px', color: arcColor }}>
                {currentRank.code === 'Emperor' ? 'EMP' : currentRank.code}-RANK
              </span>
            </div>

            {/* Arc name + XP bar */}
            <div className="flex-1 min-w-[160px]">
              <button
                onClick={() => setArcExpanded(v => !v)}
                className="flex items-center gap-2 mb-1 group"
              >
                <h1 className="font-display font-bold tracking-tight text-primary" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)' }}>
                  {currentArc.name.toUpperCase()}
                </h1>
                {arcExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
              </button>
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-3">
                LV.{currentLevel} · {profile?.full_name || 'OPERATOR'} · {currentArc.flavor}
              </p>
              {/* XP bar */}
              <div>
                <div className="flex justify-between font-mono text-[9px] text-muted mb-1">
                  <span>LV.{currentLevel}</span>
                  <span style={{ color: arcColor }}>{xpInLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP</span>
                  <span>LV.{currentLevel + 1}</span>
                </div>
                <div style={{ height: '3px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <motion.div
                    style={{ height: '100%', background: arcColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${levelPct}%` }}
                    transition={{ duration: 1.4, ease: 'easeOut' }}
                  />
                </div>
                <p className="font-mono text-[9px] text-muted mt-1">{xpNeeded.toLocaleString()} XP to next level</p>
              </div>
            </div>

            {/* Clock */}
            <div className="text-right shrink-0">
              <div className="font-display font-bold text-primary tracking-tighter" style={{ fontSize: '2rem' }}>
                {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="font-mono text-[9px] text-muted uppercase tracking-widest mt-0.5">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </motion.header>

        {/* ══════════════════════════════════════════════════════════════════
            ARC ROADMAP (expandable)
        ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {arcExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-5"
            >
              <div style={{ padding: '20px 24px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div className="flex justify-between items-center mb-5">
                  <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: arcColor }}>
                    CHARACTER ARC ROADMAP
                  </span>
                  <button onClick={() => setArcExpanded(false)} className="font-mono text-[9px] text-muted hover:text-primary">
                    COLLAPSE ↑
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute left-[11px] top-0 bottom-0 w-px" style={{ background: 'var(--border-color)' }} />
                  <div className="flex flex-col gap-0">
                    {ARC_CONFIG.map((arc) => {
                      const rd       = RANK_CONFIG[arc.rank]
                      if (!rd) return null
                      const isCleared = totalXp > rd.maxXp && rd.maxXp < 9000000
                      const isCurrent = currentRank.code === arc.rank
                      const isLocked  = totalXp < rd.minXp
                      const needed    = isLocked ? (rd.minXp - totalXp).toLocaleString() : null

                      return (
                        <div
                          key={arc.rank}
                          className="relative flex items-center gap-4 py-3 pl-10"
                          style={{ opacity: isCurrent ? 1 : isCleared ? 0.6 : 0.3 }}
                        >
                          {/* Node */}
                          <div
                            className="absolute left-[1px] flex items-center justify-center shrink-0"
                            style={{
                              width: '22px', height: '22px',
                              border: `2px solid ${isCurrent ? rd.color : isCleared ? '#22c55e' : 'var(--border-color)'}`,
                              background: isCurrent ? `${rd.color}15` : 'var(--bg-primary)',
                              boxShadow: isCurrent ? `0 0 10px ${rd.color}50` : 'none',
                            }}
                          >
                            {isCleared && <Check size={11} color="#22c55e" strokeWidth={3} />}
                            {isCurrent && (
                              <motion.div
                                className="rounded-full"
                                style={{ width: 8, height: 8, background: rd.color }}
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ repeat: Infinity, duration: 1.4 }}
                              />
                            )}
                            {isLocked && <Lock size={9} color="var(--text-muted)" />}
                          </div>

                          {/* Content */}
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 min-w-0">
                            <span className="font-display font-bold" style={{ color: isCurrent ? rd.color : 'var(--text-primary)', fontSize: '1rem' }}>
                              {arc.name.toUpperCase()}
                            </span>
                            <span className="font-mono text-[9px]" style={{ color: rd.color }}>{arc.rank}-RANK</span>
                            {isCurrent && (
                              <motion.span className="font-mono text-[9px]" style={{ color: rd.color }}
                                animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                ● ACTIVE
                              </motion.span>
                            )}
                            {isCleared && <span className="font-mono text-[9px] text-success">✓ CLEARED</span>}
                            <span className="font-mono text-[9px] text-muted">{arc.flavor}</span>
                            {isLocked && (
                              <span className="font-mono text-[9px] text-muted">🔒 {needed} XP to unlock</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════════════
            MAIN BENTO GRID
        ══════════════════════════════════════════════════════════════════ */}
        <div className="bento-grid">

          {/* LEFT (8 cols) */}
          <div className="col-8 flex flex-col gap-5">

            {/* THREAT MATRIX — IntelligenceFeed, zero logic change */}
            <IntelligenceFeed />

            {/* ACTIVE OBJECTIVE — mainQuest from OSContext */}
            {mainQuest ? (
              <div
                className="relative overflow-hidden"
                style={{
                  padding: '24px',
                  background: 'linear-gradient(135deg, #111111, #0a0a0a)',
                  border: '1px solid var(--info-subtle)',
                  borderLeft: '3px solid var(--info)',
                }}
              >
                <div className="absolute top-0 right-0 pointer-events-none" style={{
                  width: '200px', height: '200px', borderRadius: '50%',
                  background: 'var(--info)', opacity: 0.06, filter: 'blur(60px)',
                  transform: 'translate(30%, -30%)',
                }} />
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <Target size={12} color="var(--info)" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-info">Active Objective</span>
                  <span className="ml-auto font-mono text-[9px] text-info animate-pulse">● EXECUTING</span>
                </div>
                <h2 className="font-display font-bold text-primary leading-tight mb-2 relative z-10"
                  style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2rem)' }}>
                  {mainQuest.title}
                </h2>
                {mainQuest.description && (
                  <p className="font-mono text-xs text-muted mb-5 relative z-10 line-clamp-2">{mainQuest.description}</p>
                )}
                <div className="relative z-10">
                  <TacticalProgress value={mainQuest.progress} max={100} showValue color="var(--info)" />
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                <AlertTriangle size={24} className="text-muted mx-auto mb-2" />
                <p className="font-mono text-xs text-muted mb-3">No active directives</p>
                <Link href="/goals" className="btn btn-primary btn-sm">ASSIGN MISSION</Link>
              </div>
            )}

            {/* QUICK NAV GRID — replaces heatmap */}
            {/* No DB query — static links. Icon grid for fast navigation. */}
            <div>
              <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                <Activity size={9} /> COMMAND SHORTCUTS
              </p>
              <div className="grid grid-cols-4 gap-2">
                {NAV_TILES.map(({ href, icon: Icon, label }) => (
                  <Link key={href} href={href}>
                    <div
                      className="tile-hover flex flex-col items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                      style={{
                        padding: '16px 8px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        aspectRatio: '1.2',
                      }}
                    >
                      <Icon size={20} color="var(--text-muted)" />
                      <span className="font-mono text-[8px] uppercase tracking-widest text-muted text-center leading-tight">
                        {label}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT SIDEBAR (4 cols) */}
          <div className="col-4 flex flex-col gap-5">

            {/* XP STAT CARD */}
            {/* Data: profile.total_xp, xp_history today sum, xpToNextLevel() */}
            <div
              style={{
                padding: '20px',
                background: 'var(--bg-tertiary)',
                borderLeft: `3px solid ${arcColor}`,
                border: `1px solid ${arcColor}20`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-4">
                <Zap size={10} style={{ color: arcColor }} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">XP Matrix</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {/* Total XP */}
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.6rem', color: arcColor }}>
                    {totalXp >= 1000 ? `${(totalXp / 1000).toFixed(1)}k` : totalXp}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TOTAL</div>
                </div>
                {/* Today's XP */}
                <div>
                  <div className={`font-display font-bold tracking-tighter leading-none`}
                    style={{ fontSize: '1.6rem', color: xpToday > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    +{xpToday}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TODAY</div>
                </div>
                {/* XP to next level */}
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none text-info" style={{ fontSize: '1.6rem' }}>
                    {xpNeeded >= 1000 ? `${(xpNeeded / 1000).toFixed(1)}k` : xpNeeded}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TO LV.{currentLevel + 1}</div>
                </div>
              </div>
              <Link href="/xp" className="flex items-center justify-center gap-1 mt-4 font-mono text-[9px] text-muted hover:text-primary transition-colors">
                FULL MATRIX →
              </Link>
            </div>

            {/* STREAK COUNTER */}
            {/* Data: profile.current_streak (or fallback streak_days), profile.longest_streak */}
            <div style={{ padding: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Flame size={10} color={flameColor} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Streak</span>
              </div>
              <div className="flex items-end justify-between mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-bold tracking-tighter" style={{ fontSize: '3rem', color: flameColor, lineHeight: 1 }}>
                    {currentStreak}
                  </span>
                  <span className="font-mono text-xs text-muted">days</span>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-muted" style={{ fontSize: '1rem' }}>{longestStreak}</div>
                  <div className="font-mono text-[8px] text-muted">PB</div>
                </div>
              </div>
              {/* Milestone bar */}
              <div style={{ height: '2px', background: 'var(--bg-primary)', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (currentStreak / 100) * 100)}%`,
                  background: `linear-gradient(to right, #ef4444, #f97316, #F59E0B)`,
                  transition: 'width 1s ease',
                }} />
              </div>
              <div className="flex justify-between font-mono text-[8px]">
                <span style={{ color: currentStreak >= 7 ? '#f97316' : 'var(--text-muted)' }}>7d</span>
                <span style={{ color: currentStreak >= 30 ? '#F59E0B' : 'var(--text-muted)' }}>30d</span>
                <span style={{ color: currentStreak >= 100 ? '#22c55e' : 'var(--text-muted)' }}>100d</span>
              </div>
            </div>

            {/* DAY PRESSURE CLOCK */}
            {/* Data: currentTime (local state, no DB) */}
            <div style={{ padding: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-1.5 mb-4">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Time Remaining</span>
              </div>
              <div className="flex items-center gap-4">
                {/* Circular ring */}
                <div className="relative shrink-0" style={{ width: '64px', height: '64px' }}>
                  <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--bg-primary)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="26" fill="none"
                      stroke={dayUrgency === 'danger' ? 'var(--danger)' : dayUrgency === 'warning' ? 'var(--warning)' : arcColor}
                      strokeWidth="5"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - dayPct / 100)}`}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono font-bold text-primary" style={{ fontSize: '10px' }}>{dayPct}%</span>
                  </div>
                </div>
                <div>
                  <div className="font-display font-bold text-primary" style={{ fontSize: '1.8rem', lineHeight: 1 }}>
                    {hoursLeft}<span className="font-mono text-sm text-muted">h</span>
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">hours left</div>
                  <div className="font-mono text-[8px] mt-2" style={{
                    color: dayUrgency === 'danger' ? 'var(--danger)' : dayUrgency === 'warning' ? 'var(--warning)' : 'var(--text-muted)'
                  }}>
                    {dayUrgency === 'danger' ? '⚠ EXECUTE NOW' : dayUrgency === 'warning' ? 'WINDOW CLOSING' : 'TIME ON SIDE'}
                  </div>
                </div>
              </div>
            </div>

            {/* WEEKLY DEBRIEF */}
            {new Date().getDay() === 0 ? (
              <Link href="/weekly-review">
                <div style={{
                  padding: '16px', textAlign: 'center', cursor: 'pointer',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid var(--warning)',
                }}>
                  <ClipboardList size={18} color="var(--warning)" className="mx-auto mb-1" />
                  <div className="font-display text-sm text-amber uppercase tracking-widest">Weekly Debrief</div>
                  <div className="font-mono text-[9px] text-muted mt-1">+40 XP available</div>
                </div>
              </Link>
            ) : (
              <Link href="/weekly-review">
                <div style={{
                  padding: '12px', textAlign: 'center', cursor: 'pointer',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                }}
                  className="hover:border-amber transition-colors group"
                >
                  <div className="flex items-center justify-center gap-2 font-mono text-[9px] text-muted group-hover:text-amber uppercase tracking-widest">
                    <ClipboardList size={11} /> Weekly Debrief
                  </div>
                </div>
              </Link>
            )}

            {/* WAR ROOM — Active Battles */}
            {/* Data: user_blueprints.battles, battle.hp per battle */}
            {battles.length > 0 && (
              <div style={{ padding: '20px', background: 'var(--bg-tertiary)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-1.5 mb-4">
                  <Swords size={10} color="var(--danger)" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-danger">Active Battles</span>
                </div>
                <div className="flex flex-col gap-3">
                  {battles.map((battle, idx) => {
                    const Icon       = BATTLE_ICONS[battle.name] || Swords
                    const hp         = battle.hp ?? 100
                    const isCritical = hp > 75
                    const sevColor   = SEVERITY_COLORS[battle.severity] || 'var(--info)'
                    return (
                      <div key={idx}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon size={11} style={{ color: sevColor, shrink: 0 }} />
                          <span className="font-mono text-[10px] text-primary flex-1 truncate">{battle.name}</span>
                          <span className="font-mono text-[9px] font-bold" style={{ color: isCritical ? 'var(--danger)' : 'var(--warning)' }}>
                            {hp}HP
                          </span>
                        </div>
                        <div style={{ height: '2px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                          <motion.div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.max(0, hp))}%`,
                              background: isCritical ? 'var(--danger)' : hp > 50 ? 'var(--warning)' : 'var(--success)',
                            }}
                            animate={isCritical ? { opacity: [1, 0.4, 1] } : {}}
                            transition={isCritical ? { repeat: Infinity, duration: 1.5 } : {}}
                          />
                        </div>
                      </div>
                    )
                  })}
                  <Link href="/profile" className="font-mono text-[9px] text-muted hover:text-primary transition-colors text-center mt-1 block">
                    MANAGE →
                  </Link>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppShell>
  )
}
