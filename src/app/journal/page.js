'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { useOS } from '@/lib/context/OSContext'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr, formatDate, getStartOfWeek, getEndOfWeek } from '@/lib/utils/dates'
import { evaluateProtocolAutoFail } from '@/lib/utils/protocolAutoFail'
import {
  BookOpen, Smile, Frown, Meh, Save, Zap, Flame, ShieldAlert,
  CalendarDays, Trophy, CheckSquare, Target, ArrowRight, AlertTriangle,
  Pencil, ChevronLeft, ChevronRight, RotateCcw, X
} from 'lucide-react'

const MOODS = [
  { id: 'excellent', emoji: '🔥', color: 'var(--amber)' },
  { id: 'good', emoji: '😊', color: 'var(--success)' },
  { id: 'neutral', emoji: '😐', color: 'var(--info)' },
  { id: 'bad', emoji: '🙁', color: 'var(--warning)' },
  { id: 'exhausted', emoji: '😫', color: 'var(--danger)' }
]

function RenderDebrief({ text }) {
  if (!text) return null
  const sections = text.split('### ').filter(s => s.trim())
  return (
    <div className="space-y-6">
      {sections.map((sec, idx) => {
        const lines = sec.split('\n')
        const header = lines[0].trim()
        const body = lines.slice(1).join('\n').trim()

        let color = 'text-primary'
        if (header.includes('What went well')) color = 'text-success'
        if (header.includes('Bottlenecks')) color = 'text-danger'
        if (header.includes('Priorities')) color = 'text-info'

        return (
          <div key={idx} className="space-y-2">
            <h4 className={`font-mono text-sm font-bold uppercase tracking-wider ${color}`}>
              {header}
            </h4>
            <div className="font-mono text-xs text-muted whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-border-color">
              {body}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function JournalPage() {
  const { journal: { entries = [], loading = false, saveEntry, clearJournal } = {} } = useOS() || {}
  const { user } = useAuth()

  useEffect(() => {
    if (user?.id) {
      evaluateProtocolAutoFail(user.id)
    }
  }, [user])

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
  const [nextGoal1, setNextGoal1] = useState('')
  const [nextGoal2, setNextGoal2] = useState('')
  const [nextGoal3, setNextGoal3] = useState('')
  const [savingDebrief, setSavingDebrief] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showDebriefHistory, setShowDebriefHistory] = useState(false)
  const [historyLogs, setHistoryLogs] = useState([])
  const [expandedDebrief, setExpandedDebrief] = useState(null)

  // Past Week Navigation & Edit State for Weekly Debriefs
  const [debriefWeekOffset, setDebriefWeekOffset] = useState(0)
  const [editingDebriefLog, setEditingDebriefLog] = useState(null)

  const parseDebriefContent = (description = '') => {
    let winsText = ''
    let failsText = ''
    let goal1 = ''
    let goal2 = ''
    let goal3 = ''

    const winsIdx = description.indexOf('### What went well?')
    const failsIdx = description.indexOf('### Bottlenecks & Fails')
    const goalsIdx = description.indexOf('### Priorities for Next Week')

    if (winsIdx !== -1) {
      const endIdx = failsIdx !== -1 ? failsIdx : (goalsIdx !== -1 ? goalsIdx : description.length)
      winsText = description.substring(winsIdx + '### What went well?'.length, endIdx).trim()
    }

    if (failsIdx !== -1) {
      const endIdx = goalsIdx !== -1 ? goalsIdx : description.length
      failsText = description.substring(failsIdx + '### Bottlenecks & Fails'.length, endIdx).trim()
    }

    if (goalsIdx !== -1) {
      const goalsText = description.substring(goalsIdx + '### Priorities for Next Week'.length).trim()
      const lines = goalsText.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/\[DONE\]|\[FAILED\]/g, '').trim()).filter(Boolean)
      if (lines[0]) goal1 = lines[0]
      if (lines[1]) goal2 = lines[1]
      if (lines[2]) goal3 = lines[2]
    }

    return { wins: winsText, fails: failsText, goal1, goal2, goal3 }
  }

  const handleStartEditDebrief = (log) => {
    setEditingDebriefLog(log)
    const parsed = parseDebriefContent(log.description)
    setWins(parsed.wins)
    setFails(parsed.fails)
    setNextGoal1(parsed.goal1)
    setNextGoal2(parsed.goal2)
    setNextGoal3(parsed.goal3)
    setShowDebriefHistory(false)
  }

  const handleCancelEditDebrief = () => {
    setEditingDebriefLog(null)
    setWins('')
    setFails('')
    setNextGoal1('')
    setNextGoal2('')
    setNextGoal3('')
  }

  const getWordCount = (str) => {
    if (!str || !str.trim()) return 0
    return str.trim().split(/\s+/).length
  }

  useEffect(() => { setEntryDate(getLocalDateStr()) }, [])

  useEffect(() => {
    if (editingDebriefLog) return
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + (debriefWeekOffset * 7))
    const startOfWeek = getStartOfWeek(targetDate)
    const endOfWeek = getEndOfWeek(targetDate)
    const startStr = getLocalDateStr(startOfWeek)
    const endStr = getLocalDateStr(endOfWeek)
    setDateRange({ start: formatDate(startStr, 'MMM DD'), end: formatDate(endStr, 'MMM DD') })
  }, [debriefWeekOffset, editingDebriefLog])

  useEffect(() => {
    if (!user || activeTab !== 'weekly') return

    // Synchronously read cached debrief history for 0ms delay
    try {
      const cached = localStorage.getItem(`lokios_debrief_history_${user.id}`)
      if (cached) {
        setHistoryLogs(JSON.parse(cached))
      }
    } catch (e) {}

    const supabase = createClient()
    const today = new Date()
    const startOfWeek = getStartOfWeek(today)
    const endOfWeek = getEndOfWeek(today)
    const startStr = getLocalDateStr(startOfWeek)
    const endStr = getLocalDateStr(endOfWeek)

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
      if (historyRes.data) {
        setHistoryLogs(prev => {
          const map = new Map()
          // Add local cached entries first
          prev.forEach(l => map.set(l.title || l.id, l))
          // Add Supabase entries
          historyRes.data.forEach(l => map.set(l.title || l.id, l))
          const merged = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          if (typeof window !== 'undefined') {
            localStorage.setItem(`lokios_debrief_history_${user.id}`, JSON.stringify(merged))
          }
          return merged
        })
      }
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
    const goalsList = [nextGoal1, nextGoal2, nextGoal3].filter(g => typeof g === 'string' && g.trim())
    if (!wins.trim() || !fails.trim() || goalsList.length === 0) { alert('Please fill out wins, fails, and at least 1 Next Week Priority Goal.'); return }
    setSavingDebrief(true)
    const supabase = createClient()
    const todayStr = getLocalDateStr(new Date())
    const formattedGoals = goalsList.map((g, i) => `${i + 1}. ${g.trim()}`).join('\n')
    const formattedContent = `### What went well?\n${wins}\n\n### Bottlenecks & Fails\n${fails}\n\n### Priorities for Next Week\n${formattedGoals}`
    
    const debriefTitle = editingDebriefLog ? editingDebriefLog.title : `Weekly Debrief: ${dateRange.start} - ${dateRange.end}`
    const targetLogId = editingDebriefLog ? editingDebriefLog.id : ('debrief_' + Date.now())

    const logPayload = {
      id: targetLogId,
      user_id: user.id,
      title: debriefTitle,
      type: 'project_work',
      description: formattedContent,
      date: editingDebriefLog?.date || todayStr,
      created_at: editingDebriefLog?.created_at || new Date().toISOString()
    }

    // 1. Immediately update local state & localStorage cache for zero delay
    setHistoryLogs(prev => {
      const next = [logPayload, ...prev.filter(l => l.id !== targetLogId && l.title !== debriefTitle)]
      if (typeof window !== 'undefined') {
        localStorage.setItem(`lokios_debrief_history_${user.id}`, JSON.stringify(next))
        if (debriefWeekOffset === 0 || editingDebriefLog?.date === todayStr) {
          const cacheKey = `lokios_dashboard_recon_${user.id}_${todayStr}`
          try {
            const existingCache = localStorage.getItem(cacheKey)
            const parsed = existingCache ? JSON.parse(existingCache) : {}
            parsed.latestDebrief = logPayload
            localStorage.setItem(cacheKey, JSON.stringify(parsed))
          } catch (errCache) {}
        }
      }
      return next
    })

    try {
      // 2. Insert or Update Supabase work_logs
      if (editingDebriefLog && editingDebriefLog.id && !editingDebriefLog.id.toString().startsWith('debrief_')) {
        await supabase.from('work_logs').update({
          description: formattedContent,
          title: debriefTitle
        }).eq('id', editingDebriefLog.id)
      } else {
        const { data: inserted } = await supabase.from('work_logs').insert([{
          user_id: user.id,
          title: debriefTitle,
          type: 'project_work',
          description: formattedContent,
          date: logPayload.date
        }]).select()

        if (inserted && inserted.length > 0) {
          setHistoryLogs(prev => {
            const next = [inserted[0], ...prev.filter(l => l.title !== debriefTitle && l.id !== targetLogId)]
            if (typeof window !== 'undefined') {
              localStorage.setItem(`lokios_debrief_history_${user.id}`, JSON.stringify(next))
            }
            return next
          })
        }
      }

      // 3. Deploy priority goals to tasks table for Command Center widget
      const targetDateObj = new Date()
      targetDateObj.setDate(targetDateObj.getDate() + (debriefWeekOffset * 7))
      const endOfWeekStr = getLocalDateStr(getEndOfWeek(targetDateObj))

      for (const goalText of goalsList) {
        const cleanTitle = typeof goalText === 'string' ? goalText.trim() : String(goalText)
        if (!cleanTitle) continue
        await supabase.from('tasks').insert([{
          user_id: user.id,
          title: cleanTitle,
          type: 'custom',
          category: 'weekly_goal',
          due_date: endOfWeekStr,
          status: 'pending',
          description: '[Weekly Goal] Priority for Next Week (from Weekly Debrief)'
        }])
      }


      setWins(''); setFails(''); setNextGoal1(''); setNextGoal2(''); setNextGoal3('')
      setEditingDebriefLog(null)
      setShowDebriefHistory(true)
    } catch (err) {
      console.error('Failed to save review:', err)
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
                          const isSelected = mood === m.id
                          return (
                            <button 
                              key={m.id} 
                              type="button" 
                              onClick={() => setMood(m.id)}
                              className="relative flex items-center justify-center w-14 h-14 rounded-2xl text-2xl border-2 transition-all active:scale-95 cursor-pointer"
                              style={{
                                borderColor: isSelected ? m.color : 'rgba(255, 255, 255, 0.1)',
                                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 20, 30, 0.6)',
                                boxShadow: isSelected ? `0 0 16px ${m.color}88, inset 0 0 10px ${m.color}44` : 'none',
                                transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                                opacity: isSelected ? 1 : 0.55
                              }}
                            >
                              <span>{m.emoji}</span>
                              {isSelected && (
                                <span 
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-black shadow"
                                  style={{ backgroundColor: m.color }}
                                >
                                  ✓
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted uppercase tracking-widest mb-3 block">
                        Reflection Log
                      </label>
                      <textarea value={content} onChange={e => setContent(e.target.value)}
                        placeholder="Document your thoughts, struggles, and victories today..."
                        className="input w-full min-h-[300px] p-4 resize-y font-mono text-sm leading-relaxed" />
                    </div>
                    <div className="flex-between border-t border-border-color pt-4">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-amber" />
                        <span className="font-mono text-xs text-muted">
                          ARCHIVE: <span className="text-primary font-bold">DAILY REFLECTION</span>
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
                    const dayNumber = entries.length - index
                    return (
                      <HudPanel key={entry.id} className="cursor-pointer" onClick={() => setExpandedArchive(expandedArchive === entry.id ? null : entry.id)}>
                        <div className={`flex-between ${expandedArchive === entry.id ? 'mb-4 border-b border-border-color pb-2' : ''}`}>
                          <div className="flex items-center gap-3">
                            <span className="font-display text-lg text-primary tracking-widest">DAY {dayNumber}</span>
                            <span className="font-mono text-sm text-amber opacity-80">{entry.date}</span>
                          </div>
                          <div className="flex items-center justify-center text-base px-2.5 py-1 rounded border"
                            style={{ color: moodObj.color, borderColor: moodObj.color, backgroundColor: `${moodObj.color}15` }}>
                            <span>{moodObj.emoji}</span>
                          </div>
                        </div>
                        {expandedArchive === entry.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            className="font-mono text-secondary whitespace-pre-wrap text-sm">
                            {entry.content || entry.what_did_i_do || entry.reflection || entry.description || '—'}
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
                  {/* EDITING BANNER */}
                  {editingDebriefLog && (
                    <div className="p-3 bg-amber/15 border border-amber/40 rounded-xl flex items-center justify-between font-mono text-xs text-amber mb-4">
                      <span className="font-bold flex items-center gap-2">
                        <Pencil size={14} /> EDITING: {editingDebriefLog.title}
                      </span>
                      <button 
                        type="button" 
                        onClick={handleCancelEditDebrief} 
                        className="px-2.5 py-1 rounded bg-black/40 text-white hover:bg-black/60 font-bold text-[10px] uppercase border border-white/10"
                      >
                        CANCEL EDIT
                      </button>
                    </div>
                  )}

                  {/* WEEK NAVIGATION BAR */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/40 border border-white/10 font-mono text-xs mb-4">
                    <button
                      type="button"
                      onClick={() => { setEditingDebriefLog(null); setDebriefWeekOffset(w => w - 1); }}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] uppercase transition-all"
                    >
                      <ChevronLeft size={13} />
                      <span>PREV WEEK</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} className="text-amber" />
                      <span className="font-bold text-amber text-[11px] tracking-wider uppercase">
                        {dateRange.start} – {dateRange.end} {debriefWeekOffset === 0 ? '(THIS WEEK)' : ''}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setEditingDebriefLog(null); setDebriefWeekOffset(w => Math.min(0, w + 1)); }}
                      disabled={debriefWeekOffset >= 0}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span>NEXT WEEK</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveDebrief} className="space-y-6">
                    {/* Section 1: Wins */}
                    <div>
                      <label className="font-mono text-xs uppercase tracking-widest mb-2 block text-success">What went well this week?</label>
                      <textarea value={wins} onChange={e => setWins(e.target.value)} placeholder="Document your victories, breakthroughs, and wins..."
                        className="input w-full min-h-[120px] resize-y font-mono text-sm leading-relaxed" />
                    </div>

                    {/* Section 2: Fails */}
                    <div>
                      <label className="font-mono text-xs uppercase tracking-widest mb-2 block text-danger">Bottlenecks & Fails</label>
                      <textarea value={fails} onChange={e => setFails(e.target.value)} placeholder="What held you back? Where did you fall short?"
                        className="input w-full min-h-[120px] resize-y font-mono text-sm leading-relaxed" />
                    </div>

                    {/* Section 3: 3 Goal Bars */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs uppercase tracking-widest block text-info font-bold">Priorities for Next Week</label>
                        <span className="font-mono text-[9px] text-muted uppercase">MAX 20 WORDS PER GOAL</span>
                      </div>
                      <p className="font-mono text-xs text-muted">Enter up to 3 key goals for next week. These will deploy to your Command Center as finishable operations!</p>
                      
                      {[
                        { id: 1, val: nextGoal1, set: setNextGoal1, placeholder: "Goal #1 (e.g., Ship landing page redesign & test payment link)" },
                        { id: 2, val: nextGoal2, set: setNextGoal2, placeholder: "Goal #2 (e.g., Close 3 client proposals and conduct demo calls)" },
                        { id: 3, val: nextGoal3, set: setNextGoal3, placeholder: "Goal #3 (e.g., Complete 5 workouts and stick to 8h sleep target)" },
                      ].map((item) => {
                        const words = getWordCount(item.val)
                        return (
                          <div key={item.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-amber font-bold uppercase tracking-widest">PRIORITY GOAL #{item.id}</span>
                              <span className={`font-mono text-[9px] ${words >= 20 ? 'text-danger font-bold' : 'text-muted'}`}>({words}/20 words)</span>
                            </div>
                            <input 
                              type="text"
                              className="input w-full font-mono text-xs py-2 px-3 bg-bg-primary border border-border-color focus:border-amber rounded text-primary"
                              placeholder={item.placeholder}
                              value={item.val || ''}
                              onChange={e => item.set(e.target.value)}
                            />
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex-between border-t border-border-color pt-4">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-amber" />
                        <span className="font-mono text-xs text-muted">PROTOCOL: <span className="text-primary font-bold">WEEKLY RETROSPECTIVE</span></span>
                      </div>
                      <button type="submit" disabled={savingDebrief} className="btn btn-primary btn-lg flex items-center gap-2">
                        <Save size={18} />{savingDebrief ? 'SAVING...' : (editingDebriefLog ? 'UPDATE DEBRIEF' : 'SEAL DEBRIEF')}
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
                      <div className={`flex items-center justify-between gap-3 ${expandedDebrief === log.id ? 'mb-4 border-b border-border-color pb-2' : ''}`}>
                        <div>
                          <span className="font-display text-base text-primary tracking-widest block">{log.title}</span>
                          <span className="font-mono text-xs text-muted">{log.date}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEditDebrief(log)
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber/15 border border-amber/40 hover:bg-amber/30 text-amber font-mono text-[10px] font-bold uppercase transition-all shrink-0"
                        >
                          <Pencil size={12} />
                          <span>EDIT DEBRIEF</span>
                        </button>
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
