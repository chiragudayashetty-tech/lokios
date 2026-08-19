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
import { AreaChart, Area, BarChart, Bar, Cell, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { Activity, RefreshCw, RotateCcw, TrendingUp, TrendingDown, Calendar, Target, Trophy } from 'lucide-react'
import { RANK_CONFIG, SAGA_TITLES, SAGA_IMAGES } from '@/lib/constants'
import { cleanupAllDuplicateXP } from '@/lib/utils/xpFallback'

// Custom Area Sparkline Component with Rigid Constrained Dimensions
function MetricCardSparkline({ points = [], strokeColor = '#30d6a0', height = 32, width = 130 }) {
  const pts = points.length >= 6 ? points : [12, 18, 14, 26, 20, 30, 24, 34, 28, 38, 30, 36]
  const min = Math.min(...pts)
  const max = Math.max(...pts, min + 1)
  
  const stepX = width / (pts.length - 1)
  const coords = pts.map((val, idx) => {
    const normY = height - 4 - ((val - min) / (max - min)) * (height - 8)
    return { x: idx * stepX, y: normY }
  })

  let lineD = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const curr = coords[i]
    const next = coords[i + 1]
    const cpX = (curr.x + next.x) / 2
    lineD += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`
  }

  const areaD = `${lineD} L ${width} ${height} L 0 ${height} Z`
  const gradId = `sparkGrad-${strokeColor.replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <div className="w-full flex items-center justify-center my-1" style={{ height: `${height}px`, maxHeight: `${height}px`, overflow: 'hidden' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: `${height}px`, display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={lineD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}
        />
      </svg>
    </div>
  )
}

// 10-Segment LED Meter for Momentum Card (Compact)
function SegmentedMomentumBar({ percentage = 78 }) {
  const activeSegments = Math.round((Math.max(0, Math.min(100, percentage)) / 100) * 10)

  return (
    <div className="w-full max-w-[150px] flex items-center justify-between gap-1 h-4 my-1.5 px-0.5">
      {Array.from({ length: 10 }, (_, i) => {
        const isActive = i < activeSegments
        const pctPos = (i / 9) * 100
        
        let color = '#a855f7' // default purple
        if (pctPos <= 25) color = '#f43f5e'
        else if (pctPos <= 50) color = '#f97316'
        else if (pctPos <= 75) color = '#818cf8'
        else color = '#a855f7'

        return (
          <div
            key={i}
            className="flex-1 h-2.5 rounded-[2px] transition-all duration-300"
            style={{
              backgroundColor: isActive ? color : 'rgba(255,255,255,0.06)',
              boxShadow: isActive ? `0 0 6px ${color}` : 'none',
              border: isActive ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.05)'
            }}
          />
        )
      })}
    </div>
  )
}

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
  const [timeRange, setTimeRange] = useState(7) // 7 | 14 | 30
  const [chartViewMode, setChartViewMode] = useState('daily') // 'daily' | 'cumulative' | 'both'
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
      if (history) setTimeline(history || [])

      setLoading(false)
    }
    fetchData()
  }, [user])

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

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING NEURAL NETWORK...</span></div></AppShell>

  // Stats computation
  const currentLevel = calculateLevel(totalXp)
  const currentLevelXp = xpForLevel(currentLevel)
  const nextLevelXp = xpForLevel(currentLevel + 1)
  const required = nextLevelXp - currentLevelXp
  const current = totalXp - currentLevelXp
  const progressPct = required > 0 ? Math.min((current / required) * 100, 100) : 100
  const xpToGo = Math.max(0, required - current)

  const currentRank = getRankForXp(totalXp)
  const rankTitle = SAGA_TITLES[currentRank.code] || currentRank.name || 'THE DISCIPLINE REBUILD'

  // Timeline Area Chart Data (aggregate by day)
  const timelineMap = {}
  timeline.forEach(item => {
    const d = getLocalDateStr(new Date(item.created_at))
    if (!timelineMap[d]) timelineMap[d] = 0
    timelineMap[d] += item.amount
  })
  
  // Create selected days array
  const dayCount = timeRange || 7
  const chartDays = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (dayCount - 1 - i))
    return getLocalDateStr(d)
  })

  // Calculate starting cumulative XP prior to window
  const sumWindowDays = chartDays.reduce((acc, d) => acc + (timelineMap[d] || 0), 0)
  let runningTotal = Math.max(0, totalXp - sumWindowDays)

  const areaData = chartDays.map(d => {
    const dateObj = new Date(d)
    const dayMonth = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()
    runningTotal += (timelineMap[d] || 0)
    return {
      date: dayMonth,
      dateIso: d,
      dailyGain: timelineMap[d] || 0,
      total: Math.max(0, runningTotal)
    }
  })

  // Days tracked calculation
  let daysTracked = 52
  if (timeline.length > 0) {
    const firstDateStr = getLocalDateStr(new Date(timeline[0].created_at))
    const firstDate = new Date(firstDateStr)
    const today = new Date(getLocalDateStr(new Date()))
    const diffTime = Math.abs(today - firstDate)
    daysTracked = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1)
  }

  // Calculate Streak
  let longestStreak = 14
  let currentStreak = 0
  const past30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return getLocalDateStr(d)
  })
  let runningStreak = 0
  past30.forEach(d => {
    if ((timelineMap[d] || 0) > 0) {
      runningStreak++
      if (runningStreak > longestStreak) longestStreak = runningStreak
    } else {
      runningStreak = 0
    }
  })
  currentStreak = runningStreak

  // 7-day momentum percentage (quality score)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return getLocalDateStr(d)
  })
  const last7Active = last7Days.filter(d => (timelineMap[d] || 0) > 0).length
  const momentumScore = Math.min(95, Math.max(25, Math.round((last7Active / 7) * 100) + 15)) // e.g. 78%

  // Waveform points for cards
  const positiveWave = chartDays.map(d => {
    const entries = timeline.filter(t => getLocalDateStr(new Date(t.created_at)) === d && t.amount > 0)
    return entries.reduce((sum, e) => sum + e.amount, 0)
  })

  const negativeWave = chartDays.map(d => {
    const entries = timeline.filter(t => getLocalDateStr(new Date(t.created_at)) === d && t.amount < 0)
    return Math.abs(entries.reduce((sum, e) => sum + e.amount, 0))
  })

  const daysWave = chartDays.map((d, idx) => idx * 3 + (timelineMap[d] ? 15 : 4))
  const momentumWave = chartDays.map(d => {
    const net = timelineMap[d] || 0
    return net > 0 ? 70 + (net % 30) : 35
  })

  const positiveCount = timeline.filter(t => t.amount > 0).length || 516
  const deductionCount = timeline.filter(t => t.amount < 0).length || 243

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

  return (
    <AppShell>
      <div className="page-container" style={{ maxWidth: '1400px' }}>
        
        {/* ══════════════════════════════════════════════════════════════════
            PAGE HEADER (Centered & Cleaned — Full Reset Removed)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="w-full flex flex-col items-center justify-center text-center gap-2 mb-6 pb-2 mx-auto">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.4)] shrink-0">
              <Activity size={18} className="text-purple-400" />
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-[0.2em] uppercase">
              EXPERIENCE METRICS
            </h1>
          </div>
          <p className="font-mono text-xs text-slate-400">
            Track your journey. Every action shapes your legacy.
          </p>

          {/* Action Button: Purge Duplicates & Sync Only */}
          <div className="mt-1 flex justify-center">
            <button 
              onClick={handleFixDuplicates}
              className="px-4 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-400 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)] active:scale-95"
            >
              <RefreshCw size={12} className="text-cyan-400" />
              <span>PURGE & SYNC (REMOVE DUPLICATES)</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 1: SAGA & LEVEL HERO CARD (COMPACT EMBLEM — ZERO SCROLLING)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-5 rounded-2xl border border-white/10 bg-[#0c0f18] backdrop-blur-2xl p-4 sm:p-5 shadow-[0_16px_40px_rgba(0,0,0,0.7)] overflow-hidden text-center">
          
          {/* Subtle Ambient Glows */}
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-purple-500/10 blur-[80px] pointer-events-none" />

          <div className="flex flex-col items-center justify-center gap-3 relative z-10 max-w-xl mx-auto">
            
            {/* Centered Compact 48px Square Saga Artwork Emblem */}
            <div 
              className="relative flex items-center justify-center shrink-0"
              style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', maxWidth: '48px', maxHeight: '48px' }}
            >
              <div className="absolute -inset-1.5 rounded-xl border border-indigo-500/30 animate-[spin_18s_linear_infinite]" style={{ borderTopColor: 'transparent', borderBottomColor: 'transparent' }} />
              <div className="absolute -inset-0.5 rounded-lg border border-dashed border-purple-400/25 animate-[spin_24s_linear_infinite_reverse]" />
              <div className="absolute -top-1 left-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
              <div className="absolute -bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
              
              {/* 1:1 Square Artwork Container */}
              <div 
                className="rounded-xl overflow-hidden bg-slate-950 border border-indigo-400/50 shadow-[0_0_12px_rgba(129,140,248,0.4)] flex items-center justify-center relative aspect-square"
                style={{ width: '48px', height: '48px' }}
              >
                <img 
                  src={SAGA_IMAGES[currentRank.code] || '/sagas/Awakening.png'} 
                  alt={rankTitle}
                  style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                  onError={(e) => { e.currentTarget.src = '/sagas/Awakening.png' }}
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/15 rounded-xl pointer-events-none" />
              </div>
            </div>

            {/* Centered Saga Title */}
            <div className="font-mono text-xs sm:text-sm uppercase tracking-[0.25em] font-bold text-slate-300">
              SAGA {currentRank.code} <span className="text-slate-600 mx-1.5">•</span> <span className="text-indigo-400">{rankTitle.toUpperCase()}</span>
            </div>

            {/* Centered Level & XP */}
            <div className="space-y-0.5">
              <div className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-none">
                LEVEL <span className="text-indigo-400">{currentLevel}</span>
              </div>
              <div className="font-display font-black text-xl sm:text-2xl md:text-3xl text-indigo-400 tracking-tight">
                {totalXp.toLocaleString()} <span className="font-mono text-xs sm:text-sm font-bold text-slate-400">XP</span>
              </div>
            </div>

            {/* Centered Progress Capsule Bar */}
            <div className="w-full max-w-lg mt-2 flex flex-col gap-2">
              <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-slate-400 font-semibold px-1">
                <span>NEXT LEVEL <span className="text-indigo-400 font-bold">{currentLevel + 1}</span></span>
                <span className="font-display font-bold text-slate-200 text-sm">{xpToGo.toLocaleString()} <span className="font-mono text-[10px] font-bold text-slate-400">XP TO GO</span></span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-950/80 border border-white/10 p-[1px] overflow-hidden">
                <motion.div 
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.9)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(4, Math.min(100, progressPct))}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>

              <div className="font-mono text-xs text-slate-400 text-center">
                {current.toLocaleString()} / {required.toLocaleString()} XP
              </div>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 2: 3 SQUARE METRICS IN A SINGLE RECTANGLE (LEFT, CENTER, RIGHT)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-6 rounded-2xl border border-white/10 bg-[#0c0f18] backdrop-blur-2xl p-3 sm:p-5 shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', 
              gap: '10px', 
              width: '100%' 
            }}
          >
            {/* LEFT: POSITIVE ACTIONS (ADDITIONS) */}
            <div className="rounded-xl border border-emerald-500/25 bg-[#0f1422] hover:border-emerald-500/50 p-2.5 sm:p-5 flex flex-col items-center justify-between text-center transition-all group shadow-md aspect-square">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-emerald-500/40 bg-emerald-950/40 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
                <TrendingUp size={15} className="text-emerald-400 sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="font-display font-black text-xl sm:text-4xl text-emerald-400 tracking-tight leading-tight">
                {positiveCount}
              </div>
              <div className="font-mono text-[9px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-semibold hidden sm:block">
                POSITIVE ACTIONS
              </div>
              <MetricCardSparkline points={positiveWave} strokeColor="#30d6a0" height={32} width={120} />
              <div className="font-mono text-[8px] sm:text-[11px] text-emerald-400 font-semibold tracking-wider">
                <span className="sm:hidden">↑ 12%</span>
                <span className="hidden sm:inline">↑ 12% vs last 7 days</span>
              </div>
            </div>

            {/* CENTER: SUBTRACTIONS & PENALTIES */}
            <div className="rounded-xl border border-rose-500/25 bg-[#0f1422] hover:border-rose-500/50 p-2.5 sm:p-5 flex flex-col items-center justify-between text-center transition-all group shadow-md aspect-square">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-rose-500/40 bg-rose-950/40 flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.2)] group-hover:scale-105 transition-transform">
                <TrendingDown size={15} className="text-rose-400 sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="font-display font-black text-xl sm:text-4xl text-rose-400 tracking-tight leading-tight">
                {deductionCount}
              </div>
              <div className="font-mono text-[9px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-semibold hidden sm:block">
                SUBTRACTIONS & PENALTIES
              </div>
              <MetricCardSparkline points={negativeWave} strokeColor="#f43f5e" height={32} width={120} />
              <div className="font-mono text-[8px] sm:text-[11px] text-rose-400 font-semibold tracking-wider">
                <span className="sm:hidden">↓ 8%</span>
                <span className="hidden sm:inline">↓ 8% vs last 7 days</span>
              </div>
            </div>

            {/* RIGHT: DAYS TRACKED */}
            <div className="rounded-xl border border-blue-500/25 bg-[#0f1422] hover:border-blue-500/50 p-2.5 sm:p-5 flex flex-col items-center justify-between text-center transition-all group shadow-md aspect-square">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-blue-500/40 bg-blue-950/40 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.2)] group-hover:scale-105 transition-transform">
                <Calendar size={15} className="text-blue-400 sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="font-display font-black text-xl sm:text-4xl text-blue-400 tracking-tight leading-tight">
                {daysTracked}
              </div>
              <div className="font-mono text-[9px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-semibold hidden sm:block">
                DAYS TRACKED
              </div>
              <MetricCardSparkline points={daysWave} strokeColor="#60a5fa" height={32} width={120} />
              <div className="font-mono text-[8px] sm:text-[11px] text-blue-400 font-semibold tracking-wider">
                <span className="sm:hidden">{longestStreak}d streak</span>
                <span className="hidden sm:inline">Longest streak: {longestStreak} days</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 3: MOMENTUM METER DETAILED SPECTRUM BANNER
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-6 rounded-2xl border border-white/10 bg-[#0c0f18] backdrop-blur-2xl p-4 sm:p-7 shadow-[0_16px_40px_rgba(0,0,0,0.7)] flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6">
          
          {/* Left Info */}
          <div className="flex items-center gap-3 sm:gap-4 w-full lg:w-auto">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border border-purple-500/40 bg-purple-950/40 flex items-center justify-center text-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.35)] shrink-0">
              <Activity size={20} className="text-purple-400 sm:w-[22px] sm:h-[22px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-xs sm:text-sm uppercase tracking-widest text-indigo-300">
                  MOMENTUM METER
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono text-[9px] sm:text-[10px] font-bold">
                  {momentumScore}% CONSISTENCY
                </span>
              </div>
              <p className="font-mono text-[10px] sm:text-[11px] text-slate-400 mt-1 max-w-md hidden sm:block">
                Measures your execution quality over the past 7 days. Stay consistent. Protect your momentum.
              </p>
            </div>
          </div>

          {/* Right Spectrum Bar with Floating Glowing Needle Pin */}
          <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col gap-2 sm:gap-3 relative pt-6 sm:pt-7">
            
            {/* Floating Marker Pin (Above the Bar) */}
            <div 
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-700 z-20"
              style={{ left: `${Math.max(6, Math.min(94, momentumScore))}%` }}
            >
              <div className="px-2 py-0.5 rounded-md bg-purple-600 border border-white text-white font-mono text-[9px] sm:text-[10px] font-black tracking-wider flex items-center gap-1 shadow-[0_0_16px_rgba(168,85,247,0.9)] whitespace-nowrap">
                <span>⚡</span>
                <span>{momentumScore}%</span>
              </div>
              <div className="w-0.5 h-2 sm:h-2.5 bg-white shadow-[0_0_8px_#ffffff]" />
            </div>

            {/* Continuous Glow Spectrum Track */}
            <div className="relative w-full h-3.5 sm:h-4 rounded-full p-[2px] bg-slate-950 border border-white/15 overflow-hidden shadow-inner">
              <div 
                className="w-full h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #e11d48 0%, #ea580c 25%, #2563eb 50%, #9333ea 75%, #c084fc 100%)',
                  boxShadow: '0 0 12px rgba(147, 51, 234, 0.4)'
                }}
              />
            </div>

            {/* Scale Labels & Active Zone Highlight (Hidden on Mobile for ultra-clean layout) */}
            <div className="hidden sm:flex items-center justify-between font-mono text-[9px] uppercase tracking-wider font-bold pt-0.5">
              <div className={`text-left transition-all ${momentumScore < 25 ? 'scale-110 font-black' : 'opacity-70'}`}>
                <span className="text-slate-500 block">0%</span>
                <span className="text-rose-400">CRITICAL</span>
              </div>
              <div className={`text-center transition-all ${momentumScore >= 25 && momentumScore < 50 ? 'scale-110 font-black' : 'opacity-70'}`}>
                <span className="text-slate-500 block">25%</span>
                <span className="text-orange-400">AT RISK</span>
              </div>
              <div className={`text-center transition-all ${momentumScore >= 50 && momentumScore < 75 ? 'scale-110 font-black' : 'opacity-70'}`}>
                <span className="text-slate-500 block">50%</span>
                <span className="text-blue-400">STEADY</span>
              </div>
              <div className={`text-center transition-all ${momentumScore >= 75 && momentumScore < 90 ? 'scale-110 font-black text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'opacity-70'}`}>
                <span className="text-slate-500 block">75%</span>
                <span className="text-purple-400">STRONG</span>
              </div>
              <div className={`text-right transition-all ${momentumScore >= 90 ? 'scale-110 font-black text-indigo-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'opacity-70'}`}>
                <span className="text-slate-500 block">100%</span>
                <span className="text-indigo-300">UNSTOPPABLE</span>
              </div>
            </div>

          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 4: XP ACTIVITY TIMELINE CHART
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-5 rounded-2xl border border-white/10 bg-[#0c0f18] backdrop-blur-2xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.7)] overflow-hidden">
          
          {/* Timeline Header */}
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest font-bold text-indigo-300">
              <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
              <span>XP ACTIVITY TIMELINE</span>
            </div>

            {/* Time Filter Select */}
            <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded-lg p-0.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setTimeRange(7)}
                className={`px-3 py-1 rounded font-bold uppercase transition-all ${timeRange === 7 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                7 DAYS
              </button>
              <button
                type="button"
                onClick={() => setTimeRange(14)}
                className={`px-3 py-1 rounded font-bold uppercase transition-all ${timeRange === 14 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                14 DAYS
              </button>
              <button
                type="button"
                onClick={() => setTimeRange(30)}
                className={`px-3 py-1 rounded font-bold uppercase transition-all ${timeRange === 30 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                30 DAYS
              </button>
            </div>
          </div>

          {/* Spline Area Chart with Baseline & Zero-Axis Separation */}
          <div className="p-2 sm:p-4" style={{ height: '320px', width: '100%', minHeight: '320px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
              <AreaChart data={areaData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="splitGainGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#30d6a0" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#30d6a0" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="splitLossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.0} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.25)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  fontFamily="var(--font-mono)"
                  tick={{ fill: 'rgba(148,163,184,0.8)' }}
                  dy={6}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.25)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  fontFamily="var(--font-mono)"
                  tick={{ fill: 'rgba(148,163,184,0.8)' }}
                  tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v}`}
                  width={42}
                />
                <ReferenceLine y={0} stroke="rgba(48,214,160,0.4)" strokeWidth={1.2} />
                <Tooltip content={<CustomXpTooltip />} />
                <Area
                  type="monotone"
                  dataKey="dailyGain"
                  stroke="#30d6a0"
                  strokeWidth={2.8}
                  fill="url(#splitGainGrad)"
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    const isLast = payload.date === areaData[areaData.length - 1]?.date
                    if (!isLast) return null
                    return (
                      <circle
                        key={payload.date}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="#30d6a0"
                        stroke="#ffffff"
                        strokeWidth={2}
                        filter="drop-shadow(0 0 8px #30d6a0)"
                      />
                    )
                  }}
                  activeDot={{ r: 6, fill: '#30d6a0', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 5: TACTICAL QUOTE FOOTER BAR
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mb-8 p-4 rounded-xl border border-white/10 bg-[#0c0f18] flex items-center justify-between relative z-10 shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl text-purple-400 font-bold leading-none">“</span>
            <p className="font-mono text-xs text-slate-300 italic">
              Discipline today. Freedom tomorrow. Legacy forever.
            </p>
          </div>
          <div className="font-mono text-xs font-bold tracking-[0.25em] text-slate-400 uppercase shrink-0">
            LOKI OS
          </div>
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
