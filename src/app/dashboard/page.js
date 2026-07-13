'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Shield, AlertTriangle, Zap, Swords, Smartphone,
  Moon, Brain, DollarSign, Repeat, Flame, ChevronDown,
  ChevronUp, Lock, Check, ClipboardList, Cpu
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

// ── Static Arc definitions. Tied to RANK_CONFIG keys ──────────────────────────
// Each arc maps to one rank. No DB connection — purely UI narrative.
const ARC_CONFIG = [
  { rank: 'E', name: 'The Awakening',       flavor: 'You just woke up. Most people never get this far.' },
  { rank: 'D', name: 'Discipline Rebuild',  flavor: 'The foundation. The grind no one sees.' },
  { rank: 'C', name: 'The Forge',           flavor: "Shaped by pressure. Don't break." },
  { rank: 'B', name: 'The Surge',           flavor: 'Momentum compounds. The gap is forming.' },
  { rank: 'A', name: 'Apex Protocol',       flavor: 'Elite. Most people quit before here.' },
  { rank: 'S', name: 'Legend Mode',         flavor: 'Near mythical. This is rare territory.' },
  { rank: 'Emperor', name: 'The Apex',      flavor: 'Final form. You became what you imagined.' },
]

// ── Battle icon mapping (unchanged from original) ────────────────────────────
const BATTLE_ICONS = {
  'Phone Addiction': Smartphone,
  'Porn Consumption': Shield,
  'Inconsistent Execution': Repeat,
  'Fear of Selling': DollarSign,
  'Poor Sleep Discipline': Moon,
  'Overthinking': Brain,
}

const SEVERITY_COLORS = {
  extreme: '#FF3B3B',
  high: 'var(--danger)',
  medium: 'var(--accent-primary)',
  low: 'var(--info)'
}

