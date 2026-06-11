'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { motion } from 'framer-motion'

export default function ScreenIntel() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [totalHours, setTotalHours] = useState(0)
  const [focusHours, setFocusHours] = useState(0)
  const [doomScroll, setDoomScroll] = useState(0)
  const [notes, setNotes] = useState('')

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
    if (!user) return
    const supabase = createClient()
    
    const payload = {
      user_id: user.id,
      date,
      total_hours: parseFloat(totalHours),
      focus_hours: parseFloat(focusHours),
      doom_scroll_minutes: parseInt(doomScroll),
      notes,
      updated_at: new Date().toISOString()
    }

    await supabase.from('screen_time_logs').upsert(payload, { onConflict: 'user_id,date' })
    const { data } = await supabase.from('screen_time_logs').select('*').eq('user_id', user.id).order('date', { ascending: false })
    if (data) setLogs(data)
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">GATHERING INTEL...</span></div></AppShell>

  // Chart Logic (Last 7 days)
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const chartData = last7Days.map(d => {
    const log = logs.find(l => l.date === d)
    return {
      date: d.substring(5), // MM-DD
      total: log?.total_hours || 0,
      focus: log?.focus_hours || 0
    }
  })

  const maxHours = Math.max(...chartData.map(d => d.total), 12)

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">SCREEN INTEL</h1>
          <p className="page-subtitle font-mono uppercase text-xs">Monitor device usage and focus metrics.</p>
        </header>

        <div className="grid-2 mb-8">
          <HudPanel label="DATA ENTRY">
            <form onSubmit={handleSave} className="flex-col gap-4">
              <div>
                <label className="font-mono text-xs text-muted mb-1 block">DATE OF INTEL</label>
                <input type="date" className="input font-mono" value={date} onChange={e=>setDate(e.target.value)} required />
              </div>
              <div className="grid-2">
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">TOTAL HOURS</label>
                  <input type="number" step="0.5" min="0" className="input font-mono text-xl" value={totalHours} onChange={e=>setTotalHours(e.target.value)} />
                </div>
                <div>
                  <label className="font-mono text-xs text-amber mb-1 block">FOCUS HOURS</label>
                  <input type="number" step="0.5" min="0" className="input font-mono text-xl border-amber text-amber" value={focusHours} onChange={e=>setFocusHours(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="font-mono text-xs text-danger mb-1 block">DOOM SCROLL (MINUTES)</label>
                <input type="number" min="0" className="input font-mono text-xl border-danger text-danger" value={doomScroll} onChange={e=>setDoomScroll(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary mt-2">TRANSMIT DATA</button>
            </form>
          </HudPanel>

          <HudPanel label="7-DAY ANALYSIS" glow>
            <div className="flex items-end gap-2 h-[250px] pt-8 pb-4 border-b border-border-color">
              {chartData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-10 bg-secondary border border-border-color p-1 font-mono text-xs hidden group-hover:block z-10 whitespace-nowrap">
                    Tot: {data.total}h | Foc: {data.focus}h
                  </div>
                  {/* Bars container */}
                  <div className="w-full relative bg-tertiary" style={{ height: `${(data.total / maxHours) * 100}%`, minHeight: '4px' }}>
                    {/* Focus fill */}
                    <div className="absolute bottom-0 left-0 right-0 bg-accent-primary opacity-80 transition-all" style={{ height: `${data.total > 0 ? (data.focus / data.total) * 100 : 0}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-muted">{data.date}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 font-mono text-xs uppercase text-muted">
              <span className="flex items-center gap-2"><div className="w-3 h-3 bg-tertiary border border-muted" /> Total Time</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 bg-accent-primary" /> Focus Time</span>
            </div>
          </HudPanel>
        </div>

      </div>
    </AppShell>
  )
}
