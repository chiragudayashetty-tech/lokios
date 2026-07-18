'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useOS } from '@/lib/context/OSContext'
import { XP_RULES } from '@/lib/xpRules'
import { robustRemoveXP } from '@/lib/utils/xpFallback'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
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

    // 4. Streaming Hours: Target 2
    const streamingDiff = 2 - sHours
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
                  <input type="number" step="0.5" min="0" className="input font-mono text-xl w-full mb-2" value={totalHours} onChange={e=>setTotalHours(e.target.value)} />
                  <p className="font-mono text-[9px] text-muted">
                    &lt; 6 hrs = <span className="text-success">+10 XP/hr</span> | &gt; 6 hrs = <span className="text-danger">-10 XP/hr</span>
                  </p>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-info mb-1 block uppercase tracking-widest flex items-center gap-1"><Target size={12}/> Focus Hours</label>
                  <input type="number" step="0.5" min="0" className="input font-mono text-xl border-info text-info w-full mb-2" value={focusHours} onChange={e=>setFocusHours(e.target.value)} />
                  <p className="font-mono text-[9px] text-muted">
                    &gt; 3 hrs = <span className="text-success">+15 XP/hr</span> | &lt; 3 hrs = <span className="text-danger">-15 XP/hr</span>
                  </p>
                </div>
              </div>
              <div className="grid-2 gap-4">
                <div className="p-4 border border-danger-subtle bg-bg-tertiary">
                  <label className="font-mono text-[10px] text-danger mb-2 block uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={12}/> Doom Scroll (Minutes)</label>
                  <input type="number" min="0" className="input font-mono text-2xl border-danger text-danger w-full mb-2" value={doomScroll} onChange={e=>setDoomScroll(e.target.value)} />
                  <p className="font-mono text-[9px] text-muted">
                    &lt; 60 mins = <span className="text-success">+0.5 XP/min</span> | &gt; 60 mins = <span className="text-danger">-0.5 XP/min</span>
                  </p>
                </div>
                <div className="p-4 border border-amber-subtle bg-bg-tertiary">
                  <label className="font-mono text-[10px] text-amber mb-2 block uppercase tracking-widest flex items-center gap-1">Streaming (Hours)</label>
                  <input type="number" step="0.5" min="0" className="input font-mono text-2xl border-amber text-amber w-full mb-2" value={streamingHours} onChange={e=>setStreamingHours(e.target.value)} />
                  <p className="font-mono text-[9px] text-muted">
                    &lt; 2 hrs = <span className="text-success">+10 XP/hr</span> | &gt; 2 hrs = <span className="text-danger">-10 XP/hr</span>
                  </p>
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
                <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'var(--bg-tertiary)'}}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '0' }}
                    itemStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    labelStyle={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  />
                  <Legend iconType="square" wrapperStyle={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }} />
                  <Bar dataKey="total" name="Total (h)" fill="var(--border-strong)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="focus" name="Focus (h)" fill="var(--info)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="streaming" name="Streaming (h)" fill="var(--amber)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>
        </div>

        <HudPanel label="DOOMSCROLL TREND (MINUTES)" style={{ height: '300px' }}>
          <div style={{ width: '100%', height: '250px', minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: 'var(--bg-tertiary)'}}
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '0' }}
                  itemStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  labelStyle={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="doom" name="Doomscroll (m)" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.doom >= 60 ? 'var(--danger)' : entry.doom > 0 ? 'var(--warning)' : 'var(--success)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </HudPanel>

      </div>
    </AppShell>
  )
}