export default function MissionControl() {
  const { user } = useAuth()

  // ── Data from OSContext (same as before, zero changes) ────────────────────
  const {
    profile: { profile },
    goals:   { mainQuest },
    habits:  { todayLogs }
  } = useOS()

  // ── Local state ───────────────────────────────────────────────────────────
  const [battles, setBattles]       = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [xpToday, setXpToday]       = useState(0)
  const [heatmap, setHeatmap]       = useState([])
  const [arcExpanded, setArcExpanded] = useState(false)

  // ── Live clock (unchanged) ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // ── Fetch battles from user_blueprints (unchanged logic) ─────────────────
  useEffect(() => {
    async function fetchBattles() {
      const supabase = createClient()
      const { data: bpData } = await supabase
        .from('user_blueprints')
        .select('battles')
        .single()
      if (bpData?.battles) {
        setBattles(bpData.battles.filter(b => b.status !== 'defeated'))
      }
    }
    fetchBattles()
  }, [])

  // ── Fetch today's XP (read-only, sums positive xp_history rows for today) ─
  // Source: xp_history table, column: amount, filter: created_at >= today
  useEffect(() => {
    async function fetchXpToday() {
      if (!user) return
      const supabase = createClient()
      const todayStr = getLocalDateStr(new Date())
      const { data } = await supabase
        .from('xp_history')
        .select('amount')
        .eq('user_id', user.id)
        .gte('created_at', todayStr)
      if (data) {
        const total = data
          .filter(r => (r.amount || 0) > 0)
          .reduce((sum, r) => sum + r.amount, 0)
        setXpToday(total)
      }
    }
    fetchXpToday()
  }, [user, todayLogs]) // refetch whenever habits are toggled (todayLogs changes)

  // ── Fetch 7-day heatmap (read-only, habit_logs last 7 days) ──────────────
  // Source: habit_logs table, columns: date (YYYY-MM-DD), status
  // A day is green if ANY habit log has status='completed'
  // A day is grey if ALL logs are 'blocked' or no frequency_days match
  // A day is red if it had active habits but none completed
  useEffect(() => {
    async function fetchHeatmap() {
      if (!user) return
      const supabase = createClient()

      // Build array of last 7 days as Date objects (oldest first)
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d
      })
      const firstStr = getLocalDateStr(days[0])
      const todayStr = getLocalDateStr(new Date())

      const { data } = await supabase
        .from('habit_logs')
        .select('date, status')
        .eq('user_id', user.id)
        .gte('date', firstStr)

      // Group logs by date string
      const logsByDate = new Map()
      ;(data || []).forEach(log => {
        // habit_logs.date is stored as YYYY-MM-DD
        const key = String(log.date).substring(0, 10)
        if (!logsByDate.has(key)) logsByDate.set(key, [])
        logsByDate.get(key).push(log.status)
      })

      setHeatmap(days.map(d => {
        const key = getLocalDateStr(d)
        const logs = logsByDate.get(key) || []
        const hasCompleted = logs.some(s => s === 'completed')
        const hasFailed    = logs.some(s => s === 'failed')
        const allBlocked   = logs.length > 0 && logs.every(s => s === 'blocked')
        return {
          dateStr:      key,
          label:        d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
          hasCompleted,
          hasFailed,
          allBlocked,
          isToday:      key === todayStr,
        }
      }))
    }
    fetchHeatmap()
  }, [user, todayLogs])

  // ── Derived values from profile (read-only, zero logic change) ────────────
  // profile is fetched by useProfileInternal (select('*')), so all columns available.
  const totalXp        = profile?.total_xp        || 0
  const currentStreak  = profile?.current_streak  ?? profile?.streak_days ?? 0
  const longestStreak  = profile?.longest_streak  ?? 0

  const currentLevel   = calculateLevel(totalXp)
  const { current: xpInLevel, required: xpForNextLevel, percentage: levelPct } = xpToNextLevel(totalXp)
  const xpNeededForNextLevel = Math.max(0, xpForNextLevel - xpInLevel)
  const currentRank    = getRankForXp(totalXp)
  const arcColor       = RANK_CONFIG[currentRank.code]?.color || '#9CA3AF'

  const currentArc = ARC_CONFIG.find(a => a.rank === currentRank.code) || ARC_CONFIG[0]

  // ── Day pressure (computed from live clock, no DB) ────────────────────────
  const hoursLeft = +(24 - currentTime.getHours() - currentTime.getMinutes() / 60).toFixed(1)
  const dayPct    = Math.round(((currentTime.getHours() * 60 + currentTime.getMinutes()) / 1440) * 100)
  const dayUrgency = dayPct > 80 ? 'danger' : dayPct > 60 ? 'warning' : 'ok'

  // ── Streak display helpers ────────────────────────────────────────────────
  const streakFlameSize  = currentStreak >= 30 ? 30 : currentStreak >= 7 ? 24 : 18
  const streakFlameColor = currentStreak >= 30 ? '#F59E0B' : currentStreak >= 7 ? '#f97316' : '#ef4444'

  return (
    <AppShell>
      <div className="page-container relative max-w-[1600px]">

        {/* ── Dynamic arc color CSS variable ─────────────────────────────── */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root { --arc-color: ${arcColor}; }
          .arc-glow  { box-shadow: 0 0 30px ${arcColor}20, 0 0 60px ${arcColor}08; }
          .arc-border-left { border-left: 3px solid ${arcColor} !important; }
          .bento-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: var(--space-6);
          }
          @media (min-width: 1024px) {
            .bento-grid {
              grid-template-columns: repeat(12, 1fr);
              grid-auto-rows: minmax(min-content, max-content);
            }
            .bento-col-8 { grid-column: span 8; }
            .bento-col-4 { grid-column: span 4; }
          }
        ` }} />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MODULE 1: CHARACTER ARC HEADER                                  */}
        {/* Data: profile.total_xp → calculateLevel / xpToNextLevel / getRankForXp */}
        {/*       profile.full_name for operator name                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <motion.div
          className="mb-6 p-5 border arc-glow relative overflow-hidden"
          style={{
            borderLeft: `4px solid ${arcColor}`,
            borderTop: `1px solid ${arcColor}30`,
            borderRight: `1px solid ${arcColor}15`,
            borderBottom: `1px solid ${arcColor}15`,
            background: `linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-primary) 100%)`,
          }}
          layout
        >
          {/* Background glow blob */}
          <div
            className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: arcColor, opacity: 0.06, filter: 'blur(80px)', transform: 'translate(30%, -30%)' }}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">

            {/* LEFT: Rank badge + Arc name (clickable to expand) */}
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="flex flex-col items-center justify-center w-14 h-14 shrink-0 border-2"
                style={{ borderColor: arcColor, background: `${arcColor}15` }}
              >
                <span className="font-display text-2xl leading-none" style={{ color: arcColor }}>
                  {currentRank.icon}
                </span>
                <span className="font-mono text-[8px] uppercase tracking-widest mt-0.5" style={{ color: arcColor }}>
                  {currentRank.code === 'Emperor' ? 'EMP' : currentRank.code}-RANK
                </span>
              </div>

              <div className="min-w-0">
                <button
                  onClick={() => setArcExpanded(v => !v)}
                  className="flex items-center gap-2 group text-left"
                >
                  <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-primary truncate">
                    {currentArc.name.toUpperCase()}
                  </h1>
                  {arcExpanded
                    ? <ChevronUp size={16} className="text-muted shrink-0" />
                    : <ChevronDown size={16} className="text-muted shrink-0" />
                  }
                </button>
                <p className="font-mono text-[10px] text-muted uppercase tracking-widest mt-0.5 truncate">
                  OPERATOR: {profile?.full_name || 'CHIRAG'} // LV.{currentLevel} // {currentArc.flavor}
                </p>
              </div>
            </div>

            {/* CENTER: Level XP progress bar */}
            <div className="flex-1 min-w-[180px] max-w-sm">
              <div className="flex justify-between font-mono text-[10px] text-muted mb-1.5">
                <span>LV.{currentLevel}</span>
                <span style={{ color: arcColor }}>{xpInLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP</span>
                <span>LV.{currentLevel + 1}</span>
              </div>
              <div className="h-2 w-full bg-bg-primary border border-border-color overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{ background: arcColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${levelPct}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
              <div className="font-mono text-[9px] text-muted mt-1 text-center">
                {xpNeededForNextLevel.toLocaleString()} XP to LV.{currentLevel + 1}
              </div>
            </div>

            {/* RIGHT: Live clock */}
            <div className="text-right shrink-0">
              <div className="font-mono text-3xl font-bold text-primary tracking-tighter">
                {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="font-mono text-[10px] text-muted tracking-widest uppercase mt-1">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MODULE 2: ARC ROADMAP PANEL (expandable)                        */}
        {/* Data: RANK_CONFIG (static) + profile.total_xp for lock/unlock   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {arcExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <HudPanel>
                <div className="flex items-center justify-between mb-5">
                  <span className="font-display text-sm uppercase tracking-widest" style={{ color: arcColor }}>
                    CHARACTER ARC ROADMAP
                  </span>
                  <button
                    onClick={() => setArcExpanded(false)}
                    className="font-mono text-[10px] text-muted hover:text-primary transition-colors"
                  >
                    COLLAPSE ↑
                  </button>
                </div>

                <div className="relative">
                  {/* Vertical connector line */}
                  <div className="absolute left-[22px] top-4 bottom-4 w-px bg-border-color" />

                  <div className="flex flex-col gap-1">
                    {ARC_CONFIG.map((arc) => {
                      const rankData = RANK_CONFIG[arc.rank]
                      if (!rankData) return null

                      // A rank is cleared if totalXp exceeds its maxXp threshold
                      const isCleared = totalXp > rankData.maxXp && rankData.maxXp < 9000000
                      const isCurrent = currentRank.code === arc.rank
                      const isLocked  = totalXp < rankData.minXp
                      const xpNeeded  = isLocked ? rankData.minXp - totalXp : 0

                      return (
                        <div
                          key={arc.rank}
                          className={`relative flex items-start gap-4 pl-14 py-3 transition-opacity ${
                            isCurrent ? 'opacity-100' : isCleared ? 'opacity-70' : 'opacity-35'
                          }`}
                        >
                          {/* Timeline node */}
                          <div
                            className="absolute left-[11px] top-4 w-[24px] h-[24px] border-2 flex items-center justify-center shrink-0"
                            style={{
                              borderColor: isCurrent ? rankData.color : isCleared ? '#22c55e' : 'var(--border-color)',
                              background:  isCurrent ? `${rankData.color}20` : 'var(--bg-primary)',
                              boxShadow:   isCurrent ? `0 0 12px ${rankData.color}60` : 'none',
                            }}
                          >
                            {isCleared && <Check size={12} color="#22c55e" strokeWidth={3} />}
                            {isCurrent && (
                              <motion.div
                                className="w-2 h-2 rounded-full"
                                style={{ background: rankData.color }}
                                animate={{ opacity: [1, 0.4, 1] }}
                                transition={{ repeat: Infinity, duration: 1.4 }}
                              />
                            )}
                            {isLocked && <Lock size={10} color="var(--text-muted)" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <span
                                className="font-display text-base font-bold"
                                style={{ color: isCurrent ? rankData.color : 'var(--text-primary)' }}
                              >
                                {arc.name.toUpperCase()}
                              </span>
                              <span
                                className="font-mono text-[9px] px-1.5 py-0.5 border uppercase shrink-0"
                                style={{ color: rankData.color, borderColor: rankData.color }}
                              >
                                {arc.rank}-RANK
                              </span>
                              {isCleared && <span className="font-mono text-[9px] text-success">✓ CLEARED</span>}
                              {isCurrent && (
                                <motion.span
                                  className="font-mono text-[9px]"
                                  style={{ color: rankData.color }}
                                  animate={{ opacity: [1, 0.5, 1] }}
                                  transition={{ repeat: Infinity, duration: 1.5 }}
                                >
                                  ● ACTIVE ARC
                                </motion.span>
                              )}
                            </div>

                            <p className="font-mono text-[10px] text-muted italic">{arc.flavor}</p>

                            <div
                              className="font-mono text-[9px] mt-1"
                              style={{
                                color: isLocked
                                  ? 'var(--text-muted)'
                                  : isCleared
                                  ? 'var(--success)'
                                  : rankData.color,
                              }}
                            >
                              {isLocked
                                ? `🔒 ${xpNeeded.toLocaleString()} XP needed to unlock`
                                : isCurrent
                                ? `${rankData.minXp.toLocaleString()} – ${rankData.maxXp.toLocaleString()} XP range`
                                : `✓ Completed ${rankData.minXp.toLocaleString()} – ${rankData.maxXp.toLocaleString()} XP`}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </HudPanel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MAIN BENTO GRID                                                 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="bento-grid">

          {/* ── LEFT COLUMN (8 cols on desktop) ─────────────────────────── */}
          <div className="bento-col-8 flex flex-col gap-6">

            {/* MODULE 3: THREAT MATRIX (IntelligenceFeed — zero logic change) */}
            <IntelligenceFeed />

            {/* MODULE 4: ACTIVE OBJECTIVE */}
            {/* Data: mainQuest from OSContext (goals.mainQuest) */}
            {mainQuest ? (
              <HudPanel
                className="relative overflow-hidden border-info-subtle bg-gradient-to-br from-bg-tertiary to-bg-primary"
                style={{ minHeight: '160px' }}
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-info opacity-10 blur-[100px] rounded-full pointer-events-none" />
                <div className="flex-between mb-4 relative z-10">
                  <span className="font-mono text-xs text-info flex items-center gap-2">
                    <Target size={14} /> ACTIVE OBJECTIVE
                  </span>
                  <span className="badge badge-info animate-pulse">EXECUTING</span>
                </div>
                <div className="relative z-10">
                  <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-primary mb-2 leading-tight">
                    {mainQuest.title}
                  </h2>
                  <p className="font-mono text-sm text-secondary mb-6 max-w-2xl">
                    {mainQuest.description || 'Execution phase initialized.'}
                  </p>
                  <TacticalProgress value={mainQuest.progress} max={100} label="MISSION COMPLETION" showValue color="var(--info)" />
                </div>
              </HudPanel>
            ) : (
              <HudPanel className="border-border-color">
                <div className="flex-center flex-col h-full opacity-50 py-8">
                  <AlertTriangle size={32} className="text-muted mb-2" />
                  <span className="font-mono text-sm">NO ACTIVE DIRECTIVES</span>
                  <Link href="/goals" className="btn btn-primary btn-sm mt-4">ASSIGN MISSION</Link>
                </div>
              </HudPanel>
            )}

            {/* MODULE 8: 7-DAY EXECUTION HEATMAP */}
            {/* Data: habit_logs (last 7 days), columns: date, status */}
            <HudPanel>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[10px] text-muted uppercase tracking-widest flex items-center gap-2">
                  <Cpu size={10} /> 7-DAY EXECUTION RECORD
                </span>
                <Link href="/quests" className="font-mono text-[9px] text-muted hover:text-primary transition-colors">
                  DAILY OPS →
                </Link>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {heatmap.length > 0
                  ? heatmap.map((day) => (
                      <div key={day.dateStr} className="flex flex-col items-center gap-1.5">
                        <span className="font-mono text-[8px] text-muted">{day.label}</span>
                        <div
                          className="w-full rounded-sm border transition-all"
                          style={{
                            aspectRatio: '1',
                            background: day.isToday
                              ? `${arcColor}25`
                              : day.hasCompleted
                              ? '#22c55e25'
                              : day.allBlocked
                              ? 'transparent'
                              : 'var(--danger-subtle)',
                            borderColor: day.isToday
                              ? arcColor
                              : day.hasCompleted
                              ? '#22c55e'
                              : day.allBlocked
                              ? 'var(--border-color)'
                              : 'var(--danger)',
                          }}
                          title={`${day.dateStr} — ${day.hasCompleted ? 'Active' : day.allBlocked ? 'Rest Day' : 'Missed'}`}
                        />
                        {day.isToday && (
                          <div className="w-1 h-1 rounded-full" style={{ background: arcColor }} />
                        )}
                      </div>
                    ))
                  : Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <span className="font-mono text-[8px] text-muted">---</span>
                        <div className="w-full rounded-sm border border-border-color bg-bg-tertiary" style={{ aspectRatio: '1' }} />
                      </div>
                    ))
                }
              </div>
              <div className="flex gap-4 mt-3">
                <span className="font-mono text-[8px] text-muted flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm bg-success opacity-60" /> Active
                </span>
                <span className="font-mono text-[8px] text-muted flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm bg-danger opacity-60" /> Missed
                </span>
                <span className="font-mono text-[8px] text-muted flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm border border-border-color" /> Rest
                </span>
              </div>
            </HudPanel>

          </div>

          {/* ── RIGHT SIDEBAR (4 cols on desktop) ───────────────────────── */}
          <div className="bento-col-4 flex flex-col gap-6">

            {/* MODULE 5: XP STAT CARD */}
            {/* Data: profile.total_xp (totalXp), xp_history today sum (xpToday), */}
            {/*        xpToNextLevel() (xpNeededForNextLevel, currentLevel)         */}
            <HudPanel className="arc-border-left">
              <div className="font-mono text-[10px] text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                <Zap size={10} style={{ color: arcColor }} /> XP MATRIX
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div>
                  <div
                    className="font-display text-xl lg:text-2xl font-bold tracking-tighter"
                    style={{ color: arcColor }}
                  >
                    {totalXp.toLocaleString()}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-0.5">TOTAL XP</div>
                </div>
                <div>
                  <div className={`font-display text-xl lg:text-2xl font-bold tracking-tighter ${xpToday > 0 ? 'text-success' : xpToday < 0 ? 'text-danger' : 'text-muted'}`}>
                    {xpToday > 0 ? '+' : ''}{xpToday}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-0.5">TODAY</div>
                </div>
                <div>
                  <div className="font-display text-xl lg:text-2xl font-bold tracking-tighter text-info">
                    {xpNeededForNextLevel.toLocaleString()}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-0.5">TO LV.{currentLevel + 1}</div>
                </div>
              </div>
              <Link
                href="/xp"
                className="font-mono text-[9px] text-muted hover:text-primary transition-colors text-center block border border-border-color py-1.5 hover:border-primary"
              >
                VIEW FULL XP MATRIX →
              </Link>
            </HudPanel>

            {/* MODULE 6: STREAK FIRE COUNTER */}
            {/* Data: profile.current_streak (or profile.streak_days as fallback), */}
            {/*        profile.longest_streak                                        */}
            <HudPanel>
              <div className="font-mono text-[10px] text-muted uppercase tracking-widest mb-3">
                🔥 EXECUTION STREAK
              </div>
              <div className="flex items-end gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Flame size={streakFlameSize} color={streakFlameColor} />
                    <span
                      className="font-display font-bold tracking-tighter"
                      style={{
                        fontSize: currentStreak >= 30 ? '2.5rem' : currentStreak >= 7 ? '2rem' : '1.6rem',
                        color: streakFlameColor,
                      }}
                    >
                      {currentStreak}
                    </span>
                  </div>
                  <div className="font-mono text-[9px] text-muted">CURRENT STREAK</div>
                </div>
                <div className="ml-auto text-right pb-1">
                  <div className="font-mono text-lg font-bold text-muted">{longestStreak}</div>
                  <div className="font-mono text-[8px] text-muted">PERSONAL BEST</div>
                </div>
              </div>

              {/* Milestone progress bar */}
              <div className="relative h-1.5 bg-bg-primary border border-border-color overflow-hidden mb-2">
                <div
                  className="h-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(100, (currentStreak / 100) * 100)}%`,
                    background: `linear-gradient(to right, #ef4444, #f97316, #F59E0B)`,
                  }}
                />
                {/* Milestone markers */}
                <div className="absolute top-0 bottom-0 w-px bg-white opacity-30" style={{ left: '7%' }} />
                <div className="absolute top-0 bottom-0 w-px bg-white opacity-30" style={{ left: '30%' }} />
                <div className="absolute top-0 bottom-0 w-px bg-white opacity-30" style={{ left: '100%', right: 0 }} />
              </div>
              <div className="flex justify-between font-mono text-[8px]">
                <span style={{ color: currentStreak >= 7   ? '#f97316' : 'var(--text-muted)' }}>7d 🔥</span>
                <span style={{ color: currentStreak >= 30  ? '#F59E0B' : 'var(--text-muted)' }}>30d 🔥🔥</span>
                <span style={{ color: currentStreak >= 100 ? '#22c55e' : 'var(--text-muted)' }}>100d 🏆</span>
              </div>
            </HudPanel>

            {/* MODULE 7: DAY PRESSURE CLOCK */}
            {/* Data: currentTime (live clock state, no DB) */}
            <HudPanel>
              <div className="font-mono text-[10px] text-muted uppercase tracking-widest mb-3">⏳ DAY REMAINING</div>
              <div className="flex items-center gap-4">
                {/* SVG circular progress ring */}
                <div className="relative shrink-0" style={{ width: '64px', height: '64px' }}>
                  <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--bg-primary)" strokeWidth="6" />
                    <circle
                      cx="32" cy="32" r="26" fill="none"
                      stroke={dayUrgency === 'danger' ? 'var(--danger)' : dayUrgency === 'warning' ? 'var(--warning)' : arcColor}
                      strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - dayPct / 100)}`}
                      strokeLinecap="butt"
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-[10px] font-bold text-primary">{dayPct}%</span>
                  </div>
                </div>

                <div>
                  <div className="font-display text-2xl font-bold text-primary">
                    {hoursLeft}<span className="text-sm text-muted font-mono">h</span>
                  </div>
                  <div className="font-mono text-[9px] text-muted">HOURS LEFT TODAY</div>
                  <div
                    className="font-mono text-[8px] mt-1.5"
                    style={{
                      color: dayUrgency === 'danger'
                        ? 'var(--danger)'
                        : dayUrgency === 'warning'
                        ? 'var(--warning)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {dayUrgency === 'danger'
                      ? '⚠ CRITICAL — EXECUTE NOW'
                      : dayUrgency === 'warning'
                      ? 'WINDOW CLOSING'
                      : 'TIME ON YOUR SIDE'}
                  </div>
                </div>
              </div>
            </HudPanel>

            {/* Weekly Debrief link */}
            {new Date().getDay() === 0 ? (
              <Link href="/weekly-review">
                <div className="bg-amber/10 border border-amber hover:bg-amber/20 transition-colors p-4 cursor-pointer text-center">
                  <h3 className="font-display text-base text-amber tracking-widest uppercase flex-center gap-2">
                    <ClipboardList size={16} /> CONDUCT WEEKLY DEBRIEF
                  </h3>
                  <p className="font-mono text-xs text-amber/80 mt-1">Reflect on the past 7 days to earn +40 XP.</p>
                </div>
              </Link>
            ) : (
              <Link href="/weekly-review">
                <div className="bg-tertiary border border-border-color hover:border-amber transition-colors p-3 cursor-pointer text-center group">
                  <h3 className="font-mono text-xs text-muted group-hover:text-amber tracking-widest uppercase flex-center gap-2">
                    <ClipboardList size={13} /> WEEKLY DEBRIEF
                  </h3>
                </div>
              </Link>
            )}

            {/* MODULE 9: WAR ROOM — Active Battles */}
            {/* Data: user_blueprints.battles (fetched above), hp per battle */}
            {battles.length > 0 && (
              <HudPanel className="border-danger-subtle">
                <div className="font-mono text-[10px] text-danger uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Swords size={10} /> ACTIVE BATTLES
                </div>
                <div className="flex-col gap-3">
                  {battles.map((battle, idx) => {
                    const Icon        = BATTLE_ICONS[battle.name] || Swords
                    const hp          = battle.hp ?? 100
                    const isCritical  = hp > 75
                    const isDangerous = hp > 50
                    const sevColor    = SEVERITY_COLORS[battle.severity] || 'var(--info)'

                    return (
                      <div
                        key={idx}
                        className="relative p-3 bg-tertiary border border-border-color overflow-hidden hover:border-danger transition-colors"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: sevColor }} />
                        <div className="flex-between mb-2 pl-2">
                          <div className="flex items-center gap-2">
                            <Icon size={13} style={{ color: sevColor }} />
                            <span className="font-mono text-xs text-primary">{battle.name}</span>
                          </div>
                          <span className="font-mono text-[9px] font-bold" style={{ color: isCritical ? 'var(--danger)' : 'var(--warning)' }}>
                            {hp} HP
                          </span>
                        </div>

                        <div className="pl-2">
                          <div className="h-1.5 w-full bg-bg-primary overflow-hidden">
                            <motion.div
                              className="h-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, hp))}%`,
                                background: isCritical ? 'var(--danger)' : isDangerous ? 'var(--warning)' : 'var(--success)',
                              }}
                              animate={isCritical ? { opacity: [1, 0.45, 1] } : {}}
                              transition={isCritical ? { repeat: Infinity, duration: 1.4 } : {}}
                            />
                          </div>
                          <div
                            className="font-mono text-[8px] mt-1"
                            style={{
                              color: isCritical
                                ? 'var(--danger)'
                                : isDangerous
                                ? 'var(--warning)'
                                : 'var(--success)',
                            }}
                          >
                            {isCritical
                              ? '⚠ ENEMY WINNING — ROUTINES FAILING'
                              : isDangerous
                              ? 'CONTESTED — HOLD THE LINE'
                              : '✓ WINNING — MAINTAIN PRESSURE'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <Link
                    href="/profile"
                    className="font-mono text-[10px] text-muted hover:text-primary hover:underline text-center transition-colors mt-1 block"
                  >
                    MANAGE BATTLES →
                  </Link>
                </div>
              </HudPanel>
            )}

          </div>
        </div>
      </div>
    </AppShell>
  )
}
