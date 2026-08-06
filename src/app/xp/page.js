'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr } from '@/lib/utils/dates'
import { calculateLevel, xpForLevel, getRankForXp } from '@/lib/utils/xp'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, CartesianGrid, ReferenceLine } from 'recharts'
import { Flame, Star, Activity, Trophy, ArrowUp, RotateCcw } from 'lucide-react'
import { RANK_CONFIG } from '@/lib/constants'
import { cleanupAllDuplicateXP } from '@/lib/utils/xpFallback'

// Custom Glassmorphic Tooltip for XP Timeline
function CustomXpTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const total = payload.find(p => p.dataKey === 'total')?.value || 0
    const dailyGain = payload.find(p => p.dataKey === 'dailyGain')?.value || 0
    const isPositive = dailyGain >= 0

    return (
      <div className="p-3 bg-bg-secondary/98 border border-border-color rounded-xl shadow-2xl backdrop-blur-md font-mono text-xs space-y-2 min-w-[160px]" style={{ boxShadow: '0 0 24px rgba(0,0,0,0.6)' }}>
        <div className="font-display font-bold text-primary border-b border-border-color pb-1.5">
          {label}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted">Cumulative XP</span>
          <span className="font-bold text-primary">{total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted">Day Earned</span>
          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${isPositive ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            {isPositive ? '+' : ''}{dailyGain} XP
          </span>
        </div>
      </div>
    )
  }
  return null
}

