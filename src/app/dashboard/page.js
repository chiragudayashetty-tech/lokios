'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, AlertTriangle, Zap, Swords, Flame, ChevronDown,
  ChevronUp, Lock, Check, ClipboardList, BookOpen,
  Activity, Clock, Terminal, Ghost, Skull, ArrowUpRight, BarChart2,
  Smartphone, Shield, DollarSign, Moon, Brain, Repeat, Scale, X
} from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { RANK_CONFIG } from '@/lib/constants'
import { getLocalDateStr } from '@/lib/utils/dates'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

const ARC_CONFIG = [
  { rank: 'I',       name: 'The Awakening',          flavor: 'The moment I stopped drifting and chose the life I wanted to build.' },
  { rank: 'II',      name: 'The Discipline Rebuild', flavor: 'I rebuilt my mind, habits, and identity one day at a time.' },
  { rank: 'III',     name: 'The Spark',              flavor: 'Small actions became unstoppable momentum.' },
  { rank: 'IV',      name: 'The Architect',          flavor: 'I stopped chasing success and started designing systems, businesses, and a better future.' },
  { rank: 'V',       name: 'The King',               flavor: 'I learned to lead myself first, then earned the trust to lead others.' },
  { rank: 'VI',      name: 'The Empire',             flavor: 'My work grew beyond me into companies, teams, and communities that create lasting value.' },
  { rank: 'VII',     name: 'The Legacy',             flavor: 'My greatest achievement became the people I inspired and the lives I changed.' },
  { rank: 'VIII',    name: 'Beyond',                 flavor: 'There is no finish line. Every summit reveals a higher mountain.' },
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
  const [momentumExpanded, setMomentumExpanded] = useState(false)
  
  // New metrics states
  const [ghostScore, setGhostScore] = useState(0)
  const [habitGraveyard, setHabitGraveyard] = useState([])
  const [xpTrajectory, setXpTrajectory] = useState([])
  const [battles, setBattles] = useState([])
  const [weightData, setWeightData] = useState(null)
  const [latestDebrief, setLatestDebrief] = useState(null)
  const [todayScreenTime, setTodayScreenTime] = useState(null)
  const [selectedBattleIntel, setSelectedBattleIntel] = useState(null)

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

      // 1b. Fetch Active Battles (War Room) & recalculate HP daily
      const { data: blueprints } = await sb
        .from('user_blueprints')
        .select('id, battles, last_evaluated_date')
        .eq('user_id', user.id)
        .single()
      if (blueprints?.battles) {
        // Recalculate battle HP if not yet evaluated today
        if (blueprints.last_evaluated_date !== todayStr) {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = getLocalDateStr(yesterday)
          
          const { data: yesterdayLogs } = await sb
            .from('habit_logs')
            .select('habit_id, status')
            .eq('user_id', user.id)
            .eq('date', yesterdayStr)
          
          const logsMap = new Map((yesterdayLogs || []).map(l => [l.habit_id, l.status]))
          
          let needsUpdate = false
          const updatedBattles = blueprints.battles.map(battle => {
            if (!battle.linked_habits || battle.linked_habits.length === 0) return battle
            let hpChange = 0
            battle.linked_habits.forEach(habitId => {
              const status = logsMap.get(habitId) || 'none'
              if (status === 'completed') {
                hpChange -= 15 // damage to enemy
              } else if (status !== 'blocked') {
                hpChange += 20 // enemy heals
              }
            })
            if (hpChange !== 0) {
              needsUpdate = true
              return { ...battle, hp: Math.max(0, Math.min(100, (battle.hp ?? 100) + hpChange)) }
            }
            return battle
          })
          
          if (needsUpdate) {
            await sb.from('user_blueprints')
              .update({ battles: updatedBattles, last_evaluated_date: todayStr })
              .eq('id', blueprints.id)
            setBattles(updatedBattles.filter(b => b.status !== 'defeated'))
          } else {
            // Still update last_evaluated_date to prevent re-running
            await sb.from('user_blueprints')
              .update({ last_evaluated_date: todayStr })
              .eq('id', blueprints.id)
            setBattles(blueprints.battles.filter(b => b.status !== 'defeated'))
          }
        } else {
          setBattles(blueprints.battles.filter(b => b.status !== 'defeated'))
        }
      }

      // Fetch today's screen time log for live battle calculations
      const { data: stLogs } = await sb
        .from('screen_time_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .limit(1)

      if (stLogs && stLogs.length > 0) {
        setTodayScreenTime(stLogs[0])
      }

      // Handle Strike Back Action for a War Room Battle
      window.__strikeBackBattle = async (battleName) => {
        const { data: blueprints } = await sb
          .from('user_blueprints')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (!blueprints || !blueprints.battles) return

        const updatedBattles = [...blueprints.battles]
        const idx = updatedBattles.findIndex(b => b.name === battleName)
        if (idx === -1) return

        const target = updatedBattles[idx]
        const oldHp = target.hp ?? 100
        const newHp = Math.max(0, oldHp - 10)
        target.hp = newHp

        if (!target.combat_logs) target.combat_logs = []
        target.combat_logs.unshift({
          date: getLocalDateStr(new Date()),
          action: '⚡ STRIKE BACK EXECUTED',
          hpChange: -10
        })

        let xpAward = 25
        if (newHp === 0 && oldHp > 0) {
          target.status = 'defeated'
          xpAward = 200
        }

        await sb
          .from('user_blueprints')
          .update({ battles: updatedBattles })
          .eq('user_id', user.id)

        await robustAwardXP(user.id, xpAward, `War Room Strike Back: ${target.name}`)
        setBattles(updatedBattles.filter(b => b.status !== 'defeated'))
      }

      // 1c. Fetch Latest Weekly Debrief (Work Log)
      const { data: debriefLogs } = await sb
        .from('work_logs')
        .select('*')
        .eq('user_id', user.id)
        .ilike('title', 'Weekly Debrief%')
        .order('created_at', { ascending: false })
        .limit(1)

      if (debriefLogs && debriefLogs.length > 0) {
        setLatestDebrief(debriefLogs[0])
      }
        
      if (xpData) {
        // Today & This Week (NET XP including penalties)
        setXpThisWeek(xpData.filter(r => r.created_at >= currentMondayStr).reduce((s, r) => s + r.amount, 0))
        setXpToday(xpData.filter(r => r.created_at.startsWith(todayStr)).reduce((s, r) => s + r.amount, 0))
        
        // 30-Day Trajectory Graph
        const xpByDate = {}
        xpData.filter(r => r.amount > 0).forEach(r => {
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

      // ── Weight Tracking (Body Recon Widget) ──
      const { data: wConfig } = await sb.from('weight_config').select('*').eq('user_id', user.id).maybeSingle()
      if (wConfig) {
        const { data: latestLog } = await sb.from('weight_logs').select('weight_kg, date').eq('user_id', user.id).order('date', { ascending: false }).limit(1).maybeSingle()
        const { data: todayLog } = await sb.from('weight_logs').select('id').eq('user_id', user.id).eq('date', todayStr).maybeSingle()
        if (latestLog) {
          const lost = (wConfig.starting_weight - latestLog.weight_kg).toFixed(1)
          const range = wConfig.starting_weight - wConfig.target_weight
          const pct = range > 0 ? Math.min(100, Math.max(0, Math.round((parseFloat(lost) / range) * 100))) : 0
          setWeightData({
            current: parseFloat(latestLog.weight_kg),
            target: parseFloat(wConfig.target_weight),
            start: parseFloat(wConfig.starting_weight),
            lost: parseFloat(lost),
            progressPct: pct,
            loggedToday: !!todayLog
          })
        }
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

  const todayStr = getLocalDateStr(new Date())

  // ── Dynamic Daily Ops Momentum Engine (-10 to +10) ────────────────────────
  // 1. Habits Performance (Completed vs Failed Today)
  const habitsCompletedToday = (todayLogs || []).filter(l => l.date === todayStr && l.status === 'completed').length
  const habitsFailedToday    = (todayLogs || []).filter(l => l.date === todayStr && l.status === 'failed').length
  const habitComponent       = (habitsCompletedToday * 1.5) - (habitsFailedToday * 1.5)

  // 2. Operations / Tasks (Completed Today vs Overdue / Procrastinated)
  const tasksCompletedToday  = (tasks || []).filter(t => t.status === 'completed' && t.completed_at?.startsWith(todayStr)).length
  const tasksOverdue         = (tasks || []).filter(t => t.status === 'pending' && t.due_date && t.due_date < todayStr).length
  const opsComponent         = (tasksCompletedToday * 1.0) - (tasksOverdue * 1.0)

  // 3. Missions / Goals (Completed vs Stalled / Overdue)
  const missionsCompleted    = (sideQuests || []).filter(g => g.status === 'completed').length
  const missionsStalled      = (sideQuests || []).filter(g => g.status !== 'completed' && g.deadline && g.deadline < todayStr).length
  const missionsComponent    = (missionsCompleted * 2.0) - (missionsStalled * 1.5)

  // 4. Streak & Weekly Win Rate Inertia
  const streakComponent      = currentStreak >= 14 ? 3.0 : currentStreak >= 7 ? 2.0 : currentStreak >= 1 ? 1.0 : 0.0
  const winRateComponent     = weeklyWinRate >= 80 ? 3.0 : weeklyWinRate >= 60 ? 1.5 : weeklyWinRate >= 40 ? 0.0 : -3.0

  const rawMomentum          = habitComponent + opsComponent + missionsComponent + streakComponent + winRateComponent
  const momentumScore        = Math.max(-10, Math.min(10, parseFloat(rawMomentum.toFixed(1))))
  const momentumColor        = momentumScore >= 5 ? 'var(--success)' : momentumScore >= 0 ? 'var(--warning)' : 'var(--danger)'
  const momentumText         = momentumScore >= 5 ? 'SURGING' : momentumScore >= 0 ? 'STEADY' : 'DECLINING'

  // Parse Next Week Priorities from latest Weekly Debrief log
  const nextWeekPriorities = (function() {
    if (!latestDebrief?.description) return null
    const text = latestDebrief.description
    const marker = '### Priorities for Next Week'
    const idx = text.indexOf(marker)
    if (idx === -1) return null
    let section = text.substring(idx + marker.length).trim()
    const nextHeaderIdx = section.indexOf('### ')
    if (nextHeaderIdx !== -1) section = section.substring(0, nextHeaderIdx).trim()
    return section
  })()

  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24)
  const briefing = BRIEFINGS[dayOfYear % BRIEFINGS.length]

  const lastJournalDate = entries?.[0]?.date
  const journalDoneToday = lastJournalDate === todayStr

  let deadlineDays = null
  let deadlineUrgency = 'ok'
  if (mainQuest?.deadline) {
    const msDiff = new Date(mainQuest.deadline) - new Date()
    deadlineDays = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)))
    deadlineUrgency = deadlineDays <= 3 ? 'danger' : deadlineDays <= 7 ? 'warning' : 'ok'
  }



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
              <span className="font-mono tracking-widest mt-0.5" style={{ fontSize: '8px', color: arcColor }}>
                SAGA {currentRank.code}
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
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2.5">
                LV.{currentLevel} · <span className="text-primary font-bold">{totalXp.toLocaleString()} XP</span> · <span style={{ color: arcColor }}>{currentArc.flavor}</span>
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

                <div className="relative mt-2 mb-2 pl-2">
                  <div className="absolute left-[17px] top-4 bottom-4 w-px" style={{ background: 'var(--border-color)' }} />
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
                          className="relative flex flex-row items-center gap-5 py-4"
                          style={{ opacity: isCurrent ? 1 : isCleared ? 0.5 : 0.25 }}
                        >
                          <div
                            className="flex items-center justify-center shrink-0 bg-black z-10"
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
                                SAGA {arc.rank}
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Swords size={14} className="text-danger animate-pulse" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-danger font-bold">War Room // Live Active Battles</span>
                  </div>
                  <span className="font-mono text-[8px] text-muted">CLICK FOR INTEL</span>
                </div>
                <div className="flex flex-col gap-3">
                  {battles.map((battle, idx) => {
                    const Icon       = BATTLE_ICONS[battle.name] || Swords
                    const sevColor   = SEVERITY_COLORS[battle.severity] || 'var(--info)'

                    // Calculate Live HP & Intel Factors for Today
                    const liveIntel  = (function() {
                      let baseHp = 50
                      const succeeded = []
                      const failed = []

                      if (battle.linked_habits && battle.linked_habits.length > 0) {
                        battle.linked_habits.forEach(habitId => {
                          if (habitId === 'sys_screen_intel') return
                          const habit = (habits || []).find(h => h.id === habitId)
                          const log = (todayLogs || []).find(l => l.habit_id === habitId)
                          const title = habit?.title || 'Linked Habit'

                          if (log?.status === 'completed') {
                            baseHp -= 15
                            succeeded.push(`Completed habit "${title}" (-15 HP to threat)`)
                          } else if (log?.status === 'failed') {
                            baseHp += 20
                            failed.push(`Failed habit "${title}" (+20 HP to threat)`)
                          } else {
                            baseHp += 5
                            failed.push(`Pending habit "${title}" (+5 HP threat drift)`)
                          }
                        })
                      }

                      const bName = battle.name?.toLowerCase() || ''
                      if (bName.includes('phone') || bName.includes('screen') || bName.includes('addiction') || bName.includes('execution')) {
                        if (todayScreenTime) {
                          const tHours = parseFloat(todayScreenTime.total_hours) || 0
                          const dMins  = parseInt(todayScreenTime.doomscroll_minutes) || 0
                          const sHours = parseFloat(todayScreenTime.streaming_hours) || 0

                          if (tHours <= 6) {
                            baseHp -= 10
                            succeeded.push(`Screen Time (${tHours}h) ≤ 6h limit (-10 HP)`)
                          } else {
                            baseHp += 15
                            failed.push(`Screen Time (${tHours}h) > 6h limit (+15 HP)`)
                          }

                          if (dMins <= 60) {
                            baseHp -= 10
                            succeeded.push(`Doomscroll (${dMins}m) ≤ 60m limit (-10 HP)`)
                          } else {
                            baseHp += 15
                            failed.push(`Doomscroll (${dMins}m) > 60m limit (+15 HP)`)
                          }

                          if (sHours <= 2) {
                            baseHp -= 5
                            succeeded.push(`Streaming (${sHours}h) ≤ 2h limit (-5 HP)`)
                          } else {
                            baseHp += 10
                            failed.push(`Streaming (${sHours}h) > 2h limit (+10 HP)`)
                          }
                        } else {
                          failed.push(`No Screen Time logged today (+10 HP threat drift)`)
                          baseHp += 10
                        }
                      }

                      const hp = Math.max(0, Math.min(100, baseHp))
                      return { hp, succeeded, failed }
                    })()

                    const hp = liveIntel.hp
                    const isCritical = hp > 75

                    return (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedBattleIntel({ battle, intel: liveIntel })}
                        className="p-3 bg-bg-primary border border-border-color rounded-sm cursor-pointer hover:border-danger transition-colors group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, background: `${sevColor}15`, border: `1px solid ${sevColor}50` }}>
                            <Icon size={13} style={{ color: sevColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display text-primary tracking-tight truncate group-hover:text-danger transition-colors" style={{ fontSize: '0.95rem' }}>{battle.name}</span>
                              <span className="font-mono text-[10px] font-bold shrink-0" style={{ color: isCritical ? 'var(--danger)' : 'var(--warning)' }}>
                                {hp} HP
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ height: '4px', background: 'var(--bg-secondary)', overflow: 'hidden', borderRadius: '2px' }}>
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

            {/* NEXT WEEK PRIORITIES // WEEKLY DEBRIEF WIDGET */}
            <div className="dashboard-card border-info-subtle" style={{ borderLeft: '3px solid var(--info)' }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList size={12} color="var(--info)" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-info">Next Week Priorities // Weekly Debrief</span>
                </div>
                <Link href="/weekly-review" className="font-mono text-[9px] text-muted hover:text-info flex items-center gap-1">
                  DEBRIEF <ArrowUpRight size={10} />
                </Link>
              </div>

              {nextWeekPriorities ? (
                <div className="font-mono text-xs text-primary whitespace-pre-wrap leading-relaxed p-3 rounded-sm bg-bg-primary border border-border-color">
                  {nextWeekPriorities}
                </div>
              ) : (
                <div className="p-4 text-center rounded-sm bg-bg-primary border border-dashed border-border-color">
                  <p className="font-mono text-[10px] text-muted mb-2">No priorities logged for this cycle.</p>
                  <Link href="/weekly-review" className="btn btn-secondary btn-sm font-mono text-[9px]">
                    INITIALIZE WEEKLY DEBRIEF
                  </Link>
                </div>
              )}
            </div>

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
            <div 
              className="dashboard-card cursor-pointer hover:border-primary transition-colors" 
              onClick={() => setMomentumExpanded(!momentumExpanded)}
            >
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
                    {momentumScore > 0 ? '+' : ''}{momentumScore}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase">-10 to +10</div>
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
              <div style={{ height: '2px', background: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${((momentumScore + 10) / 20) * 100}%`, background: momentumColor, transition: 'width 1s ease' }} />
              </div>

              {/* Momentum Breakdown */}
              <AnimatePresence>
                {momentumExpanded && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 overflow-hidden"
                    style={{ borderTop: '1px solid var(--border-color)' }}
                  >
                    <div className="flex flex-col gap-2 font-mono text-[9px] text-muted tracking-widest">
                      <div className="flex justify-between">
                        <span>HABITS TODAY ({habitsCompletedToday}/{habitsCompletedToday + habitsFailedToday})</span> 
                        <span className="font-bold" style={{ color: habitComponent > 0 ? 'var(--success)' : habitComponent < 0 ? 'var(--danger)' : 'inherit' }}>{habitComponent > 0 ? '+' : ''}{habitComponent.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>OPERATIONS ({tasksCompletedToday} done / {tasksOverdue} overdue)</span> 
                        <span className="font-bold" style={{ color: opsComponent > 0 ? 'var(--success)' : opsComponent < 0 ? 'var(--danger)' : 'inherit' }}>{opsComponent > 0 ? '+' : ''}{opsComponent.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MISSIONS ({missionsCompleted} done / {missionsStalled} stalled)</span> 
                        <span className="font-bold" style={{ color: missionsComponent > 0 ? 'var(--success)' : missionsComponent < 0 ? 'var(--danger)' : 'inherit' }}>{missionsComponent > 0 ? '+' : ''}{missionsComponent.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>STREAK INERTIA ({currentStreak}d)</span> 
                        <span className="font-bold" style={{ color: streakComponent > 0 ? 'var(--success)' : 'inherit' }}>{streakComponent > 0 ? '+' : ''}{streakComponent.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>WEEKLY WIN RATE ({weeklyWinRate}%)</span> 
                        <span className="font-bold" style={{ color: winRateComponent > 0 ? 'var(--success)' : winRateComponent < 0 ? 'var(--danger)' : 'inherit' }}>{winRateComponent > 0 ? '+' : ''}{winRateComponent.toFixed(1)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* XP STAT CARD */}
            <div className="dashboard-card" style={{ borderLeft: `3px solid ${arcColor}`, borderTop: `1px solid ${arcColor}20`, borderRight: `1px solid ${arcColor}20`, borderBottom: `1px solid ${arcColor}20` }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Zap size={10} style={{ color: arcColor }} />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">XP Matrix</span>
              </div>
              <div className="grid grid-cols-3 gap-y-3 gap-x-2">
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none text-info" style={{ fontSize: '1.4rem' }}>
                    {xpNeeded >= 1000 ? `${(xpNeeded / 1000).toFixed(1)}k` : xpNeeded}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TO LV.{currentLevel + 1}</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.4rem', color: xpToday > 0 ? 'var(--success)' : xpToday < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {xpToday >= 0 ? '+' : ''}{xpToday}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TODAY</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.4rem', color: xpThisWeek > 0 ? 'var(--success)' : xpThisWeek < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {xpThisWeek >= 0 ? '+' : ''}{xpThisWeek}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">THIS WEEK</div>
                </div>
              </div>
            </div>

            {/* BODY RECON WIDGET */}
            {weightData && (
              <Link href="/weight">
                <div className="dashboard-card hover:border-amber transition-colors cursor-pointer" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Scale size={10} color="var(--accent-primary)" />
                    <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Body Recon</span>
                    {weightData.loggedToday && <span className="ml-auto font-mono text-[8px] text-success">✓ LOGGED</span>}
                  </div>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>
                        {weightData.current}
                        <span className="font-mono text-[9px] text-muted ml-1">kg</span>
                      </div>
                      <div className="font-mono text-[8px] text-muted uppercase mt-1">
                        {weightData.lost > 0 ? `▼ ${weightData.lost} kg lost` : 'Current'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[10px] font-bold" style={{ color: 'var(--accent-primary)' }}>
                        → {weightData.target} kg
                      </div>
                      <div className="font-mono text-[8px] text-muted mt-0.5">{weightData.progressPct}%</div>
                    </div>
                  </div>
                  <div style={{ height: '3px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${weightData.progressPct}%`, background: weightData.progressPct >= 100 ? 'var(--success)' : 'var(--accent-primary)', transition: 'width 1s ease' }} />
                  </div>
                </div>
              </Link>
            )}

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

            {/* GHOST SCORE */}
            <div className="dashboard-card text-center" style={{ padding: '12px' }}>
              <Ghost size={12} className="mx-auto mb-1 text-muted" />
              <div className="font-display font-bold tracking-tighter" style={{ fontSize: '1.8rem', lineHeight: 1 }}>{ghostScore}</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-muted mt-1">Ghost Score</div>
              <div className="font-mono text-[7px] text-muted mt-0.5">(All-Time Bounces)</div>
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
      {/* COMBAT INTEL MODAL */}
      <AnimatePresence>
        {selectedBattleIntel && (
          <div className="modal-overlay" onClick={() => setSelectedBattleIntel(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg p-6 bg-tertiary border border-danger rounded-sm shadow-2xl relative m-4"
            >
              <button 
                onClick={() => setSelectedBattleIntel(null)}
                className="absolute top-4 right-4 text-muted hover:text-primary"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2 text-danger mb-4 border-b border-border-color pb-3">
                <Swords size={18} className="animate-pulse" />
                <span className="font-display text-lg uppercase tracking-widest font-bold">
                  COMBAT INTEL // {selectedBattleIntel.battle.name}
                </span>
              </div>

              <div className="mb-6">
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-muted">LIVE REAL-TIME THREAT HP</span>
                  <span className="font-bold text-danger">{selectedBattleIntel.intel.hp} / 100 HP</span>
                </div>
                <div className="h-3 w-full bg-bg-primary border border-border-color rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-danger transition-all duration-500" 
                    style={{ width: `${selectedBattleIntel.intel.hp}%` }}
                  />
                </div>
              </div>

              {/* WHY SUCCEEDED (GREEN) */}
              <div className="mb-4 p-3 bg-success/5 border border-success/30 rounded-sm font-mono text-xs">
                <div className="text-success font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Check size={14} /> WHY THREAT HP IS DECREASING (SUCCEEDED)
                </div>
                {selectedBattleIntel.intel.succeeded.length > 0 ? (
                  <ul className="flex flex-col gap-1.5 text-secondary">
                    {selectedBattleIntel.intel.succeeded.map((reason, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-success font-bold">•</span> {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted text-[10px]">No victory factors achieved yet today.</div>
                )}
              </div>

              {/* WHY FAILED (RED) */}
              <div className="mb-6 p-3 bg-danger/5 border border-danger/30 rounded-sm font-mono text-xs">
                <div className="text-danger font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                  <AlertTriangle size={14} /> WHY THREAT HP IS INCREASING (FAILED / PENALTY)
                </div>
                {selectedBattleIntel.intel.failed.length > 0 ? (
                  <ul className="flex flex-col gap-1.5 text-secondary">
                    {selectedBattleIntel.intel.failed.map((reason, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-danger font-bold">•</span> {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-success text-[10px]">Zero failure penalties active today! Perfect defense.</div>
                )}
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={() => setSelectedBattleIntel(null)}
                  className="btn btn-primary btn-sm font-mono text-xs"
                >
                  CLOSE INTEL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
