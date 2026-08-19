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

// Custom SVG Waveform Sparkline Component
function MiniWaveform({ points = [], strokeColor = '#34d399', height = 28, width = 160 }) {
  const pts = points.length > 1 ? points : [10, 15, 12, 22, 18, 25, 20, 28, 24, 30]
  const min = Math.min(...pts)
  const max = Math.max(...pts, min + 1)
  
  const stepX = width / (pts.length - 1)
  const coords = pts.map((val, idx) => {
    const normY = height - 4 - ((val - min) / (max - min)) * (height - 8)
    return { x: idx * stepX, y: normY }
  })

  let d = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const curr = coords[i]
    const next = coords[i + 1]
    const cpX = (curr.x + next.x) / 2
    d += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`
  }

  const cleanId = strokeColor.replace(/[^a-zA-Z0-9]/g, '')

  return (
    <div className="w-full flex items-center justify-center overflow-hidden pt-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible w-full max-w-[170px]">
        <defs>
          <filter id={`glow-${cleanId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#glow-${cleanId})`}
        />
      </svg>
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
  const xpToGo = Math.max(0, required - current)

  const currentRank = getRankForXp(totalXp)
  const rankTitle = SAGA_TITLES[currentRank.code] || currentRank.name || 'The Spark'

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

  // Consistency Score Calculation (last 30 days)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return getLocalDateStr(d)
  })
  const daysWithActivity = last30Days.filter(d => (timelineMap[d] !== undefined && timelineMap[d] > 0)).length
  const consistencyScore = Math.min(100, Math.max(15, Math.round((daysWithActivity / 30) * 100)))

  // Sparkline data curves for the 4 metric cards
  const positiveWave = last14Days.map(d => {
    const entries = timeline.filter(t => getLocalDateStr(new Date(t.created_at)) === d && t.amount > 0)
    return entries.reduce((sum, e) => sum + e.amount, 0)
  })

  const negativeWave = last14Days.map(d => {
    const entries = timeline.filter(t => getLocalDateStr(new Date(t.created_at)) === d && t.amount < 0)
    return Math.abs(entries.reduce((sum, e) => sum + e.amount, 0))
  })

  const daysWave = last14Days.map((d, idx) => idx * 2 + (timelineMap[d] ? 5 : 1))
  const consistencyWave = last14Days.map(d => {
    const net = timelineMap[d] || 0
    return net > 0 ? 80 + (net % 20) : net === 0 ? 40 : 20
  })

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
        
        {/* ══════════════════════════════════════════════════════════════════
            PAGE HEADER (Clean waveform title & action buttons)
        ══════════════════════════════════════════════════════════════════ */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.35)] shrink-0 mt-1">
              <Activity size={18} />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-widest uppercase">
                EXPERIENCE METRICS
              </h1>
              <p className="font-mono text-xs text-slate-400 mt-0.5">
                Track your journey. Every action shapes your legacy.
              </p>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
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
            HERO CARD CONTAINER (Ultra-Modern Glassmorphic Matrix)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-8 rounded-3xl border border-indigo-500/20 bg-[#0c1020]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(99,102,241,0.06)] overflow-hidden">
          
          {/* Subtle Ambient Background Glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-500/10 blur-[90px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-purple-500/10 blur-[90px] pointer-events-none" />

          {/* ── TOP HERO ROW: SAGA / LEVEL / PROGRESS ── */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-12 relative z-10">
            
            {/* Left: 3D Orbital Gem + Level Status */}
            <div className="flex items-center gap-5 sm:gap-7 w-full lg:w-auto">
              
              {/* Orbital Gem Emblem */}
              <div className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 shrink-0">
                {/* Outer Orbital Ring 1 */}
                <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-[spin_14s_linear_infinite]" style={{ borderTopColor: 'transparent', borderBottomColor: 'transparent' }} />
                {/* Outer Orbital Ring 2 */}
                <div className="absolute inset-2 rounded-full border border-dashed border-purple-400/25 animate-[spin_20s_linear_infinite_reverse]" />
                {/* Accent Orbital Dots */}
                <div className="absolute top-1 left-4 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
                <div className="absolute bottom-2 right-4 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
                
                {/* Core Crystal Container */}
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
                <div className="font-mono text-xs sm:text-sm uppercase tracking-[0.2em] font-semibold text-slate-400">
                  SAGA {currentRank.code} <span className="text-slate-600">•</span> <span className="text-indigo-400 font-bold">{rankTitle.toUpperCase()}</span>
                </div>
                <div className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white leading-tight mt-0.5">
                  LEVEL <span className="text-indigo-400">{currentLevel}</span>
                </div>
                <div className="font-display font-black text-2xl sm:text-3xl text-indigo-400 tracking-tight leading-tight mt-0.5">
                  {totalXp.toLocaleString()} <span className="font-mono text-xs sm:text-sm font-bold text-slate-400">XP</span>
                </div>
              </div>

            </div>

            {/* Right: Next Level Progress Box */}
            <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col justify-center gap-2">
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

          {/* ── MIDDLE ROW: 4 METRIC CARDS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 relative z-10">
            
            {/* Card 1: POSITIVE ACTIONS */}
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 hover:border-emerald-500/30 p-5 flex flex-col items-center justify-between text-center transition-all group">
              <div className="w-12 h-12 rounded-full border border-emerald-500/40 bg-emerald-950/40 flex items-center justify-center mb-3 shadow-[0_0_14px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
                <TrendingUp size={20} className="text-emerald-400" />
              </div>
              <div className="font-display font-black text-3xl sm:text-4xl text-emerald-400 tracking-tight leading-tight">
                {positiveCount}
              </div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-semibold mt-1">
                POSITIVE ACTIONS
              </div>
              <MiniWaveform points={positiveWave} strokeColor="#34d399" />
            </div>

            {/* Card 2: SUBTRACTIONS & PENALTIES */}
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 hover:border-rose-500/30 p-5 flex flex-col items-center justify-between text-center transition-all group">
              <div className="w-12 h-12 rounded-full border border-rose-500/40 bg-rose-950/40 flex items-center justify-center mb-3 shadow-[0_0_14px_rgba(244,63,94,0.2)] group-hover:scale-105 transition-transform">
                <TrendingDown size={20} className="text-rose-400" />
              </div>
              <div className="font-display font-black text-3xl sm:text-4xl text-rose-400 tracking-tight leading-tight">
                {deductionCount}
              </div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-semibold mt-1">
                SUBTRACTIONS & PENALTIES
              </div>
              <MiniWaveform points={negativeWave} strokeColor="#f43f5e" />
            </div>

            {/* Card 3: DAYS TRACKED */}
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 hover:border-blue-500/30 p-5 flex flex-col items-center justify-between text-center transition-all group">
              <div className="w-12 h-12 rounded-full border border-blue-500/40 bg-blue-950/40 flex items-center justify-center mb-3 shadow-[0_0_14px_rgba(59,130,246,0.2)] group-hover:scale-105 transition-transform">
                <Calendar size={20} className="text-blue-400" />
              </div>
              <div className="font-display font-black text-3xl sm:text-4xl text-blue-400 tracking-tight leading-tight">
                {daysTracked}
              </div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-semibold mt-1">
                DAYS TRACKED
              </div>
              <MiniWaveform points={daysWave} strokeColor="#60a5fa" />
            </div>

            {/* Card 4: CONSISTENCY SCORE */}
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 hover:border-purple-500/30 p-5 flex flex-col items-center justify-between text-center transition-all group">
              <div className="w-12 h-12 rounded-full border border-purple-500/40 bg-purple-950/40 flex items-center justify-center mb-3 shadow-[0_0_14px_rgba(168,85,247,0.2)] group-hover:scale-105 transition-transform">
                <Target size={20} className="text-purple-400" />
              </div>
              <div className="font-display font-black text-3xl sm:text-4xl text-purple-400 tracking-tight leading-tight">
                {consistencyScore}%
              </div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-semibold mt-1">
                CONSISTENCY SCORE
              </div>
              <MiniWaveform points={consistencyWave} strokeColor="#c084fc" />
              <div className="font-mono text-[9px] text-slate-500 tracking-widest uppercase mt-1">
                LAST 30 DAYS
              </div>
            </div>

          </div>

          {/* ── BOTTOM ROW: TACTICAL QUOTE ── */}
          <div className="mt-6 p-3.5 sm:p-4 rounded-xl border border-white/5 bg-slate-950/40 flex items-center gap-3 relative z-10">
            <div className="w-1 h-5 rounded-full bg-indigo-500 shrink-0" />
            <span className="font-serif text-lg text-purple-400 font-bold shrink-0">“</span>
            <p className="font-mono text-xs text-slate-400 italic">
              Discipline today. Freedom tomorrow. Legacy forever.
            </p>
          </div>

        </div>

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
