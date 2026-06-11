'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { useCalendar } from '@/lib/hooks/useCalendar'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, MapPin, AlignLeft, Calendar as CalendarIcon, Clock } from 'lucide-react'

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const { events, loading, addEvent } = useCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1)
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
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

  const selectedDateEvents = events.filter(e => new Date(e.start_time).toISOString().split('T')[0] === selectedDate)
  const todayStr = new Date().toISOString().split('T')[0]

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">SYNCING SATELLITES...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header flex-between">
          <div>
            <h1 className="page-title">CALENDAR</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Temporal scheduling and event tracking.</p>
          </div>
          <button className="btn btn-primary" onClick={() => {
            setFormData({...formData, start_time: `${selectedDate}T09:00`, end_time: `${selectedDate}T10:00`})
            setShowAddForm(true)
          }}>
            <Plus size={16} /> NEW EVENT
          </button>
        </header>

        <HudPanel className="p-0 mb-8" style={{ padding: 0 }}>
          <div className="flex-between p-4 border-b border-border-color bg-secondary">
            <button onClick={prevMonth} className="btn btn-ghost p-2"><ChevronLeft /></button>
            <h2 className="font-display text-xl tracking-widest text-amber uppercase glow-amber">
              {monthNames[month]} {year}
            </h2>
            <button onClick={nextMonth} className="btn btn-ghost p-2"><ChevronRight /></button>
          </div>

          <div className="calendar-grid">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
              <div key={day} className="p-2 text-center font-display text-xs text-muted uppercase tracking-wider bg-tertiary">
                {day}
              </div>
            ))}
            
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="calendar-day opacity-50" />
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const dayEvents = events.filter(e => new Date(e.start_time).toISOString().split('T')[0] === dateStr)

              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDate(dateStr)}
                  className={`calendar-day cursor-pointer transition-all hover:bg-hover ${isToday ? 'today' : ''} ${isSelected ? 'border-amber shadow-[inset_0_0_10px_rgba(212,168,67,0.2)]' : ''}`}
                  style={isSelected ? { border: '1px solid var(--accent-primary)' } : {}}
                >
                  <div className="flex-between">
                    <span className={`font-mono text-sm ${isToday ? 'text-amber' : 'text-primary'}`}>{day}</span>
                    {dayEvents.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber" />}
                  </div>
                  <div className="mt-2 flex-col gap-1">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="text-[9px] font-mono truncate text-muted bg-primary px-1 border-l border-amber">
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[9px] text-muted text-center">+{dayEvents.length - 2}</div>}
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
          
          <div className="flex-col gap-4">
            <AnimatePresence>
              {selectedDateEvents.map((event, i) => (
                <motion.div key={event.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex gap-4 p-4 bg-tertiary border border-border-color border-l-2 border-l-amber">
                  <div className="flex-col text-right shrink-0 w-20">
                    <span className="font-mono text-amber">{new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    {event.end_time && <span className="font-mono text-xs text-muted mt-1">{new Date(event.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                  </div>
                  <div className="flex-col gap-2">
                    <span className="font-display text-lg uppercase tracking-wide text-primary">{event.title}</span>
                    {event.location && <div className="flex items-center gap-2 text-xs text-secondary font-mono"><MapPin size={12} /> {event.location}</div>}
                    {event.description && <div className="flex items-start gap-2 text-xs text-muted font-mono"><AlignLeft size={12} className="mt-0.5" /> {event.description}</div>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {selectedDateEvents.length === 0 && <div className="empty-state py-8">NO EVENTS SCHEDULED</div>}
          </div>
        </HudPanel>

        {showAddForm && (
          <div className="modal-overlay">
            <HudPanel className="modal-content">
              <div className="font-display text-xl uppercase text-amber mb-4 border-b border-border-color pb-2">Schedule Event</div>
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
