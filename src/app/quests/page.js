'use client'

import { useState, useMemo, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import { Plus, Check, X, Archive, Trash2, ChevronLeft, ChevronRight, AlertTriangle, ArrowUp, ArrowDown, Flame } from 'lucide-react'
import { useHabitsInternal } from '@/lib/hooks/useHabitsInternal'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'

export default function DailyOps() {
  const {
    habits, monthLogs, todayLogs, loading, error,
    fetchHabits, cycleHabitState, addHabit, deleteHabit, archiveHabit, reorderHabits, updateHabit
  } = useHabitsInternal()

  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()) // 0-indexed
  const [mobileWeekStart, setMobileWeekStart] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('beyond_tatva')
  const [customCategory, setCustomCategory] = useState('')
  const [newXp, setNewXp] = useState(25)

  // Edit State
  const [editingHabit, setEditingHabit] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCustomCategory, setEditCustomCategory] = useState('')
  const [editXp, setEditXp] = useState(25)

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  // Days in the current viewed month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = new Date()
  const todayDay = today.getDate()
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  const mobileDays = Array.from({ length: 7 }, (_, i) => mobileWeekStart + i).filter(d => d <= daysInMonth)
  
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Navigate months
  const prevMonth = () => {
    setMobileWeekStart(1)
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); fetchHabits(viewYear - 1, 11) }
    else { setViewMonth(viewMonth - 1); fetchHabits(viewYear, viewMonth - 1) }
  }
  const nextMonth = () => {
    setMobileWeekStart(1)
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); fetchHabits(viewYear + 1, 0) }
    else { setViewMonth(viewMonth + 1); fetchHabits(viewYear, viewMonth + 1) }
  }

  const prevWeek = () => setMobileWeekStart(prev => Math.max(1, prev - 7))
  const nextWeek = () => setMobileWeekStart(prev => Math.min(daysInMonth, prev + 7))

  useEffect(() => {
    if (isCurrentMonth) {
      setMobileWeekStart(Math.max(1, todayDay - today.getDay()))
    } else {
      setMobileWeekStart(1)
    }
  }, [viewMonth, viewYear, isCurrentMonth, todayDay])

  // Build a lookup map: "habitId::YYYY-MM-DD" -> status
  const logMap = useMemo(() => {
    const m = new Map()
    monthLogs.forEach((l) => m.set(`${l.habit_id}::${l.date}`, l.status || 'completed'))
    return m
  }, [monthLogs])

  const getStatus = (habitId, day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return logMap.get(`${habitId}::${dateStr}`) || 'none'
  }

  const handleToggle = (habitId, day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cycleHabitState(habitId, dateStr)
  }

  const handleDelete = async (habitId) => {
    if (!window.confirm('Are you sure you want to permanently delete this operation?')) return
    await deleteHabit(habitId)
  }

  // Stats for each habit
  const getHabitStats = (habitId) => {
    let completed = 0
    let failed = 0
    days.forEach((d) => {
      const status = getStatus(habitId, d)
      if (status === 'completed') completed++
      if (status === 'failed') failed++
    })
    const goal = daysInMonth
    const left = goal - completed - failed // Not totally accurate if left implies days left, but works
    const pct = goal === 0 ? 0 : Math.round((completed / goal) * 100)
    return { completed, failed, left: Math.max(0, left), pct }
  }

  // Global month stats
  const globalStats = useMemo(() => {
    let done = 0
    let total = 0
    habits.forEach((h) => {
      days.forEach((d) => {
        total++
        if (getStatus(h.id, d) === 'completed') done++
      })
    })
    return { completed: done, goal: total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [habits, logMap, days])

  // Today's completion stats
  const todayComplete = habits.filter(h => todayLogs.some(l => l.habit_id === h.id && (!l.status || l.status === 'completed'))).length
  const todayFailed = habits.filter(h => todayLogs.some(l => l.habit_id === h.id && l.status === 'failed')).length
  const todayTotal = habits.length
  const todayPct = todayTotal === 0 ? 0 : Math.round((todayComplete / todayTotal) * 100)

  // Top Consistent Habits
  const topHabits = useMemo(() => {
    return [...habits]
      .map(h => ({ ...h, stats: getHabitStats(h.id) }))
      .sort((a, b) => b.stats.completed - a.stats.completed)
      .slice(0, 10)
  }, [habits, logMap, days])

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

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editTitle.trim() || !editingHabit) return
    await updateHabit(editingHabit.id, {
      title: editTitle,
      category: editCategory === 'other' ? (editCustomCategory || 'Other') : editCategory,
      stat_category: QUEST_CATEGORIES.find(c => c.id === editCategory)?.stat_category || 'discipline',
      xp_per_completion: editXp
    })
    setEditingHabit(null)
  }

  const openEditModal = (h) => {
    setEditingHabit(h)
    setEditTitle(h.title)
    const isCustom = !QUEST_CATEGORIES.some(c => c.id === h.category)
    if (isCustom) {
      setEditCategory('other')
      setEditCustomCategory(h.category)
    } else {
      setEditCategory(h.category)
      setEditCustomCategory('')
    }
    setEditXp(h.xp_per_completion || 25)
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex-center h-full flex-col gap-4 text-center">
          <AlertTriangle size={48} className="text-danger mb-2" />
          <h2 className="font-display text-xl text-danger uppercase tracking-widest">SYSTEM ERROR</h2>
          <p className="font-mono text-sm text-muted max-w-md">{error}</p>
          <button type="button" onClick={() => fetchHabits()} className="btn btn-primary mt-4">RETRY CONNECTION</button>
        </div>
      </AppShell>
    )
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
        <div className="grid-2 gap-4 mb-6">
          {/* Today's Progress */}
          <HudPanel glow className="flex items-center gap-5 p-5">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-strong)" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent-primary)" strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - todayPct / 100)}`}
                  strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
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
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-strong)" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--info)" strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - globalStats.pct / 100)}`}
                  strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-lg text-info">{globalStats.pct}%</span>
              </div>
            </div>
            <div>
              <div className="font-display text-lg uppercase tracking-wider text-info">MONTH TOTAL</div>
              <div className="font-mono text-sm text-secondary">{globalStats.completed} / {globalStats.goal} total</div>
            </div>
          </HudPanel>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-center mb-6">
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
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '900px' }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-[140px] md:w-[260px] min-w-[140px] md:min-w-[260px] max-w-[140px] md:max-w-[260px]" style={{ background: 'var(--bg-tertiary)', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)', borderRight: '2px solid var(--border-color)', borderTopLeftRadius: 'var(--radius-lg)' }}>
                  <span className="font-display text-[10px] md:text-xs uppercase tracking-widest text-primary">DAILY HABITS</span>
                </th>
                <th className="sticky left-[140px] md:left-[260px] z-20 w-[40px] md:w-[50px] min-w-[40px] md:min-w-[50px] max-w-[40px] md:max-w-[50px]" style={{ background: 'var(--bg-tertiary)', padding: '10px 4px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', borderRight: '2px solid var(--border-color)' }}>
                  <span className="font-mono text-[10px] text-muted">XP</span>
                </th>
                {days.map((d) => {
                  const isToday = isCurrentMonth && d === todayDay
                  return (
                    <th key={d} style={{
                      padding: '6px 2px', textAlign: 'center',
                      borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-subtle)',
                      background: isToday ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      minWidth: '36px'
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
                <th style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', minWidth: '50px', borderTopRightRadius: 'var(--radius-lg)' }}>
                  <span className="font-mono text-[9px] text-info">%</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {habits.map((habit, idx) => {
                const stats = getHabitStats(habit.id)
                const cat = QUEST_CATEGORIES.find(c => c.id === habit.category) || QUEST_CATEGORIES[0]
                return (
                  <tr key={habit.id} className="group hover:bg-hover transition-colors">
                    {/* Habit Name */}
                    <td className="sticky left-0 z-10 w-[140px] md:w-[260px] min-w-[140px] md:min-w-[260px] max-w-[140px] md:max-w-[260px]" style={{
                      background: 'var(--bg-secondary)',
                      padding: '8px',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderRight: '2px solid var(--border-color)',
                    }}>
                      <div className="flex items-center gap-1 md:gap-2">
                        <div className="flex flex-col gap-1 pr-1 border-r border-[var(--border-subtle)]">
                          <button onClick={() => reorderHabits(habit.id, 'up')} className="opacity-40 hover:opacity-100 text-muted" title="Move Up"><ArrowUp size={10} /></button>
                          <button onClick={() => reorderHabits(habit.id, 'down')} className="opacity-40 hover:opacity-100 text-muted" title="Move Down"><ArrowDown size={10} /></button>
                        </div>
                        <div className="w-1 md:w-1.5 h-8 rounded-full shrink-0" style={{ background: cat.color }} />
                        <div className="flex-1 min-w-0" onClick={() => openEditModal(habit)} style={{ cursor: 'pointer' }}>
                          <div className="font-mono text-[10px] md:text-xs text-primary truncate hover:text-amber transition-colors">{habit.title}</div>
                          <div className="font-mono text-[8px] md:text-[9px] text-muted uppercase hidden md:block">{cat.name}</div>
                        </div>
                        <button type="button" onClick={() => handleDelete(habit.id)} className="opacity-40 hover:opacity-100 transition-opacity text-danger p-1 shrink-0" title="Delete Routine">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                    {/* XP */}
                    <td className="sticky left-[140px] md:left-[260px] z-[5] w-[40px] md:w-[50px] min-w-[40px] md:min-w-[50px] max-w-[40px] md:max-w-[50px]" style={{
                      background: 'var(--bg-secondary)',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderRight: '2px solid var(--border-color)',
                      padding: '4px'
                    }}>
                      <span className="font-mono text-[9px] md:text-[10px] text-info font-bold">{habit.xp_per_completion || 25}</span>
                    </td>
                    {/* Day cells */}
                    {days.map((d) => {
                      const status = getStatus(habit.id, d)
                      const isToday = isCurrentMonth && d === todayDay
                      return (
                        <td key={d}
                          onClick={() => handleToggle(habit.id, d)}
                          style={{
                            textAlign: 'center', padding: '0', cursor: 'pointer', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
                            background: isToday ? 'var(--accent-subtle)' : 'transparent',
                          }}
                          className="hover:bg-hover transition-colors min-w-[36px]"
                        >
                          <div style={{
                            width: '26px', height: '26px', margin: '4px auto',
                            border: status === 'none' ? '1px solid var(--border-color)' : 'none',
                            borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: status === 'completed' ? cat.color : status === 'failed' ? 'var(--danger)' : 'transparent',
                            transition: 'all 150ms ease',
                            opacity: status !== 'none' ? 1 : 0.4,
                          }}>
                            {status === 'completed' && <Check size={12} color="#fff" strokeWidth={3} />}
                            {status === 'failed' && <X size={12} color="#fff" strokeWidth={3} />}
                          </div>
                        </td>
                      )
                    })}
                    {/* Stats cells */}
                    <td style={{ textAlign: 'center', borderLeft: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-subtle)', padding: '6px' }}>
                      <span className="font-mono text-[10px] text-success font-bold">{stats.completed}</span>
                    </td>
                    <td style={{ textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', padding: '6px' }}>
                      <span className="font-mono text-[10px] text-muted">{stats.left}</span>
                    </td>
                    <td style={{ textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', padding: '6px' }}>
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
                  <td className="sticky left-0 z-[5] w-[140px] md:w-[260px] min-w-[140px] md:min-w-[260px] max-w-[140px] md:max-w-[260px]" style={{ background: 'var(--bg-tertiary)', padding: '10px 12px', borderRight: '2px solid var(--border-color)' }}>
                    <span className="font-display text-[10px] md:text-xs uppercase tracking-widest text-amber truncate block">GLOBAL PROGRESS</span>
                  </td>
                  <td className="sticky left-[140px] md:left-[260px] z-[5] w-[40px] md:w-[50px] min-w-[40px] md:min-w-[50px] max-w-[40px] md:max-w-[50px]" style={{ background: 'var(--bg-tertiary)', borderRight: '2px solid var(--border-color)' }}></td>
                  {days.map((d) => {
                    const dayDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    const dayDone = habits.filter(h => logMap.get(`${h.id}::${dayDate}`) === 'completed').length
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
        {topHabits.length > 0 && (
          <div className="grid-2 gap-6 mt-6">
            <HudPanel label="TOP 10 CONSISTENT ROUTINES">
              <div className="flex-col gap-2">
                {topHabits.map((h, i) => {
                  const log = todayLogs.find(l => l.habit_id === h.id)
                  const isComplete = log && (!log.status || log.status === 'completed')
                  const isFailed = log && log.status === 'failed'
                  
                  return (
                    <div key={h.id} className="flex items-center gap-3 p-2 hover:bg-hover transition-colors">
                      <span className="font-mono text-xs text-muted w-5 text-right">{i + 1}</span>
                      <button 
                        onClick={() => cycleHabitState(h.id, todayStr)}
                        className="flex items-center justify-center transition-all hover:scale-110"
                        style={{
                          width: '24px', height: '24px',
                          border: isComplete || isFailed ? 'none' : '1.5px solid var(--border-color)',
                          borderRadius: '4px',
                          background: isComplete ? 'var(--success)' : isFailed ? 'var(--danger)' : 'var(--bg-tertiary)',
                        }}
                      >
                        {isComplete && <Check size={14} color="#fff" strokeWidth={3} />}
                        {isFailed && <X size={14} color="#fff" strokeWidth={3} />}
                      </button>
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
                {habits.map(h => {
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

      {/* Edit Routine Modal */}
      <AnimatePresence>
        {editingHabit && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-content"
            >
              <div className="modal-header">
                <h3 className="font-display text-lg text-primary tracking-widest">EDIT ROUTINE</h3>
                <button onClick={() => setEditingHabit(null)} className="text-muted hover:text-primary"><X size={20} /></button>
              </div>
              <form onSubmit={handleEditSave} className="flex flex-col gap-4">
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">ROUTINE TITLE</label>
                  <input type="text" className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                  <select className="select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {QUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    <option value="other">Other</option>
                  </select>
                </div>
                {editCategory === 'other' && (
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">CUSTOM CATEGORY</label>
                    <input type="text" className="input" value={editCustomCategory} onChange={(e) => setEditCustomCategory(e.target.value)} required placeholder="e.g. Finance" />
                  </div>
                )}
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">XP REWARD / PENALTY</label>
                  <input type="number" className="input" value={editXp} onChange={(e) => setEditXp(Number(e.target.value))} required min="5" max="100" step="5" />
                  <p className="font-mono text-[10px] text-muted mt-1">XP earned when complete. Penalty for failing is currently fixed at -15 XP.</p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setEditingHabit(null)} className="btn btn-ghost flex-1">CANCEL</button>
                  <button type="submit" className="btn btn-primary flex-1">SAVE CHANGES</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </AppShell>
  )
}
