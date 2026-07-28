'use client'

import { useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { getLocalDateStr } from '@/lib/utils/dates'
import { useCalendar } from '@/lib/hooks/useCalendar'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Plus, MapPin, AlignLeft, Calendar as CalendarIcon,
  Clock, CheckSquare, Target, Zap, Rocket, Video, Briefcase, Megaphone, Code,
  Dumbbell, Trophy, Globe, Camera, Trash2, X, Check, Flame
} from 'lucide-react'
import styles from './calendar.module.css'

// Helper: Pick dynamic icon & color based on title or operation type
const getItemIconDetails = (item) => {
  const title = (item.title || '').toLowerCase()
  const category = (item.category || item.stat_category || '').toLowerCase()

  if (title.includes('edit') || title.includes('shoot') || title.includes('video') || title.includes('camera') || title.includes('module') || title.includes('film')) {
    return { Icon: Video, color: '#38bdf8', label: 'MEDIA / PRODUCTION' } // Cyan
  }
  if (title.includes('seo') || title.includes('social') || title.includes('post') || title.includes('marketing') || title.includes('campaign')) {
    return { Icon: Megaphone, color: '#ec4899', label: 'MARKETING / SEO' } // Pink
  }
  if (title.includes('code') || title.includes('dev') || title.includes('build') || title.includes('app') || title.includes('feature') || title.includes('bug')) {
    return { Icon: Code, color: '#a855f7', label: 'DEVELOPMENT' } // Purple
  }
  if (title.includes('launch') || title.includes('deploy') || title.includes('release') || title.includes('ship')) {
    return { Icon: Rocket, color: '#f59e0b', label: 'MISSION LAUNCH' } // Amber
  }
  if (title.includes('work') || title.includes('client') || title.includes('meeting') || title.includes('mathuram') || title.includes('call')) {
    return { Icon: Briefcase, color: '#10b981', label: 'BUSINESS / OPERATIONAL' } // Emerald
  }
  if (title.includes('gym') || title.includes('workout') || title.includes('health') || title.includes('run') || title.includes('cardio') || title.includes('sleep')) {
    return { Icon: Dumbbell, color: '#ef4444', label: 'PHYSICAL RECON' } // Red
  }
  if (title.includes('target') || title.includes('goal') || title.includes('milestone') || title.includes('quest')) {
    return { Icon: Target, color: '#f97316', label: 'GOAL / TARGET' } // Orange
  }

  // Default fallback by item type
  if (item._type === 'task') return { Icon: CheckSquare, color: '#22c55e', label: 'DAILY TASK' }
  if (item._type === 'goal') return { Icon: Trophy, color: '#f59e0b', label: 'STRATEGIC GOAL' }
  return { Icon: CalendarIcon, color: '#38bdf8', label: 'EVENT' }
}

