'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useOS } from '@/lib/context/OSContext'
import { XP_RULES } from '@/lib/xpRules'
import { robustRemoveXP } from '@/lib/utils/xpFallback'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { Shield, Target, AlertTriangle } from 'lucide-react'

export default function ScreenIntel() {
  const { auth: { user }, xp: { awardXP }, goals: { mainQuest, updateProgress } } = useOS()
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

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">GATHERING INTEL...</span></div></AppShell>

  // Chart Logic (Last 7 days)
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return getLocalDateStr(d)
  })

  const chartData = last7Days.map(d => {
    const log = logs.find(l => l.date === d)
    return {
      date: d.substring(5).replace('-', '/'),
      total: log?.total_hours || 0,
      focus: log?.focus_hours || 0,
      doom: log?.doom_scroll_minutes || 0,
      streaming: log?.streaming_hours || 0
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

          <HudPanel label="7-DAY ANALYSIS" style={{ height: '400px' }}>
            <div style={{ width: '100%', height: '350px', minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorStream" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{stroke: 'rgba(255,255,255,0.2)'}}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                    itemStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    labelStyle={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }} />
                  <Area type="monotone" dataKey="total" name="Total (h)" stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" dot={{ fill: '#94a3b8', r: 3 }} />
                  <Area type="monotone" dataKey="focus" name="Focus (h)" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFocus)" dot={{ fill: '#38bdf8', r: 3.5 }} />
                  <Area type="monotone" dataKey="streaming" name="Streaming (h)" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorStream)" dot={{ fill: '#f59e0b', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>
        </div>

        <HudPanel label="DOOMSCROLL TREND (MINUTES)" style={{ height: '300px' }}>
          <div style={{ width: '100%', height: '250px', minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDoom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{stroke: 'rgba(239,68,68,0.4)'}}
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--danger)', borderRadius: '8px' }}
                  itemStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  labelStyle={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="doom" name="Doomscroll (m)" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDoom)" dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HudPanel>

      </div>
    </AppShell>
  )
}
