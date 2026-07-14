'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { motion, AnimatePresence } from 'framer-motion'
import { Scale, TrendingDown, TrendingUp, Trophy, Lock, Check, Target, Plus, ArrowDown, Flame } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, Tooltip, ReferenceLine, XAxis, YAxis } from 'recharts'

export default function BodyRecon() {
  const { user } = useAuth()
  const supabase = createClient()

  // States
  const [config, setConfig] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggedToday, setLoggedToday] = useState(false)
  const [todayWeight, setTodayWeight] = useState('')
  const [xpToast, setXpToast] = useState(null)

  // Setup form
  const [setupStarting, setSetupStarting] = useState('')
  const [setupTarget, setSetupTarget] = useState('')

  const todayStr = getLocalDateStr(new Date())

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [configRes, logsRes] = await Promise.all([
      supabase.from('weight_config').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('weight_logs').select('*').eq('user_id', user.id).order('date', { ascending: true })
    ])

    if (configRes.data) setConfig(configRes.data)
    if (logsRes.data) {
      setLogs(logsRes.data)
      const todayLog = logsRes.data.find(l => l.date === todayStr)
      if (todayLog) {
        setLoggedToday(true)
        setTodayWeight(String(todayLog.weight_kg))
      }
    }
    setLoading(false)
  }, [user, todayStr])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Setup handler ──
  const handleSetup = async () => {
    if (!setupStarting || !setupTarget) return
    setSaving(true)
    const { error } = await supabase.from('weight_config').insert({
      user_id: user.id,
      starting_weight: parseFloat(setupStarting),
      target_weight: parseFloat(setupTarget),
      milestones_awarded: 0
    })
    if (!error) {
      await fetchData()
    }
    setSaving(false)
  }

  // ── Log weight handler ──
  const handleLogWeight = async () => {
    if (!todayWeight || loggedToday) return
    const weight = parseFloat(todayWeight)
    if (isNaN(weight) || weight <= 0 || weight > 500) return
    setSaving(true)

    // Insert log
    const { error } = await supabase.from('weight_logs').upsert({
      user_id: user.id,
      date: todayStr,
      weight_kg: weight
    }, { onConflict: 'user_id,date' })

    if (error) { setSaving(false); return }

    let totalXpEarned = 0

    // +2 XP for logging
    await robustAwardXP(user.id, 2, 'weight_log', todayStr, 'Daily weight log', 'discipline')
    totalXpEarned += 2

    // Check milestones
    if (config) {
      const kgLost = Math.floor(config.starting_weight - weight)
      const alreadyAwarded = config.milestones_awarded || 0

      if (kgLost > alreadyAwarded && kgLost > 0) {
        const newMilestones = kgLost - alreadyAwarded
        // Award +30 XP per kg milestone
        for (let i = 0; i < newMilestones; i++) {
          await robustAwardXP(user.id, 30, 'weight_milestone', `kg_${alreadyAwarded + i + 1}`, `Weight milestone: -${alreadyAwarded + i + 1} kg`, 'discipline')
        }
        totalXpEarned += newMilestones * 30

        await supabase.from('weight_config').update({ milestones_awarded: kgLost }).eq('id', config.id)
      }

      // Check target hit
      if (weight <= config.target_weight && !config.target_hit_at) {
        await robustAwardXP(user.id, 100, 'weight_target', 'target_hit', `Target weight ${config.target_weight} kg reached!`, 'discipline')
        totalXpEarned += 100
        await supabase.from('weight_config').update({ target_hit_at: todayStr }).eq('id', config.id)
      }

      // Maintenance XP (+5 if target already hit and still at/below)
      if (config.target_hit_at && weight <= config.target_weight) {
        await robustAwardXP(user.id, 5, 'weight_maintain', todayStr, 'Weight maintenance bonus', 'discipline')
        totalXpEarned += 5
      }
    }

    setLoggedToday(true)
    setXpToast(totalXpEarned)
    setTimeout(() => setXpToast(null), 3000)
    await fetchData()
    setSaving(false)
  }

  // ── Set new target ──
  const [showNewTarget, setShowNewTarget] = useState(false)
  const [newTargetWeight, setNewTargetWeight] = useState('')

  const handleNewTarget = async () => {
    if (!newTargetWeight) return
    setSaving(true)
    await supabase.from('weight_config').update({
      target_weight: parseFloat(newTargetWeight),
      target_hit_at: null,
      milestones_awarded: Math.floor(config.starting_weight - logs[logs.length - 1]?.weight_kg) || 0
    }).eq('id', config.id)
    setShowNewTarget(false)
    setNewTargetWeight('')
    await fetchData()
    setSaving(false)
  }

  // ── Derived data ──
  const latestWeight = logs.length > 0 ? logs[logs.length - 1].weight_kg : null
  const totalLost = config && latestWeight ? (config.starting_weight - latestWeight).toFixed(1) : 0
  const progressPct = config && latestWeight
    ? Math.min(100, Math.max(0, ((config.starting_weight - latestWeight) / (config.starting_weight - config.target_weight)) * 100))
    : 0
  const isInMaintenance = config?.target_hit_at != null

  // Week comparison
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = getLocalDateStr(weekAgo)
  const weekAgoLog = logs.find(l => l.date <= weekAgoStr)
  const weekChange = weekAgoLog && latestWeight ? (latestWeight - weekAgoLog.weight_kg).toFixed(1) : null

  // Chart data
  const chartData = logs.map(l => ({
    date: new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: parseFloat(l.weight_kg)
  }))

  // Milestones
  const milestones = config ? Array.from({ length: Math.ceil(config.starting_weight - config.target_weight) }, (_, i) => {
    const targetKg = config.starting_weight - (i + 1)
    const hitLog = logs.find(l => parseFloat(l.weight_kg) <= targetKg)
    return {
      kg: i + 1,
      targetKg: targetKg.toFixed(1),
      hit: !!hitLog,
      date: hitLog?.date,
      isTarget: targetKg <= config.target_weight
    }
  }) : []

  // ── Custom tooltip ──
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '6px 10px' }}>
          <p className="font-mono text-[9px] text-muted">{label}</p>
          <p className="font-mono text-[11px] font-bold text-primary">{payload[0].value} kg</p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <AppShell>
        <div className="page-container flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <div className="font-mono text-muted text-sm animate-pulse">Loading Body Recon...</div>
        </div>
      </AppShell>
    )
  }

  // ── SETUP SCREEN ──
  if (!config) {
    return (
      <AppShell>
        <div className="page-container max-w-lg mx-auto" style={{ paddingTop: '60px' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Scale size={28} color="var(--accent-primary)" />
              <h1 className="font-display font-bold text-primary tracking-tight" style={{ fontSize: '2rem' }}>
                BODY RECON
              </h1>
            </div>
            <p className="font-mono text-[11px] text-muted uppercase tracking-widest">
              Track · Transform · Prove
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              padding: '28px',
              background: 'linear-gradient(135deg, #111111, #0a0a0a)',
              border: '1px solid var(--border-color)',
              borderLeft: '3px solid var(--accent-primary)',
            }}
          >
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-6">
              Initialize Tracking Parameters
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={setupStarting}
                  onChange={e => setSetupStarting(e.target.value)}
                  placeholder="e.g. 80"
                  className="w-full p-3 font-mono text-lg text-primary bg-bg-primary border border-border-color focus:border-amber outline-none"
                  style={{ background: 'var(--bg-primary)' }}
                />
              </div>

              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">
                  Target Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={setupTarget}
                  onChange={e => setSetupTarget(e.target.value)}
                  placeholder="e.g. 70"
                  className="w-full p-3 font-mono text-lg text-primary bg-bg-primary border border-border-color focus:border-amber outline-none"
                  style={{ background: 'var(--bg-primary)' }}
                />
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2 font-mono text-[9px] text-muted">
                  <Flame size={10} color="var(--accent-primary)" />
                  <span>+2 XP per daily log · +30 XP per kg lost · +100 XP at target</span>
                </div>
              </div>

              <button
                onClick={handleSetup}
                disabled={!setupStarting || !setupTarget || saving}
                className="w-full p-4 font-display font-bold uppercase tracking-widest text-sm transition-all"
                style={{
                  background: setupStarting && setupTarget ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: setupStarting && setupTarget ? '#0a0a0a' : 'var(--text-muted)',
                  cursor: setupStarting && setupTarget ? 'pointer' : 'not-allowed',
                  opacity: saving ? 0.5 : 1
                }}
              >
                {saving ? 'Initializing...' : 'Begin Tracking'}
              </button>
            </div>
          </motion.div>
        </div>
      </AppShell>
    )
  }

  // ── MAIN TRACKING VIEW ──
  return (
    <AppShell>
      <div className="page-container max-w-[1200px] pb-10">
        {/* XP Toast */}
        <AnimatePresence>
          {xpToast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-[999] px-5 py-3 font-display font-bold text-lg tracking-tight"
              style={{ background: 'var(--success)', color: '#0a0a0a', boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)' }}
            >
              +{xpToast} XP
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Scale size={22} color="var(--accent-primary)" />
          <div>
            <h1 className="font-display font-bold text-primary tracking-tight" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)' }}>
              BODY RECON
            </h1>
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest">
              {isInMaintenance ? 'Maintenance Mode · +5 XP Daily' : 'Active Transformation'}
            </p>
          </div>
        </div>

        {/* Target Hit Banner */}
        <AnimatePresence>
          {isInMaintenance && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 overflow-hidden"
            >
              <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
                style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04))', border: '1px solid rgba(34, 197, 94, 0.3)', borderLeft: '3px solid var(--success)' }}
              >
                <div className="flex items-center gap-3">
                  <Trophy size={18} color="var(--success)" />
                  <div>
                    <div className="font-display font-bold text-primary">TARGET REACHED!</div>
                    <div className="font-mono text-[9px] text-muted">Hit {config.target_weight} kg on {new Date(config.target_hit_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewTarget(true)}
                  className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest border border-success text-success hover:bg-success hover:text-bg-primary transition-colors"
                >
                  Set New Target
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Target Modal */}
        <AnimatePresence>
          {showNewTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.8)' }}
              onClick={() => setShowNewTarget(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm p-6"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
              >
                <h3 className="font-display font-bold text-primary text-lg mb-4">SET NEW TARGET</h3>
                <input
                  type="number"
                  step="0.1"
                  value={newTargetWeight}
                  onChange={e => setNewTargetWeight(e.target.value)}
                  placeholder="New target weight (kg)"
                  className="w-full p-3 font-mono text-lg text-primary border border-border-color mb-4 outline-none"
                  style={{ background: 'var(--bg-primary)' }}
                />
                <button
                  onClick={handleNewTarget}
                  disabled={!newTargetWeight || saving}
                  className="w-full p-3 font-display font-bold uppercase tracking-widest text-sm"
                  style={{ background: 'var(--accent-primary)', color: '#0a0a0a', opacity: !newTargetWeight || saving ? 0.5 : 1 }}
                >
                  {saving ? 'Saving...' : 'Update Target'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div className="font-display font-bold text-primary tracking-tighter" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', lineHeight: 1 }}>
              {config.starting_weight}
            </div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-muted mt-1.5">Start</div>
          </div>
          <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${parseFloat(totalLost) > 0 ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-color)'}`, borderLeft: `3px solid ${parseFloat(totalLost) > 0 ? 'var(--success)' : 'var(--border-color)'}` }}>
            <div className="font-display font-bold tracking-tighter" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', lineHeight: 1, color: latestWeight ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {latestWeight || '—'}
            </div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-muted mt-1.5">Current</div>
          </div>
          <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div className="font-display font-bold tracking-tighter" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', lineHeight: 1, color: 'var(--accent-primary)' }}>
              {config.target_weight}
            </div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-muted mt-1.5">Target</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-5 p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              {parseFloat(totalLost) > 0 ? (
                <TrendingDown size={12} color="var(--success)" />
              ) : (
                <TrendingUp size={12} color="var(--danger)" />
              )}
              <span className="font-mono text-[10px] font-bold" style={{ color: parseFloat(totalLost) > 0 ? 'var(--success)' : 'var(--danger)' }}>
                {parseFloat(totalLost) > 0 ? `▼ ${totalLost} kg lost` : parseFloat(totalLost) < 0 ? `▲ ${Math.abs(totalLost)} kg gained` : 'No change'}
              </span>
            </div>
            <span className="font-mono text-[10px] font-bold text-primary">{Math.round(progressPct)}%</span>
          </div>
          <div style={{ height: '4px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', background: progressPct >= 100 ? 'var(--success)' : 'var(--accent-primary)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          {weekChange !== null && (
            <div className="font-mono text-[9px] text-muted mt-2">
              This week: {parseFloat(weekChange) <= 0 ? `▼ ${Math.abs(weekChange)} kg` : `▲ ${weekChange} kg`}
            </div>
          )}
        </div>

        {/* Daily Log */}
        <div className="mb-5 p-4" style={{
          background: loggedToday ? 'rgba(34, 197, 94, 0.05)' : 'linear-gradient(135deg, #111111, #0a0a0a)',
          border: `1px solid ${loggedToday ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-color)'}`,
          borderLeft: `3px solid ${loggedToday ? 'var(--success)' : 'var(--accent-primary)'}`
        }}>
          <div className="flex items-center gap-2 mb-3">
            <Scale size={10} color={loggedToday ? 'var(--success)' : 'var(--accent-primary)'} />
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: loggedToday ? 'var(--success)' : 'var(--text-muted)' }}>
              {loggedToday ? '✓ Today Logged' : "Today's Weight"}
            </span>
            <span className="ml-auto font-mono text-[9px]" style={{ color: 'var(--accent-primary)' }}>+2 XP</span>
          </div>
          <div className="flex gap-3">
            <input
              type="number"
              step="0.1"
              value={todayWeight}
              onChange={e => setTodayWeight(e.target.value)}
              placeholder="Enter weight"
              disabled={loggedToday}
              className="flex-1 p-3 font-mono text-lg text-primary border border-border-color outline-none"
              style={{ background: 'var(--bg-primary)', opacity: loggedToday ? 0.6 : 1 }}
            />
            <button
              onClick={handleLogWeight}
              disabled={loggedToday || !todayWeight || saving}
              className="px-5 py-3 font-display font-bold uppercase tracking-widest text-sm shrink-0 transition-all"
              style={{
                background: loggedToday ? 'var(--success)' : 'var(--accent-primary)',
                color: '#0a0a0a',
                opacity: loggedToday || !todayWeight || saving ? 0.5 : 1,
                cursor: loggedToday ? 'default' : 'pointer'
              }}
            >
              {loggedToday ? '✓ Done' : saving ? '...' : 'Log'}
            </button>
          </div>
        </div>

        {/* Weight Graph */}
        {chartData.length >= 2 && (
          <div className="mb-5 p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
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
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div style={{ width: 12, height: 2, background: 'var(--accent-primary)' }} />
                <span className="font-mono text-[8px] text-muted">Weight</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ width: 12, height: 0, borderTop: '2px dashed var(--success)' }} />
                <span className="font-mono text-[8px] text-muted">Target ({config.target_weight} kg)</span>
              </div>
            </div>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={10} color="var(--accent-primary)" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Milestones</span>
              <span className="ml-auto font-mono text-[9px] text-muted">
                {milestones.filter(m => m.hit).length}/{milestones.length}
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-[11px] top-0 bottom-0 w-px" style={{ background: 'var(--border-color)' }} />
              <div className="flex flex-col gap-3">
                {milestones.map((m, idx) => (
                  <div key={idx} className="relative flex items-center gap-4 pl-8">
                    <div className="absolute left-[4px] flex items-center justify-center" style={{
                      width: '16px', height: '16px',
                      border: `2px solid ${m.hit ? 'var(--success)' : m.isTarget ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      background: m.hit ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-primary)',
                    }}>
                      {m.hit ? <Check size={8} color="var(--success)" strokeWidth={3} /> : m.isTarget ? <Target size={7} color="var(--accent-primary)" /> : <Lock size={7} color="var(--text-muted)" />}
                    </div>
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <div>
                        <span className="font-display font-bold text-sm" style={{ color: m.hit ? 'var(--success)' : m.isTarget ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                          {m.isTarget ? `🎯 TARGET: ${m.targetKg} kg` : `-${m.kg} kg (${m.targetKg} kg)`}
                        </span>
                        {m.hit && m.date && (
                          <span className="ml-2 font-mono text-[8px] text-muted">
                            {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[9px] font-bold shrink-0" style={{ color: m.hit ? 'var(--success)' : 'var(--text-muted)' }}>
                        {m.isTarget ? '+100 XP' : '+30 XP'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
