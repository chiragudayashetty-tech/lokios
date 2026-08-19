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
import { RANK_CONFIG, SAGA_TITLES } from '@/lib/constants'
import { cleanupAllDuplicateXP } from '@/lib/utils/xpFallback'

// Custom Area Sparkline Component with Area Gradient Fill & Smooth Curves
function MetricCardSparkline({ points = [], strokeColor = '#30d6a0', fillColor = 'rgba(48,214,160,0.18)', height = 48, width = 220 }) {
  const pts = points.length >= 6 ? points : [12, 18, 14, 26, 20, 30, 24, 34, 28, 38, 30, 36]
  const min = Math.min(...pts)
  const max = Math.max(...pts, min + 1)
  
  const stepX = width / (pts.length - 1)
  const coords = pts.map((val, idx) => {
    const normY = height - 8 - ((val - min) / (max - min)) * (height - 16)
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
    <div className="w-full h-12 flex items-center justify-center overflow-hidden my-1">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible w-full max-w-[240px]">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.38" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={lineD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 6px ${strokeColor})` }}
        />
      </svg>
    </div>
  )
}

// 10-Segment LED Meter for Momentum Card
function SegmentedMomentumBar({ percentage = 78 }) {
  const activeSegments = Math.round((Math.max(0, Math.min(100, percentage)) / 100) * 10)

  return (
    <div className="w-full max-w-[220px] flex items-center justify-between gap-1.5 h-6 my-2 px-1">
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
            className="flex-1 h-3.5 rounded-sm transition-all duration-300"
            style={{
              backgroundColor: isActive ? color : 'rgba(255,255,255,0.06)',
              boxShadow: isActive ? `0 0 8px ${color}` : 'none',
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
            PAGE HEADER (Clean waveform title & action buttons)
        ══════════════════════════════════════════════════════════════════ */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-2">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.4)] shrink-0 mt-0.5">
              <Activity size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-[0.2em] uppercase">
                EXPERIENCE METRICS
              </h1>
              <p className="font-mono text-xs text-slate-400 mt-1">
                Track your journey. Every action shapes your legacy.
              </p>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <button 
              onClick={handleFixDuplicates}
              className="px-4 py-2 rounded-xl border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-900/40 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)] active:scale-95"
            >
              <RefreshCw size={13} className="text-cyan-400" />
              <span>PURGE & SYNC</span>
            </button>
            <button 
              onClick={handleResetXP}
              className="px-4 py-2 rounded-xl border border-rose-500/40 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(244,63,94,0.15)] active:scale-95"
            >
              <RotateCcw size={13} className="text-rose-400" />
              <span>FULL RESET</span>
            </button>
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 1: TOP HERO ROW (SAGA / LEVEL / PROGRESS)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-5 rounded-2xl border border-indigo-500/20 bg-[#090d1a]/95 backdrop-blur-2xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.65)] overflow-hidden">
          
          {/* Subtle Ambient Glows */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-500/10 blur-[90px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-purple-500/10 blur-[90px] pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            
            {/* Left: 3D Orbital Gem + Level Status */}
            <div className="flex items-center gap-5 sm:gap-7 w-full md:w-auto">
              
              {/* Orbital Gem Emblem */}
              <div className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 shrink-0">
                <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-[spin_14s_linear_infinite]" style={{ borderTopColor: 'transparent', borderBottomColor: 'transparent' }} />
                <div className="absolute inset-2 rounded-full border border-dashed border-purple-400/25 animate-[spin_20s_linear_infinite_reverse]" />
                <div className="absolute top-1 left-4 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
                <div className="absolute bottom-2 right-4 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
                
                {/* Core Faceted Diamond */}
                <div className="absolute inset-3.5 rounded-full bg-gradient-to-br from-indigo-950/90 via-purple-950/80 to-slate-950 border border-indigo-400/40 shadow-[0_0_24px_rgba(129,140,248,0.5)] flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-pulse" />
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="relative z-10 drop-shadow-[0_0_12px_rgba(168,85,247,0.9)]">
                    <path d="M12 2L3 9.5L12 22L21 9.5L12 2Z" fill="url(#heroGemGrad1)" stroke="#c084fc" strokeWidth="1.1" strokeLinejoin="round" />
                    <path d="M12 2L8 9.5L12 22L16 9.5L12 2Z" fill="url(#heroGemGrad2)" fillOpacity="0.9" />
                    <path d="M3 9.5H21" stroke="#e9d5ff" strokeWidth="0.8" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="heroGemGrad1" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#a855f7" />
                        <stop offset="1" stopColor="#3730a3" />
                      </linearGradient>
                      <linearGradient id="heroGemGrad2" x1="8" y1="2" x2="16" y2="22" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#f5d0fe" />
                        <stop offset="0.4" stopColor="#c084fc" />
                        <stop offset="1" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Text Info */}
              <div className="flex flex-col justify-center min-w-0">
                <div className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-slate-400">
                  SAGA {currentRank.code} <span className="text-slate-600">•</span> <span className="text-indigo-400 font-bold">{rankTitle.toUpperCase()}</span>
                </div>
                <div className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight leading-tight mt-1">
                  LEVEL <span className="text-indigo-400">{currentLevel}</span>
                </div>
                <div className="font-display font-black text-2xl sm:text-3xl text-indigo-400 tracking-tight leading-tight mt-1">
                  {totalXp.toLocaleString()} <span className="font-mono text-xs sm:text-sm font-bold text-slate-400">XP</span>
                </div>
              </div>

            </div>

            {/* Right: Next Level Progress Box */}
            <div className="w-full md:w-[360px] lg:w-[400px] flex flex-col justify-center gap-2">
              <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-slate-400 font-semibold">
                <span>NEXT LEVEL <span className="text-indigo-400 font-bold">{currentLevel + 1}</span></span>
              </div>
              
              <div className="font-display font-black text-xl sm:text-2xl text-slate-100 tracking-tight">
                {xpToGo.toLocaleString()} <span className="font-mono text-xs font-bold text-slate-400">XP TO GO</span>
              </div>

              {/* Progress Capsule Bar */}
              <div className="w-full h-2.5 rounded-full bg-slate-950/80 border border-white/10 p-[1px] overflow-hidden my-0.5">
                <motion.div 
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.85)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(4, Math.min(100, progressPct))}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>

              <div className="font-mono text-xs text-slate-400">
                {current.toLocaleString()} / {required.toLocaleString()} XP
              </div>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 2: 4 METRIC CARDS (STRICTLY SIDE-BY-SIDE 4-COLUMN GRID)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          
          {/* Card 1: POSITIVE ACTIONS */}
          <div className="rounded-2xl border border-white/5 bg-[#090d1a]/90 hover:border-emerald-500/40 p-5 flex flex-col items-center justify-between text-center transition-all group shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
            <div className="w-12 h-12 rounded-full border border-emerald-500/40 bg-emerald-950/30 flex items-center justify-center mb-2.5 shadow-[0_0_14px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
              <TrendingUp size={20} className="text-emerald-400" />
            </div>
            <div className="font-display font-black text-3xl sm:text-4xl text-emerald-400 tracking-tight leading-tight">
              {positiveCount}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-semibold mt-1">
              POSITIVE ACTIONS
            </div>
            <MiniWaveform points={positiveWave} strokeColor="#30d6a0" />
            <div className="font-mono text-[10px] text-emerald-400 font-semibold tracking-wider mt-1">
              ↑ 12% vs last 7 days
            </div>
          </div>

          {/* Card 2: SUBTRACTIONS & PENALTIES */}
          <div className="rounded-2xl border border-white/5 bg-[#090d1a]/90 hover:border-rose-500/40 p-5 flex flex-col items-center justify-between text-center transition-all group shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
            <div className="w-12 h-12 rounded-full border border-rose-500/40 bg-rose-950/30 flex items-center justify-center mb-2.5 shadow-[0_0_14px_rgba(244,63,94,0.2)] group-hover:scale-105 transition-transform">
              <TrendingDown size={20} className="text-rose-400" />
            </div>
            <div className="font-display font-black text-3xl sm:text-4xl text-rose-400 tracking-tight leading-tight">
              {deductionCount}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-semibold mt-1">
              SUBTRACTIONS & PENALTIES
            </div>
            <MiniWaveform points={negativeWave} strokeColor="#f43f5e" />
            <div className="font-mono text-[10px] text-rose-400 font-semibold tracking-wider mt-1">
              ↓ 8% vs last 7 days
            </div>
          </div>

          {/* Card 3: DAYS TRACKED */}
          <div className="rounded-2xl border border-white/5 bg-[#090d1a]/90 hover:border-blue-500/40 p-5 flex flex-col items-center justify-between text-center transition-all group shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
            <div className="w-12 h-12 rounded-full border border-blue-500/40 bg-blue-950/30 flex items-center justify-center mb-2.5 shadow-[0_0_14px_rgba(59,130,246,0.2)] group-hover:scale-105 transition-transform">
              <Calendar size={20} className="text-blue-400" />
            </div>
            <div className="font-display font-black text-3xl sm:text-4xl text-blue-400 tracking-tight leading-tight">
              {daysTracked}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-semibold mt-1">
              DAYS TRACKED
            </div>
            <MiniWaveform points={daysWave} strokeColor="#60a5fa" />
            <div className="font-mono text-[10px] text-blue-400 font-semibold tracking-wider mt-1">
              Longest streak: {longestStreak} days
            </div>
          </div>

          {/* Card 4: MOMENTUM METER */}
          <div className="rounded-2xl border border-white/5 bg-[#090d1a]/90 hover:border-purple-500/40 p-5 flex flex-col items-center justify-between text-center transition-all group shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
            <div className="w-12 h-12 rounded-full border border-purple-500/40 bg-purple-950/30 flex items-center justify-center mb-2.5 shadow-[0_0_14px_rgba(168,85,247,0.2)] group-hover:scale-105 transition-transform">
              <Target size={20} className="text-purple-400" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">
              MOMENTUM METER
            </div>
            <div className="font-display font-black text-3xl sm:text-4xl text-purple-400 tracking-tight leading-tight">
              {momentumScore}%
            </div>
            <SegmentedMomentumBar percentage={momentumScore} />
            <div className="font-mono text-[10px] text-purple-300 font-semibold tracking-wider mt-1">
              {momentumScore >= 75 ? 'Strong momentum' : momentumScore >= 50 ? 'Steady momentum' : 'At risk'}
            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 3: MOMENTUM METER DETAILED SPECTRUM BANNER
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-5 rounded-2xl border border-indigo-500/20 bg-[#090d1a]/95 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex flex-col lg:flex-row items-center justify-between gap-6">
          
          {/* Left Info */}
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="w-12 h-12 rounded-2xl border border-purple-500/40 bg-purple-950/40 flex items-center justify-center text-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.3)] shrink-0">
              <Activity size={22} className="text-purple-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm uppercase tracking-widest text-indigo-300">
                MOMENTUM METER
              </h3>
              <p className="font-mono text-[11px] text-slate-400 mt-0.5 max-w-md">
                Measures your execution quality over the past 7 days. Stay consistent. Protect your momentum.
              </p>
            </div>
          </div>

          {/* Right Spectrum Spectrum Bar with Floating Indicator Pin */}
          <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col gap-2 relative pt-4">
            
            {/* Spectrum Bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex items-center bg-slate-950 border border-white/10 p-[1px]">
              <div className="h-full w-[25%] bg-gradient-to-r from-rose-600 to-rose-500" />
              <div className="h-full w-[25%] bg-gradient-to-r from-orange-500 to-amber-500" />
              <div className="h-full w-[25%] bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="h-full w-[25%] bg-gradient-to-r from-purple-500 to-fuchsia-400" />
            </div>

            {/* Floating Neon Lightning Bolt Pin */}
            <div 
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-500"
              style={{ left: `${Math.max(4, Math.min(96, momentumScore))}%` }}
            >
              <div className="w-5 h-5 rounded-full bg-purple-500 border border-white flex items-center justify-center shadow-[0_0_12px_#c084fc]">
                <Activity size={10} className="text-white fill-white" />
              </div>
            </div>

            {/* Scale Labels */}
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider font-bold">
              <div className="text-left">
                <span className="text-slate-500 block">0%</span>
                <span className="text-rose-500">CRITICAL</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 block">25%</span>
                <span className="text-orange-400">AT RISK</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 block">50%</span>
                <span className="text-blue-400">STEADY</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 block">75%</span>
                <span className="text-purple-400">STRONG</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">100%</span>
                <span className="text-indigo-300">UNSTOPPABLE</span>
              </div>
            </div>

          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CARD 4: XP ACTIVITY TIMELINE CHART
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-5 rounded-2xl border border-indigo-500/20 bg-[#090d1a]/95 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.5)] overflow-hidden">
          
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
          <div className="p-2 sm:p-4" style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
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
        <div className="mb-8 p-4 rounded-xl border border-white/5 bg-[#090d1a]/90 flex items-center justify-between relative z-10 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
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
