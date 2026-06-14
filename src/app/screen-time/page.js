'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useOS } from '@/lib/context/OSContext'
import { XP_RULES } from '@/lib/xpRules'
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
      setNotes(todayLog.notes || '')
    } else {
      setTotalHours(0)
      setFocusHours(0)
      setDoomScroll(0)
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
      notes
    }

    const { data: upsertData, error: upsertError } = await supabase.from('screen_time_logs').upsert(payload, { onConflict: 'user_id,date' }).select()
    if (upsertError) {
      console.error("Supabase upsert error:", upsertError)
      alert("Failed to save screen time: " + upsertError.message)
      return
    }

    const { data } = await supabase.from('screen_time_logs').select('*').eq('user_id', user.id).order('date', { ascending: false })
    if (data) setLogs(data)

    // Check if we already awarded XP for this exact date to prevent idempotency bugs
    const existingLog = logs.find(l => l.date === date)
    const alreadyAwarded = existingLog && existingLog.doom_scroll_minutes !== undefined

    if (alreadyAwarded) {
      return // Prevent double XP if they just click save again
    }

    // Calculate XP
    let xpAmount = 0
    let reason = ''
    if (parsedDoom === 0) {
      xpAmount = XP_RULES.SCREEN_TIME.PERFECT_DAY
      reason = 'Perfect Screen Discipline (0 Doomscroll)'
    } else if (parsedDoom <= 30) {
      xpAmount = XP_RULES.SCREEN_TIME.MODERATE
      reason = 'Maintained Acceptable Screen Discipline'
    } else if (parsedDoom >= 60) {
      xpAmount = XP_RULES.SCREEN_TIME.PENALTY
      reason = 'Failed Screen Discipline (>60m Doomscroll)'
      
      // Damage Battle/Main Quest
      if (mainQuest && typeof mainQuest.progress === 'number') {
        const newProgress = Math.max(0, mainQuest.progress - 5)
        await updateProgress(mainQuest.id, newProgress)
        reason += ' (-5% Battle Health)'
      }
    }

      if (xpAmount !== 0) {
        await awardXP(xpAmount, 'screen_time', date, reason, 'discipline')
        setXpAnim({ amount: xpAmount, reason })
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
      doom: log?.doom_scroll_minutes || 0
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
              <div className="p-4 border border-danger-subtle bg-bg-tertiary">
                <label className="font-mono text-[10px] text-danger mb-2 block uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={12}/> Doom Scroll (Minutes)</label>
                <input type="number" min="0" className="input font-mono text-2xl border-danger text-danger w-full mb-2" value={doomScroll} onChange={e=>setDoomScroll(e.target.value)} />
                <p className="font-mono text-[9px] text-muted">
                  0 mins = <span className="text-success">+{XP_RULES.SCREEN_TIME.PERFECT_DAY} XP</span> |
                  &gt;60 mins = <span className="text-danger">{XP_RULES.SCREEN_TIME.PENALTY} XP</span>
                </p>
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
