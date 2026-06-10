'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export default function ScreenTime() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [formData, setFormData] = useState({ total_hours: 0, doom_scroll_minutes: 0, focus_hours: 0, notes: '' })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!user) return
    const fetchLog = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('screen_time_logs').select('*').eq('user_id', user.id).eq('date', selectedDate).single()
      if (data) {
        setFormData({
          total_hours: data.total_hours || 0,
          doom_scroll_minutes: data.doom_scroll_minutes || 0,
          focus_hours: data.focus_hours || 0,
          notes: data.notes || ''
        })
      } else {
        setFormData({ total_hours: 0, doom_scroll_minutes: 0, focus_hours: 0, notes: '' })
      }
    }
    fetchLog()
  }, [user, selectedDate])

  useEffect(() => {
    if (!user) return
    const fetchHistory = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('screen_time_logs').select('date, total_hours, focus_hours').eq('user_id', user.id).order('date', { ascending: false }).limit(7)
      if (data) setHistory(data.reverse())
    }
    fetchHistory()
  }, [user, saved])

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('screen_time_logs').upsert({
      user_id: user.id,
      date: selectedDate,
      ...formData
    }, { onConflict: 'user_id, date' })
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const maxHours = Math.max(...history.map(h => h.total_hours || 0), 12)

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header" style={{ textAlign: 'center' }}>
          <h1 className="page-title">Screen Time</h1>
          <p className="page-subtitle">Track your digital consumption vs production.</p>
        </header>

        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            <h2 className="card-title">Daily Log</h2>
            <input 
              type="date" 
              className="input" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              style={{ width: 'auto', padding: 'var(--space-1) var(--space-2)' }}
            />
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="grid-2">
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Total Screen Hours</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <input type="number" step="0.5" min="0" max="24" className="input" value={formData.total_hours} onChange={e => setFormData({...formData, total_hours: parseFloat(e.target.value) || 0})} />
                  <span style={{ color: 'var(--text-muted)' }}>hrs</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Focus Hours (Deep Work)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <input type="number" step="0.5" min="0" max="24" className="input" value={formData.focus_hours} onChange={e => setFormData({...formData, focus_hours: parseFloat(e.target.value) || 0})} />
                  <span style={{ color: 'var(--text-muted)' }}>hrs</span>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Doom Scroll Minutes (Waste)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input type="number" min="0" className="input" value={formData.doom_scroll_minutes} onChange={e => setFormData({...formData, doom_scroll_minutes: parseInt(e.target.value) || 0})} style={{ maxWidth: '150px' }} />
                <span style={{ color: 'var(--text-muted)' }}>mins</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Notes</label>
              <textarea className="textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="What apps consumed your time today?" style={{ minHeight: '80px' }} />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
              {loading ? 'Saving...' : saved ? 'Saved ✓' : 'Save Log'}
            </button>
          </form>
        </div>

        {/* 7-Day Chart */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Last 7 Days</h3>
          {history.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '150px', gap: 'var(--space-2)' }}>
              {history.map(day => {
                const totalHeight = `${((day.total_hours || 0) / maxHours) * 100}%`
                const focusHeight = day.total_hours > 0 ? `${((day.focus_hours || 0) / day.total_hours) * 100}%` : '0%'
                const dateLabel = new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })
                
                return (
                  <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', height: '100%' }}>
                    <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: totalHeight, background: 'var(--text-muted)', position: 'relative' }}>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: focusHeight, background: 'var(--accent-primary)' }}></div>
                      </div>
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{dateLabel}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No recent history found.</p>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: 'var(--accent-primary)', borderRadius: '2px' }}></div>
              Focus Time
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: 'var(--text-muted)', borderRadius: '2px' }}></div>
              Total Screen Time
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
