'use client'

import { useState, useEffect, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useJournal } from '@/lib/hooks/useJournal'
import { MOOD_EMOJIS } from '@/lib/constants'

export default function Journal() {
  const { entries, saveEntry } = useJournal()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  
  // Find entry for selected date or initialize empty
  const currentEntry = entries.find(e => e.date === selectedDate) || {
    date: selectedDate,
    what_did_i_do: '',
    what_did_i_learn: '',
    what_went_well: '',
    needs_improvement: '',
    mood: 0,
    tags: []
  }

  const [formData, setFormData] = useState(currentEntry)
  const saveTimeoutRef = useRef(null)

  // Update form data when date changes
  useEffect(() => {
    setFormData(entries.find(e => e.date === selectedDate) || {
      date: selectedDate,
      what_did_i_do: '',
      what_did_i_learn: '',
      what_went_well: '',
      needs_improvement: '',
      mood: 0,
      tags: []
    })
  }, [selectedDate, entries])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Auto-save logic (debounce 1.5s)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSaving(true)
    saveTimeoutRef.current = setTimeout(async () => {
      await saveEntry({ ...formData, [field]: value })
      setSaving(false)
    }, 1500)
  }

  const handleDateChange = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  // Calculate if entry is "full" (all fields have content)
  const isFull = formData.what_did_i_do && formData.what_did_i_learn && formData.what_went_well && formData.needs_improvement && formData.mood > 0;
  const wordCount = Object.values(formData).filter(v => typeof v === 'string').join(' ').split(/\s+/).filter(w => w.length > 0).length;

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header" style={{ textAlign: 'center' }}>
          <h1 className="page-title">Daily Journal</h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <button onClick={() => handleDateChange(-1)} className="btn btn-ghost btn-icon">◀</button>
            <div style={{ fontSize: 'var(--text-lg-size)', fontWeight: 600 }}>
              {new Date(selectedDate).toDateString() === new Date().toDateString() ? 'Today' : new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <button onClick={() => handleDateChange(1)} className="btn btn-ghost btn-icon" disabled={selectedDate >= new Date().toISOString().split('T')[0]}>▶</button>
          </div>
        </header>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Mood Selector */}
          <div style={{ textAlign: 'center' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>How was your day?</label>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
              {MOOD_EMOJIS.map(m => (
                <button
                  key={m.level}
                  onClick={() => handleChange('mood', m.level)}
                  style={{
                    fontSize: '32px',
                    opacity: formData.mood === m.level ? 1 : 0.4,
                    transform: formData.mood === m.level ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all var(--transition-fast)'
                  }}
                  title={m.label}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>

          <hr style={{ margin: '0' }} />

          {/* Prompts */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)' }}>1. What did I build today?</label>
            <textarea className="textarea" placeholder="Projects, code, content..." value={formData.what_did_i_do || ''} onChange={e => handleChange('what_did_i_do', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)' }}>2. What did I learn today?</label>
            <textarea className="textarea" placeholder="New concepts, insights, lessons..." value={formData.what_did_i_learn || ''} onChange={e => handleChange('what_did_i_learn', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)' }}>3. What wasted my time today?</label>
            <textarea className="textarea" placeholder="Distractions, inefficiencies..." value={formData.what_went_well || ''} onChange={e => handleChange('what_went_well', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)' }}>4. What is tomorrow's priority?</label>
            <textarea className="textarea" placeholder="The one thing that must get done..." value={formData.needs_improvement || ''} onChange={e => handleChange('needs_improvement', e.target.value)} />
          </div>

          {/* Footer stats / save indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)' }}>
              {wordCount} words • {isFull ? 'Full Entry (+30 XP)' : 'Partial Entry (+15 XP)'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: saving ? 'var(--warning)' : 'var(--success)' }}>
              {saving ? (
                <>⏳ Saving...</>
              ) : (
                <>✓ Saved</>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
