'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Shield, AlertTriangle, Zap, Swords, Smartphone,
  Moon, Brain, DollarSign, Repeat, Flame, ChevronDown,
  ChevronUp, Lock, Check, ClipboardList, BookOpen,
  Activity, Clock, Terminal
} from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import TacticalProgress from '@/components/ui/ProgressBar'
import IntelligenceFeed from '@/components/ui/IntelligenceFeed'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { RANK_CONFIG } from '@/lib/constants'
import { getLocalDateStr } from '@/lib/utils/dates'

// Arc definitions
const ARC_CONFIG = [
  { rank: 'E',       name: 'The Awakening',      flavor: 'You just woke up.' },
  { rank: 'D',       name: 'Discipline Rebuild',  flavor: 'The grind no one sees.' },
  { rank: 'C',       name: 'The Forge',           flavor: "Shaped by pressure." },
  { rank: 'B',       name: 'The Surge',           flavor: 'Momentum compounds.' },
  { rank: 'A',       name: 'Apex Protocol',       flavor: 'Elite territory.' },
  { rank: 'S',       name: 'Legend Mode',         flavor: 'Near mythical.' },
  { rank: 'Emperor', name: 'The Apex',            flavor: 'Final form.' },
]

const BRIEFINGS = [
  "The discipline you build in private becomes the edge you show in public.",
  "Amateurs wait for motivation. Professionals execute on schedule.",
  "Pain is temporary. Quitting lasts forever. Push through.",
  "Every action is a vote for the person you wish to become.",
  "Do not stop when you are tired. Stop when you are done.",
  "Small daily disciplines compound into massive results over time.",
  "Your mind will quit 100 times before your body does. Ignore it.",
  "Victory is reserved for those who are willing to pay its price.",
  "Focus on the next step, not the entire staircase.",
  "Comfort is the enemy of progress. Seek the friction."
]

