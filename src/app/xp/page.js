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
import { Flame, Star, Activity, Trophy, ArrowUp } from 'lucide-react'
import { RANK_CONFIG } from '@/lib/constants'

export default function XPDashboard() {
  const { user } = useAuth()
  const [timeline, setTimeline] = useState([])
  const [totalXp, setTotalXp] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const supabase = createClient()
      
      const { data: profile } = await supabase.from('profiles').select('total_xp').eq('id', user.id).single()
      if (profile) setTotalXp(profile.total_xp || 0)

      const { data: history } = await supabase.from('xp_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      if (history) setTimeline(history)

      setLoading(false)
    }
    fetchData()
  }, [user])

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
  const categories = ['discipline', 'focus', 'health', 'business', 'learning']
  const radarData = categories.map(cat => {
    const amount = timeline.filter(t => t.stat_category === cat && t.amount > 0).reduce((acc, curr) => acc + curr.amount, 0)
    return { subject: cat.toUpperCase(), A: amount, fullMark: 1000 }
  })

  // Timeline Area Chart Data (aggregate by day)
  const timelineMap = {}
  timeline.forEach(item => {
    const d = item.created_at.split('T')[0]
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

  return (
    <AppShell>
      <div className="page-container" style={{ maxWidth: '1400px' }}>
        <header className="page-header mb-8">
          <h1 className="page-title flex items-center gap-3"><Trophy className="text-amber" /> EXPERIENCE METRICS</h1>
          <p className="page-subtitle font-mono uppercase text-xs">Visualize your character progression and stat distribution.</p>
        </header>

        {/* Level Up Banner / Core Stats */}
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-bg-tertiary to-transparent z-0" />
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10 blur-[100px]" style={{ background: currentRank.color }} />
          
          <HudPanel className="relative z-10 flex flex-col md:flex-row items-center gap-8 p-8" style={{ borderColor: currentRank.color }}>
            <div className="flex-col items-center justify-center shrink-0">
              <div className="relative w-32 h-32 flex-center mb-2">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r="60" fill="none" stroke="var(--border-strong)" strokeWidth="4" />
                  <motion.circle cx="64" cy="64" r="60" fill="none" stroke={currentRank.color} strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    initial={{ strokeDashoffset: `${2 * Math.PI * 60}` }}
                    animate={{ strokeDashoffset: `${2 * Math.PI * 60 * (1 - progressPct / 100)}` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    strokeLinecap="round" />
                </svg>
                <div className="flex-col items-center text-center">
                  <span className="font-mono text-xs uppercase tracking-widest text-muted">LEVEL</span>
                  <span className="font-display text-4xl text-primary drop-shadow-md">{currentLevel}</span>
                </div>
              </div>
              <div className="font-display text-lg uppercase tracking-widest" style={{ color: currentRank.color }}>{currentRank.name}</div>
            </div>

            <div className="flex-1 w-full">
              <div className="flex-between mb-2">
                <span className="font-mono text-xs text-amber uppercase tracking-widest flex items-center gap-2"><Star size={12}/> TOTAL XP: {totalXp}</span>
                <span className="font-mono text-xs text-muted uppercase tracking-widest">{current} / {required} TO LV.{currentLevel + 1}</span>
              </div>
              <TacticalProgress value={progressPct} height={8} showValue={false} color={currentRank.color} />
              
              <div className="grid-3 gap-4 mt-6">
                <div className="bg-bg-tertiary border border-border-color p-4 flex-col text-center">
                  <span className="font-display text-2xl text-success">{timeline.filter(t => t.amount > 0).length}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted">POSITIVE ACTIONS</span>
                </div>
                <div className="bg-bg-tertiary border border-border-color p-4 flex-col text-center">
                  <span className="font-display text-2xl text-danger">{timeline.filter(t => t.amount < 0).length}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted">PENALTIES</span>
                </div>
                <div className="bg-bg-tertiary border border-border-color p-4 flex-col text-center">
                  <span className="font-display text-2xl text-info">{last14Days.length}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted">DAYS TRACKED</span>
                </div>
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
                    <div className={`font-mono text-sm font-bold ${item.amount > 0 ? 'text-success' : 'text-danger'}`}>
                      {item.amount > 0 ? '+' : ''}{item.amount} XP
                    </div>
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
