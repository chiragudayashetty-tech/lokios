'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale, TrendingDown, TrendingUp, Trophy, Lock, Check, Target, Flame,
  Moon, Clock, CheckCircle2, XCircle, Swords, BarChart2, Activity
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, Tooltip, ReferenceLine, XAxis, YAxis, BarChart, Bar, Cell } from 'recharts'

export default function WellnessPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const todayStr = getLocalDateStr(new Date())

  const [activeTab, setActiveTab] = useState('body')

  // ─── BODY RECON STATE ───
  const [config, setConfig] = useState(null)
  const [logs, setLogs] = useState([])
  const [loadingBody, setLoadingBody] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggedToday, setLoggedToday] = useState(false)
  const [todayWeight, setTodayWeight] = useState('')
  const [xpToast, setXpToast] = useState(null)
  const [setupStarting, setSetupStarting] = useState('')
  const [setupTarget, setSetupTarget] = useState('')
  const [showNewTarget, setShowNewTarget] = useState(false)
  const [newTargetWeight, setNewTargetWeight] = useState('')

  // ─── SLEEP ANALYTICS STATE ───
  const [sleepLogs, setSleepLogs] = useState([])
  const [loadingSleep, setLoadingSleep] = useState(true)
  const [warRoomHp, setWarRoomHp] = useState(null)

  // ─── FETCH BODY DATA ───
  const fetchBodyData = useCallback(async () => {
    if (!user) return
    setLoadingBody(true)
    const [configRes, logsRes] = await Promise.all([
      supabase.from('weight_config').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('weight_logs').select('*').eq('user_id', user.id).order('date', { ascending: true })
    ])
    if (configRes.data) setConfig(configRes.data)
    if (logsRes.data) {
      setLogs(logsRes.data)
      const todayLog = logsRes.data.find(l => l.date === todayStr)
      if (todayLog) { setLoggedToday(true); setTodayWeight(String(todayLog.weight_kg)) }
    }
    setLoadingBody(false)
  }, [user, todayStr])

  // ─── FETCH SLEEP DATA ───
  const fetchSleepData = useCallback(async () => {
    if (!user) return
    setLoadingSleep(true)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = getLocalDateStr(thirtyDaysAgo)

    const [sleepRes, bpRes] = await Promise.all([
      supabase.from('sleep_logs').select('*').eq('user_id', user.id)
        .gte('date', thirtyDaysAgoStr).order('date', { ascending: true }),
      supabase.from('user_blueprints').select('battles').eq('user_id', user.id)
    ])

    if (sleepRes.data) setSleepLogs(sleepRes.data)

    const bp = bpRes.data?.[0]
    if (bp?.battles) {
      const sleepBattle = bp.battles.find(b => {
        const n = b.name?.toLowerCase() || ''
        return n.includes('sleep') || n.includes('rest') || n.includes('discipline')
      })
      if (sleepBattle) setWarRoomHp(sleepBattle.hp ?? 100)
    }
    setLoadingSleep(false)
  }, [user])

  useEffect(() => { fetchBodyData() }, [fetchBodyData])
  useEffect(() => { if (activeTab === 'sleep') fetchSleepData() }, [activeTab, fetchSleepData])

  // ─── BODY HANDLERS ───
  const handleSetup = async () => {
    if (!setupStarting || !setupTarget) return
    setSaving(true)
    const { error } = await supabase.from('weight_config').insert({
      user_id: user.id, starting_weight: parseFloat(setupStarting),
      target_weight: parseFloat(setupTarget), milestones_awarded: 0
    })
    if (!error) await fetchBodyData()
    setSaving(false)
  }

  const handleLogWeight = async () => {
    if (!todayWeight || loggedToday) return
    const weight = parseFloat(todayWeight)
    if (isNaN(weight) || weight <= 0 || weight > 500) return
    setSaving(true)
    const { error: err1 } = await supabase.from('weight_logs').insert({ user_id: user.id, date: todayStr, weight_kg: weight })
    if (err1) await supabase.from('weight_logs').update({ weight_kg: weight }).eq('user_id', user.id).eq('date', todayStr)

    let totalXpEarned = 0
    const { data: existingXp } = await supabase.from('xp_history').select('id').eq('user_id', user.id).eq('source_type', 'weight_log').eq('source_id', todayStr).maybeSingle()
    if (!existingXp) {
      await robustAwardXP(user.id, 2, 'weight_log', todayStr, 'Daily weight log', 'discipline')
      totalXpEarned += 2
    }
    if (config) {
      const kgLost = Math.floor(config.starting_weight - weight)
      const alreadyAwarded = config.milestones_awarded || 0
      if (kgLost > alreadyAwarded && kgLost > 0) {
        const newMilestones = kgLost - alreadyAwarded
        for (let i = 0; i < newMilestones; i++) {
          await robustAwardXP(user.id, 30, 'weight_milestone', `kg_${alreadyAwarded + i + 1}`, `Weight milestone: -${alreadyAwarded + i + 1} kg`, 'discipline')
        }
        totalXpEarned += newMilestones * 30
        await supabase.from('weight_config').update({ milestones_awarded: kgLost }).eq('id', config.id)
      }
      if (weight <= config.target_weight && !config.target_hit_at) {
        await robustAwardXP(user.id, 100, 'weight_target', 'target_hit', `Target weight ${config.target_weight} kg reached!`, 'discipline')
        totalXpEarned += 100
        await supabase.from('weight_config').update({ target_hit_at: todayStr }).eq('id', config.id)
      }
      if (config.target_hit_at && weight <= config.target_weight) {
        await robustAwardXP(user.id, 5, 'weight_maintain', todayStr, 'Weight maintenance bonus', 'discipline')
        totalXpEarned += 5
      }
    }
    setLoggedToday(true)
    setXpToast(totalXpEarned)
    setTimeout(() => setXpToast(null), 3000)
    await fetchBodyData()
    setSaving(false)
  }

  const handleNewTarget = async () => {
    if (!newTargetWeight) return
    setSaving(true)
    await supabase.from('weight_config').update({
      target_weight: parseFloat(newTargetWeight), target_hit_at: null,
      milestones_awarded: Math.floor(config.starting_weight - logs[logs.length - 1]?.weight_kg) || 0
    }).eq('id', config.id)
    setShowNewTarget(false); setNewTargetWeight('')
    await fetchBodyData()
    setSaving(false)
  }

  // ─── BODY DERIVED DATA ───
  const latestWeight = logs.length > 0 ? logs[logs.length - 1].weight_kg : null
  const totalLost = config && latestWeight ? (config.starting_weight - latestWeight).toFixed(1) : 0
  const progressPct = config && latestWeight
    ? Math.min(100, Math.max(0, ((config.starting_weight - latestWeight) / (config.starting_weight - config.target_weight)) * 100)) : 0
  const isInMaintenance = config?.target_hit_at != null
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = getLocalDateStr(weekAgo)
  const weekAgoLog = logs.find(l => l.date <= weekAgoStr)
  const weekChange = weekAgoLog && latestWeight ? (latestWeight - weekAgoLog.weight_kg).toFixed(1) : null
  const chartData = logs.map(l => ({
    date: new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: parseFloat(l.weight_kg)
  }))
  const milestones = config ? Array.from({ length: Math.ceil(config.starting_weight - config.target_weight) }, (_, i) => {
    const targetKg = config.starting_weight - (i + 1)
    const hitLog = logs.find(l => parseFloat(l.weight_kg) <= targetKg)
    return { kg: i + 1, targetKg: targetKg.toFixed(1), hit: !!hitLog, date: hitLog?.date, isTarget: targetKg <= config.target_weight }
  }) : []

  // ─── SLEEP DERIVED DATA ───
  const sleepChartData = sleepLogs.map(l => ({
    date: new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    hours: parseFloat(l.duration_hours) || 0,
    status: l.status
  }))
  const avgSleep = sleepLogs.length > 0 ? (sleepLogs.reduce((s, l) => s + (parseFloat(l.duration_hours) || 0), 0) / sleepLogs.length).toFixed(1) : null
  const healthyNights = sleepLogs.filter(l => l.status === 'healthy').length
  const totalNights = sleepLogs.length
  const bedtimeScore = totalNights > 0 ? Math.round((sleepLogs.filter(l => {
    const [h] = (l.bedtime || '00:00').split(':').map(Number)
    return h >= 20 && h <= 23
  }).length / totalNights) * 100) : null
  const wakeScore = totalNights > 0 ? Math.round((sleepLogs.filter(l => {
    const [h] = (l.wake_time || '09:00').split(':').map(Number)
    return h < 9
  }).length / totalNights) * 100) : null

  // Streak calc
  let currentStreak = 0, bestStreak = 0, streak = 0
  const sorted = [...sleepLogs].sort((a, b) => a.date.localeCompare(b.date))
  sorted.forEach(l => {
    if (l.status === 'healthy') { streak++; if (streak > bestStreak) bestStreak = streak }
    else streak = 0
  })
  if (sorted.length > 0 && sorted[sorted.length - 1]?.status === 'healthy') currentStreak = streak

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '6px 10px' }}>
          <p className="font-mono text-[9px] text-muted">{label}</p>
          <p className="font-mono text-[11px] font-bold text-primary">{payload[0].value} {payload[0].dataKey === 'weight' ? 'kg' : 'h'}</p>
        </div>
      )
    }
    return null
  }

  if (loadingBody) {
    return (
      <AppShell>
        <div className="page-container flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <div className="font-mono text-muted text-sm animate-pulse">Loading Wellness...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page-container max-w-[1200px] pb-10">

        {/* XP Toast */}
        <AnimatePresence>
          {xpToast && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-[999] px-5 py-3 font-display font-bold text-lg tracking-tight"
              style={{ background: 'var(--success)', color: '#0a0a0a', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
              +{xpToast} XP
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Activity size={22} color="var(--accent-primary)" />
            <div>
              <h1 className="font-display font-bold text-primary tracking-tight" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)' }}>
                WELLNESS
              </h1>
              <p className="font-mono text-[9px] text-muted uppercase tracking-widest">
                Body Recon · Sleep Analytics
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex border border-border-color overflow-hidden">
            {[
              { id: 'body', icon: Scale, label: 'BODY RECON' },
              { id: 'sleep', icon: Moon, label: 'SLEEP ANALYTICS' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all"
                style={{
                  background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === tab.id ? '#0a0a0a' : 'var(--text-muted)',
                  borderRight: tab.id === 'body' ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── BODY RECON TAB ─── */}
        {activeTab === 'body' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {!config ? (
              /* Setup Screen */
              <div className="max-w-lg mx-auto pt-10">
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Scale size={28} color="var(--accent-primary)" />
                    <h2 className="font-display font-bold text-primary tracking-tight text-3xl">BODY RECON</h2>
                  </div>
                  <p className="font-mono text-[11px] text-muted uppercase tracking-widest">Track · Transform · Prove</p>
                </div>
                <div className="p-7" style={{ background: 'linear-gradient(135deg,#111,#0a0a0a)', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--accent-primary)' }}>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-6">Initialize Tracking Parameters</div>
                  <div className="flex flex-col gap-5">
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">Current Weight (kg)</label>
                      <input type="number" step="0.1" value={setupStarting} onChange={e => setSetupStarting(e.target.value)} placeholder="e.g. 80"
                        className="w-full p-3 font-mono text-lg text-primary border border-border-color outline-none" style={{ background: 'var(--bg-primary)' }} />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">Target Weight (kg)</label>
                      <input type="number" step="0.1" value={setupTarget} onChange={e => setSetupTarget(e.target.value)} placeholder="e.g. 70"
                        className="w-full p-3 font-mono text-lg text-primary border border-border-color outline-none" style={{ background: 'var(--bg-primary)' }} />
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[9px] text-muted">
                      <Flame size={10} color="var(--accent-primary)" />
                      <span>+2 XP per daily log · +30 XP per kg lost · +100 XP at target</span>
                    </div>
                    <button onClick={handleSetup} disabled={!setupStarting || !setupTarget || saving}
                      className="w-full p-4 font-display font-bold uppercase tracking-widest text-sm transition-all"
                      style={{ background: setupStarting && setupTarget ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: setupStarting && setupTarget ? '#0a0a0a' : 'var(--text-muted)', opacity: saving ? 0.5 : 1 }}>
                      {saving ? 'Initializing...' : 'Begin Tracking'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Maintenance Banner */}
                {isInMaintenance && (
                  <div className="p-4 flex items-center justify-between gap-3"
                    style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.3)', borderLeft: '3px solid var(--success)' }}>
                    <div className="flex items-center gap-3">
                      <Trophy size={18} color="var(--success)" />
                      <div>
                        <div className="font-display font-bold text-primary">TARGET REACHED!</div>
                        <div className="font-mono text-[9px] text-muted">Hit {config.target_weight} kg on {new Date(config.target_hit_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                    </div>
                    <button onClick={() => setShowNewTarget(true)} className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest border border-success text-success hover:bg-success hover:text-bg-primary transition-colors">
                      Set New Target
                    </button>
                  </div>
                )}

                {/* New Target Modal */}
                <AnimatePresence>
                  {showNewTarget && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                      onClick={() => setShowNewTarget(false)}>
                      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                        onClick={e => e.stopPropagation()} className="w-full max-w-sm p-6"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                        <h3 className="font-display font-bold text-primary text-lg mb-4">SET NEW TARGET</h3>
                        <input type="number" step="0.1" value={newTargetWeight} onChange={e => setNewTargetWeight(e.target.value)}
                          placeholder="New target weight (kg)" className="w-full p-3 font-mono text-lg text-primary border border-border-color mb-4 outline-none" style={{ background: 'var(--bg-primary)' }} />
                        <button onClick={handleNewTarget} disabled={!newTargetWeight || saving}
                          className="w-full p-3 font-display font-bold uppercase tracking-widest text-sm"
                          style={{ background: 'var(--accent-primary)', color: '#0a0a0a', opacity: !newTargetWeight || saving ? 0.5 : 1 }}>
                          {saving ? 'Saving...' : 'Update Target'}
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Start', val: config.starting_weight, accent: false },
                    { label: 'Current', val: latestWeight || '—', accent: true },
                    { label: 'Target', val: config.target_weight, accent: false }
                  ].map(s => (
                    <div key={s.label} className="text-center p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                      <div className="font-display font-bold text-primary tracking-tighter" style={{ fontSize: 'clamp(1.4rem,4vw,2rem)', lineHeight: 1, color: s.accent && latestWeight ? 'var(--text-primary)' : 'var(--text-primary)' }}>{s.val}</div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-muted mt-1.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-[10px] font-bold" style={{ color: parseFloat(totalLost) > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {parseFloat(totalLost) > 0 ? `▼ ${totalLost} kg lost` : parseFloat(totalLost) < 0 ? `▲ ${Math.abs(totalLost)} kg gained` : 'No change'}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-primary">{Math.round(progressPct)}%</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                    <motion.div style={{ height: '100%', background: progressPct >= 100 ? 'var(--success)' : 'var(--accent-primary)' }}
                      initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
                  </div>
                  {weekChange !== null && <div className="font-mono text-[9px] text-muted mt-2">This week: {parseFloat(weekChange) <= 0 ? `▼ ${Math.abs(weekChange)} kg` : `▲ ${weekChange} kg`}</div>}
                </div>

                {/* Daily Log */}
                <div className="p-4" style={{ background: loggedToday ? 'rgba(34,197,94,0.05)' : 'linear-gradient(135deg,#111,#0a0a0a)', border: `1px solid ${loggedToday ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`, borderLeft: `3px solid ${loggedToday ? 'var(--success)' : 'var(--accent-primary)'}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Scale size={10} color={loggedToday ? 'var(--success)' : 'var(--accent-primary)'} />
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: loggedToday ? 'var(--success)' : 'var(--text-muted)' }}>{loggedToday ? '✓ Today Logged' : "Today's Weight"}</span>
                    <span className="ml-auto font-mono text-[9px]" style={{ color: 'var(--accent-primary)' }}>+2 XP</span>
                  </div>
                  <div className="flex gap-3">
                    <input type="number" step="0.1" value={todayWeight} onChange={e => setTodayWeight(e.target.value)} placeholder="Enter weight"
                      disabled={loggedToday} className="flex-1 p-3 font-mono text-lg text-primary border border-border-color outline-none"
                      style={{ background: 'var(--bg-primary)', opacity: loggedToday ? 0.6 : 1 }} />
                    <button onClick={handleLogWeight} disabled={loggedToday || !todayWeight || saving}
                      className="px-5 py-3 font-display font-bold uppercase tracking-widest text-sm shrink-0 transition-all"
                      style={{ background: loggedToday ? 'var(--success)' : 'var(--accent-primary)', color: '#0a0a0a', opacity: loggedToday || !todayWeight || saving ? 0.5 : 1 }}>
                      {loggedToday ? '✓ Done' : saving ? '...' : 'Log'}
                    </button>
                  </div>
                </div>

                {/* Chart */}
                {chartData.length >= 2 && (
                  <div className="p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown size={10} color="var(--accent-primary)" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Weight Trajectory</span>
                    </div>
                    <div style={{ width: '100%', height: '200px' }}>
                      <ResponsiveContainer>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine y={config.target_weight} stroke="var(--success)" strokeDasharray="4 4" strokeOpacity={0.6} />
                          <Area type="monotone" dataKey="weight" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorWeight)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Milestones */}
                {milestones.length > 0 && (
                  <div className="p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy size={10} color="var(--accent-primary)" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Milestones</span>
                      <span className="ml-auto font-mono text-[9px] text-muted">{milestones.filter(m => m.hit).length}/{milestones.length}</span>
                    </div>
                    <div className="relative">
                      <div className="absolute left-[11px] top-0 bottom-0 w-px" style={{ background: 'var(--border-color)' }} />
                      <div className="flex flex-col gap-3">
                        {milestones.map((m, idx) => (
                          <div key={idx} className="relative flex items-center gap-4 pl-8">
                            <div className="absolute left-[4px] flex items-center justify-center"
                              style={{ width: '16px', height: '16px', border: `2px solid ${m.hit ? 'var(--success)' : m.isTarget ? 'var(--accent-primary)' : 'var(--border-color)'}`, background: m.hit ? 'rgba(34,197,94,0.15)' : 'var(--bg-primary)' }}>
                              {m.hit ? <Check size={8} color="var(--success)" strokeWidth={3} /> : m.isTarget ? <Target size={7} color="var(--accent-primary)" /> : <Lock size={7} color="var(--text-muted)" />}
                            </div>
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <span className="font-display font-bold text-sm" style={{ color: m.hit ? 'var(--success)' : m.isTarget ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                                  {m.isTarget ? `🎯 TARGET: ${m.targetKg} kg` : `-${m.kg} kg (${m.targetKg} kg)`}
                                </span>
                                {m.hit && m.date && <span className="ml-2 font-mono text-[8px] text-muted">{new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                              </div>
                              <span className="font-mono text-[9px] font-bold shrink-0" style={{ color: m.hit ? 'var(--success)' : 'var(--text-muted)' }}>{m.isTarget ? '+100 XP' : '+30 XP'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ─── SLEEP ANALYTICS TAB ─── */}
        {activeTab === 'sleep' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {loadingSleep ? (
              <div className="flex items-center justify-center py-16">
                <div className="font-mono text-muted text-sm animate-pulse">Loading Sleep Data...</div>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Avg Sleep', val: avgSleep ? `${avgSleep}h` : '—', icon: Clock, color: 'var(--info)' },
                    { label: 'Healthy Nights', val: totalNights > 0 ? `${healthyNights}/${totalNights}` : '—', icon: CheckCircle2, color: 'var(--success)' },
                    { label: 'Bedtime Score', val: bedtimeScore !== null ? `${bedtimeScore}%` : '—', icon: Moon, color: 'var(--accent-primary)' },
                    { label: 'Best Streak', val: bestStreak > 0 ? `${bestStreak}d` : '—', icon: Flame, color: 'var(--amber)' }
                  ].map(stat => (
                    <div key={stat.label} className="p-4 flex items-center gap-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                      <stat.icon size={20} style={{ color: stat.color, flexShrink: 0 }} />
                      <div>
                        <div className="font-display font-bold text-primary text-xl leading-none">{stat.val}</div>
                        <div className="font-mono text-[8px] text-muted uppercase tracking-widest mt-0.5">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* War Room Sync Badge */}
                {warRoomHp !== null && (
                  <div className="p-4 flex items-center gap-4" style={{ background: warRoomHp > 60 ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.07)', border: `1px solid ${warRoomHp > 60 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderLeft: `3px solid ${warRoomHp > 60 ? 'var(--danger)' : 'var(--success)'}` }}>
                    <Swords size={20} style={{ color: warRoomHp > 60 ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }} />
                    <div className="flex-1">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-1">WAR ROOM // POOR SLEEP DISCIPLINE THREAT</div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                          <div className="h-full transition-all duration-700" style={{ width: `${warRoomHp}%`, background: warRoomHp > 60 ? 'var(--danger)' : warRoomHp > 30 ? 'var(--warning)' : 'var(--success)' }} />
                        </div>
                        <span className="font-mono text-xs font-bold" style={{ color: warRoomHp > 60 ? 'var(--danger)' : 'var(--success)' }}>{warRoomHp} HP</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sleep Duration Chart */}
                {sleepChartData.length >= 2 ? (
                  <div className="p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 size={10} color="var(--info)" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted">30-Day Sleep Duration</span>
                      <div className="ml-auto flex items-center gap-4">
                        <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, background: 'var(--success)', borderRadius: 2 }} /><span className="font-mono text-[8px] text-muted">Healthy (7–10h)</span></div>
                        <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, background: 'var(--danger)', borderRadius: 2 }} /><span className="font-mono text-[8px] text-muted">Missed target</span></div>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '200px' }}>
                      <ResponsiveContainer>
                        <BarChart data={sleepChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis domain={[0, 12]} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine y={7} stroke="var(--success)" strokeDasharray="4 4" strokeOpacity={0.5} />
                          <ReferenceLine y={10} stroke="var(--warning)" strokeDasharray="4 4" strokeOpacity={0.5} />
                          <Bar dataKey="hours" radius={[2, 2, 0, 0]}>
                            {sleepChartData.map((entry, index) => (
                              <Cell key={index} fill={entry.status === 'healthy' ? 'var(--success)' : 'var(--danger)'} fillOpacity={0.8} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center gap-6 mt-2 flex-wrap">
                      <div className="font-mono text-[8px] text-muted">— Target Zone: 7–10h</div>
                      {wakeScore !== null && <div className="font-mono text-[8px] text-muted">Wake before 9 AM: {wakeScore}% of nights</div>}
                      {currentStreak > 0 && <div className="font-mono text-[8px] text-success">🔥 Current Streak: {currentStreak} nights</div>}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center" style={{ border: '1px dashed var(--border-color)' }}>
                    <Moon size={24} className="text-muted mx-auto mb-3" />
                    <p className="font-mono text-[11px] text-muted uppercase">No sleep logs yet. Log your sleep in Daily Ops to see analytics here.</p>
                  </div>
                )}

                {/* Sleep Log History Table */}
                {sleepLogs.length > 0 && (
                  <div className="p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock size={10} color="var(--info)" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Sleep Log History (Last 30 Days)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full font-mono text-xs">
                        <thead>
                          <tr className="border-b border-border-color text-muted text-[9px] uppercase tracking-widest">
                            <th className="text-left py-2 pr-4">Date</th>
                            <th className="text-left py-2 pr-4">Bedtime</th>
                            <th className="text-left py-2 pr-4">Wake Time</th>
                            <th className="text-left py-2 pr-4">Duration</th>
                            <th className="text-left py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...sleepLogs].reverse().map((log, i) => (
                            <tr key={i} className="border-b border-border-color border-opacity-30 hover:bg-bg-primary transition-colors">
                              <td className="py-2 pr-4 text-muted">{log.date}</td>
                              <td className="py-2 pr-4 text-primary">{log.bedtime || '—'}</td>
                              <td className="py-2 pr-4 text-primary">{log.wake_time || '—'}</td>
                              <td className="py-2 pr-4 font-bold" style={{ color: log.status === 'healthy' ? 'var(--success)' : 'var(--danger)' }}>
                                {log.duration_hours ? `${log.duration_hours}h` : '—'}
                              </td>
                              <td className="py-2">
                                {log.status === 'healthy'
                                  ? <span className="flex items-center gap-1 text-success"><CheckCircle2 size={10} /> Healthy</span>
                                  : <span className="flex items-center gap-1 text-danger"><XCircle size={10} /> Missed</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}