export default function XPDashboard() {
  const { user } = useAuth()
  const [timeline, setTimeline] = useState([])
  const [totalXp, setTotalXp] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const supabase = createClient()
      
      // Auto-clean any invisible duplicate XP entries for sleep/weight
      const cleaned = await cleanupAllDuplicateXP(user.id)
      if (cleaned > 0) console.log(`Cleaned ${cleaned} duplicate XP entries`)

      const { data: profile } = await supabase.from('profiles').select('total_xp').eq('id', user.id).single()
      if (profile) setTotalXp(profile.total_xp || 0)

      const { data: history } = await supabase.from('xp_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      if (history) setTimeline(history)

      setLoading(false)
    }
    fetchData()
  }, [user])

  const handleResetXP = async () => {
    if (!confirm('WARNING: PROTOCOL OVERRIDE. This will permanently wipe all XP history, timeline events, and reset your total XP to 0. Proceed?')) return
    
    setLoading(true)
    const supabase = createClient()
    
    await supabase.from('profiles').update({ total_xp: 0 }).eq('id', user.id)
    await supabase.from('xp_history').delete().eq('user_id', user.id)
    await supabase.from('habit_logs').delete().eq('user_id', user.id)
    
    localStorage.setItem('last_reset_date', getLocalDateStr(new Date()))
    localStorage.removeItem('daily_ops_autofail_ran_today')
    
    window.location.reload()
  }

  const handleFixDuplicates = async () => {
    setLoading(true)
    const cleanedCount = await cleanupAllDuplicateXP(user.id)
    if (cleanedCount > 0) {
      alert(`Cleanup Complete: Successfully purged ${cleanedCount} duplicate XP entries and updated your profile XP.`)
    } else {
      alert('No duplicate XP entries found!')
    }
    window.location.reload()
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING NEURAL NETWORK...</span></div></AppShell>

  // Stats computation
  const currentLevel = calculateLevel(totalXp)
  const currentLevelXp = xpForLevel(currentLevel)
  const nextLevelXp = xpForLevel(currentLevel + 1)
  const required = nextLevelXp - currentLevelXp
  const current = totalXp - currentLevelXp
  const progressPct = required > 0 ? Math.min((current / required) * 100, 100) : 100

  const currentRank = getRankForXp(totalXp)

  // STAT DISTRIBUTION Calculations
  const STAT_CONFIG = [
    { key: 'founder', label: 'FOUNDER', icon: '👑', color: '#f59e0b' },
    { key: 'discipline', label: 'DISCIPLINE', icon: '⚡', color: '#22c55e' },
    { key: 'communication', label: 'COMMUNICATION', icon: '💬', color: '#38bdf8' },
    { key: 'learning', label: 'LEARNING', icon: '🧠', color: '#a855f7' },
    { key: 'creation', label: 'CREATION', icon: '🎨', color: '#ec4899' },
    { key: 'strength', label: 'STRENGTH', icon: '💪', color: '#ef4444' }
  ]

  const statBreakdown = STAT_CONFIG.map(cfg => {
    const amount = timeline.filter(t => (t.stat_category || '').toLowerCase() === cfg.key && t.amount > 0).reduce((acc, curr) => acc + curr.amount, 0)
    return { ...cfg, amount }
  })

  const maxStatXp = Math.max(...statBreakdown.map(s => s.amount), 100)
  const dominantStat = statBreakdown.reduce((max, s) => s.amount > max.amount ? s : max, statBreakdown[0])

  const radarData = STAT_CONFIG.map(cfg => {
    const statObj = statBreakdown.find(s => s.key === cfg.key)
    return { subject: cfg.label, A: statObj ? statObj.amount : 0, fullMark: 1000 }
  })

  // Timeline Area Chart Data (aggregate by day)
  const timelineMap = {}
  timeline.forEach(item => {
    const d = getLocalDateStr(new Date(item.created_at))
    if (!timelineMap[d]) timelineMap[d] = 0
    timelineMap[d] += item.amount
  })
  
  // Create last 14 days array
  const last14Days = Array.from({length: 14}, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return getLocalDateStr(d)
  })

  // Calculate starting cumulative XP prior to the 14-day window
  const sum14Days = last14Days.reduce((acc, d) => acc + (timelineMap[d] || 0), 0)
  let runningTotal = Math.max(0, totalXp - sum14Days)

  const areaData = last14Days.map(d => {
    runningTotal += (timelineMap[d] || 0)
    return {
      date: d.substring(5).replace('-', '/'),
      dailyGain: timelineMap[d] || 0,
      total: Math.max(0, runningTotal)
    }
  })

  // Calculate actual days tracked since first activity (or reset)
  let daysTracked = 1
  if (timeline.length > 0) {
    const firstDateStr = getLocalDateStr(new Date(timeline[0].created_at))
    const firstDate = new Date(firstDateStr)
    const today = new Date(getLocalDateStr(new Date()))
    const diffTime = Math.abs(today - firstDate)
    daysTracked = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <AppShell>
      <div className="page-container" style={{ maxWidth: '1400px' }}>
        <header className="page-header mb-8 flex items-start justify-between">
          <div>
            <h1 className="page-title flex items-center gap-3"><Trophy className="text-amber" /> EXPERIENCE METRICS</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Visualize your character progression and stat distribution.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleFixDuplicates}
              className="px-3 py-1.5 border border-info text-info text-xs font-mono uppercase tracking-widest hover:bg-info/10 rounded flex items-center gap-2 transition-colors mt-1"
            >
              <Activity size={14} /> FIX DUPLICATES
            </button>
            <button 
              onClick={handleResetXP}
              className="px-3 py-1.5 border border-danger text-danger text-xs font-mono uppercase tracking-widest hover:bg-danger/10 rounded flex items-center gap-2 transition-colors mt-1"
            >
              <RotateCcw size={14} /> Full Reset
            </button>
          </div>
        </header>

        {/* Level Up Banner / Core Stats */}
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-bg-tertiary to-transparent z-0" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 opacity-15 blur-[120px] pointer-events-none" style={{ background: currentRank.color }} />
          
          <HudPanel className="relative z-10 p-8 md:p-10 flex flex-col items-center text-center" style={{ borderColor: `${currentRank.color}50` }}>
            
            {/* Glowing Progress Wave */}
            <div className="relative w-full max-w-2xl mb-2" style={{ height: '160px' }}>

              {/* The wave SVG */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 600 160"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={currentRank.color} stopOpacity="0.30" />
                    <stop offset="100%" stopColor={currentRank.color} stopOpacity="0" />
                  </linearGradient>
                  <filter id="glowDot" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="lineGlow" x="-20%" y="-100%" width="140%" height="300%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Fill area under curve */}
                <motion.path
                  d="M0,140 C80,140 160,135 230,115 C280,100 310,60 340,28 C360,12 380,20 410,55 C450,100 510,138 600,140 L600,160 L0,160 Z"
                  fill="url(#waveGrad)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.2 }}
                />

                {/* Main curve line */}
                <motion.path
                  d="M0,140 C80,140 160,135 230,115 C280,100 310,60 340,28 C360,12 380,20 410,55 C450,100 510,138 600,140"
                  fill="none"
                  stroke={currentRank.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#lineGlow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />

                {/* Bright apex dot */}
                <motion.circle
                  cx="340" cy="28" r="6"
                  fill="#ffffff"
                  filter="url(#glowDot)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.5, duration: 0.5, ease: "easeOut" }}
                />

                {/* Colored outer glow ring at apex */}
                <motion.circle
                  cx="340" cy="28" r="11"
                  fill="none"
                  stroke={currentRank.color}
                  strokeWidth="1.5"
                  filter="url(#glowDot)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 1.6, duration: 0.5 }}
                />
              </svg>
            </div>

            {/* Level Title & Rank Subtitle */}
            <h2 className="font-display text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1">
              Level {currentLevel}
            </h2>
            <span className="font-mono text-xs uppercase tracking-[0.35em] font-semibold text-muted mb-8">
              {currentRank.name}
            </span>

            {/* Progress Card (Matching Reference Image) */}
            <div className="w-full max-w-2xl bg-bg-primary/80 border border-border-color rounded-2xl p-6 shadow-2xl backdrop-blur-md mb-8 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${currentRank.color}20`, border: `1px solid ${currentRank.color}40` }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L22 12L12 22L2 12L12 2Z" fill={currentRank.color} />
                    </svg>
                  </div>
                  <span className="font-display text-lg font-bold text-white">Level {currentLevel}</span>
                </div>
                <span className="font-mono text-xs font-bold text-muted tracking-wider">{current} / {required} XP</span>
              </div>

              <div className="mb-4">
                <TacticalProgress value={progressPct} height={8} showValue={false} color={currentRank.color} />
              </div>

              <p className="font-mono text-xs text-muted leading-relaxed">
                {currentRank.flavor || "You are proficient in executing daily disciplines, completing missions, and maintaining high operational performance."}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
              <div className="bg-bg-tertiary border border-border-color p-4 rounded-xl flex flex-col items-center text-center">
                <span className="font-display text-2xl text-success font-bold">{timeline.filter(t => t.amount > 0).length}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">POSITIVE ACTIONS</span>
              </div>
              <div className="bg-bg-tertiary border border-border-color p-4 rounded-xl flex flex-col items-center text-center">
                <span className="font-display text-2xl text-danger font-bold">{timeline.filter(t => t.amount < 0).length}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">PENALTIES</span>
              </div>
              <div className="bg-bg-tertiary border border-border-color p-4 rounded-xl flex flex-col items-center text-center">
                <span className="font-display text-2xl text-info font-bold">{daysTracked}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">DAYS TRACKED</span>
              </div>
            </div>

          </HudPanel>
        </motion.div>

        {/* XP TRAJECTORY — Unified Single Chart */}
        <div className="w-full">
          <HudPanel label="" glow className="p-0 overflow-hidden">
            {/* Chart Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: currentRank.color, boxShadow: `0 0 8px ${currentRank.color}` }} />
                <span className="font-mono text-xs uppercase tracking-widest text-muted font-bold">XP TRAJECTORY — 14-DAY INTELLIGENCE</span>
              </div>
              <div className="flex items-center gap-4 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-success">
                  <span className="inline-block w-3 h-0.5 bg-success rounded" />
                  Daily Gain
                </span>
                <span className="flex items-center gap-1.5" style={{ color: currentRank.color }}>
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: currentRank.color }} />
                  Cumulative XP
                </span>
              </div>
            </div>

            {/* Daily delta chips */}
            <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto">
              {areaData.map((d, i) => (
                <div
                  key={i}
                  className="shrink-0 px-2 py-1 rounded-md font-mono text-[9px] font-bold border"
                  style={{
                    background: d.dailyGain > 0 ? 'rgba(34,197,94,0.12)' : d.dailyGain < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                    borderColor: d.dailyGain > 0 ? 'rgba(34,197,94,0.35)' : d.dailyGain < 0 ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.1)',
                    color: d.dailyGain > 0 ? '#22c55e' : d.dailyGain < 0 ? '#ef4444' : 'var(--text-muted)'
                  }}
                >
                  {d.date}<br />
                  {d.dailyGain > 0 ? '+' : ''}{d.dailyGain}
                </div>
              ))}
            </div>

            {/* The Chart */}
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="xpGradMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={currentRank.color} stopOpacity={0.5} />
                      <stop offset="60%" stopColor={currentRank.color} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={currentRank.color} stopOpacity={0} />
                    </linearGradient>
                    <filter id="xpGlow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="var(--font-mono)"
                    tick={{ fill: 'var(--text-muted)' }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="var(--font-mono)"
                    tick={{ fill: 'var(--text-muted)' }}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                    width={45}
                  />
                  <Tooltip
                    content={<CustomXpTooltip />}
                    cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeDasharray: '4 4', strokeWidth: 1 }}
                  />
                  {/* Hidden dailyGain area just for tooltip data */}
                  <Area
                    type="monotone"
                    dataKey="dailyGain"
                    stroke="transparent"
                    fill="transparent"
                    strokeWidth={0}
                  />
                  {/* Main cumulative XP area */}
                  <Area
                    type="monotonex"
                    dataKey="total"
                    stroke={currentRank.color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#xpGradMain)"
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      const isToday = payload.date === areaData[areaData.length - 1]?.date
                      return (
                        <circle
                          key={payload.date}
                          cx={cx}
                          cy={cy}
                          r={isToday ? 6 : 3.5}
                          fill={isToday ? '#fff' : currentRank.color}
                          stroke={currentRank.color}
                          strokeWidth={isToday ? 2.5 : 1}
                          filter={isToday ? 'url(#xpGlow)' : 'none'}
                        />
                      )
                    }}
                    activeDot={{ r: 7, fill: currentRank.color, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>
        </div>

        {/* FULL ACTIVITY TIMELINE */}
        <div className="mt-8">
          <HudPanel label="FULL ACTIVITY LOG">
            <div className="flex-col gap-0 max-h-[600px] overflow-y-auto pr-4">
              {timeline.slice().reverse().map((item, i) => (
                <div key={item.id} className="relative pl-6 py-4 border-l border-border-strong group hover:border-info transition-colors border-b border-border-color last:border-b-0">
                  <div className="absolute left-[-4.5px] top-5 w-2 h-2 rounded-full bg-border-color group-hover:bg-info transition-colors" />
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-mono text-sm text-primary">{item.description}</div>
                    <span className={`font-mono text-sm font-bold ${item.amount > 0 ? 'text-success' : item.amount < 0 ? 'text-danger' : 'text-muted'}`}>
                      {item.amount > 0 ? '+' : ''}{item.amount} XP
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted flex gap-3">
                    <span>{new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}</span>
                    <span className="uppercase text-amber">{item.stat_category || 'GENERAL'}</span>
                  </div>
                </div>
              ))}
              {timeline.length === 0 && <div className="font-mono text-sm text-muted py-8 text-center">NO ACTIVITY LOGS ARCHIVED.</div>}
            </div>
          </HudPanel>
        </div>

      </div>
    </AppShell>
  )
}
