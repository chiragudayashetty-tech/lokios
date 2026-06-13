'use client'

import { useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useHabits } from '@/lib/hooks/useHabits'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, Flame, Trash2, ChevronLeft, ChevronRight, X, Archive } from 'lucide-react'

export default function DailyOps() {
  const { habits, monthLogs, todayLogs, loading, toggleHabitForDate, addHabit, deleteHabit, archiveHabit, fetchHabits } = useHabits()

  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()) // 0-indexed
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('beyond_tatva')
  const [customCategory, setCustomCategory] = useState('')
  const [newXp, setNewXp] = useState(25)

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  // Days in the current viewed month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = new Date()
  const todayDay = today.getDate()
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); fetchHabits(viewYear - 1, 11) }
    else { setViewMonth(viewMonth - 1); fetchHabits(viewYear, viewMonth - 1) }
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); fetchHabits(viewYear + 1, 0) }
    else { setViewMonth(viewMonth + 1); fetchHabits(viewYear, viewMonth + 1) }
  }

  // Build a lookup set: "habitId::YYYY-MM-DD" for O(1) checks
  const logSet = useMemo(() => {
    const s = new Set()
    monthLogs.forEach((l) => s.add(`${l.habit_id}::${l.date}`))
    return s
  }, [monthLogs])

  const isChecked = (habitId, day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return logSet.has(`${habitId}::${dateStr}`)
  }

  const handleToggle = (habitId, day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    toggleHabitForDate(habitId, dateStr)
  }

  const handleFail = (habitId, dateStr) => {
    if (!window.confirm('Are you sure? This cannot be undone.')) return
    toggleHabitForDate(habitId, dateStr, 'failed')
  }

  const handleDelete = async (habitId) => {
    if (!window.confirm('Are you sure you want to permanently delete this operation?')) return
    await deleteHabit(habitId)
  }

  // Stats for each habit
  const getHabitStats = (habitId) => {
    let completed = 0
    days.forEach((d) => { if (isChecked(habitId, d)) completed++ })
    const goal = daysInMonth
    const left = goal - completed
    const pct = goal === 0 ? 0 : Math.round((completed / goal) * 100)
    return { completed, goal, left, pct }
  }

  // Global stats
  const globalStats = useMemo(() => {
    if (habits.length === 0) return { completed: 0, goal: 0, pct: 0 }
    let total = 0, done = 0
    habits.forEach((h) => {
      days.forEach((d) => {
        total++
        if (isChecked(h.id, d)) done++
      })
    })
    return { completed: done, goal: total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [habits, logSet, days])

  // Today's completion stats
  const todayComplete = habits.filter(h => todayLogs.some(l => l.habit_id === h.id)).length
  const todayTotal = habits.length
  const todayPct = todayTotal === 0 ? 0 : Math.round((todayComplete / todayTotal) * 100)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await addHabit({
      title: newTitle,
      category: newCategory === 'other' ? (customCategory || 'Other') : newCategory,
      stat_category: QUEST_CATEGORIES.find(c => c.id === newCategory)?.stat_category || 'discipline',
      frequency: 'daily',
      xp_per_completion: newXp
    })
    setNewTitle('')
    setCustomCategory('')
    setShowAddForm(false)
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING HABIT TRACKER...</span></div></AppShell>

  // Day of week abbreviations
  const getDow = (day) => {
    const d = new Date(viewYear, viewMonth, day)
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]
  }

  return (
    <AppShell>
      <div className="page-container" style={{ maxWidth: '1600px' }}>
        <header className="page-header flex-between flex-wrap gap-4">
          <div>
            <h1 className="page-title">DAILY OPS — HABIT TRACKER</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Monthly overview. Click any cell to toggle completion.</p>
          </div>
          <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> ADD ROUTINE
          </button>
        </header>

        {/* Top Stats Row */}
        <div className="grid-3 gap-4 mb-6">
          {/* Today's Progress */}
          <HudPanel glow className="flex items-center gap-5 p-5">
            <div className="relative w-16 h-16 shrink-0 flex-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-strong)" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent-primary)" strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - todayPct / 100)}`}
                  strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex-center">
                <span className="font-display text-lg text-primary">{todayPct}%</span>
              </div>
            </div>
            <div>
              <div className="font-display text-lg uppercase tracking-wider text-primary">TODAY</div>
              <div className="font-mono text-sm text-secondary">{todayComplete} / {todayTotal} completed</div>
            </div>
          </HudPanel>

          {/* Monthly Progress */}
          <HudPanel className="flex items-center gap-5 p-5">
            <div className="relative w-16 h-16 shrink-0 flex-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-strong)" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--info)" strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - globalStats.pct / 100)}`}
                  strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex-center">
                <span className="font-display text-lg text-info">{globalStats.pct}%</span>
              </div>
            </div>
            <div>
              <div className="font-display text-lg uppercase tracking-wider text-primary">MONTHLY</div>
              <div className="font-mono text-sm text-secondary">{globalStats.completed} / {globalStats.goal} total</div>
            </div>
          </HudPanel>

          {/* Month Navigation */}
          <HudPanel className="flex-center gap-6 p-5">
            <button onClick={prevMonth} className="btn btn-ghost p-2 hover:text-amber"><ChevronLeft size={20} /></button>
            <div className="text-center">
              <div className="font-display text-2xl uppercase tracking-widest text-primary">{MONTH_NAMES[viewMonth]}</div>
              <div className="font-mono text-xs text-muted">{viewYear}</div>
            </div>
            <button onClick={nextMonth} className="btn btn-ghost p-2 hover:text-amber"><ChevronRight size={20} /></button>
          </HudPanel>
        </div>

        {/* The Spreadsheet Grid */}
        <HudPanel className="overflow-x-auto p-0">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-tertiary)', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)', borderRight: '2px solid var(--border-color)', minWidth: '200px' }}>
                  <span className="font-display text-xs uppercase tracking-widest text-primary">DAILY HABITS</span>
                </th>
                <th style={{ position: 'sticky', left: '200px', zIndex: 10, background: 'var(--bg-tertiary)', padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', borderRight: '2px solid var(--border-color)', minWidth: '50px' }}>
                  <span className="font-mono text-[10px] text-muted">XP</span>
                </th>
                {days.map((d) => {
                  const isToday = isCurrentMonth && d === todayDay
                  return (
                    <th key={d} style={{
                      padding: '6px 2px', textAlign: 'center',
                      borderBottom: '1px solid var(--border-color)',
                      background: isToday ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      minWidth: '32px'
                    }}>
                      <div className="font-mono text-[9px] text-muted">{getDow(d)}</div>
                      <div className={`font-mono text-xs ${isToday ? 'text-info font-bold' : 'text-secondary'}`}>{d}</div>
                    </th>
                  )
                })}
                {/* Stats columns */}
                <th style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', borderLeft: '2px solid var(--border-color)', background: 'var(--bg-tertiary)', minWidth: '45px' }}>
                  <span className="font-mono text-[9px] text-success">DONE</span>
                </th>
                <th style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', minWidth: '45px' }}>
                  <span className="font-mono text-[9px] text-muted">LEFT</span>
                </th>
                <th style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', minWidth: '50px' }}>
                  <span className="font-mono text-[9px] text-info">%</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {habits.map((habit, idx) => {
                const stats = getHabitStats(habit.id)
                const cat = QUEST_CATEGORIES.find(c => c.id === habit.category) || QUEST_CATEGORIES[0]
                return (
                  <tr key={habit.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    className="group hover:bg-hover transition-colors">
                    {/* Habit Name */}
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 5,
                      background: 'var(--bg-secondary)',
                      padding: '8px 12px',
                      borderRight: '2px solid var(--border-color)',
                    }}>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-8 rounded-full shrink-0" style={{ background: cat.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs text-primary truncate">{habit.title}</div>
                          <div className="font-mono text-[9px] text-muted uppercase">{cat.name}</div>
                        </div>
                        <button onClick={() => archiveHabit(habit.id)} className="opacity-40 hover:opacity-100 transition-opacity text-amber p-1" title="Archive Routine">
                          <Archive size={12} />
                        </button>
                        <button type="button" onClick={() => handleDelete(habit.id)} className="opacity-40 hover:opacity-100 transition-opacity text-danger p-1" title="Delete Routine">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                    {/* XP */}
                    <td style={{
                      position: 'sticky', left: '200px', zIndex: 5,
                      background: 'var(--bg-secondary)',
                      textAlign: 'center',
                      borderRight: '2px solid var(--border-color)',
                      padding: '4px'
                    }}>
                      <span className="font-mono text-[10px] text-info font-bold">{habit.xp_per_completion || 25}</span>
                    </td>
                    {/* Day cells */}
                    {days.map((d) => {
                      const checked = isChecked(habit.id, d)
                      const isToday = isCurrentMonth && d === todayDay
                      return (
                        <td key={d}
                          onClick={() => handleToggle(habit.id, d)}
                          style={{
                            textAlign: 'center', padding: '4px 2px', cursor: 'pointer',
                            background: isToday ? 'var(--accent-subtle)' : 'transparent',
                          }}
                          className="hover:bg-hover transition-colors"
                        >
                          <div style={{
                            width: '20px', height: '20px', margin: '0 auto',
                            border: checked ? 'none' : '1.5px solid var(--border-strong)',
                            borderRadius: '3px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: checked ? cat.color : 'transparent',
                            transition: 'all 150ms ease',
                            opacity: checked ? 1 : 0.5,
                          }}>
                            {checked && <Check size={12} color="#fff" strokeWidth={3} />}
                          </div>
                        </td>
                      )
                    })}
                    {/* Stats cells */}
                    <td style={{ textAlign: 'center', borderLeft: '2px solid var(--border-color)', padding: '4px' }}>
                      <span className="font-mono text-xs text-success font-bold">{stats.completed}</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '4px' }}>
                      <span className="font-mono text-xs text-muted">{stats.left}</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '4px' }}>
                      <span className={`font-mono text-xs font-bold ${stats.pct >= 80 ? 'text-success' : stats.pct >= 50 ? 'text-amber' : 'text-danger'}`}>
                        {stats.pct}%
                      </span>
                    </td>
                  </tr>
                )
              })}

              {/* Global Progress Row */}
              {habits.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--accent-primary)' }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--bg-tertiary)', padding: '10px 12px', borderRight: '2px solid var(--border-color)' }}>
                    <span className="font-display text-xs uppercase tracking-widest text-amber">GLOBAL PROGRESS</span>
                  </td>
                  <td style={{ position: 'sticky', left: '200px', zIndex: 5, background: 'var(--bg-tertiary)', borderRight: '2px solid var(--border-color)' }}></td>
                  {days.map((d) => {
                    const dayDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    const dayDone = habits.filter(h => logSet.has(`${h.id}::${dayDate}`)).length
                    const dayPct = habits.length === 0 ? 0 : Math.round((dayDone / habits.length) * 100)
                    const isToday = isCurrentMonth && d === todayDay
                    return (
                      <td key={d} style={{
                        textAlign: 'center', padding: '6px 2px',
                        background: isToday ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      }}>
                        <span className={`font-mono text-[9px] font-bold ${dayPct === 100 ? 'text-success' : dayPct > 0 ? 'text-amber' : 'text-muted'}`}>
                          {dayPct > 0 ? `${dayPct}` : '·'}
                        </span>
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'center', borderLeft: '2px solid var(--border-color)', background: 'var(--bg-tertiary)', padding: '6px' }}>
                    <span className="font-mono text-xs text-success font-bold">{globalStats.completed}</span>
                  </td>
                  <td style={{ textAlign: 'center', background: 'var(--bg-tertiary)', padding: '6px' }}>
                    <span className="font-mono text-xs text-muted">{globalStats.goal - globalStats.completed}</span>
                  </td>
                  <td style={{ textAlign: 'center', background: 'var(--bg-tertiary)', padding: '6px' }}>
                    <span className={`font-mono text-xs font-bold ${globalStats.pct >= 80 ? 'text-success' : 'text-primary'}`}>{globalStats.pct}%</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {habits.length === 0 && (
            <div className="p-12 text-center">
              <div className="font-mono text-sm text-muted mb-4">NO ROUTINES DEPLOYED</div>
              <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-sm">ADD YOUR FIRST ROUTINE</button>
            </div>
          )}
        </HudPanel>

        {/* Top 10 Daily Habits Sidebar */}
        {habits.length > 0 && (
          <div className="grid-2 gap-6 mt-6">
            <HudPanel label="TOP 10 DAILY HABITS">
              <div className="flex-col gap-2">
                {habits.slice(0, 10).map((h, i) => {
                  const log = todayLogs.find(l => l.habit_id === h.id)
                  const isComplete = log && (!log.status || log.status === 'completed')
                  const isFailed = log && log.status === 'failed'
                  
                  return (
                    <div key={h.id} className="flex items-center gap-3 p-2 hover:bg-hover transition-colors">
                      <span className="font-mono text-xs text-muted w-5 text-right">{i + 1}</span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => toggleHabitForDate(h.id, todayStr, 'completed')}
                          className="flex items-center justify-center transition-all hover:scale-110"
                          style={{
                            width: '22px', height: '22px',
                            border: isComplete ? 'none' : '1.5px solid var(--border-color)',
                            borderRadius: '3px',
                            background: isComplete ? 'var(--success)' : 'var(--bg-tertiary)',
                            opacity: isFailed ? 0.3 : 1
                          }}
                        >
                          <Check size={14} color={isComplete ? "#fff" : "var(--muted)"} strokeWidth={isComplete ? 3 : 2} />
                        </button>
                        <button 
                          onClick={() => handleFail(h.id, todayStr)}
                          className="flex items-center justify-center transition-all hover:scale-110"
                          style={{
                            width: '22px', height: '22px',
                            border: isFailed ? 'none' : '1.5px solid var(--border-color)',
                            borderRadius: '3px',
                            background: isFailed ? 'var(--danger)' : 'var(--bg-tertiary)',
                            opacity: isComplete ? 0.3 : 1
                          }}
                        >
                          <X size={14} color={isFailed ? "#fff" : "var(--muted)"} strokeWidth={isFailed ? 3 : 2} />
                        </button>
                      </div>
                      <span className={`font-mono text-sm flex-1 ${isComplete ? 'text-muted line-through' : isFailed ? 'text-danger line-through' : 'text-primary'}`}>{h.title}</span>
                      {isComplete && <span className="font-mono text-[10px] text-success">+{h.xp_per_completion || 25} XP</span>}
                      {isFailed && <span className="font-mono text-[10px] text-danger">-15 XP</span>}
                      {!isComplete && !isFailed && <span className="font-mono text-[10px] text-info font-bold">+{h.xp_per_completion || 25} XP</span>}
                    </div>
                  )
                })}
              </div>
            </HudPanel>

            <HudPanel label="STREAK & CONSISTENCY">
              <div className="flex-col gap-4">
                {habits.slice(0, 5).map(h => {
                  const stats = getHabitStats(h.id)
                  return (
                    <div key={h.id}>
                      <div className="flex-between mb-1">
                        <span className="font-mono text-xs text-primary">{h.title}</span>
                        <span className="font-mono text-[10px] text-info font-bold flex items-center gap-1">
                          <Flame size={10} /> {h.current_streak || 0}d
                        </span>
                      </div>
                      <div className="mt-2">
                        <TacticalProgress 
                          value={stats.pct} 
                          color={stats.pct >= 80 ? 'var(--success)' : stats.pct >= 50 ? 'var(--info)' : 'var(--danger)'} 
                          height={6} 
                          showValue={false} 
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </HudPanel>
          </div>
        )}

        {/* Add Form Modal */}
        <AnimatePresence>
          {showAddForm && (
            <div className="modal-overlay">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
                <HudPanel className="modal-content" style={{ width: '420px', maxWidth: '95vw' }}>
                  <div className="flex-between mb-4 border-b border-border-color pb-3">
                    <span className="font-display text-xl uppercase text-amber">Add Routine</span>
                    <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-danger"><X size={18} /></button>
                  </div>
                  <form onSubmit={handleAdd} className="flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">ROUTINE TITLE</label>
                      <input type="text" className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} required autoFocus placeholder="e.g. Wake up at 7AM" />
                    </div>
                    <div className="grid-2 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                        <select className="select font-mono w-full" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                          {QUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {newCategory === 'other' && (
                          <div className="mt-2">
                            <input type="text" className="input font-mono text-xs w-full" 
                              value={customCategory} 
                              onChange={e => setCustomCategory(e.target.value)}
                              placeholder="Specify category..." required />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">XP PER DAY</label>
                        <input type="number" className="input font-mono" value={newXp} onChange={e => setNewXp(e.target.value)} min="1" max="100" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button type="submit" className="btn btn-primary flex-1">DEPLOY</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>ABORT</button>
                    </div>
                  </form>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