export default function Calendar() {
  const {
    profile: { profile },
    tasks: { tasks, loading: tLoading },
    goals: { goals: allGoals, loading: gLoading },
    calendar: { events = [], loading: cLoading, addEvent, deleteEvent } = {}
  } = useOS()

  const [viewMode, setViewMode] = useState('month') // 'month' | 'week' | 'day'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(getLocalDateStr())

  // Event modal state
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', location: '', start_time: '', end_time: '' })

  const todayStr = getLocalDateStr()

  // Navigation handlers
  const prevPeriod = () => {
    const next = new Date(currentDate)
    if (viewMode === 'month') next.setMonth(next.getMonth() - 1)
    else if (viewMode === 'week') next.setDate(next.getDate() - 7)
    else if (viewMode === 'day') next.setDate(next.getDate() - 1)
    setCurrentDate(next)
  }

  const nextPeriod = () => {
    const next = new Date(currentDate)
    if (viewMode === 'month') next.setMonth(next.getMonth() + 1)
    else if (viewMode === 'week') next.setDate(next.getDate() + 7)
    else if (viewMode === 'day') next.setDate(next.getDate() + 1)
    setCurrentDate(next)
  }

  const handleToday = () => {
    const now = new Date()
    setCurrentDate(now)
    setSelectedDate(getLocalDateStr(now))
  }

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.start_time) return
    await addEvent(formData)
    setShowAddForm(false)
    setFormData({ title: '', description: '', location: '', start_time: '', end_time: '' })
  }

  const handleDeleteEvent = async (id) => {
    if (deleteEvent && window.confirm('Delete this event?')) {
      await deleteEvent(id)
    }
  }

  // Combine Events, Tasks, and Goals
  const getItemsForDate = (dateStr) => {
    const dayEvents = (events || [])
      .filter(e => getLocalDateStr(new Date(e.start_time)) === dateStr)
      .map(e => ({ ...e, _type: 'event' }))
    const dayTasks = (tasks || [])
      .filter(t => t.due_date === dateStr)
      .map(t => ({ ...t, _type: 'task', start_time: `${dateStr}T00:00:00` }))
    const dayGoals = (allGoals || [])
      .filter(g => g.deadline && getLocalDateStr(new Date(g.deadline)) === dateStr)
      .map(g => ({ ...g, _type: 'goal', start_time: g.deadline }))
    return [...dayEvents, ...dayTasks, ...dayGoals]
  }

  // Calculate days for Week View starting from Sunday of currentDate
  const weekDays = useMemo(() => {
    const start = new Date(currentDate)
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [currentDate])

  const selectedDateItems = getItemsForDate(selectedDate)
  const isLoading = cLoading || tLoading || gLoading

  if (isLoading && !events.length && !tasks.length) {
    return (
      <AppShell>
        <div className="flex-center h-full min-h-[60vh]">
          <span className="typewriter-text">SYNCING SATELLITES...</span>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page-container narrow">

        {/* ── HEADER ── */}
        <header className="page-header flex-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="page-title">CALENDAR</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Temporal scheduling and operational tracking.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View Switcher Tabs (MONTH | WEEK | DAY) */}
            <div className="flex border border-border-color rounded overflow-hidden bg-bg-tertiary">
              {[
                { id: 'month', label: 'MONTH' },
                { id: 'week', label: 'WEEK' },
                { id: 'day', label: 'DAY' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                    viewMode === tab.id
                      ? 'bg-info text-bg-primary font-extrabold'
                      : 'text-muted hover:text-primary hover:bg-hover'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Today Button */}
            <button
              onClick={handleToday}
              className="btn btn-ghost text-xs font-mono border border-border-color px-3"
            >
              TODAY
            </button>

            {/* .ICS Link */}
            {profile?.calendar_token ? (
              <a
                href={`/api/calendar?token=${profile.calendar_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info font-mono text-xs hover:text-primary transition-colors hover:underline hidden sm:inline-block"
              >
                .ICS SUBSCRIPTION
              </a>
            ) : (
              <span className="text-muted font-mono text-xs cursor-not-allowed hidden sm:inline-block" title="Calendar token not generated">
                .ICS (UNAVAILABLE)
              </span>
            )}

            {/* New Event Button */}
            <button
              className="btn btn-primary"
              onClick={() => {
                setFormData({ ...formData, start_time: `${selectedDate}T09:00`, end_time: `${selectedDate}T10:00` })
                setShowAddForm(true)
              }}
            >
              <Plus size={16} /> NEW EVENT
            </button>
          </div>
        </header>

        {/* ── MAIN CALENDAR HUD PANEL ── */}
        <HudPanel className="p-0 mb-8" style={{ padding: 0 }}>
          
          {/* Calendar Control Header */}
          <div className="flex-between p-4 border-b border-border-color bg-secondary">
            <button onClick={prevPeriod} className="btn btn-ghost p-2"><ChevronLeft /></button>

            <h2 className="font-display text-xl font-bold tracking-widest text-primary uppercase">
              {viewMode === 'month' && `${monthNames[month]} ${year}`}
              {viewMode === 'week' && `WEEK OF ${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              {viewMode === 'day' && currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>

            <button onClick={nextPeriod} className="btn btn-ghost p-2"><ChevronRight /></button>
          </div>

          {/* ── 1. MONTH VIEW (ORIGINAL HUD GRID WITH DYNAMIC ICONS) ── */}
          {viewMode === 'month' && (
            <div className={styles.calendarGrid}>
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                <div key={day} className={`p-2 text-center font-display text-xs text-muted uppercase tracking-wider bg-tertiary ${styles.calendarHeaderCell}`}>
                  {day}
                </div>
              ))}

              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className={`${styles.calendarCell} ${styles.otherMonth}`} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const dayItems = getItemsForDate(dateStr)

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`${styles.calendarCell} overflow-hidden cursor-pointer transition-all hover:bg-hover ${isToday ? styles.today : ''} ${isSelected ? 'border-info shadow-[inset_0_0_10px_rgba(96,165,250,0.1)]' : ''}`}
                    style={isSelected ? { border: '1px solid var(--info)' } : {}}
                  >
                    <div className="flex-between">
                      <span className={`font-mono text-sm ${isToday ? 'text-info font-bold' : 'text-primary'}`}>{day}</span>
                      {dayItems.length > 0 && (
                        <span className="font-mono text-[9px] text-muted opacity-80">{dayItems.length}</span>
                      )}
                    </div>

                    {/* Dynamic Icons for Operation / Mission Types */}
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      {dayItems.map((item, idx) => {
                        const { Icon, color, label } = getItemIconDetails(item)
                        return (
                          <div
                            key={idx}
                            title={`${item.title} (${label})`}
                            className="p-1 rounded bg-bg-tertiary/80 border border-border-color/50 hover:scale-115 transition-transform"
                            style={{ borderColor: `${color}40` }}
                          >
                            <Icon size={13} style={{ color }} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 2. WEEK VIEW ── */}
          {viewMode === 'week' && (
            <div className="grid grid-cols-7 gap-1 p-3 bg-bg-secondary font-mono">
              {weekDays.map((d, idx) => {
                const dateStr = getLocalDateStr(d)
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const dayItems = getItemsForDate(dateStr)

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-3 rounded border transition-all cursor-pointer min-h-[220px] ${
                      isSelected ? 'border-info bg-bg-tertiary shadow-lg' : isToday ? 'border-info/50 bg-info/5' : 'border-border-color bg-bg-primary/50 hover:bg-hover'
                    }`}
                  >
                    <div className="border-b border-border-color pb-2 mb-2 flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-muted uppercase font-display">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className={`text-base font-bold ${isToday ? 'text-info' : 'text-primary'}`}>{d.getDate()}</div>
                      </div>
                      <span className="text-[10px] text-muted">{dayItems.length} items</span>
                    </div>

                    <div className="space-y-2">
                      {dayItems.map((item, itemIdx) => {
                        const { Icon, color } = getItemIconDetails(item)
                        return (
                          <div
                            key={itemIdx}
                            className="p-1.5 rounded bg-bg-tertiary border text-[11px] flex items-center gap-1.5 truncate"
                            style={{ borderColor: `${color}40` }}
                          >
                            <Icon size={12} style={{ color }} className="shrink-0" />
                            <span className="truncate text-primary">{item.title}</span>
                          </div>
                        )
                      })}
                      {dayItems.length === 0 && (
                        <div className="text-[10px] text-muted text-center pt-8 opacity-40">NO ITEMS</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 3. DAY VIEW ── */}
          {viewMode === 'day' && (
            <div className="p-6 bg-bg-secondary space-y-4 font-mono">
              <div className="flex justify-between items-center border-b border-border-color pb-3">
                <span className="font-display text-lg text-info uppercase font-bold">
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-xs text-muted">
                  {getItemsForDate(getLocalDateStr(currentDate)).length} Scheduled
                </span>
              </div>

              <div className="space-y-3">
                {getItemsForDate(getLocalDateStr(currentDate)).map((item, idx) => {
                  const { Icon, color, label } = getItemIconDetails(item)
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded border bg-bg-tertiary flex items-start justify-between gap-4"
                      style={{ borderLeftWidth: '4px', borderLeftColor: color }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon size={16} style={{ color }} />
                          <span className="font-display text-base font-bold text-primary uppercase">{item.title}</span>
                        </div>
                        {item.location && <div className="text-xs text-muted flex items-center gap-1"><MapPin size={12} /> {item.location}</div>}
                        {item.description && <div className="text-xs text-secondary">{item.description}</div>}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded border uppercase font-bold" style={{ borderColor: `${color}50`, color }}>
                          {label}
                        </span>
                        <div className="text-xs text-muted mt-1">
                          {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {getItemsForDate(getLocalDateStr(currentDate)).length === 0 && (
                  <div className="text-center py-12 text-muted text-sm">NO OPERATIONAL ITEMS FOR THIS DAY</div>
                )}
              </div>
            </div>
          )}

        </HudPanel>

        {/* ── SELECTED DATE DETAILS (ORIGINAL HUD PANEL ENHANCED) ── */}
        <HudPanel label="SELECTED DATE" glow>
          <h3 className="font-display text-xl uppercase tracking-wide text-primary mb-4 border-b border-border-color pb-2">
            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </h3>

          <div className="flex-col gap-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <AnimatePresence>
              {selectedDateItems.map((item, i) => {
                const { Icon, color, label } = getItemIconDetails(item)

                return (
                  <motion.div
                    key={`${item._type}-${item.id || i}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-4 p-4 bg-tertiary border border-border-color rounded-sm relative group"
                    style={{ borderLeftWidth: '3px', borderLeftColor: color }}
                  >
                    <div className="flex-col text-right shrink-0 w-20">
                      {item._type === 'event' ? (
                        <>
                          <span className="font-mono font-bold" style={{ color }}>
                            {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {item.end_time && (
                            <span className="font-mono text-xs text-muted mt-1">
                              {new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </>
                      ) : item._type === 'goal' ? (
                        <span className="font-mono text-amber">
                          {new Date(item.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="font-mono text-success">ALL DAY</span>
                      )}
                    </div>

                    <div className="flex-col gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon size={16} style={{ color }} />
                        <span className="font-display text-lg uppercase tracking-wide text-primary">{item.title}</span>
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border ml-2" style={{ borderColor: `${color}40`, color }}>
                          {label}
                        </span>
                      </div>
                      {item.location && (
                        <div className="flex items-center gap-2 text-xs text-secondary font-mono">
                          <MapPin size={12} /> {item.location}
                        </div>
                      )}
                      {item.description && (
                        <div className="flex items-start gap-2 text-xs text-muted font-mono">
                          <AlignLeft size={12} className="mt-0.5" /> {item.description}
                        </div>
                      )}
                    </div>

                    {item._type === 'event' && (
                      <button
                        onClick={() => handleDeleteEvent(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-danger transition-all self-center"
                        title="Delete Event"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {selectedDateItems.length === 0 && (
              <div className="empty-state py-8 font-mono text-xs text-muted">
                NO EVENTS OR DEADLINES SCHEDULED FOR THIS DATE
              </div>
            )}
          </div>
        </HudPanel>

        {/* ── NEW EVENT MODAL ── */}
        {showAddForm && (
          <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
            <HudPanel className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="font-display text-xl uppercase text-primary font-bold mb-4 border-b border-border-color pb-2 flex justify-between items-center">
                <span>Schedule Event</span>
                <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-primary"><X size={18} /></button>
              </div>

              <form onSubmit={handleAdd} className="flex-col gap-4 font-mono text-xs">
                <div>
                  <label className="text-muted mb-1 block uppercase">EVENT TITLE</label>
                  <input
                    type="text"
                    className="input font-mono w-full"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="e.g. Mathuram SEO Campaign or Video Shoot"
                    autoFocus
                  />
                </div>
                <div className="grid-2 gap-4">
                  <div>
                    <label className="text-muted mb-1 block uppercase">START TIME</label>
                    <input
                      type="datetime-local"
                      className="input font-mono w-full"
                      value={formData.start_time}
                      onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-muted mb-1 block uppercase">END TIME</label>
                    <input
                      type="datetime-local"
                      className="input font-mono w-full"
                      value={formData.end_time}
                      onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-muted mb-1 block uppercase">LOCATION / URL</label>
                  <input
                    type="text"
                    className="input font-mono w-full"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Office or Google Meet"
                  />
                </div>
                <div>
                  <label className="text-muted mb-1 block uppercase">DETAILS</label>
                  <textarea
                    className="textarea font-mono w-full min-h-[80px]"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary flex-1">DEPLOY EVENT</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>ABORT</button>
                </div>
              </form>
            </HudPanel>
          </div>
        )}

      </div>
    </AppShell>
  )
}
