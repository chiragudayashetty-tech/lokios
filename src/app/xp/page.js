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
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Flame, Star, Activity, Trophy, ArrowUp, RotateCcw } from 'lucide-react'
import { RANK_CONFIG } from '@/lib/constants'
import { cleanupAllDuplicateXP } from '@/lib/utils/xpFallback'

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
    const supabase = createClient()
    
    // 1. Clean sleep/weight duplicates
    await cleanupAllDuplicateXP(user.id)

    // 2. Clean habit duplicates (legacy logic)
    const { data: allHistory } = await supabase.from('xp_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    if (!allHistory) { window.location.reload(); return }
    
    const xpByDayAndRoutine = {}
    for (const item of allHistory) {
      if (!item.source_type?.startsWith('habit_')) continue
      
      const isComplete = item.description?.startsWith('Completed routine: ')
      const isFail = item.description?.startsWith('Failed routine: ')
      if (!isComplete && !isFail) continue
      
      const routineName = item.description.replace('Completed routine: ', '').replace('Failed routine: ', '')
      const d = new Date(item.created_at)
      const offset = d.getTimezoneOffset()
      const local = new Date(d.getTime() - offset * 60 * 1000)
      const dateStr = local.toISOString().split('T')[0]
      
      const key = `${dateStr}_${routineName}`
      if (!xpByDayAndRoutine[key]) xpByDayAndRoutine[key] = []
      xpByDayAndRoutine[key].push(item)
    }
    
    let totalDeduction = 0
    const toDelete = []
    
    for (const key in xpByDayAndRoutine) {
      const items = xpByDayAndRoutine[key]
      if (items.length > 1) {
        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        for (let i = 1; i < items.length; i++) {
          toDelete.push(items[i].id)
          totalDeduction += items[i].amount
        }
      }
    }
    
    if (toDelete.length > 0) {
      await supabase.from('xp_history').delete().in('id', toDelete)
      const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', user.id).single()
      if (prof) {
        await supabase.from('profiles').update({ total_xp: Math.max(0, (prof.total_xp || 0) - totalDeduction) }).eq('id', user.id)
      }
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

  // Radar Chart Data
  const categories = ['founder', 'discipline', 'communication', 'learning', 'creation', 'strength']
  const radarData = categories.map(cat => {
    const amount = timeline.filter(t => t.stat_category === cat && t.amount > 0).reduce((acc, curr) => acc + curr.amount, 0)
    return { subject: cat.toUpperCase(), A: amount, fullMark: 1000 }
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

  let runningTotal = 0
  const areaData = last14Days.map(d => {
    runningTotal += (timelineMap[d] || 0)
    return {
      date: d.substring(5).replace('-', '/'),
      dailyGain: timelineMap[d] || 0,
      total: runningTotal
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
              {/* Subtle grid background */}
              <svg className="absolute inset-0 w-full h-full opacity-[0.06]" preserveAspectRatio="none">
                {Array.from({length: 10}, (_, i) => (
                  <line key={`v${i}`} x1={`${(i+1) * 9.09}%`} y1="0" x2={`${(i+1) * 9.09}%`} y2="100%" stroke={currentRank.color} strokeWidth="1" />
                ))}
                {Array.from({length: 6}, (_, i) => (
                  <line key={`h${i}`} x1="0" y1={`${(i+1) * 14.28}%`} x2="100%" y2={`${(i+1) * 14.28}%`} stroke={currentRank.color} strokeWidth="1" />
                ))}
              </svg>

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

        <div className="grid-3 gap-6">
          <div style={{ gridColumn: 'span 2 / span 2' }}>
            <HudPanel label="XP TIMELINE (14 DAYS)" glow style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={currentRank.color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={currentRank.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{stroke: 'var(--border-strong)'}}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '0' }}
                    itemStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    labelStyle={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="dailyGain" stroke="var(--success)" fillOpacity={0} strokeWidth={2} name="Daily Gain" />
                  <Area type="monotone" dataKey="total" stroke={currentRank.color} fillOpacity={1} fill="url(#colorTotal)" name="Total XP" />
                </AreaChart>
              </ResponsiveContainer>
            </HudPanel>
          </div>

          <div>
            <HudPanel label="STAT DISTRIBUTION" style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid stroke="var(--border-strong)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'dataMax + 100']} tick={false} axisLine={false} />
                  <Radar name="XP Earned" dataKey="A" stroke="var(--amber)" fill="var(--amber)" fillOpacity={0.4} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '0' }}
                    itemStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--amber)' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </HudPanel>
          </div>
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
