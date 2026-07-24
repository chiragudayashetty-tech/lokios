'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { useOS } from '@/lib/context/OSContext'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr, formatDate, getStartOfWeek, getEndOfWeek } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import {
  BookOpen, Smile, Frown, Meh, Save, Zap, Flame, ShieldAlert,
  CalendarDays, Trophy, CheckSquare, Target, ArrowRight, AlertTriangle
} from 'lucide-react'

const MOODS = [
  { id: 'excellent', icon: Flame, color: 'var(--amber)', label: 'Locked In' },
  { id: 'good', icon: Smile, color: 'var(--success)', label: 'Solid' },
  { id: 'neutral', icon: Meh, color: 'var(--info)', label: 'Average' },
  { id: 'bad', icon: Frown, color: 'var(--warning)', label: 'Struggling' },
  { id: 'exhausted', icon: ShieldAlert, color: 'var(--danger)', label: 'Exhausted' }
]

function RenderDebrief({ text }) {
  if (!text) return null
  const sections = text.split('### ').filter(s => s.trim())
  return (
    <div className="space-y-6">
      {sections.map((section, idx) => {
        let title = '', content = section.trim()
        const knownTitles = ['What went well?', 'Bottlenecks & Fails', 'Priorities for Next Week']
        for (const kt of knownTitles) {
          if (content.startsWith(kt)) { title = kt; content = content.substring(kt.length).trim(); break }
        }
        if (!title) { const lines = content.split('\n'); title = lines[0]; content = lines.slice(1).join('\n').trim() }
        let colorClass = 'text-primary', Icon = ArrowRight
        if (title.toLowerCase().includes('went well')) { colorClass = 'text-success'; Icon = Target }
        else if (title.toLowerCase().includes('fail') || title.toLowerCase().includes('bottleneck')) { colorClass = 'text-danger'; Icon = AlertTriangle }
        else if (title.toLowerCase().includes('priorit')) { colorClass = 'text-info'; Icon = ArrowRight }
        return (
          <div key={idx} className="space-y-3">
            <h4 className={`font-display tracking-widest uppercase flex items-center gap-2 ${colorClass}`}>
              <Icon size={16} /> {title}
            </h4>
            <div className="font-mono text-sm text-secondary whitespace-pre-wrap pl-6 border-l-2 border-border-color ml-2 opacity-90 leading-relaxed">
              {content || 'None recorded.'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function JournalPage() {
  const { journal: { entries, loading, saveEntry, clearJournal } } = useOS()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('daily')

  // ─── DAILY JOURNAL STATE ───
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [expandedArchive, setExpandedArchive] = useState(null)
  const [entryDate, setEntryDate] = useState('')

  // ─── WEEKLY DEBRIEF STATE ───
  const [loadingStats, setLoadingStats] = useState(true)
  const [stats, setStats] = useState({ xp: 0, tasks: 0, habits: 0, missions: 0 })
  const [wins, setWins] = useState('')
  const [fails, setFails] = useState('')
  const [nextActions, setNextActions] = useState('')
  const [savingDebrief, setSavingDebrief] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showDebriefHistory, setShowDebriefHistory] = useState(false)
  const [historyLogs, setHistoryLogs] = useState([])
  const [expandedDebrief, setExpandedDebrief] = useState(null)

  useEffect(() => { setEntryDate(getLocalDateStr()) }, [])

  useEffect(() => {
    if (!user || activeTab !== 'weekly') return
    const supabase = createClient()
    const today = new Date()
    const startOfWeek = getStartOfWeek(today)
    const endOfWeek = getEndOfWeek(today)
    const startStr = getLocalDateStr(startOfWeek)
    const endStr = getLocalDateStr(endOfWeek)
    setDateRange({ start: formatDate(startStr, 'MMM DD'), end: formatDate(endStr, 'MMM DD') })

    Promise.all([
      supabase.from('xp_history').select('amount').eq('user_id', user.id).gte('created_at', startStr).lte('created_at', endStr + 'T23:59:59.999Z'),
      supabase.from('habit_logs').select('status').eq('user_id', user.id).gte('date', startStr).lte('date', endStr).eq('status', 'completed'),
      supabase.from('tasks').select('id').eq('user_id', user.id).gte('completed_at', startStr).lte('completed_at', endStr + 'T23:59:59.999Z').eq('status', 'completed'),
      supabase.from('goals').select('id').eq('user_id', user.id).gte('completed_at', startStr).lte('completed_at', endStr + 'T23:59:59.999Z').eq('status', 'completed'),
      supabase.from('work_logs').select('*').eq('user_id', user.id).ilike('title', 'Weekly Debrief%').order('created_at', { ascending: false })
    ]).then(([xpRes, habitRes, taskRes, goalRes, historyRes]) => {
      setStats({
        xp: (xpRes.data || []).reduce((s, l) => s + l.amount, 0),
        habits: (habitRes.data || []).length,
        tasks: (taskRes.data || []).length,
        missions: (goalRes.data || []).length
      })
      if (historyRes.data) setHistoryLogs(historyRes.data)
      setLoadingStats(false)
    })
  }, [user, activeTab])

  const handleSaveJournal = async (e) => {
    e.preventDefault()
    if (!mood) { alert('Please select a mood vector.'); return }
    if (!content.trim()) { alert('Please enter your journal reflection.'); return }
    setSaving(true)
    const success = await saveEntry({ content, mood, date: entryDate })
    setSaving(false)
    if (success) { setContent(''); setMood(''); setShowHistory(true) }
  }

  const handleSaveDebrief = async (e) => {
    e.preventDefault()
    if (!user || savingDebrief) return
    if (!wins.trim() || !fails.trim() || !nextActions.trim()) { alert('Please fill out all fields.'); return }
    setSavingDebrief(true)
    const supabase = createClient()
    const todayStr = getLocalDateStr()
    const formattedContent = `### What went well?\n${wins}\n\n### Bottlenecks & Fails\n${fails}\n\n### Priorities for Next Week\n${nextActions}`
    try {
      await supabase.from('work_logs').insert([{
        user_id: user.id,
        title: `Weekly Debrief: ${dateRange.start} - ${dateRange.end}`,
        type: 'project_work', description: formattedContent, date: todayStr
      }])
      await robustAwardXP(user.id, 5, 'task', todayStr, 'Weekly Review Completed', 'discipline')
      setWins(''); setFails(''); setNextActions('')
      const { data } = await supabase.from('work_logs').select('*').eq('user_id', user.id).ilike('title', 'Weekly Debrief%').order('created_at', { ascending: false })
      if (data) setHistoryLogs(data)
      setShowDebriefHistory(true)
    } catch (err) {
      alert('Failed to save review. Please try again.')
    } finally { setSavingDebrief(false) }
  }

  const isFullEntry = content.length >= 100 && mood

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <header className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-4xl text-primary uppercase tracking-widest flex items-center gap-3">
              <BookOpen size={32} className="text-amber" />
              Journal
            </h1>
            <p className="font-mono text-muted text-sm uppercase tracking-widest mt-2">
              {activeTab === 'daily' ? 'Mental State & Reflection Archive' : `${dateRange.start} — ${dateRange.end}`}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex border border-border-color overflow-hidden">
            {[
              { id: 'daily', icon: BookOpen, label: 'DAILY LOG' },
              { id: 'weekly', icon: CalendarDays, label: 'WEEKLY DEBRIEF' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all"
                style={{
                  background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === tab.id ? '#0a0a0a' : 'var(--text-muted)',
                  borderRight: tab.id === 'daily' ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* ─── DAILY LOG TAB ─── */}
        {activeTab === 'daily' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-end gap-2 mb-4">
              <button
                onClick={async () => { if (window.confirm('Delete all journal entries? This cannot be undone.')) await clearJournal() }}
                className="btn btn-ghost text-danger border border-border-color hover:bg-danger hover:text-white">
                CLEAR ARCHIVES
              </button>
              <button onClick={() => setShowHistory(!showHistory)} className="btn btn-ghost border border-border-color">
                {showHistory ? 'VIEW TODAY' : 'VIEW ARCHIVES'}
              </button>
            </div>

            {loading ? (
              <div className="flex-center py-12"><span className="typewriter-text text-amber">DECRYPTING ARCHIVES...</span></div>
            ) : !showHistory ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <HudPanel label="NEW LOG">
                  <form onSubmit={handleSaveJournal} className="space-y-6">
                    <div>
                      <label className="font-mono text-xs text-muted uppercase tracking-widest mb-3 block">Log Date</label>
                      <input type="date" required value={entryDate} onChange={e => setEntryDate(e.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className="w-full bg-bg-tertiary border border-border-color rounded p-3 font-mono text-primary text-sm focus:border-amber focus:outline-none transition-colors cursor-pointer" />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted uppercase tracking-widest mb-3 block">Mental State Vector</label>
                      <div className="flex flex-wrap gap-3">
                        {MOODS.map(m => {
                          const Icon = m.icon; const isSelected = mood === m.id
                          return (
                            <button key={m.id} type="button" onClick={() => setMood(m.id)}
                              className={`flex items-center gap-2 px-4 py-2 border transition-all ${isSelected ? 'scale-105' : 'border-border-color opacity-60 hover:opacity-100'}`}
                              style={{ borderColor: isSelected ? m.color : '', backgroundColor: isSelected ? `${m.color}15` : '', color: isSelected ? m.color : 'var(--text-muted)' }}>
                              <Icon size={16} /><span className="font-mono text-xs uppercase tracking-wider">{m.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted uppercase tracking-widest mb-3 flex-between">
                        <span>Reflection Log</span>
                        <span className={content.length >= 100 ? 'text-success' : 'text-danger'}>Min 100 chars for +30 XP (Current: {content.length})</span>
                      </label>
                      <textarea value={content} onChange={e => setContent(e.target.value)}
                        placeholder="Document your thoughts, struggles, and victories today..."
                        className="input w-full min-h-[250px] resize-y font-mono text-sm leading-relaxed" />
                    </div>
                    <div className="flex-between border-t border-border-color pt-4">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className={isFullEntry ? 'text-success' : 'text-warning'} />
                        <span className="font-mono text-xs text-muted">
                          REWARD: <span className={isFullEntry ? 'text-success font-bold' : 'text-warning'}>{isFullEntry ? '+30 XP (Full Log)' : '+10 XP (Partial Log)'}</span>
                        </span>
                      </div>
                      <button type="submit" disabled={saving} className="btn btn-primary btn-lg flex items-center gap-2">
                        <Save size={18} />{saving ? 'ENCRYPTING...' : 'SEAL LOG'}
                      </button>
                    </div>
                  </form>
                </HudPanel>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {entries.length === 0 ? (
                  <div className="p-8 text-center text-muted font-mono text-sm border border-border-color bg-tertiary">NO JOURNAL ARCHIVES FOUND.</div>
                ) : (
                  entries.map((entry, index) => {
                    const moodObj = MOODS.find(m => m.id === entry.mood) || MOODS[2]
                    const MoodIcon = moodObj.icon
                    const dayNumber = entries.length - index
                    return (
                      <HudPanel key={entry.id} className="cursor-pointer" onClick={() => setExpandedArchive(expandedArchive === entry.id ? null : entry.id)}>
                        <div className={`flex-between ${expandedArchive === entry.id ? 'mb-4 border-b border-border-color pb-2' : ''}`}>
                          <div className="flex items-center gap-3">
                            <span className="font-display text-lg text-primary tracking-widest">DAY {dayNumber}</span>
                            <span className="font-mono text-sm text-amber opacity-80">{entry.date}</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs uppercase px-2 py-1 rounded border"
                            style={{ color: moodObj.color, borderColor: moodObj.color, backgroundColor: `${moodObj.color}15` }}>
                            <MoodIcon size={12} /> {moodObj.label}
                          </div>
                        </div>
                        {expandedArchive === entry.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            className="font-mono text-secondary whitespace-pre-wrap text-sm">
                            {entry.content || '—'}
                          </motion.div>
                        )}
                      </HudPanel>
                    )
                  })
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ─── WEEKLY DEBRIEF TAB ─── */}
        {activeTab === 'weekly' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-end">
              <button onClick={() => setShowDebriefHistory(!showDebriefHistory)} className="btn btn-ghost border border-border-color">
                {showDebriefHistory ? 'VIEW THIS WEEK' : 'VIEW ARCHIVES'}
              </button>
            </div>

            {!showDebriefHistory ? (
              <>
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: Trophy, color: 'amber', label: 'XP Earned', val: loadingStats ? '...' : `+${stats.xp}` },
                    { icon: Target, color: 'success', label: 'Missions Done', val: loadingStats ? '...' : stats.missions },
                    { icon: CheckSquare, color: 'primary', label: 'Ops Completed', val: loadingStats ? '...' : stats.tasks },
                    { icon: Flame, color: 'info', label: 'Habits Done', val: loadingStats ? '...' : stats.habits }
                  ].map(s => (
                    <HudPanel key={s.label}>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 bg-${s.color}/10 rounded-lg text-${s.color}`}>
                          <s.icon size={24} />
                        </div>
                        <div>
                          <span className="font-mono text-xs text-muted uppercase tracking-widest block">{s.label}</span>
                          <span className="font-display text-2xl text-primary">{s.val}</span>
                        </div>
                      </div>
                    </HudPanel>
                  ))}
                </div>

                {/* Form */}
                <HudPanel label="WEEKLY DEBRIEF">
                  <form onSubmit={handleSaveDebrief} className="space-y-6">
                    {[
                      { label: 'What went well this week?', val: wins, set: setWins, color: 'var(--success)', placeholder: 'Document your victories, breakthroughs, and wins...' },
                      { label: 'Bottlenecks & Fails', val: fails, set: setFails, color: 'var(--danger)', placeholder: 'What held you back? Where did you fall short?' },
                      { label: 'Priorities for Next Week', val: nextActions, set: setNextActions, color: 'var(--info)', placeholder: 'What 3 things must get done next week?' }
                    ].map(f => (
                      <div key={f.label}>
                        <label className="font-mono text-xs uppercase tracking-widest mb-3 block" style={{ color: f.color }}>{f.label}</label>
                        <textarea value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                          className="input w-full min-h-[120px] resize-y font-mono text-sm leading-relaxed"
                          style={{ borderColor: f.val.trim() ? f.color : '' }} />
                      </div>
                    ))}
                    <div className="flex-between border-t border-border-color pt-4">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-amber" />
                        <span className="font-mono text-xs text-muted">REWARD: <span className="text-amber font-bold">+5 XP on completion</span></span>
                      </div>
                      <button type="submit" disabled={savingDebrief} className="btn btn-primary btn-lg flex items-center gap-2">
                        <Save size={18} />{savingDebrief ? 'SAVING...' : 'SEAL DEBRIEF'}
                      </button>
                    </div>
                  </form>
                </HudPanel>
              </>
            ) : (
              <div className="space-y-4">
                {historyLogs.length === 0 ? (
                  <div className="p-8 text-center text-muted font-mono text-sm border border-border-color">NO DEBRIEF ARCHIVES FOUND.</div>
                ) : (
                  historyLogs.map(log => (
                    <HudPanel key={log.id} className="cursor-pointer" onClick={() => setExpandedDebrief(expandedDebrief === log.id ? null : log.id)}>
                      <div className={`flex-between ${expandedDebrief === log.id ? 'mb-4 border-b border-border-color pb-2' : ''}`}>
                        <span className="font-display text-base text-primary tracking-widest">{log.title}</span>
                        <span className="font-mono text-xs text-muted">{log.date}</span>
                      </div>
                      {expandedDebrief === log.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                          <RenderDebrief text={log.description} />
                        </motion.div>
                      )}
                    </HudPanel>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}
