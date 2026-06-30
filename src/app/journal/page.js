'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { useOS } from '@/lib/context/OSContext'
import { BookOpen, Smile, Frown, Meh, Save, Zap, Heart, Flame, ShieldAlert, Coffee } from 'lucide-react'

const MOODS = [
  { id: 'excellent', icon: Flame, color: 'var(--amber)', label: 'Locked In' },
  { id: 'good', icon: Smile, color: 'var(--success)', label: 'Solid' },
  { id: 'neutral', icon: Meh, color: 'var(--info)', label: 'Average' },
  { id: 'bad', icon: Frown, color: 'var(--warning)', label: 'Struggling' },
  { id: 'exhausted', icon: ShieldAlert, color: 'var(--danger)', label: 'Exhausted' }
]

export default function JournalPage() {
  const { journal: { entries, loading, saveEntry } } = useOS()
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [expandedArchive, setExpandedArchive] = useState(null)

  const handleSave = async (e) => {
    e.preventDefault()
    if (!mood) {
      alert("Please select a mood vector.")
      return
    }
    if (!content.trim()) {
      alert("Please enter your journal reflection.")
      return
    }
    
    setSaving(true)
    const success = await saveEntry({ content, mood })
    setSaving(false)
    
    if (success) {
      setContent('')
      setMood('')
      setShowHistory(true)
    }
  }

  const isFullEntry = content.length >= 100 && mood

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="mb-8 flex-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-4xl text-primary uppercase tracking-widest flex items-center gap-3">
              <BookOpen size={32} className="text-amber" />
              Operator Journal
            </h1>
            <p className="font-mono text-muted text-sm uppercase tracking-widest mt-2">
              Mental State & Reflection Archive
            </p>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            className="btn btn-ghost border border-border-color"
          >
            {showHistory ? 'VIEW TODAY' : 'VIEW ARCHIVES'}
          </button>
        </header>

        {loading ? (
          <div className="flex-center py-12"><span className="typewriter-text text-amber">DECRYPTING ARCHIVES...</span></div>
        ) : !showHistory ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <HudPanel label="TODAY's LOG">
              <form onSubmit={handleSave} className="space-y-6">
                
                {/* MOOD SELECTOR */}
                <div>
                  <label className="font-mono text-xs text-muted uppercase tracking-widest mb-3 block">Mental State Vector</label>
                  <div className="flex flex-wrap gap-3">
                    {MOODS.map(m => {
                      const Icon = m.icon
                      const isSelected = mood === m.id
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMood(m.id)}
                          className={`flex items-center gap-2 px-4 py-2 border transition-all ${isSelected ? 'bg-opacity-10 scale-105' : 'bg-tertiary border-border-color hover:border-amber opacity-60 hover:opacity-100'}`}
                          style={{
                            borderColor: isSelected ? m.color : '',
                            backgroundColor: isSelected ? `${m.color}15` : '',
                            color: isSelected ? m.color : 'var(--text-muted)'
                          }}
                        >
                          <Icon size={16} />
                          <span className="font-mono text-xs uppercase tracking-wider">{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* TEXT AREA */}
                <div>
                  <label className="font-mono text-xs text-muted uppercase tracking-widest mb-3 flex-between">
                    <span>Reflection Log</span>
                    <span className={content.length >= 100 ? 'text-success' : 'text-danger'}>
                      Min 100 chars for +30 XP bonus (Current: {content.length})
                    </span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Document your thoughts, struggles, and victories today..."
                    className="input w-full min-h-[250px] resize-y font-mono text-sm leading-relaxed"
                  />
                </div>

                {/* SUBMIT */}
                <div className="flex-between border-t border-border-color pt-4">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className={isFullEntry ? 'text-success' : 'text-warning'} />
                    <span className="font-mono text-xs text-muted">
                      REWARD: <span className={isFullEntry ? 'text-success font-bold' : 'text-warning'}>
                        {isFullEntry ? '+30 XP (Full Log)' : '+10 XP (Partial Log)'}
                      </span>
                    </span>
                  </div>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="btn btn-primary btn-lg flex items-center gap-2"
                  >
                    <Save size={18} />
                    {saving ? 'ENCRYPTING...' : 'SEAL LOG'}
                  </button>
                </div>

              </form>
            </HudPanel>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-muted font-mono text-sm border border-border-color bg-tertiary">
                NO JOURNAL ARCHIVES FOUND.
              </div>
            ) : (
              entries.map((entry, index) => {
                const moodObj = MOODS.find(m => m.id === entry.mood) || MOODS[2]
                const MoodIcon = moodObj.icon
                
                // Calculate the chronological day number (oldest is Day 1)
                const dayNumber = entries.length - index;

                return (
                  <HudPanel key={entry.id} className="group hover:border-amber transition-colors cursor-pointer" onClick={() => setExpandedArchive(expandedArchive === entry.id ? null : entry.id)}>
                    <div className={`flex-between ${expandedArchive === entry.id ? 'mb-4 border-b border-border-color pb-2' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-lg text-primary tracking-widest">DAY {dayNumber}</span>
                        <span className="font-mono text-sm text-amber opacity-80">{entry.date}</span>
                      </div>
                      <div 
                        className="flex items-center gap-1 font-mono text-xs uppercase px-2 py-1 rounded border"
                        style={{ color: moodObj.color, borderColor: moodObj.color, backgroundColor: `${moodObj.color}15` }}
                      >
                        <MoodIcon size={12} /> {moodObj.label}
                      </div>
                    </div>
                    {expandedArchive === entry.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="prose prose-invert prose-sm max-w-none font-mono text-secondary whitespace-pre-wrap">
                        {entry.content ? entry.content : (
                          <div className="flex flex-col gap-4">
                            {entry.what_did_i_do && !entry.what_did_i_learn && !entry.what_went_well && !entry.needs_improvement ? (
                              <div>{entry.what_did_i_do}</div>
                            ) : (
                              <>
                                {entry.what_did_i_do && <div><span className="text-amber mb-1 block tracking-widest text-[10px]">WHAT I DID</span>{entry.what_did_i_do}</div>}
                                {entry.what_did_i_learn && <div><span className="text-amber mb-1 block tracking-widest text-[10px]">WHAT I LEARNED</span>{entry.what_did_i_learn}</div>}
                                {entry.what_went_well && <div><span className="text-amber mb-1 block tracking-widest text-[10px]">WINS</span>{entry.what_went_well}</div>}
                                {entry.needs_improvement && <div><span className="text-amber mb-1 block tracking-widest text-[10px]">NEEDS IMPROVEMENT</span>{entry.needs_improvement}</div>}
                              </>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </HudPanel>
                )
              })
            )}
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}