export default function MissionControl() {
  const { user } = useAuth()

  const {
    profile: { profile },
    goals:   { mainQuest },
    habits:  { todayLogs },
    journal: { entries }
  } = useOS()

  const [currentTime, setCurrentTime] = useState(new Date())
  const [xpToday, setXpToday]         = useState(0)
  const [xpThisWeek, setXpThisWeek]   = useState(0)
  const [weeklyWinRate, setWeeklyWinRate] = useState(0)
  const [arcExpanded, setArcExpanded] = useState(false)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // Fetch XP and Habit data for the new metrics
  useEffect(() => {
    async function fetchMetrics() {
      if (!user) return
      const sb = createClient()
      
      const todayStr = getLocalDateStr(new Date())
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekAgoStr = getLocalDateStr(weekAgo)

      // 1. Fetch XP
      const { data: xpData } = await sb
        .from('xp_history')
        .select('amount, created_at')
        .eq('user_id', user.id)
        .gte('created_at', weekAgoStr)
        
      if (xpData) {
        const positiveXp = xpData.filter(r => r.amount > 0)
        setXpThisWeek(positiveXp.reduce((s, r) => s + r.amount, 0))
        setXpToday(positiveXp.filter(r => r.created_at.startsWith(todayStr)).reduce((s, r) => s + r.amount, 0))
      }

      // 2. Fetch Habit Logs for Win Rate (last 7 days)
      const { data: habitData } = await sb
        .from('habit_logs')
        .select('date, status')
        .eq('user_id', user.id)
        .gte('date', weekAgoStr)

      if (habitData) {
        // Calculate days where at least one habit was completed
        const uniqueDaysWithCompletion = new Set(
          habitData.filter(log => log.status === 'completed').map(log => log.date)
        ).size
        // Win rate is out of 7 days
        setWeeklyWinRate(Math.round((uniqueDaysWithCompletion / 7) * 100))
      }
    }
    fetchMetrics()
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

  // Momentum Score (0-100)
  // Weighted: 40% streak (cap at 30 days), 40% weekly win rate, 20% weekly XP (cap at 1000)
  const streakScore = Math.min(100, (currentStreak / 30) * 100) * 0.4
  const winRateScore = weeklyWinRate * 0.4
  const xpScore = Math.min(100, (xpThisWeek / 1000) * 100) * 0.2
  const momentumScore = Math.round(streakScore + winRateScore + xpScore)
  
  const momentumColor = momentumScore >= 80 ? 'var(--success)' : momentumScore >= 50 ? 'var(--warning)' : 'var(--danger)'
  const momentumText = momentumScore >= 80 ? 'SURGING' : momentumScore >= 50 ? 'BUILDING' : 'STAGNANT'

  // Daily Briefing (seeded randomly by day of year so it changes daily but stays consistent for the day)
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24)
  const briefing = BRIEFINGS[dayOfYear % BRIEFINGS.length]

  // Journal Status
  const todayStr = getLocalDateStr(new Date())
  const lastJournalDate = entries?.[0]?.date
  const journalDoneToday = lastJournalDate === todayStr

  // Deadline Countdown for Main Quest
  let deadlineDays = null
  let deadlineUrgency = 'ok'
  if (mainQuest?.deadline) {
    const msDiff = new Date(mainQuest.deadline) - new Date()
    deadlineDays = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)))
    deadlineUrgency = deadlineDays <= 3 ? 'danger' : deadlineDays <= 7 ? 'warning' : 'ok'
  }

  return (
    <AppShell>
      <div className="page-container relative max-w-[1600px]">

        <style dangerouslySetInnerHTML={{ __html: `
          :root { --arc-color: ${arcColor}; }
          .arc-glow { box-shadow: 0 0 40px ${arcColor}18, 0 0 80px ${arcColor}08; }
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
          <div style={{
            position: 'absolute', top: '-40%', right: '-5%',
            width: '300px', height: '300px', borderRadius: '50%',
            background: arcColor, opacity: 0.05, filter: 'blur(60px)',
            pointerEvents: 'none',
          }} />

          <div className="flex flex-wrap items-center gap-5 relative z-10">
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

            {/* THREAT MATRIX */}
            <IntelligenceFeed />

            {/* DAILY CLASSIFIED BRIEFING */}
            <div style={{
              padding: '24px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
            }}>
              <div className="flex items-center gap-2 mb-3">
                <Terminal size={12} color="var(--text-muted)" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Daily Briefing // Intelligence</span>
              </div>
              <p className="font-display text-primary" style={{ fontSize: '1.4rem', lineHeight: 1.3 }}>
                "{briefing}"
              </p>
            </div>

            {/* ACTIVE OBJECTIVE & COUNTDOWN */}
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
                
                <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                  <div className="flex-1">
                    <h2 className="font-display font-bold text-primary leading-tight mb-2"
                      style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2rem)' }}>
                      {mainQuest.title}
                    </h2>
                    {mainQuest.description && (
                      <p className="font-mono text-xs text-muted mb-5 line-clamp-2">{mainQuest.description}</p>
                    )}
                    <TacticalProgress value={mainQuest.progress} max={100} showValue color="var(--info)" />
                  </div>

                  {/* OPERATION DEADLINE COUNTDOWN */}
                  {deadlineDays !== null && (
                    <div className="shrink-0 flex flex-col items-center justify-center p-4 border border-border-color bg-bg-primary min-w-[140px]">
                      <Clock size={16} className="mb-2" style={{
                        color: deadlineUrgency === 'danger' ? 'var(--danger)' : deadlineUrgency === 'warning' ? 'var(--warning)' : 'var(--info)'
                      }} />
                      <div className="font-display font-bold" style={{
                        fontSize: '2.5rem', lineHeight: 1,
                        color: deadlineUrgency === 'danger' ? 'var(--danger)' : deadlineUrgency === 'warning' ? 'var(--warning)' : 'var(--text-primary)'
                      }}>
                        {deadlineDays}
                      </div>
                      <div className="font-mono text-[9px] text-muted uppercase mt-1">Days Remaining</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                <AlertTriangle size={24} className="text-muted mx-auto mb-2" />
                <p className="font-mono text-xs text-muted mb-3">No active directives</p>
                <Link href="/goals" className="btn btn-primary btn-sm">ASSIGN MISSION</Link>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR (4 cols) */}
          <div className="col-4 flex flex-col gap-5">

            {/* MOMENTUM & STREAK (Combines Momentum, Win Rate, Streak) */}
            <div style={{ padding: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  <Activity size={10} color={momentumColor} />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Momentum Engine</span>
                </div>
                <span className="font-mono text-[9px] font-bold" style={{ color: momentumColor }}>
                  {momentumText}
                </span>
              </div>
              
              <div className="flex items-end justify-between mb-5">
                <div>
                  <div className="font-display font-bold tracking-tighter" style={{ fontSize: '3.5rem', color: momentumColor, lineHeight: 1 }}>
                    {momentumScore}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase">Global Score</div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 mb-2">
                    <Flame size={12} color={flameColor} />
                    <span className="font-mono font-bold text-primary" style={{ fontSize: '1.2rem' }}>{currentStreak} <span className="text-[10px] text-muted font-normal">days</span></span>
                  </div>
                  <div className="font-mono font-bold text-primary" style={{ fontSize: '1.2rem' }}>{weeklyWinRate}% <span className="text-[10px] text-muted font-normal">win rate</span></div>
                </div>
              </div>

              {/* Score bar */}
              <div style={{ height: '2px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${momentumScore}%`,
                  background: momentumColor,
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>

            {/* XP STAT CARD */}
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
              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.6rem', color: arcColor }}>
                    {totalXp >= 1000 ? `${(totalXp / 1000).toFixed(1)}k` : totalXp}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TOTAL</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none text-info" style={{ fontSize: '1.6rem' }}>
                    {xpNeeded >= 1000 ? `${(xpNeeded / 1000).toFixed(1)}k` : xpNeeded}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TO LV.{currentLevel + 1}</div>
                </div>
                <div>
                  <div className={`font-display font-bold tracking-tighter leading-none`}
                    style={{ fontSize: '1.6rem', color: xpToday > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    +{xpToday}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TODAY</div>
                </div>
                <div>
                  <div className={`font-display font-bold tracking-tighter leading-none text-primary`} style={{ fontSize: '1.6rem' }}>
                    +{xpThisWeek}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">THIS WEEK</div>
                </div>
              </div>
            </div>

            {/* DAY PRESSURE CLOCK */}
            <div style={{ padding: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-1.5 mb-4">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Time Remaining</span>
              </div>
              <div className="flex items-center gap-4">
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

            {/* JOURNAL STATUS & WEEKLY DEBRIEF */}
            <div className="flex gap-2">
              <Link href="/journal" className="flex-1">
                <div style={{
                  padding: '16px', textAlign: 'center', cursor: 'pointer',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', height: '100%'
                }} className="hover:border-primary transition-colors flex flex-col justify-center items-center">
                  <BookOpen size={14} color={journalDoneToday ? "var(--success)" : "var(--text-muted)"} className="mb-2" />
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">Journal</div>
                  <div className="font-mono text-[9px] mt-1 font-bold" style={{ color: journalDoneToday ? 'var(--success)' : 'var(--warning)' }}>
                    {journalDoneToday ? '✓ LOGGED' : '⚠ PENDING'}
                  </div>
                </div>
              </Link>
              
              <Link href="/weekly-review" className="flex-1">
                <div style={{
                  padding: '16px', textAlign: 'center', cursor: 'pointer',
                  background: new Date().getDay() === 0 ? 'rgba(245,158,11,0.08)' : 'var(--bg-tertiary)', 
                  border: `1px solid ${new Date().getDay() === 0 ? 'var(--warning)' : 'var(--border-color)'}`,
                  height: '100%'
                }} className="hover:border-amber transition-colors flex flex-col justify-center items-center">
                  <ClipboardList size={14} color={new Date().getDay() === 0 ? "var(--warning)" : "var(--text-muted)"} className="mb-2" />
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">Debrief</div>
                  {new Date().getDay() === 0 && (
                     <div className="font-mono text-[9px] mt-1 text-amber">+40 XP</div>
                  )}
                </div>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
