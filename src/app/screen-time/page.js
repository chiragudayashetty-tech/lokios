'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useOS } from '@/lib/context/OSContext'
import { robustRemoveXP } from '@/lib/utils/xpFallback'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { Shield, Target, AlertTriangle } from 'lucide-react'

export default function ScreenIntel() {
  const { auth: { user } = {}, xp: { awardXP } = {}, goals: { mainQuest, updateProgress } = {} } = useOS() || {}
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [xpAnim, setXpAnim] = useState(null)
  
  const [totalHours, setTotalHours] = useState(0)
  const [focusHours, setFocusHours] = useState(0)
  const [doomScroll, setDoomScroll] = useState(0)
  const [streamingHours, setStreamingHours] = useState(0)
  
  const getLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - (offset*60*1000))
    return local.toISOString().split('T')[0]
  }

  const [date, setDate] = useState(getLocalDateStr(new Date()))

  useEffect(() => {
    if (!user) return
    const fetchLogs = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('screen_time_logs').select('*').eq('user_id', user.id).order('date', { ascending: false })
      if (data) setLogs(data)
      setLoading(false)
    }
    fetchLogs()
  }, [user])

  useEffect(() => {
    const todayLog = logs.find(l => l.date === date)
    if (todayLog) {
      setTotalHours(todayLog.total_hours || 0)
      setFocusHours(todayLog.focus_hours || 0)
      setDoomScroll(todayLog.doom_scroll_minutes || 0)
      setStreamingHours(todayLog.streaming_hours || 0)
      setNotes(todayLog.notes || '')
    } else {
      setTotalHours(0)
      setFocusHours(0)
      setDoomScroll(0)
      setStreamingHours(0)
      setNotes('')
    }
  }, [date, logs])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!user || saving) return
    setSaving(true)
    try {
      const supabase = createClient()
    
    const parsedDoom = parseInt(doomScroll) || 0;
    
    const payload = {
      user_id: user.id,
      date,
      total_hours: parseFloat(totalHours),
      focus_hours: parseFloat(focusHours),
      doom_scroll_minutes: parsedDoom,
      streaming_hours: parseFloat(streamingHours) || 0,
      notes
    }

    // Manual check and insert/update instead of upsert
    const { data: existing } = await supabase.from('screen_time_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', date)
      .single()

    let savedLogId = existing?.id;

    let saveError;
    if (existing) {
      const { data: updated, error } = await supabase.from('screen_time_logs').update(payload).eq('id', existing.id).select().single()
      saveError = error
      if (updated) savedLogId = updated.id;
    } else {
      const { data: inserted, error } = await supabase.from('screen_time_logs').insert(payload).select().single()
      saveError = error
      if (inserted) savedLogId = inserted.id;
    }

    if (saveError) {
      console.error("Supabase save error:", saveError)
      alert("Failed to save screen time: " + saveError.message)
      return
    }

    const { data } = await supabase.from('screen_time_logs').select('*').eq('user_id', user.id).order('date', { ascending: false })
    if (data) setLogs(data)

    // Remove any previously awarded XP for this exact screen time log to prevent duplicates
    if (savedLogId) {
      await robustRemoveXP(user.id, 'screen_time', savedLogId)
      // Cleanup for legacy bug: also remove any XP that was incorrectly logged under the date string
      await robustRemoveXP(user.id, 'screen_time', date)
    }

    // Calculate dynamic XP
    let xpAmount = 0
    let reasons = []

    const tHours = parseFloat(totalHours) || 0
    const fHours = parseFloat(focusHours) || 0
    const dMins = parsedDoom
    const sHours = parseFloat(streamingHours) || 0

    // 1. Total Hours: Target 6
    const totalDiff = 6 - tHours
    const totalXp = Math.round(totalDiff * 10)
    if (totalXp !== 0) {
      xpAmount += totalXp
      reasons.push(`Total Time: ${totalXp > 0 ? '+' : ''}${totalXp}`)
    }

    // 2. Doom Scroll: Target 60 mins (1 hr)
    const doomDiff = 60 - dMins
    const doomXp = Math.round(doomDiff * 0.5)
    if (doomXp !== 0) {
      xpAmount += doomXp
      reasons.push(`Doomscroll: ${doomXp > 0 ? '+' : ''}${doomXp}`)
    }

    // 3. Focus Hours: Target 3
    const focusDiff = fHours - 3
    const focusXp = Math.round(focusDiff * 15)
    if (focusXp !== 0) {
      xpAmount += focusXp
      reasons.push(`Focus: ${focusXp > 0 ? '+' : ''}${focusXp}`)
    }

    // 4. Streaming Hours: Target 1h (60 min)
    const streamingDiff = 1 - sHours
    const streamingXp = Math.round(streamingDiff * 10)
    if (streamingXp !== 0) {
      xpAmount += streamingXp
      reasons.push(`Streaming: ${streamingXp > 0 ? '+' : ''}${streamingXp}`)
    }

    let finalReason = reasons.join(' | ') || 'Screen Time logged'

    // Update Phone Addiction Battle based on all metrics
    let hpChange = 0;
    if (tHours <= 6) hpChange -= 5; else hpChange += 10;
    if (dMins <= 60) hpChange -= 5; else hpChange += 10;
    if (sHours <= 2) hpChange -= 5; else hpChange += 10;

    const { data: bp } = await supabase.from('user_blueprints').select('*').eq('user_id', user.id).single()
    if (bp && bp.battles) {
      let battleUpdated = false
      const updatedBattles = bp.battles.map(battle => {
        const bName = battle.name?.toLowerCase() || ''
        if (battle.status !== 'defeated' && (bName.includes('phone') || bName.includes('screen') || bName.includes('addiction'))) {
          battleUpdated = true
          const oldHp = battle.hp ?? 100
          const newHp = Math.max(0, Math.min(100, oldHp + hpChange))
          
          if (newHp === 0 && oldHp > 0) {
            finalReason += ' (PHONE WAR WON! 🏆)'
          } else if (hpChange < 0) {
            finalReason += ` (${hpChange} Enemy HP)`
          } else if (hpChange > 0) {
            finalReason += ` (+${hpChange} Enemy Heal)`
          }
          
          return { ...battle, hp: newHp, status: newHp === 0 ? 'defeated' : battle.status }
        }
        return battle
      })
      
      if (battleUpdated) {
        await supabase.from('user_blueprints').update({ battles: updatedBattles }).eq('id', bp.id)
      }
    }

    if (xpAmount !== 0 && savedLogId) {
      await awardXP(xpAmount, 'screen_time', savedLogId, finalReason, 'discipline')
      setXpAnim({ amount: xpAmount, reason: finalReason })
      setTimeout(() => setXpAnim(null), 4000)
    }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <AppShell>
      <div className="flex-center h-full flex-col gap-2">
        <span className="typewriter-text">GATHERING INTEL...</span>
        <span className="font-mono text-xs text-cyan-400 font-bold tracking-widest uppercase animate-pulse flex items-center gap-1.5">
          <span>❄️</span> WINTER IS COMING <span>❄️</span>
        </span>
      </div>
    </AppShell>
  )

  // Unified Digital Discipline Score formula per day:
  // Score = (focusPct * 40) + (cleanScreenPct * 35) + (cleanDoomPct * 25)
  // where: focusPct = min(focus/3, 1), cleanScreenPct = max(0, 1 - (total-4)/8), cleanDoomPct = max(0, 1 - doom/120)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return getLocalDateStr(d)
  })

  const chartData = last7Days.map(d => {
    const log = logs.find(l => l.date === d)
    const total = log?.total_hours || 0
    const focus = log?.focus_hours || 0
    const doom = log?.doom_scroll_minutes || 0
    const streaming = log?.streaming_hours || 0
    const unfocused = Math.max(0, total - focus)

    // Formula emphasizing Doomscroll, Unfocused Wasted Time (Total - Focus), and Streaming:
    // 1. Doomscroll Factor (40%): 0m = 40pts, 120m+ = 0pts
    const doomScore = Math.max(0, 40 * (1 - doom / 120))
    // 2. Unfocused Wasted Time (35%): 0h = 35pts, 5h+ = 0pts
    const unfocusedScore = Math.max(0, 35 * (1 - unfocused / 5))
    // 3. Streaming Factor (25%): 0h = 25pts, 3h+ = 0pts
    const streamingScore = Math.max(0, 25 * (1 - streaming / 3))

    // Weighted discipline score
    const score = log ? Math.round(doomScore + unfocusedScore + streamingScore) : null

    return {
      date: d.substring(5).replace('-', '/'),
      score,
      total,
      focus,
      unfocused,
      doom,
      streaming,
      logged: !!log
    }
  })

  return (
    <AppShell>
      <div className="page-container" style={{ maxWidth: '1400px' }}>
        <header className="page-header mb-8">
          <h1 className="page-title flex items-center gap-3"><Shield className="text-info" /> SCREEN INTEL</h1>
          <p className="page-subtitle font-mono uppercase text-xs">Monitor device usage and protect discipline.</p>
        </header>

        <AnimatePresence>
          {xpAnim && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className={`p-4 mb-6 border ${xpAnim.amount > 0 ? 'border-success bg-success-subtle text-success' : 'border-danger bg-danger-subtle text-danger'} flex-between`}>
              <span className="font-mono text-sm uppercase">{xpAnim.reason}</span>
              <span className="font-display text-xl font-bold">{xpAnim.amount > 0 ? '+' : ''}{xpAnim.amount} XP</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid-2 gap-6 mb-8">
          <HudPanel label="DATA ENTRY" className="flex-col h-full">
            <form onSubmit={handleSave} className="flex-col gap-5 flex-1">
              <div>
                <label className="font-mono text-[10px] text-muted mb-1 block uppercase tracking-widest">Date of Intel</label>
                <input type="date" className="input font-mono text-sm w-full" value={date} onChange={e=>setDate(e.target.value)} required />
              </div>
              <div className="grid-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] text-muted mb-1 block uppercase tracking-widest">Total Hours</label>
                  <input type="number" step="0.5" min="0" className="input font-mono text-xl w-full" value={totalHours} onChange={e=>setTotalHours(e.target.value)} />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-info mb-1 block uppercase tracking-widest flex items-center gap-1"><Target size={12}/> Focus Hours</label>
                  <input type="number" step="0.5" min="0" className="input font-mono text-xl border-info text-info w-full" value={focusHours} onChange={e=>setFocusHours(e.target.value)} />
                </div>
              </div>
              <div className="grid-2 gap-4">
                <div className="p-4 border border-danger-subtle bg-bg-tertiary rounded-lg">
                  <label className="font-mono text-[10px] text-danger mb-2 block uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={12}/> Doom Scroll (Minutes)</label>
                  <input type="number" min="0" className="input font-mono text-2xl border-danger text-danger w-full" value={doomScroll} onChange={e=>setDoomScroll(e.target.value)} />
                </div>
                <div className="p-4 border border-amber-subtle bg-bg-tertiary rounded-lg">
                  <label className="font-mono text-[10px] text-amber mb-2 block uppercase tracking-widest flex items-center gap-1">Streaming (Hours)</label>
                  <input type="number" step="0.5" min="0" className="input font-mono text-2xl border-amber text-amber w-full" value={streamingHours} onChange={e=>setStreamingHours(e.target.value)} />
                </div>
              </div>
              <div className="mt-auto">
                <button type="submit" disabled={saving} className="btn btn-primary w-full py-3">{saving ? 'TRANSMITTING...' : 'TRANSMIT DATA'}</button>
              </div>
            </form>
          </HudPanel>
        </div>

        {/* ── UNIFIED DIGITAL DISCIPLINE SCORE CHART ── */}
        <HudPanel label="" className="p-0 overflow-hidden">
          {/* Chart Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--info)', boxShadow: '0 0 8px var(--info)' }} />
              <span className="font-mono text-xs uppercase tracking-widest text-muted font-bold">DIGITAL DISCIPLINE SCORE — 7-DAY ANALYSIS</span>
            </div>
            <div className="font-mono text-[10px] text-muted">
              Formula: No Doom (40%) + Unfocused Time (35%) + Low Streaming (25%)
            </div>
          </div>

          {/* Score Pills Row */}
          <div className="flex gap-2 px-5 pb-3 overflow-x-auto">
            {chartData.map((d, i) => {
              const s = d.score
              const color = s === null ? 'rgba(255,255,255,0.1)' : s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'
              const textColor = s === null ? 'var(--text-muted)' : s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'
              return (
                <div
                  key={i}
                  className="shrink-0 px-3 py-2 rounded-xl font-mono text-[9px] font-bold border text-center min-w-[56px]"
                  style={{ background: `${color}15`, borderColor: `${color}40`, color: textColor }}
                >
                  <div className="text-[8px] text-muted mb-0.5">{d.date}</div>
                  <div className="text-sm font-display">{s === null ? '—' : s}</div>
                </div>
              )
            })}
          </div>

          {/* The Chart */}
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                    <stop offset="60%" stopColor="#38bdf8" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <filter id="scoreGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
                <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} width={35} />
                <ReferenceLine y={75} stroke="rgba(34,197,94,0.3)" strokeDasharray="4 4" label={{ value: '75 OPTIMAL', position: 'right', fontSize: 9, fill: 'rgba(34,197,94,0.7)', fontFamily: 'var(--font-mono)' }} />
                <ReferenceLine y={50} stroke="rgba(245,158,11,0.3)" strokeDasharray="4 4" label={{ value: '50 CAUTION', position: 'right', fontSize: 9, fill: 'rgba(245,158,11,0.7)', fontFamily: 'var(--font-mono)' }} />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeDasharray: '4 4', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload
                    const s = d?.score
                    const scoreColor = s === null ? 'var(--text-muted)' : s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'
                    return (
                      <div className="p-3 bg-bg-secondary/98 border border-border-color rounded-xl shadow-2xl font-mono text-xs space-y-1.5 min-w-[190px]" style={{ boxShadow: '0 0 24px rgba(0,0,0,0.6)' }}>
                        <div className="font-display font-bold text-primary border-b border-border-color pb-1.5">{label}</div>
                        {s === null
                          ? <div className="text-muted">No data logged</div>
                          : <>
                            <div className="flex justify-between"><span className="text-muted">Discipline Score</span><span className="font-bold" style={{ color: scoreColor }}>{s}/100</span></div>
                            <div className="flex justify-between"><span className="text-muted">Total Screen</span><span className="text-primary">{d?.total}h</span></div>
                            <div className="flex justify-between"><span className="text-muted">Focus Hours</span><span className="text-info">{d?.focus}h</span></div>
                            <div className="flex justify-between"><span className="text-muted">Unfocused Wasted</span><span className="text-amber font-bold">{d?.unfocused}h</span></div>
                            <div className="flex justify-between"><span className="text-muted">Doomscroll</span><span className="text-danger font-bold">{d?.doom}m</span></div>
                            <div className="flex justify-between"><span className="text-muted">Streaming</span><span className="text-amber font-bold">{d?.streaming}h</span></div>
                          </>
                        }
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#scoreGrad)"
                  connectNulls={false}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    if (payload.score === null) return null
                    const s = payload.score
                    const color = s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'
                    const isLast = payload.date === chartData[chartData.length-1]?.date
                    return <circle key={payload.date} cx={cx} cy={cy} r={isLast ? 6 : 4} fill={color} stroke="#fff" strokeWidth={isLast ? 2 : 1.5} filter={isLast ? 'url(#scoreGlow)' : 'none'} />
                  }}
                  activeDot={{ r: 7, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HudPanel>

      </div>
    </AppShell>
  )
}
