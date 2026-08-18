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
import { AreaChart, Area, BarChart, Bar, Cell, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, CartesianGrid, ReferenceLine } from 'recharts'
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
  const [chartViewMode, setChartViewMode] = useState('cumulative') // 'cumulative' | 'daily' | 'both'
  const [logFilterMode, setLogFilterMode] = useState('all') // 'all' | 'additions' | 'deductions'
  const [logSearch, setLogSearch] = useState('')

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

  const minTotal = Math.min(...areaData.map(d => d.total))
  const maxTotal = Math.max(...areaData.map(d => d.total))
  const yMin = Math.max(0, Math.floor((minTotal * 0.85) / 500) * 500)
  const yMax = Math.ceil((maxTotal * 1.05) / 500) * 500

  const dailyGains = areaData.map(d => d.dailyGain)
  const minDaily = Math.min(...dailyGains, 0)
  const maxDaily = Math.max(...dailyGains, 100)
  const yMinDaily = Math.floor((minDaily < 0 ? minDaily * 1.2 : minDaily) / 50) * 50
  const yMaxDaily = Math.ceil((maxDaily * 1.2) / 50) * 50

  // Calculate actual days tracked since first activity (or reset)
  let daysTracked = 1
  if (timeline.length > 0) {
    const firstDateStr = getLocalDateStr(new Date(timeline[0].created_at))
    const firstDate = new Date(firstDateStr)
    const today = new Date(getLocalDateStr(new Date()))
    const diffTime = Math.abs(today - firstDate)
    daysTracked = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  // Filtered timeline logs
  const filteredTimeline = timeline.slice().reverse().filter(item => {
    if (logFilterMode === 'additions' && item.amount <= 0) return false
    if (logFilterMode === 'deductions' && item.amount >= 0) return false
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase()
      const desc = (item.description || '').toLowerCase()
      const cat = (item.stat_category || '').toLowerCase()
      const src = (item.source_type || '').toLowerCase()
      return desc.includes(q) || cat.includes(q) || src.includes(q)
    }
    return true
  })

  const positiveCount = timeline.filter(t => t.amount > 0).length
  const deductionCount = timeline.filter(t => t.amount < 0).length

  return (
    <AppShell>
      <div className="page-container" style={{ maxWidth: '1400px' }}>
        <header className="page-header mb-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="page-title flex items-center justify-center gap-3"><Trophy className="text-amber" /> EXPERIENCE METRICS</h1>
            <p className="page-subtitle font-mono uppercase text-xs text-center max-w-xl mx-auto mt-1">Visualize your character progression, minute-to-minute XP activity timeline, and stat distribution.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button 
              onClick={handleFixDuplicates}
              className="px-3.5 py-1.5 border border-info text-info text-xs font-mono uppercase tracking-widest hover:bg-info/10 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <Activity size={14} /> PURGE & SYNC
            </button>
            <button 
              onClick={handleResetXP}
              className="px-3.5 py-1.5 border border-danger text-danger text-xs font-mono uppercase tracking-widest hover:bg-danger/10 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw size={14} /> Full Reset
            </button>
          </div>
        </header>

        {/* Level Up Banner / Core Stats */}
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6 sm:mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-bg-tertiary to-transparent z-0" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 opacity-15 blur-[120px] pointer-events-none" style={{ background: currentRank.color }} />
          
          <HudPanel className="relative z-10 p-5 sm:p-8 flex flex-col items-center text-center space-y-6" style={{ borderColor: `${currentRank.color}50` }}>
            
            {/* Clean Top Header Card (NO CIRCLES OR SVG WAVES) */}
            <div className="w-full max-w-2xl text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 font-mono text-[10px] sm:text-xs text-muted uppercase font-bold tracking-widest">
                <span>SAGA {currentRank.code}</span>
                <span>•</span>
                <span style={{ color: currentRank.color }}>LEVEL {currentLevel}</span>
              </div>

              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-primary uppercase">
                {currentRank.name}
              </h2>

              {/* Main XP Counter */}
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <span className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ color: currentRank.color }}>
                  {totalXp.toLocaleString()}
                </span>
                <span className="font-mono text-xs sm:text-sm text-muted font-bold tracking-widest uppercase">
                  TOTAL XP
                </span>
              </div>
            </div>

            {/* Level Progress Card */}
            <div className="w-full max-w-2xl bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md text-left space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: `${currentRank.color}20`, border: `1px solid ${currentRank.color}40` }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L22 12L12 22L2 12L12 2Z" fill={currentRank.color} />
                    </svg>
                  </div>
                  <span className="font-display text-sm sm:text-base font-bold text-white">Level {currentLevel}</span>
                </div>
                <span className="font-mono text-xs font-bold text-muted tracking-wider">{current} / {required} XP</span>
              </div>

              <div>
                <TacticalProgress value={progressPct} height={8} showValue={false} color={currentRank.color} />
              </div>

              <p className="font-mono text-xs text-muted leading-relaxed">
                {currentRank.flavor || "You are proficient in executing daily disciplines, completing missions, and maintaining high operational performance."}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl">
              <div className="bg-bg-tertiary border border-border-color p-3.5 sm:p-4 rounded-xl flex flex-col items-center text-center">
                <span className="font-display text-2xl text-success font-bold">{positiveCount}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">POSITIVE ACTIONS</span>
              </div>
              <div className="bg-bg-tertiary border border-border-color p-3.5 sm:p-4 rounded-xl flex flex-col items-center text-center">
                <span className="font-display text-2xl text-danger font-bold">{deductionCount}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">SUBTRACTIONS & PENALTIES</span>
              </div>
              <div className="bg-bg-tertiary border border-border-color p-3.5 sm:p-4 rounded-xl flex flex-col items-center text-center">
                <span className="font-display text-2xl text-info font-bold">{daysTracked}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">DAYS TRACKED</span>
              </div>
            </div>

          </HudPanel>
        </motion.div>

        {/* XP TRAJECTORY — Sleek Tactical Chart */}
        <div className="w-full">
          <HudPanel label="" glow className="p-0 overflow-hidden">
            {/* Chart Header */}
            <div className="p-4 sm:p-5 border-b border-white/5 space-y-3">
              {/* Top Row: Title + 14-Day Net Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ background: currentRank.color, boxShadow: `0 0 10px ${currentRank.color}` }} />
                  <div className="min-w-0">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-primary font-bold truncate">
                      XP TRAJECTORY — 14-DAY INTELLIGENCE
                    </h3>
                    <p className="font-mono text-[9px] text-muted hidden sm:block mt-0.5">
                      {chartViewMode === 'cumulative' 
                        ? 'Cumulative total progress trajectory' 
                        : chartViewMode === 'daily' 
                        ? 'Daily net XP gain breakdown' 
                        : 'Dual view: Cumulative total & daily net gain'}
                    </p>
                  </div>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border-color font-mono text-[10px] flex items-center gap-1.5 shrink-0">
                  <span className="text-muted uppercase tracking-wider">14-Day Net:</span>
                  <span className={`font-bold ${sum14Days >= 0 ? 'text-success' : 'text-danger'}`}>
                    {sum14Days >= 0 ? '+' : ''}{sum14Days.toLocaleString()} XP
                  </span>
                </div>
              </div>

              {/* Mode Selector Toggle Strip */}
              <div className="grid grid-cols-3 gap-1 bg-black/50 border border-white/10 rounded-xl p-1 font-mono text-[10px] sm:w-fit">
                <button
                  type="button"
                  onClick={() => setChartViewMode('cumulative')}
                  className={`px-2.5 sm:px-4 py-1.5 rounded-lg font-bold uppercase tracking-wider text-center transition-all ${
                    chartViewMode === 'cumulative' 
                      ? 'bg-amber text-black shadow-md' 
                      : 'text-muted hover:text-primary hover:bg-white/5'
                  }`}
                >
                  Cumulative
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('daily')}
                  className={`px-2.5 sm:px-4 py-1.5 rounded-lg font-bold uppercase tracking-wider text-center transition-all ${
                    chartViewMode === 'daily' 
                      ? 'bg-success text-black shadow-md' 
                      : 'text-muted hover:text-primary hover:bg-white/5'
                  }`}
                >
                  Daily Net
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('both')}
                  className={`px-2.5 sm:px-4 py-1.5 rounded-lg font-bold uppercase tracking-wider text-center transition-all ${
                    chartViewMode === 'both' 
                      ? 'bg-info text-black shadow-md' 
                      : 'text-muted hover:text-primary hover:bg-white/5'
                  }`}
                >
                  Both
                </button>
              </div>
            </div>

            {/* The Chart */}
            <div className="p-2 sm:p-4" style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartViewMode === 'cumulative' ? (
                  /* 1. CUMULATIVE AREA CHART */
                  <AreaChart data={areaData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="xpGradMain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={currentRank.color} stopOpacity={0.4} />
                        <stop offset="70%" stopColor={currentRank.color} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={currentRank.color} stopOpacity={0} />
                      </linearGradient>
                      <filter id="xpGlow">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="var(--font-mono)"
                      tick={{ fill: 'var(--text-muted)' }}
                      minTickGap={15}
                      dy={5}
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="var(--font-mono)"
                      tick={{ fill: 'var(--text-muted)' }}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                      width={38}
                    />
                    <Tooltip
                      content={<CustomXpTooltip />}
                      cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeDasharray: '4 4', strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke={currentRank.color}
                      strokeWidth={3}
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
                            r={isToday ? 5 : 3}
                            fill={isToday ? '#fff' : currentRank.color}
                            stroke={currentRank.color}
                            strokeWidth={isToday ? 2 : 1}
                            filter={isToday ? 'url(#xpGlow)' : 'none'}
                          />
                        )
                      }}
                      activeDot={{ r: 6, fill: currentRank.color, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                ) : chartViewMode === 'daily' ? (
                  /* 2. DAILY NET GAIN BAR CHART */
                  <BarChart data={areaData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="var(--font-mono)"
                      tick={{ fill: 'var(--text-muted)' }}
                      minTickGap={15}
                      dy={5}
                    />
                    <YAxis
                      domain={[yMinDaily, yMaxDaily]}
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="var(--font-mono)"
                      tick={{ fill: 'var(--text-muted)' }}
                      tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v}`}
                      width={38}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 2" />
                    <Tooltip
                      content={<CustomXpTooltip />}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="dailyGain" radius={[4, 4, 0, 0]}>
                      {areaData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.dailyGain >= 0 ? 'rgba(34,197,94,0.65)' : 'rgba(239,68,68,0.65)'}
                          stroke={entry.dailyGain >= 0 ? '#22c55e' : '#ef4444'}
                          strokeWidth={1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  /* 3. BOTH / DUAL-AXIS COMPOSED CHART */
                  <ComposedChart data={areaData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="xpGradMain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={currentRank.color} stopOpacity={0.35} />
                        <stop offset="70%" stopColor={currentRank.color} stopOpacity={0.05} />
                        <stop offset="100%" stopColor={currentRank.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="var(--font-mono)"
                      tick={{ fill: 'var(--text-muted)' }}
                      minTickGap={15}
                      dy={5}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[yMin, yMax]}
                      stroke={currentRank.color}
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="var(--font-mono)"
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                      width={38}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[yMinDaily, yMaxDaily]}
                      stroke="#22c55e"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="var(--font-mono)"
                      tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v}`}
                      width={38}
                    />
                    <Tooltip
                      content={<CustomXpTooltip />}
                      cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeDasharray: '4 4', strokeWidth: 1 }}
                    />
                    <Bar yAxisId="right" dataKey="dailyGain" barSize={12} radius={[3, 3, 0, 0]}>
                      {areaData.map((entry, index) => (
                        <Cell
                          key={`cell-both-${index}`}
                          fill={entry.dailyGain >= 0 ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}
                          stroke={entry.dailyGain >= 0 ? '#22c55e' : '#ef4444'}
                          strokeWidth={1}
                        />
                      ))}
                    </Bar>
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="total"
                      stroke={currentRank.color}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#xpGradMain)"
                      dot={{ fill: currentRank.color, r: 2.5 }}
                      activeDot={{ r: 6, fill: currentRank.color, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </HudPanel>
        </div>

        {/* FULL MINUTE-TO-MINUTE ACTIVITY TIMELINE */}
        <div className="mt-8">
          <HudPanel label="MINUTE-TO-MINUTE XP AUDIT LOG">
            {/* Header Toolbar: Filters & Search */}
            <div className="p-4 border-b border-border-color flex flex-wrap items-center justify-between gap-3 bg-bg-tertiary/50 rounded-t-xl">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-black/40 p-1 border border-border-color rounded-lg font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setLogFilterMode('all')}
                  className={`px-3 py-1 rounded font-bold transition-colors ${logFilterMode === 'all' ? 'bg-amber text-black' : 'text-muted hover:text-primary'}`}
                >
                  ALL ({timeline.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilterMode('additions')}
                  className={`px-3 py-1 rounded font-bold transition-colors ${logFilterMode === 'additions' ? 'bg-success text-black' : 'text-muted hover:text-primary'}`}
                >
                  + ADDITIONS ({positiveCount})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilterMode('deductions')}
                  className={`px-3 py-1 rounded font-bold transition-colors ${logFilterMode === 'deductions' ? 'bg-danger text-black' : 'text-muted hover:text-primary'}`}
                >
                  - SUBTRACTIONS ({deductionCount})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filter by keyword..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full bg-black/50 border border-border-color rounded-lg px-3 py-1.5 text-xs font-mono text-primary placeholder:text-muted focus:outline-none focus:border-amber transition-colors"
                />
                {logSearch && (
                  <button
                    onClick={() => setLogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-primary font-mono"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Timeline Stream (Smooth natural scroll on phone, fixed container on desktop) */}
            <div className="flex flex-col gap-0 sm:max-h-[650px] sm:overflow-y-auto touch-pan-y divide-y divide-border-color">
              {filteredTimeline.map((item) => {
                const isPositive = item.amount > 0
                const isNegative = item.amount < 0
                const dt = item.created_at ? new Date(item.created_at) : new Date()
                
                // Format exact minute and second timestamp
                const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

                return (
                  <div 
                    key={item.id} 
                    className="px-4 py-3.5 hover:bg-white/[0.04] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 font-mono border-b border-border-color/60"
                  >
                    {/* Left & Main Content Block */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      {/* Indicator Dot */}
                      <div 
                        className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 sm:mt-0 ${
                          isPositive 
                            ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                            : isNegative 
                            ? 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.6)]' 
                            : 'bg-muted'
                        }`} 
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 min-w-0 flex-1">
                        {/* LINE 1 ON PHONE: Task / Activity Description */}
                        <span className="text-primary font-bold text-sm leading-snug break-words whitespace-normal">
                          {typeof item.description === 'string' ? item.description : 'XP Event Logged'}
                        </span>

                        {/* LINE 2 ON PHONE: Date & Time + Badges */}
                        <div className="flex items-center flex-wrap gap-2 text-[11px] sm:text-xs text-muted/80">
                          <span className="font-medium whitespace-nowrap">
                            {dateStr} <span className="text-amber/80 font-bold">{timeStr}</span>
                          </span>

                          {/* Category Badge */}
                          <span className="text-[9px] px-2 py-0.5 rounded uppercase border bg-bg-tertiary border-border-color text-amber font-bold tracking-wider shrink-0">
                            {item.stat_category || 'GENERAL'}
                          </span>

                          {/* Source Badge */}
                          {item.source_type && (
                            <span className="text-[9px] px-2 py-0.5 rounded text-muted bg-white/5 border border-white/10 shrink-0">
                              {item.source_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right XP Amount Pill */}
                    <div className="shrink-0 self-end sm:self-center pt-1 sm:pt-0">
                      <span 
                        className={`text-xs sm:text-sm font-extrabold px-3 py-1 rounded-lg border shadow-md font-mono ${
                          isPositive 
                            ? 'bg-success/15 border-success/40 text-success' 
                            : isNegative 
                            ? 'bg-danger/15 border-danger/40 text-danger' 
                            : 'bg-bg-tertiary border-border-color text-muted'
                        }`}
                      >
                        {isPositive ? `+${item.amount}` : item.amount} XP
                      </span>
                    </div>
                  </div>
                )
              })}

              {filteredTimeline.length === 0 && (
                <div className="font-mono text-xs text-muted py-12 text-center uppercase tracking-widest">
                  {logSearch ? 'No XP events match your search query.' : 'No XP activity logs archived.'}
                </div>
              )}
            </div>
          </HudPanel>
        </div>

      </div>
    </AppShell>
  )
}
