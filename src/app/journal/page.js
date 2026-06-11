'use client'

import { useState, useEffect, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { useJournal } from '@/lib/hooks/useJournal'
import { MOOD_EMOJIS } from '@/lib/constants'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Save, CheckCircle } from 'lucide-react'

export default function FieldLog() {
  const { entries, todayEntry, loading, saveEntry } = useJournal()
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0])
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const debounceRef = useRef(null)

  const currentEntry = entries.find(e => e.date === dateStr) || {
    what_did_i_do: '',
    what_did_i_learn: '',
    what_went_well: '',
    needs_improvement: '',
    mood: 3
  }

  const [formData, setFormData] = useState(currentEntry)

  useEffect(() => {
    setFormData(entries.find(e => e.date === dateStr) || {
      what_did_i_do: '', what_did_i_learn: '', what_went_well: '', needs_improvement: '', mood: 3
    })
  }, [dateStr, entries])

  const handleChange = (field, value) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    
    setIsSaving(true)
    setSaveSuccess(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    
    debounceRef.current = setTimeout(async () => {
      await saveEntry({ ...newData, date: dateStr })
      setIsSaving(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    }, 1500)
  }

  const changeDate = (days) => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    setDateStr(d.toISOString().split('T')[0])
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">RETRIEVING LOGS...</span></div></AppShell>

  const isToday = dateStr === new Date().toISOString().split('T')[0]
  const wordCount = Object.values(formData).filter(v => typeof v === 'string').join(' ').split(/\s+/).filter(w => w.length > 0).length

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">FIELD LOG</h1>
          <p className="page-subtitle font-mono uppercase text-xs">Daily debrief and tactical review.</p>
        </header>

        <div className="flex-center gap-4 mb-8">
          <button onClick={() => changeDate(-1)} className="btn btn-ghost p-2"><ChevronLeft /></button>
          <div className="font-display text-2xl tracking-widest text-amber">{new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}</div>
          <button onClick={() => changeDate(1)} disabled={isToday} className="btn btn-ghost p-2" style={{ opacity: isToday ? 0.3 : 1 }}>
            <ChevronRight />
          </button>
        </div>

        <HudPanel label="DEBRIEF PROTOCOL" glow>
          <div className="flex-col gap-8">
            
            {/* Mood Selector */}
            <div>
              <label className="font-display text-sm text-amber uppercase tracking-widest mb-3 block">OPERATOR CONDITION</label>
              <div className="flex gap-4">
                {MOOD_EMOJIS.map(mood => (
                  <button
                    key={mood.value}
                    onClick={() => handleChange('mood', mood.value)}
                    className={`flex-center p-3 rounded-sm transition-all text-2xl bg-primary border ${formData.mood === mood.value ? 'border-amber shadow-amber' : 'border-border-color opacity-50'}`}
                    style={{ filter: formData.mood === mood.value ? 'drop-shadow(0 0 10px var(--amber-glow))' : 'none' }}
                    title={mood.label}
                  >
                    {mood.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompts */}
            <div className="flex-col gap-6">
              {[
                { field: 'what_did_i_do', label: 'DEBRIEF 01: OPERATIONS EXECUTED' },
                { field: 'what_did_i_learn', label: 'DEBRIEF 02: INTEL GATHERED' },
                { field: 'what_went_well', label: 'DEBRIEF 03: TACTICAL SUCCESSES' },
                { field: 'needs_improvement', label: 'DEBRIEF 04: SYSTEM FAILURES & CRITICAL FIXES' }
              ].map((prompt, i) => (
                <div key={prompt.field}>
                  <label className="font-display text-sm text-amber uppercase tracking-widest mb-2 block">{prompt.label}</label>
                  <textarea
                    className="textarea font-mono text-sm"
                    value={formData[prompt.field]}
                    onChange={(e) => handleChange(prompt.field, e.target.value)}
                    placeholder="Input data..."
                    style={{ minHeight: i === 0 ? '150px' : '100px' }}
                  />
                </div>
              ))}
            </div>

            <div className="flex-between border-t border-border-color pt-4 mt-2">
              <span className="font-mono text-xs text-muted">WORD COUNT: {wordCount}</span>
              <div className="flex items-center gap-4">
                <span className="font-display text-xs text-secondary tracking-widest uppercase">FULL DEBRIEF +30 XP | PARTIAL +15 XP</span>
                <div className="flex items-center gap-2 font-mono text-xs text-amber">
                  {isSaving ? (
                    <><Save size={14} className="animate-pulse" /> SAVING...</>
                  ) : saveSuccess ? (
                    <><CheckCircle size={14} className="text-success" /> SECURED</>
                  ) : null}
                </div>
              </div>
            </div>

          </div>
        </HudPanel>

      </div>
    </AppShell>
  )
}
