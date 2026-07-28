'use client'

import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { getLocalDateStr, formatDate } from '@/lib/utils/dates'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Plus, MapPin, AlignLeft, Calendar as CalendarIcon,
  Clock, CheckSquare, Target, Zap, Search, Filter, Trash2, X, Check, Eye,
  Sliders, Grid, List, Sun, Award
} from 'lucide-react'
import styles from './calendar.module.css'

export default function DynamicGoogleCalendar() {
  const {
    auth: { user },
    profile: { profile },
    tasks: { tasks, loading: tLoading },
    goals: { goals: allGoals, loading: gLoading },
    calendar: { events = [], loading: cLoading, addEvent, deleteEvent } = {}
  } = useOS()

  // ─── STATE ───
  const [viewMode, setViewMode] = useState('month') // 'month' | 'week' | 'day' | 'agenda'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDateStr, setSelectedDateStr] = useState(getLocalDateStr())

  // Filters
  const [filterTypes, setFilterTypes] = useState({
    event: true,
    task: true,
    goal: true
  })
  const [searchQuery, setSearchQuery] = useState('')

  // Modal
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
    category: 'event'
  })
  const [selectedItemDetails, setSelectedItemDetails] = useState(null)

  const todayStr = getLocalDateStr()

  // ─── NAVIGATION HANDLERS ───
  const handleToday = () => {
    const now = new Date()
    setCurrentDate(now)
    setSelectedDateStr(getLocalDateStr(now))
  }

  const handlePrev = () => {
    const next = new Date(currentDate)
    if (viewMode === 'month' || viewMode === 'agenda') {
      next.setMonth(next.getMonth() - 1)
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() - 7)
    } else if (viewMode === 'day') {
      next.setDate(next.getDate() - 1)
    }
    setCurrentDate(next)
    setSelectedDateStr(getLocalDateStr(next))
  }

  const handleNext = () => {
    const next = new Date(currentDate)
    if (viewMode === 'month' || viewMode === 'agenda') {
      next.setMonth(next.getMonth() + 1)
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7)
    } else if (viewMode === 'day') {
      next.setDate(next.getDate() + 1)
    }
    setCurrentDate(next)
    setSelectedDateStr(getLocalDateStr(next))
  }

  // ─── DATE HELPERS ───
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ]

  // Week days starting Sunday
  const getWeekDays = (date) => {
    const start = new Date(date)
    const day = start.getDay()
    start.setDate(start.getDate() - day)
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  const currentWeekDays = useMemo(() => getWeekDays(currentDate), [currentDate])

  // Header Title Text
  const headerTitle = useMemo(() => {
    if (viewMode === 'month' || viewMode === 'agenda') {
      return `${monthNames[month]} ${year}`
    } else if (viewMode === 'week') {
      const start = currentWeekDays[0]
      const end = currentWeekDays[6]
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
    }
  }, [viewMode, month, year, currentDate, currentWeekDays])

  // ─── COMBINED ITEMS ───
  const allCombinedItems = useMemo(() => {
    const evs = (events || []).map(e => {
      const d = e.start_time ? new Date(e.start_time) : new Date()
      return {
        ...e,
        _type: 'event',
        dateStr: getLocalDateStr(d),
        startTime: e.start_time,
        endTime: e.end_time || e.start_time
      }
    })

    const tks = (tasks || []).map(t => {
      const dateStr = t.due_date || todayStr
      return {
        ...t,
        _type: 'task',
        dateStr,
        startTime: `${dateStr}T09:00:00`,
        endTime: `${dateStr}T10:00:00`
      }
    })

    const gls = (allGoals || []).filter(g => g.deadline).map(g => {
      const d = new Date(g.deadline)
      const dateStr = getLocalDateStr(d)
      return {
        ...g,
        _type: 'goal',
        dateStr,
        startTime: g.deadline,
        endTime: g.deadline
      }
    })

    return [...evs, ...tks, ...gls]
  }, [events, tasks, allGoals, todayStr])

  // Filtered items
  const filteredItems = useMemo(() => {
    return allCombinedItems.filter(item => {
      if (!filterTypes[item._type]) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const title = (item.title || '').toLowerCase()
        const desc = (item.description || '').toLowerCase()
        const loc = (item.location || '').toLowerCase()
        return title.includes(q) || desc.includes(q) || loc.includes(q)
      }
      return true
    })
  }, [allCombinedItems, filterTypes, searchQuery])

  // Get items for a specific date string
  const getItemsForDate = (dateStr) => {
    return filteredItems.filter(item => item.dateStr === dateStr)
  }

  // Handle Event Add
  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.start_time) return
    await addEvent(formData)
    setShowAddForm(false)
    setFormData({ title: '', description: '', location: '', start_time: '', end_time: '', category: 'event' })
  }

  // Handle Delete Event
  const handleDeleteItem = async (item) => {
    if (item._type === 'event' && deleteEvent) {
      if (window.confirm(`Delete event "${item.title}"?`)) {
        await deleteEvent(item.id)
        setSelectedItemDetails(null)
      }
    } else {
      alert(`Custom event items can be deleted. Tasks and Goals are managed in Operations / Missions.`)
    }
  }

  const isLoading = cLoading || tLoading || gLoading

  if (isLoading && !events.length && !tasks.length) {
    return (
      <AppShell>
        <div className="flex-center h-full min-h-[60vh]">
          <span className="typewriter-text text-info">CONNECTING SATELLITES & GOOGLE CALENDAR ENGINE...</span>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page-container full max-w-[1600px] mx-auto pb-12">

        {/* ─── TOP GOOGLE CALENDAR HEADER BAR ─── */}
        <header className="flex items-center justify-between gap-4 mb-6 flex-wrap border-b border-border-color pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarIcon size={26} className="text-info" />
              <div>
                <h1 className="font-display text-2xl font-bold tracking-widest text-primary uppercase leading-tight">
                  CALENDAR
                </h1>
                <p className="font-mono text-[9px] text-muted uppercase tracking-widest">
                  Google-Style Dynamic Temporal Engine
                </p>
              </div>
            </div>

            {/* Navigation & Today Button */}
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={handleToday}
                className="px-3.5 py-1.5 font-mono text-xs font-bold uppercase rounded border border-border-color bg-bg-tertiary hover:border-info text-primary transition-all active:scale-95"
              >
                TODAY
              </button>
              <div className="flex items-center border border-border-color rounded overflow-hidden bg-bg-tertiary">
                <button onClick={handlePrev} className="p-1.5 hover:bg-hover text-primary transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={handleNext} className="p-1.5 hover:bg-hover text-primary transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
              <h2 className="font-display text-lg font-bold tracking-widest text-primary uppercase ml-2">
                {headerTitle}
              </h2>
            </div>
          </div>

          {/* Right Controls: View Switcher Tabs + New Event + .ICS */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex border border-border-color rounded overflow-hidden bg-bg-tertiary">
              {[
                { id: 'month', label: 'MONTH' },
                { id: 'week', label: 'WEEK' },
                { id: 'day', label: 'DAY' },
                { id: 'agenda', label: 'AGENDA' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                    viewMode === tab.id
                      ? 'bg-info text-bg-primary font-extrabold'
                      : 'text-muted hover:text-primary hover:bg-hover'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* .ICS Link */}
            {profile?.calendar_token ? (
              <a
                href={`/api/calendar?token=${profile.calendar_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] px-2.5 py-1.5 rounded border border-info/40 text-info hover:bg-info/10 transition-colors uppercase tracking-widest hidden sm:inline-block"
              >
                .ICS LINK
              </a>
            ) : null}

            {/* Add Event Button */}
            <button
              onClick={() => {
                setFormData({
                  title: '',
                  description: '',
                  location: '',
                  start_time: `${selectedDateStr}T09:00`,
                  end_time: `${selectedDateStr}T10:00`,
                  category: 'event'
                })
                setShowAddForm(true)
              }}
              className="px-4 py-2 font-display font-bold text-xs uppercase tracking-widest rounded bg-info text-bg-primary hover:bg-info/90 transition-all flex items-center gap-1.5 shadow-lg shadow-info/20 active:scale-95"
            >
              <Plus size={16} /> NEW EVENT
            </button>
          </div>
        </header>

        {/* ─── MAIN LAYOUT: SIDEBAR + CALENDAR VIEW ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ─── LEFT SIDEBAR (MINI-CALENDAR & FILTERS) ─── */}
          <div className="lg:col-span-3 space-y-5">

            {/* Mini Month Picker */}
            <HudPanel className="p-4" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="flex items-center justify-between mb-3 border-b border-border-color pb-2">
                <span className="font-display text-xs uppercase font-bold tracking-widest text-primary">
                  {monthNames[month]} {year}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={handlePrev} className="p-1 text-muted hover:text-primary"><ChevronLeft size={14} /></button>
                  <button onClick={handleNext} className="p-1 text-muted hover:text-primary"><ChevronRight size={14} /></button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] text-muted mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
                {Array.from({ length: getFirstDayOfMonth(year, month) }).map((_, i) => (
                  <div key={`m-empty-${i}`} className="p-1 opacity-20">—</div>
                ))}
                {Array.from({ length: getDaysInMonth(year, month) }).map((_, i) => {
                  const dNum = i + 1
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDateStr
                  const hasItems = getItemsForDate(dateStr).length > 0

                  return (
                    <button
                      key={dNum}
                      onClick={() => {
                        setSelectedDateStr(dateStr)
                        const clickedDate = new Date(year, month, dNum)
                        setCurrentDate(clickedDate)
                      }}
                      className={`p-1 rounded transition-all relative ${
                        isSelected
                          ? 'bg-info text-bg-primary font-bold shadow'
                          : isToday
                          ? 'border border-info text-info font-bold'
                          : 'hover:bg-hover text-secondary'
                      }`}
                    >
                      {dNum}
                      {hasItems && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-info" />
                      )}
                    </button>
                  )
                })}
              </div>
            </HudPanel>

            {/* Category Filter Checkboxes */}
            <HudPanel className="p-4" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="flex items-center gap-2 mb-3 border-b border-border-color pb-2">
                <Filter size={14} className="text-info" />
                <span className="font-display text-xs uppercase font-bold tracking-widest text-primary">
                  MY CALENDARS
                </span>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                {[
                  { key: 'event', label: 'Custom Events', color: '#38bdf8', icon: CalendarIcon },
                  { key: 'task', label: 'Daily Tasks', color: '#22c55e', icon: CheckSquare },
                  { key: 'goal', label: 'Missions & Goals', color: '#f59e0b', icon: Target }
                ].map(cat => (
                  <label key={cat.key} className="flex items-center gap-2.5 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={filterTypes[cat.key]}
                      onChange={() => setFilterTypes(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
                      className="hidden"
                    />
                    <div
                      className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                      style={{
                        borderColor: cat.color,
                        backgroundColor: filterTypes[cat.key] ? cat.color : 'transparent'
                      }}
                    >
                      {filterTypes[cat.key] && <Check size={10} className="text-black font-bold" />}
                    </div>
                    <cat.icon size={13} style={{ color: cat.color }} />
                    <span className="text-secondary group-hover:text-primary transition-colors">{cat.label}</span>
                  </label>
                ))}
              </div>
            </HudPanel>

            {/* Search Input */}
            <HudPanel className="p-4" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="flex items-center gap-2 mb-2 border-b border-border-color pb-2">
                <Search size={14} className="text-info" />
                <span className="font-display text-xs uppercase font-bold tracking-widest text-primary">
                  SEARCH EVENTS
                </span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search title, details, location..."
                className="w-full p-2.5 font-mono text-xs bg-bg-primary border border-border-color rounded text-primary focus:border-info outline-none"
              />
            </HudPanel>

          </div>

          {/* ─── RIGHT MAIN DISPLAY (DYNAMIC VIEWS) ─── */}
          <div className="lg:col-span-9">

            {/* 1. MONTH VIEW */}
            {viewMode === 'month' && (
              <HudPanel className="p-0 overflow-hidden" style={{ background: 'var(--bg-secondary)', padding: 0 }}>
                <div className={styles.calendarGrid}>
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                    <div key={day} className="p-2 text-center font-display text-[10px] text-muted uppercase tracking-widest bg-tertiary">
                      {day}
                    </div>
                  ))}

                  {Array.from({ length: getFirstDayOfMonth(year, month) }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[110px] bg-bg-primary/40 opacity-30 border border-border-color/40 p-2" />
                  ))}

                  {Array.from({ length: getDaysInMonth(year, month) }).map((_, i) => {
                    const dayNum = i + 1
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                    const isToday = dateStr === todayStr
                    const isSelected = dateStr === selectedDateStr
                    const dayItems = getItemsForDate(dateStr)

                    return (
                      <div
                        key={dayNum}
                        onClick={() => {
                          setSelectedDateStr(dateStr)
                          setCurrentDate(new Date(year, month, dayNum))
                        }}
                        className={`min-h-[110px] p-2 border border-border-color/60 transition-all cursor-pointer relative ${
                          isToday ? 'bg-info/10' : 'bg-bg-secondary hover:bg-hover'
                        } ${isSelected ? 'ring-2 ring-info ring-inset' : ''}`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span
                            className={`font-mono text-xs w-6 h-6 rounded-full flex items-center justify-center ${
                              isToday ? 'bg-info text-bg-primary font-bold' : 'text-primary'
                            }`}
                          >
                            {dayNum}
                          </span>
                          {dayItems.length > 0 && (
                            <span className="font-mono text-[9px] text-muted">
                              {dayItems.length} {dayItems.length === 1 ? 'item' : 'items'}
                            </span>
                          )}
                        </div>

                        {/* Item Chips */}
                        <div className="space-y-1 overflow-hidden max-h-[75px]">
                          {dayItems.slice(0, 3).map((item, idx) => {
                            const isTask = item._type === 'task'
                            const isGoal = item._type === 'goal'
                            const chipBg = isTask ? 'rgba(34,197,94,0.15)' : isGoal ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)'
                            const chipBorder = isTask ? 'var(--success)' : isGoal ? 'var(--amber)' : 'var(--info)'

                            return (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDateStr(dateStr)
                                  setSelectedItemDetails(item)
                                }}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono truncate border flex items-center gap-1 hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: chipBg, borderColor: chipBorder, color: chipBorder }}
                                title={item.title}
                              >
                                <span className="truncate">{item.title}</span>
                              </div>
                            )
                          })}
                          {dayItems.length > 3 && (
                            <div className="font-mono text-[9px] text-muted hover:text-primary pt-0.5">
                              +{dayItems.length - 3} more...
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </HudPanel>
            )}

            {/* 2. WEEK VIEW (Google Calendar 24h Time Grid) */}
            {viewMode === 'week' && (
              <HudPanel className="p-0 overflow-hidden" style={{ background: 'var(--bg-secondary)', padding: 0 }}>
                {/* Week Header Row */}
                <div className="grid grid-cols-8 border-b border-border-color bg-bg-tertiary sticky top-0 z-10 text-center font-mono">
                  <div className="p-2 text-[10px] text-muted border-r border-border-color">GMT</div>
                  {currentWeekDays.map((d, i) => {
                    const dateStr = getLocalDateStr(d)
                    const isToday = dateStr === todayStr
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          setSelectedDateStr(dateStr)
                          setCurrentDate(d)
                        }}
                        className={`p-2 border-r border-border-color cursor-pointer ${
                          isToday ? 'bg-info/10' : ''
                        }`}
                      >
                        <div className="text-[10px] text-muted uppercase">
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-sm font-bold ${isToday ? 'text-info' : 'text-primary'}`}>
                          {d.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 24-Hour Time Grid Scroll */}
                <div className="max-h-[600px] overflow-y-auto relative">
                  <div className="grid grid-cols-8 relative">
                    {/* Hours Column */}
                    <div className="border-r border-border-color bg-bg-tertiary/40 font-mono text-[10px] text-muted text-right pr-2">
                      {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="h-12 border-b border-border-color/30 flex items-start justify-end pt-1">
                          {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                        </div>
                      ))}
                    </div>

                    {/* 7 Day Columns */}
                    {currentWeekDays.map((d, dayIdx) => {
                      const dateStr = getLocalDateStr(d)
                      const dayItems = getItemsForDate(dateStr)
                      const isToday = dateStr === todayStr

                      return (
                        <div key={dayIdx} className={`border-r border-border-color/40 relative min-h-[1152px] ${isToday ? 'bg-info/5' : ''}`}>
                          {/* Hour lines */}
                          {Array.from({ length: 24 }).map((_, h) => (
                            <div key={h} className="h-12 border-b border-border-color/20" />
                          ))}

                          {/* Render Items Positioned in Time Grid */}
                          {dayItems.map((item, itemIdx) => {
                            let startHour = 9, durationHrs = 1
                            if (item.startTime) {
                              const st = new Date(item.startTime)
                              if (!isNaN(st.getTime())) {
                                startHour = st.getHours() + st.getMinutes() / 60
                              }
                            }
                            if (item.endTime) {
                              const et = new Date(item.endTime)
                              const st = new Date(item.startTime)
                              if (!isNaN(et.getTime()) && !isNaN(st.getTime())) {
                                durationHrs = Math.max(0.5, (et.getTime() - st.getTime()) / (1000 * 60 * 60))
                              }
                            }

                            const topPx = startHour * 48
                            const heightPx = durationHrs * 48

                            const isTask = item._type === 'task'
                            const isGoal = item._type === 'goal'
                            const bg = isTask ? 'rgba(34,197,94,0.2)' : isGoal ? 'rgba(245,158,11,0.2)' : 'rgba(56,189,248,0.2)'
                            const stroke = isTask ? 'var(--success)' : isGoal ? 'var(--amber)' : 'var(--info)'

                            return (
                              <div
                                key={itemIdx}
                                onClick={() => setSelectedItemDetails(item)}
                                className="absolute left-1 right-1 rounded p-1.5 text-[10px] font-mono border overflow-hidden cursor-pointer shadow hover:z-20 transition-all"
                                style={{
                                  top: `${topPx}px`,
                                  height: `${Math.max(28, heightPx)}px`,
                                  backgroundColor: bg,
                                  borderColor: stroke,
                                  color: stroke
                                }}
                              >
                                <div className="font-bold truncate">{item.title}</div>
                                {heightPx > 35 && (
                                  <div className="text-[8px] opacity-80 font-mono">
                                    {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </HudPanel>
            )}

            {/* 3. DAY VIEW */}
            {viewMode === 'day' && (
              <HudPanel className="p-0 overflow-hidden" style={{ background: 'var(--bg-secondary)', padding: 0 }}>
                <div className="p-4 border-b border-border-color bg-bg-tertiary flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-2xl font-bold text-info">
                      {currentDate.getDate()}
                    </span>
                    <div>
                      <div className="font-display text-sm font-bold text-primary">
                        {currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}
                      </div>
                      <div className="font-mono text-[10px] text-muted">
                        {getItemsForDate(selectedDateStr).length} Scheduled Items
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFormData({
                        title: '',
                        description: '',
                        location: '',
                        start_time: `${selectedDateStr}T10:00`,
                        end_time: `${selectedDateStr}T11:00`,
                        category: 'event'
                      })
                      setShowAddForm(true)
                    }}
                    className="btn btn-primary text-xs"
                  >
                    + ADD FOR THIS DAY
                  </button>
                </div>

                <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
                  {getItemsForDate(selectedDateStr).length === 0 ? (
                    <div className="p-12 text-center font-mono text-sm text-muted">
                      NO EVENTS SCHEDULED FOR THIS DAY
                    </div>
                  ) : (
                    getItemsForDate(selectedDateStr).map((item, idx) => {
                      const isTask = item._type === 'task'
                      const isGoal = item._type === 'goal'
                      const stroke = isTask ? 'var(--success)' : isGoal ? 'var(--amber)' : 'var(--info)'
                      const Icon = isTask ? CheckSquare : isGoal ? Target : CalendarIcon

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedItemDetails(item)}
                          className="p-4 rounded-lg border bg-bg-tertiary flex items-start justify-between gap-4 cursor-pointer hover:border-info transition-all"
                          style={{ borderLeftWidth: '4px', borderLeftColor: stroke }}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Icon size={16} style={{ color: stroke }} />
                              <span className="font-display text-base font-bold text-primary uppercase tracking-wide">
                                {item.title}
                              </span>
                            </div>
                            {item.location && (
                              <div className="font-mono text-xs text-secondary flex items-center gap-1.5">
                                <MapPin size={12} className="text-info" /> {item.location}
                              </div>
                            )}
                            {item.description && (
                              <div className="font-mono text-xs text-muted leading-relaxed">
                                {item.description}
                              </div>
                            )}
                          </div>

                          <div className="text-right font-mono text-xs shrink-0">
                            <div className="font-bold text-primary">
                              {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded border inline-block mt-1" style={{ borderColor: stroke, color: stroke }}>
                              {item._type}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </HudPanel>
            )}

            {/* 4. AGENDA VIEW (GOOGLE CALENDAR SCHEDULE LIST) */}
            {viewMode === 'agenda' && (
              <HudPanel className="p-4" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-between mb-4 border-b border-border-color pb-3">
                  <div className="flex items-center gap-2">
                    <List size={18} className="text-info" />
                    <span className="font-display text-base font-bold uppercase tracking-widest text-primary">
                      AGENDA SCHEDULE
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted">
                    {filteredItems.length} Total Items
                  </span>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <div className="p-12 text-center font-mono text-sm text-muted">
                      NO MATCHING SCHEDULED ITEMS FOUND
                    </div>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const isTask = item._type === 'task'
                      const isGoal = item._type === 'goal'
                      const stroke = isTask ? 'var(--success)' : isGoal ? 'var(--amber)' : 'var(--info)'
                      const Icon = isTask ? CheckSquare : isGoal ? Target : CalendarIcon

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedItemDetails(item)}
                          className="p-3.5 rounded border bg-bg-tertiary flex items-center justify-between gap-4 cursor-pointer hover:border-info transition-all"
                          style={{ borderLeftWidth: '3px', borderLeftColor: stroke }}
                        >
                          <div className="flex items-center gap-3">
                            <Icon size={16} style={{ color: stroke }} />
                            <div>
                              <div className="font-display font-bold text-sm text-primary uppercase">
                                {item.title}
                              </div>
                              <div className="font-mono text-[10px] text-muted flex items-center gap-2 mt-0.5">
                                <span>📅 {item.dateStr}</span>
                                {item.location && <span>📍 {item.location}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="font-mono text-xs font-bold text-primary shrink-0">
                            {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </HudPanel>
            )}

            {/* Selected Date Details Panel (Always available under calendar) */}
            <div className="mt-6">
              <HudPanel label={`SELECTED DATE: ${selectedDateStr}`} glow>
                <div className="flex items-center justify-between mb-4 border-b border-border-color pb-2">
                  <h3 className="font-display text-lg uppercase tracking-wide text-primary">
                    {new Date(selectedDateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
                  </h3>
                  <button
                    onClick={() => {
                      setFormData({
                        title: '',
                        description: '',
                        location: '',
                        start_time: `${selectedDateStr}T09:00`,
                        end_time: `${selectedDateStr}T10:00`,
                        category: 'event'
                      })
                      setShowAddForm(true)
                    }}
                    className="px-3 py-1 font-mono text-xs uppercase border border-info text-info hover:bg-info/10 rounded transition-colors"
                  >
                    + Add Event
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {getItemsForDate(selectedDateStr).map((item, i) => {
                    const isTask = item._type === 'task'
                    const isGoal = item._type === 'goal'
                    const stroke = isTask ? 'var(--success)' : isGoal ? 'var(--amber)' : 'var(--info)'

                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedItemDetails(item)}
                        className="p-3 bg-bg-tertiary border rounded flex items-center justify-between gap-3 cursor-pointer hover:border-info"
                        style={{ borderLeftWidth: '3px', borderLeftColor: stroke }}
                      >
                        <div className="font-mono text-xs text-primary font-bold">{item.title}</div>
                        <div className="font-mono text-[10px] text-muted">
                          {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )
                  })}
                  {getItemsForDate(selectedDateStr).length === 0 && (
                    <div className="font-mono text-xs text-muted text-center py-6">
                      NO SCHEDULED ITEMS FOR {selectedDateStr}
                    </div>
                  )}
                </div>
              </HudPanel>
            </div>

          </div>

        </div>

        {/* ─── ADD EVENT MODAL ─── */}
        <AnimatePresence>
          {showAddForm && (
            <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-lg p-6 bg-bg-secondary border border-info rounded-xl shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-border-color pb-3">
                  <div className="font-display text-lg font-bold text-info uppercase tracking-widest flex items-center gap-2">
                    <CalendarIcon size={18} /> Schedule Event
                  </div>
                  <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-primary">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleAddSubmit} className="space-y-4 font-mono text-xs">
                  <div>
                    <label className="text-muted uppercase block mb-1">EVENT TITLE</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-bg-primary border border-border-color rounded text-primary text-sm focus:border-info outline-none"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder="e.g. Beyond Tatva Strategy Meeting"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-muted uppercase block mb-1">START TIME</label>
                      <input
                        type="datetime-local"
                        className="w-full p-2.5 bg-bg-primary border border-border-color rounded text-primary focus:border-info outline-none"
                        value={formData.start_time}
                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-muted uppercase block mb-1">END TIME</label>
                      <input
                        type="datetime-local"
                        className="w-full p-2.5 bg-bg-primary border border-border-color rounded text-primary focus:border-info outline-none"
                        value={formData.end_time}
                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-muted uppercase block mb-1">LOCATION / LINK</label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-bg-primary border border-border-color rounded text-primary focus:border-info outline-none"
                      value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g. Google Meet or Office"
                    />
                  </div>

                  <div>
                    <label className="text-muted uppercase block mb-1">DETAILS / NOTES</label>
                    <textarea
                      className="w-full p-2.5 bg-bg-primary border border-border-color rounded text-primary focus:border-info outline-none min-h-[80px]"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Agenda and objectives..."
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 p-3 font-display font-bold text-xs uppercase bg-info text-bg-primary rounded hover:bg-info/90 transition-all">
                      DEPLOY TO CALENDAR
                    </button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="px-4 p-3 border border-border-color rounded text-muted hover:text-primary">
                      CANCEL
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── EVENT DETAILS MODAL ─── */}
        <AnimatePresence>
          {selectedItemDetails && (
            <div className="modal-overlay" onClick={() => setSelectedItemDetails(null)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md p-6 bg-bg-secondary border border-info rounded-xl shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-border-color pb-3">
                  <span className="font-mono text-xs uppercase text-info font-bold">
                    {selectedItemDetails._type.toUpperCase()} DETAILS
                  </span>
                  <button onClick={() => setSelectedItemDetails(null)} className="text-muted hover:text-primary">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <h3 className="font-display text-xl font-bold text-primary uppercase">
                    {selectedItemDetails.title}
                  </h3>

                  <div className="p-3 bg-bg-tertiary rounded space-y-1.5">
                    <div className="text-muted">📅 Date: <span className="text-primary">{selectedItemDetails.dateStr}</span></div>
                    <div className="text-muted">⏰ Start: <span className="text-primary">{new Date(selectedItemDetails.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                    {selectedItemDetails.location && (
                      <div className="text-muted">📍 Location: <span className="text-info">{selectedItemDetails.location}</span></div>
                    )}
                  </div>

                  {selectedItemDetails.description && (
                    <div className="p-3 bg-bg-tertiary rounded text-secondary leading-relaxed">
                      {selectedItemDetails.description}
                    </div>
                  )}

                  {selectedItemDetails._type === 'event' && (
                    <button
                      onClick={() => handleDeleteItem(selectedItemDetails)}
                      className="w-full p-2.5 border border-danger/40 text-danger hover:bg-danger/10 rounded font-mono text-xs uppercase flex items-center justify-center gap-1.5 transition-colors mt-2"
                    >
                      <Trash2 size={14} /> DELETE EVENT
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </AppShell>
  )
}
