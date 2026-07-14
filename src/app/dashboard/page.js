'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, AlertTriangle, Zap, Swords, Flame, ChevronDown,
  ChevronUp, Lock, Check, ClipboardList, BookOpen,
  Activity, Clock, Terminal, Ghost, Skull, ArrowUpRight, BarChart2,
  Smartphone, Shield, DollarSign, Moon, Brain, Repeat
} from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { RANK_CONFIG } from '@/lib/constants'
import { getLocalDateStr } from '@/lib/utils/dates'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

const ARC_CONFIG = [
  { rank: 'E',       name: 'The Awakening',      flavor: 'You just woke up.' },
  { rank: 'D',       name: 'Discipline Rebuild',  flavor: 'The grind no one sees.' },
  { rank: 'C',       name: 'The Forge',           flavor: "Shaped by pressure." },
  { rank: 'B',       name: 'The Surge',           flavor: 'Momentum compounds.' },
  { rank: 'A',       name: 'Apex Protocol',       flavor: 'Elite territory.' },
  { rank: 'S',       name: 'Legend Mode',         flavor: 'Near mythical.' },
  { rank: 'Emperor', name: 'The Apex',            flavor: 'Final form.' },
]

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
    goals:   { mainQuest, sideQuests, longTermGoals },
    habits:  { todayLogs, habits },
    tasks:   { tasks },
    journal: { entries }
  } = useOS()

  const [currentTime, setCurrentTime] = useState(new Date())
  const [xpToday, setXpToday]         = useState(0)
  const [xpThisWeek, setXpThisWeek]   = useState(0)
  const [weeklyWinRate, setWeeklyWinRate] = useState(0)
  const [arcExpanded, setArcExpanded] = useState(false)
  
  // New metrics states
  const [ghostScore, setGhostScore] = useState(0)
  const [habitGraveyard, setHabitGraveyard] = useState([])
  const [xpTrajectory, setXpTrajectory] = useState([])
  const [battles, setBattles] = useState([])

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function fetchMetrics() {
      if (!user) return
      const sb = createClient()
      
      const todayStr = getLocalDateStr(new Date())
      
      const currentMonday = new Date()
      const day = currentMonday.getDay()
      const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1)
      currentMonday.setDate(diff)
      const currentMondayStr = getLocalDateStr(currentMonday)
      
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      const thirtyDaysAgoStr = getLocalDateStr(thirtyDaysAgo)

      // 1. Fetch XP Data (Last 30 Days)
      const { data: xpData } = await sb
        .from('xp_history')
        .select('amount, created_at')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgoStr)

      // 1b. Fetch Active Battles (War Room)
      const { data: blueprints } = await sb
        .from('user_blueprints')
        .select('battles')
        .eq('user_id', user.id)
        .single()
      if (blueprints?.battles) {
        setBattles(blueprints.battles.filter(b => b.status !== 'defeated'))
      }
        
      if (xpData) {
        const positiveXp = xpData.filter(r => r.amount > 0)
        
        // Today & This Week
        setXpThisWeek(positiveXp.filter(r => r.created_at >= currentMondayStr).reduce((s, r) => s + r.amount, 0))
        setXpToday(positiveXp.filter(r => r.created_at.startsWith(todayStr)).reduce((s, r) => s + r.amount, 0))
        
        // 30-Day Trajectory Graph
        const xpByDate = {}
        positiveXp.forEach(r => {
          const dateStr = r.created_at.substring(0, 10)
          xpByDate[dateStr] = (xpByDate[dateStr] || 0) + r.amount
        })
        const graphData = []
        for(let i=29; i>=0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dStr = getLocalDateStr(d)
          graphData.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            xp: xpByDate[dStr] || 0
          })
        }
        setXpTrajectory(graphData)
      }

      // 2. Fetch ALL Habit Logs (for Ghost Score, Win Rate, Graveyard)
      const { data: allHabitLogs } = await sb
        .from('habit_logs')
        .select('date, status, habit_id')
        .eq('user_id', user.id)
        .order('date', { ascending: true })

      const { data: allHabitsData } = await sb
        .from('habits')
        .select('id, title')
        .eq('user_id', user.id)

      if (allHabitLogs) {
        // Weekly Win Rate (This week from Monday)
        const recentLogs = allHabitLogs.filter(l => l.date >= currentMondayStr)
        const uniqueDaysWithCompletion = new Set(
          recentLogs.filter(log => log.status === 'completed').map(log => log.date)
        ).size
        
        // Calculate days elapsed in the current week so far (Monday = 1 day elapsed)
        let daysElapsed = new Date().getDay()
        if (daysElapsed === 0) daysElapsed = 7 // Sunday is the 7th day
        
        setWeeklyWinRate(Math.round((uniqueDaysWithCompletion / daysElapsed) * 100))

        // Ghost Score (All-Time Recovery)
        let ghostPoints = 0
        const logsByHabit = {}
        allHabitLogs.forEach(log => {
          if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = []
          logsByHabit[log.habit_id].push(log)
        })

        Object.values(logsByHabit).forEach(logs => {
          for (let i = 0; i < logs.length - 1; i++) {
            if (logs[i].status === 'failed' && logs[i+1].status === 'completed') {
              ghostPoints++
            }
          }
        })
        setGhostScore(ghostPoints)

        // Habit Graveyard (Last 30 Days)
        const recentFails = {}
        allHabitLogs
          .filter(l => l.date >= thirtyDaysAgoStr && l.status === 'failed')
          .forEach(l => {
            recentFails[l.habit_id] = (recentFails[l.habit_id] || 0) + 1
          })
        
        const sortedFails = Object.entries(recentFails)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([habitId, fails]) => {
            const habit = allHabitsData?.find(h => String(h.id) === String(habitId))
            return { habitId, fails, name: habit?.title || 'Unknown Routine' }
          })
          
        setHabitGraveyard(sortedFails)
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

  const hoursLeft = +(24 - currentTime.getHours() - currentTime.getMinutes() / 60).toFixed(1)
  const dayPct    = Math.round(((currentTime.getHours() * 60 + currentTime.getMinutes()) / 1440) * 100)
  const dayUrgency = dayPct > 80 ? 'danger' : dayPct > 60 ? 'warning' : 'ok'

  const flameColor = currentStreak >= 30 ? '#F59E0B' : currentStreak >= 7 ? '#f97316' : '#ef4444'

  const streakScore = Math.min(100, (currentStreak / 30) * 100) * 0.4
  const winRateScore = weeklyWinRate * 0.4
  const xpScore = Math.min(100, (xpThisWeek / 1000) * 100) * 0.2
  const momentumScore = Math.round(streakScore + winRateScore + xpScore)
  const momentumColor = momentumScore >= 80 ? 'var(--success)' : momentumScore >= 50 ? 'var(--warning)' : 'var(--danger)'
  const momentumText = momentumScore >= 80 ? 'SURGING' : momentumScore >= 50 ? 'BUILDING' : 'STAGNANT'

  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24)
  const briefing = BRIEFINGS[dayOfYear % BRIEFINGS.length]

  const todayStr = getLocalDateStr(new Date())
  const lastJournalDate = entries?.[0]?.date
  const journalDoneToday = lastJournalDate === todayStr

  let deadlineDays = null
  let deadlineUrgency = 'ok'
  if (mainQuest?.deadline) {
    const msDiff = new Date(mainQuest.deadline) - new Date()
    deadlineDays = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)))
    deadlineUrgency = deadlineDays <= 3 ? 'danger' : deadlineDays <= 7 ? 'warning' : 'ok'
  }

  // Daily Output Ratio
  const todayCompletedTasks = tasks?.filter(t => t.status === 'completed' && t.completed_at?.startsWith(todayStr)) || []
  const deepWorkTasks = todayCompletedTasks.filter(t => t.difficulty === 'HARD' || t.difficulty === 'EXTREME').length
  const shallowWorkTasks = todayCompletedTasks.filter(t => t.difficulty === 'EASY' || t.difficulty === 'MEDIUM').length
  const totalWork = deepWorkTasks + shallowWorkTasks
  const deepWorkPct = totalWork > 0 ? (deepWorkTasks / totalWork) * 100 : 0

  // Helper for Tooltip in Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-primary)', border: `1px solid ${arcColor}`, padding: '4px 8px' }}>
          <p className="font-mono text-[9px] text-muted">{label}</p>
          <p className="font-mono text-[10px] font-bold" style={{ color: arcColor }}>{payload[0].value} XP</p>
        </div>
      )
    }
    return null
  }

  return (
    <AppShell>
      <div className="page-container relative max-w-[1600px] pb-10">

        <style dangerouslySetInnerHTML={{ __html: `
          :root { --arc-color: ${arcColor}; }
          .arc-glow { box-shadow: 0 0 30px ${arcColor}15, 0 0 60px ${arcColor}05; }
          .bento-grid {
            display: grid; grid-template-columns: 1fr; gap: 12px;
          }
          .dashboard-card {
            padding: 16px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
          }
          @media (min-width: 1024px) {
            .bento-grid { grid-template-columns: repeat(12, 1fr); gap: 16px; }
            .col-8 { grid-column: span 8; }
            .col-4 { grid-column: span 4; }
            .dashboard-card { padding: 20px; }
          }
        ` }} />

        {/* ══════════════════════════════════════════════════════════════════
            ARC HERO HEADER & DROPDOWN
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative z-50 mb-4 lg:mb-5">
          <motion.header
            className="arc-glow relative overflow-hidden"
          style={{
            padding: '20px 24px',
            background: `linear-gradient(130deg, #111111 0%, #0a0a0a 60%, ${arcColor}0a 100%)`,
            borderLeft: `3px solid ${arcColor}`,
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

          <div className="flex flex-wrap items-center gap-4 relative z-10">
            <div
              className="flex flex-col items-center justify-center shrink-0"
              style={{
                width: '56px', height: '56px',
                border: `2px solid ${arcColor}`,
                background: `${arcColor}12`,
              }}
            >
              <span style={{ fontSize: '22px', lineHeight: 1 }}>{currentRank.icon}</span>
              <span className="font-mono tracking-widest mt-0.5" style={{ fontSize: '7px', color: arcColor }}>
                {currentRank.code === 'Emperor' ? 'EMP' : currentRank.code}-RANK
              </span>
            </div>

            <div className="flex-1 min-w-[140px]">
              <button
                onClick={() => setArcExpanded(v => !v)}
                className="flex items-center gap-2 mb-1 group text-left"
              >
                <h1 className="font-display font-bold tracking-tight text-primary" style={{ fontSize: 'clamp(1.2rem, 3.5vw, 1.8rem)' }}>
                  {currentArc.name.toUpperCase()}
                </h1>
                {arcExpanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
              </button>
              <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-2.5">
                LV.{currentLevel} · {profile?.full_name || 'OPERATOR'} · {currentArc.flavor}
              </p>
              <div>
                <div className="flex justify-between font-mono text-[8px] text-muted mb-1">
                  <span>LV.{currentLevel}</span>
                  <span style={{ color: arcColor }}>{xpInLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP</span>
                  <span>LV.{currentLevel + 1}</span>
                </div>
                <div style={{ height: '2px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                  <motion.div
                    style={{ height: '100%', background: arcColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${levelPct}%` }}
                    transition={{ duration: 1.4, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 hidden sm:block">
              <div className="font-display font-bold text-primary tracking-tighter" style={{ fontSize: '1.6rem' }}>
                {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="font-mono text-[8px] text-muted uppercase tracking-widest mt-0.5">
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
              initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-0 right-0 z-50"
              style={{ top: '100%', marginTop: '8px', transformOrigin: 'top' }}
            >
              <div className="dashboard-card shadow-2xl" style={{ border: `1px solid ${arcColor}50`, background: 'rgba(4, 5, 7, 0.95)', backdropFilter: 'blur(16px)' }}>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: arcColor }}>
                    CHARACTER ARC ROADMAP
                  </span>
                  <button onClick={() => setArcExpanded(false)} className="font-mono text-[8px] text-muted hover:text-primary">
                    COLLAPSE ↑
                  </button>
                </div>

                <div className="relative mt-2 mb-2">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px" style={{ background: 'var(--border-color)' }} />
                  <div className="flex flex-col gap-2">
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
                          className="relative flex items-center gap-5 py-4 pl-12"
                          style={{ opacity: isCurrent ? 1 : isCleared ? 0.5 : 0.25 }}
                        >
                          <div
                            className="absolute left-[2px] flex items-center justify-center shrink-0"
                            style={{
                              width: '18px', height: '18px',
                              border: `2px solid ${isCurrent ? rd.color : isCleared ? '#22c55e' : 'var(--border-color)'}`,
                              background: isCurrent ? `${rd.color}15` : 'var(--bg-primary)',
                              boxShadow: isCurrent ? `0 0 10px ${rd.color}50` : 'none',
                            }}
                          >
                            {isCleared && <Check size={10} color="#22c55e" strokeWidth={3} />}
                            {isCurrent && (
                              <motion.div
                                className="rounded-full"
                                style={{ width: 6, height: 6, background: rd.color }}
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ repeat: Infinity, duration: 1.4 }}
                              />
                            )}
                            {isLocked && <Lock size={8} color="var(--text-muted)" />}
                          </div>
                          <div className="flex flex-col min-w-0 gap-1">
                            <span className="font-display font-bold text-base md:text-lg leading-tight tracking-wide" style={{ color: isCurrent ? rd.color : 'var(--text-primary)' }}>
                              {arc.name.toUpperCase()}
                            </span>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm" style={{ background: `${rd.color}15`, color: rd.color }}>
                                {arc.rank}-RANK
                              </span>
                              {isCurrent && (
                                <motion.span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: rd.color }}
                                  animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                  ● ACTIVE
                                </motion.span>
                              )}
                              {isLocked && <span className="font-mono text-[9px] text-muted tracking-widest">🔒 {needed} XP</span>}
                            </div>
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
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MAIN BENTO GRID
        ══════════════════════════════════════════════════════════════════ */}
        <div className="bento-grid">

          {/* LEFT (8 cols) */}
          <div className="col-8 flex flex-col gap-3 lg:gap-4">

            {/* ACTIVE OBJECTIVE & COUNTDOWN */}
            {mainQuest ? (
              <div
                className="relative overflow-hidden dashboard-card"
                style={{
                  background: 'linear-gradient(135deg, #111111, #0a0a0a)',
                  border: '1px solid var(--info-subtle)',
                  borderLeft: '3px solid var(--info)',
                }}
              >
                <div className="absolute top-0 right-0 pointer-events-none" style={{
                  width: '200px', height: '200px', borderRadius: '50%',
                  background: 'var(--info)', opacity: 0.05, filter: 'blur(50px)',
                  transform: 'translate(30%, -30%)',
                }} />
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <Target size={10} color="var(--info)" />
                  <span className="font-mono text-[8px] uppercase tracking-widest text-info">Active Objective</span>
                  <span className="ml-auto font-mono text-[8px] text-info animate-pulse">● EXECUTING</span>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between gap-4 relative z-10">
                  <div className="flex-1">
                    <h2 className="font-display font-bold text-primary leading-tight mb-2"
                      style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)' }}>
                      {mainQuest.title}
                    </h2>
                    {mainQuest.description && (
                      <p className="font-mono text-[10px] text-muted mb-4 line-clamp-2">{mainQuest.description}</p>
                    )}
                    <TacticalProgress value={mainQuest.progress} max={100} showValue color="var(--info)" />
                  </div>

                  {/* OPERATION DEADLINE COUNTDOWN */}
                  {deadlineDays !== null && (
                    <div className="shrink-0 flex flex-col items-center justify-center p-3 border border-border-color bg-bg-primary min-w-[100px] sm:min-w-[120px]">
                      <Clock size={14} className="mb-1" style={{
                        color: deadlineUrgency === 'danger' ? 'var(--danger)' : deadlineUrgency === 'warning' ? 'var(--warning)' : 'var(--info)'
                      }} />
                      <div className="font-display font-bold" style={{
                        fontSize: '2rem', lineHeight: 1,
                        color: deadlineUrgency === 'danger' ? 'var(--danger)' : deadlineUrgency === 'warning' ? 'var(--warning)' : 'var(--text-primary)'
                      }}>
                        {deadlineDays}
                      </div>
                      <div className="font-mono text-[8px] text-muted uppercase mt-1">Days Left</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="dashboard-card border-dashed text-center">
                <AlertTriangle size={20} className="text-muted mx-auto mb-2" />
                <p className="font-mono text-[10px] text-muted mb-3">No active directives</p>
                <Link href="/goals" className="btn btn-primary btn-sm" style={{ fontSize: '10px', padding: '4px 12px' }}>ASSIGN MISSION</Link>
              </div>
            )}

            {/* ACTIVE BATTLES (War Room Widget) */}
            {battles.length > 0 && (
              <div className="dashboard-card border-danger-subtle" style={{ borderLeft: '3px solid var(--danger)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Swords size={12} color="var(--danger)" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-danger">War Room // Active Battles</span>
                </div>
                <div className="flex flex-col gap-4">
                  {battles.map((battle, idx) => {
                    const Icon       = BATTLE_ICONS[battle.name] || Swords
                    const hp         = battle.hp ?? 100
                    const isCritical = hp > 75
                    const sevColor   = SEVERITY_COLORS[battle.severity] || 'var(--info)'
                    return (
                      <div key={idx}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center justify-center" style={{ width: 24, height: 24, background: `${sevColor}15`, border: `1px solid ${sevColor}50` }}>
                            <Icon size={12} style={{ color: sevColor }} />
                          </div>
                          <span className="font-display text-primary tracking-tight flex-1 truncate" style={{ fontSize: '1rem' }}>{battle.name}</span>
                          <span className="font-mono text-[10px] font-bold" style={{ color: isCritical ? 'var(--danger)' : 'var(--warning)' }}>
                            {hp} HP
                          </span>
                        </div>
                        <div style={{ height: '3px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
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
                </div>
              </div>
            )}

            {/* 30-DAY XP TRAJECTORY GRAPH */}
            <div className="dashboard-card" style={{ paddingBottom: '8px' }}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={10} color={arcColor} />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">30-Day Project Trajectory (XP)</span>
              </div>
              <div style={{ width: '100%', height: '140px' }}>
                <ResponsiveContainer>
                  <AreaChart data={xpTrajectory} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={arcColor} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={arcColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="xp" stroke={arcColor} fillOpacity={1} fill="url(#colorXp)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* DAILY CLASSIFIED BRIEFING */}
            <div className="dashboard-card">
              <div className="flex items-center gap-2 mb-2">
                <Terminal size={10} color="var(--text-muted)" />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Daily Briefing // Intelligence</span>
              </div>
              <p className="font-display text-primary" style={{ fontSize: '1.2rem', lineHeight: 1.3 }}>
                "{briefing}"
              </p>
            </div>

          </div>

          {/* RIGHT SIDEBAR (4 cols) */}
          <div className="col-4 flex flex-col gap-3 lg:gap-4">

            {/* MOMENTUM & STREAK */}
            <div className="dashboard-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Activity size={10} color={momentumColor} />
                  <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Momentum Engine</span>
                </div>
                <span className="font-mono text-[8px] font-bold" style={{ color: momentumColor }}>
                  {momentumText}
                </span>
              </div>
              
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="font-display font-bold tracking-tighter" style={{ fontSize: '2.8rem', color: momentumColor, lineHeight: 1 }}>
                    {momentumScore}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase">Global Score</div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 mb-1.5">
                    <Flame size={10} color={flameColor} />
                    <span className="font-mono font-bold text-primary" style={{ fontSize: '1rem' }}>{currentStreak} <span className="text-[8px] text-muted font-normal">days</span></span>
                  </div>
                  <div className="font-mono font-bold text-primary" style={{ fontSize: '1rem' }}>{weeklyWinRate}% <span className="text-[8px] text-muted font-normal">win rate</span></div>
                </div>
              </div>

              {/* Score bar */}
              <div style={{ height: '2px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${momentumScore}%`, background: momentumColor, transition: 'width 1s ease' }} />
              </div>
            </div>

            {/* XP STAT CARD */}
            <div className="dashboard-card" style={{ borderLeft: `3px solid ${arcColor}`, borderTop: `1px solid ${arcColor}20`, borderRight: `1px solid ${arcColor}20`, borderBottom: `1px solid ${arcColor}20` }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Zap size={10} style={{ color: arcColor }} />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">XP Matrix</span>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.4rem', color: arcColor }}>
                    {totalXp >= 1000 ? `${(totalXp / 1000).toFixed(1)}k` : totalXp}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TOTAL</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none text-info" style={{ fontSize: '1.4rem' }}>
                    {xpNeeded >= 1000 ? `${(xpNeeded / 1000).toFixed(1)}k` : xpNeeded}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TO LV.{currentLevel + 1}</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.4rem', color: xpToday > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    +{xpToday}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TODAY</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none text-primary" style={{ fontSize: '1.4rem' }}>
                    +{xpThisWeek}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">THIS WEEK</div>
                </div>
              </div>
            </div>

            {/* DAY PRESSURE CLOCK */}
            <div className="dashboard-card">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Time Remaining</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0" style={{ width: '48px', height: '48px' }}>
                  <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="24" cy="24" r="20" fill="none" stroke="var(--bg-primary)" strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" fill="none"
                      stroke={dayUrgency === 'danger' ? 'var(--danger)' : dayUrgency === 'warning' ? 'var(--warning)' : arcColor}
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - dayPct / 100)}`}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono font-bold text-primary" style={{ fontSize: '8px' }}>{dayPct}%</span>
                  </div>
                </div>
                <div>
                  <div className="font-display font-bold text-primary" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                    {hoursLeft}<span className="font-mono text-xs text-muted">h</span>
                  </div>
                  <div className="font-mono text-[8px] mt-1.5" style={{
                    color: dayUrgency === 'danger' ? 'var(--danger)' : dayUrgency === 'warning' ? 'var(--warning)' : 'var(--text-muted)'
                  }}>
                    {dayUrgency === 'danger' ? '⚠ EXECUTE NOW' : dayUrgency === 'warning' ? 'WINDOW CLOSING' : 'TIME ON SIDE'}
                  </div>
                </div>
              </div>
            </div>

            {/* GHOST SCORE & DAILY OUTPUT RATIO */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <div className="dashboard-card text-center" style={{ padding: '12px' }}>
                <Ghost size={12} className="mx-auto mb-1 text-muted" />
                <div className="font-display font-bold tracking-tighter" style={{ fontSize: '1.8rem', lineHeight: 1 }}>{ghostScore}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-muted mt-1">Ghost Score</div>
                <div className="font-mono text-[7px] text-muted mt-0.5">(All-Time Bounces)</div>
              </div>
              
              <div className="dashboard-card text-center" style={{ padding: '12px' }}>
                <ArrowUpRight size={12} className="mx-auto mb-1" style={{ color: deepWorkPct >= 50 ? 'var(--success)' : 'var(--text-muted)' }} />
                <div className="font-display font-bold tracking-tighter" style={{ fontSize: '1.8rem', lineHeight: 1, color: deepWorkPct >= 50 ? 'var(--success)' : 'var(--text-primary)' }}>
                  {Math.round(deepWorkPct)}%
                </div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-muted mt-1">Deep Work Ratio</div>
                <div className="font-mono text-[7px] text-muted mt-0.5">({deepWorkTasks} Hard / {totalWork} Total)</div>
              </div>
            </div>

            {/* HABIT GRAVEYARD */}
            {habitGraveyard.length > 0 && (
              <div className="dashboard-card border-danger-subtle" style={{ borderLeft: '3px solid var(--danger)' }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <Skull size={10} color="var(--danger)" />
                  <span className="font-mono text-[8px] uppercase tracking-widest text-danger">Habit Graveyard (30 Days)</span>
                </div>
                <div className="flex flex-col gap-2">
                  {habitGraveyard.map((grave) => {
                    return (
                      <div key={grave.habitId} className="flex items-center justify-between p-2 bg-bg-primary border border-danger-subtle">
                        <span className="font-mono text-[9px] text-primary truncate max-w-[150px]">{grave.name}</span>
                        <span className="font-mono text-[9px] font-bold text-danger">{grave.fails} Fails</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* JOURNAL STATUS & WEEKLY DEBRIEF */}
            <div className="flex gap-3 lg:gap-4">
              <Link href="/journal" className="flex-1">
                <div style={{
                  padding: '12px', textAlign: 'center', cursor: 'pointer',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', height: '100%'
                }} className="hover:border-primary transition-colors flex flex-col justify-center items-center">
                  <BookOpen size={12} color={journalDoneToday ? "var(--success)" : "var(--text-muted)"} className="mb-1.5" />
                  <div className="font-mono text-[8px] uppercase tracking-widest text-muted">Journal</div>
                  <div className="font-mono text-[8px] mt-1 font-bold" style={{ color: journalDoneToday ? 'var(--success)' : 'var(--warning)' }}>
                    {journalDoneToday ? '✓ LOGGED' : '⚠ PENDING'}
                  </div>
                </div>
              </Link>
              
              <Link href="/weekly-review" className="flex-1">
                <div style={{
                  padding: '12px', textAlign: 'center', cursor: 'pointer',
                  background: new Date().getDay() === 0 ? 'rgba(245,158,11,0.08)' : 'var(--bg-tertiary)', 
                  border: `1px solid ${new Date().getDay() === 0 ? 'var(--warning)' : 'var(--border-color)'}`,
                  height: '100%'
                }} className="hover:border-amber transition-colors flex flex-col justify-center items-center">
                  <ClipboardList size={12} color={new Date().getDay() === 0 ? "var(--warning)" : "var(--text-muted)"} className="mb-1.5" />
                  <div className="font-mono text-[8px] uppercase tracking-widest text-muted">Debrief</div>
                  {new Date().getDay() === 0 && (
                     <div className="font-mono text-[8px] mt-1 text-amber">+40 XP</div>
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
