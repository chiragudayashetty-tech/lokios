'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { getLocalDateStr } from '@/lib/utils/dates'
import { useCalendar } from '@/lib/hooks/useCalendar'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, MapPin, AlignLeft, Calendar as CalendarIcon, Clock, CheckSquare, Target, Zap } from 'lucide-react'
import styles from './calendar.module.css'

export default function Calendar() {
  const { auth: { user }, profile: { profile }, tasks: { tasks, loading: tLoading }, goals: { goals: allGoals, loading: gLoading } } = useOS()
  const [currentDate, setCurrentDate] = useState(new Date())
  const { events, loading, addEvent } = useCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1)

  const [selectedDate, setSelectedDate] = useState(getLocalDateStr())
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', location: '', start_time: '', end_time: '' })

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.start_time) return
    await addEvent(formData)
    setShowAddForm(false)
    setFormData({ title: '', description: '', location: '', start_time: '', end_time: '' })
  }

  // Combine Events, Tasks, and Goals
  const getItemsForDate = (dateStr) => {
    const dayEvents = events.filter(e => getLocalDateStr(new Date(e.start_time)) === dateStr).map(e => ({ ...e, _type: 'event' }))
    const dayTasks = tasks.filter(t => t.due_date === dateStr).map(t => ({ ...t, _type: 'task', start_time: `${dateStr}T00:00:00` }))
    const dayGoals = allGoals.filter(g => g.deadline && getLocalDateStr(new Date(g.deadline)) === dateStr).map(g => ({ ...g, _type: 'goal', start_time: g.deadline }))
    return [...dayEvents, ...dayTasks, ...dayGoals]
  }

  const selectedDateItems = getItemsForDate(selectedDate)
  const todayStr = getLocalDateStr()

  if (loading || tLoading || gLoading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">SYNCING SATELLITES...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header flex-between">
          <div>
            <h1 className="page-title">CALENDAR</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Temporal scheduling and event tracking.</p>
          </div>
          <div className="flex items-center gap-4">
            {profile?.calendar_token ? (
              <a href={`/api/calendar?token=${profile.calendar_token}`} target="_blank" rel="noopener noreferrer" className="text-info font-mono text-xs hover:text-primary transition-colors hover:underline">
                .ICS SUBSCRIPTION
              </a>
            ) : (
              <span className="text-muted font-mono text-xs cursor-not-allowed" title="Calendar token not generated">
                .ICS (UNAVAILABLE)
              </span>
            )}
            <button className="btn btn-primary" onClick={() => {
              setFormData({...formData, start_time: `${selectedDate}T09:00`, end_time: `${selectedDate}T10:00`})
              setShowAddForm(true)
            }}>
              <Plus size={16} /> NEW EVENT
            </button>
          </div>
        </header>

        <HudPanel className="p-0 mb-8" style={{ padding: 0 }}>
          <div className="flex-between p-4 border-b border-border-color bg-secondary">
            <button onClick={prevMonth} className="btn btn-ghost p-2"><ChevronLeft /></button>
            <h2 className="font-display text-xl font-bold tracking-widest text-primary uppercase">
              {monthNames[month]} {year}
            </h2>
            <button onClick={nextMonth} className="btn btn-ghost p-2"><ChevronRight /></button>
          </div>

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
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dayItems.map((item, idx) => {
                      if (item._type === 'task') return <CheckSquare key={idx} size={10} className="text-success" title={item.title} />
                      if (item._type === 'goal') return <Target key={idx} size={10} className="text-amber" title={item.title} />
                      return <CalendarIcon key={idx} size={10} className="text-info" title={item.title} />
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </HudPanel>

        <HudPanel label="SELECTED DATE" glow>
          <h3 className="font-display text-xl uppercase tracking-wide text-primary mb-4 border-b border-border-color pb-2">
            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </h3>
          
          <div className="flex-col gap-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <AnimatePresence>
              {selectedDateItems.map((item, i) => {
                const isTask = item._type === 'task'
                const isGoal = item._type === 'goal'
                const typeColor = isTask ? 'border-l-success' : isGoal ? 'border-l-primary' : 'border-l-info'
                const Icon = isTask ? CheckSquare : isGoal ? Target : CalendarIcon
                const iconColor = isTask ? 'text-success' : isGoal ? 'text-primary' : 'text-info'

                return (
                  <motion.div key={`${item._type}-${item.id}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className={`flex gap-4 p-4 bg-tertiary border border-border-color border-l-2 ${typeColor}`}>
                    <div className="flex-col text-right shrink-0 w-20">
                      {item._type === 'event' ? (
                        <>
                          <span className="font-mono text-info font-bold">{new Date(item.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          {item.end_time && <span className="font-mono text-xs text-muted mt-1">{new Date(item.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                        </>
                      ) : isGoal ? (
                        <span className="font-mono text-info">{new Date(item.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      ) : (
                        <span className="font-mono text-success">ALL DAY</span>
                      )}
                    </div>
                    <div className="flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={iconColor} />
                        <span className="font-display text-lg uppercase tracking-wide text-primary">{item.title}</span>
                      </div>
                      {item.location && <div className="flex items-center gap-2 text-xs text-secondary font-mono"><MapPin size={12} /> {item.location}</div>}
                      {item.description && <div className="flex items-start gap-2 text-xs text-muted font-mono"><AlignLeft size={12} className="mt-0.5" /> {item.description}</div>}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {selectedDateItems.length === 0 && <div className="empty-state py-8">NO EVENTS OR DEADLINES SCHEDULED</div>}
          </div>
        </HudPanel>

        {showAddForm && (
          <div className="modal-overlay">
            <HudPanel className="modal-content">
              <div className="font-display text-xl uppercase text-primary font-bold mb-4 border-b border-border-color pb-2">Schedule Event</div>
              <form onSubmit={handleAdd} className="flex-col gap-4">
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">EVENT TITLE</label>
                  <input type="text" className="input" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} required autoFocus />
                </div>
                <div className="grid-2">
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">START TIME</label>
                    <input type="datetime-local" className="input font-mono" value={formData.start_time} onChange={e=>setFormData({...formData, start_time: e.target.value})} required />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">END TIME</label>
                    <input type="datetime-local" className="input font-mono" value={formData.end_time} onChange={e=>setFormData({...formData, end_time: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">LOCATION / URL</label>
                  <input type="text" className="input font-mono" value={formData.location} onChange={e=>setFormData({...formData, location: e.target.value})} />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">DETAILS</label>
                  <textarea className="textarea" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary flex-1">DEPLOY EVENT</button>
                  <button type="button" className="btn btn-ghost" onClick={()=>setShowAddForm(false)}>ABORT</button>
                </div>
              </form>
            </HudPanel>
          </div>
        )}

      </div>
    </AppShell>
  )
}
