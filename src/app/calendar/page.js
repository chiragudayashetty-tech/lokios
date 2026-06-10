'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useCalendar } from '@/lib/hooks/useCalendar'
import { getDaysInMonth } from '@/lib/utils/dates'

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const { events, addEvent } = useCalendar(currentDate)
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [showAddForm, setShowAddForm] = useState(false)

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    category: 'general',
    color: '#6c5ce7'
  })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0 = Sun
  
  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDay(1)
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDay(1)
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!newEvent.title || !newEvent.start_time || !newEvent.end_time) return
    
    // Ensure the date matches the selected day if not explicitly set
    let start = new Date(newEvent.start_time)
    let end = new Date(newEvent.end_time)
    
    await addEvent({
      ...newEvent,
      start_time: start.toISOString(),
      end_time: end.toISOString()
    })
    
    setShowAddForm(false)
    setNewEvent({ title: '', description: '', start_time: '', end_time: '', category: 'general', color: '#6c5ce7' })
  }

  const selectedDateStr = new Date(year, month, selectedDay).toDateString()
  const selectedDayEvents = events.filter(e => new Date(e.start_time).toDateString() === selectedDateStr)

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">Calendar</h1>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>+ Add Event</button>
        </header>

        <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
          {/* Month Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            <button className="btn btn-ghost btn-icon" onClick={handlePrevMonth}>◀</button>
            <h2 style={{ fontSize: 'var(--text-xl-size)' }}>
              {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h2>
            <button className="btn btn-ghost btn-icon" onClick={handleNextMonth}>▶</button>
          </div>

          {/* Days of Week Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 'bold', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} style={{ aspectRatio: '1', background: 'transparent' }} />
              
              const isSelected = day === selectedDay
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
              
              const dayDateStr = new Date(year, month, day).toDateString()
              const dayEvents = events.filter(e => new Date(e.start_time).toDateString() === dayDateStr)
              
              return (
                <div 
                  key={`day-${day}`}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? 'var(--accent-primary)' : isToday ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                    color: isSelected ? '#fff' : isToday ? 'var(--accent-primary)' : 'var(--text-primary)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontWeight: isToday || isSelected ? 600 : 400,
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  {day}
                  {dayEvents.length > 0 && (
                    <div style={{ display: 'flex', gap: '2px', position: 'absolute', bottom: '4px' }}>
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: e.color || '#fff' }}></div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Day Events */}
        <div>
          <h3 style={{ fontSize: 'var(--text-lg-size)', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Schedule for {selectedDateStr}</span>
            <span style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)' }}>{selectedDayEvents.length} events</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {selectedDayEvents.length > 0 ? selectedDayEvents.map(event => (
              <div key={event.id} className="card card-flat" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                <div style={{ width: '4px', height: '40px', background: event.color || 'var(--accent-primary)', borderRadius: '2px' }}></div>
                <div>
                  <div style={{ fontWeight: 600 }}>{event.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                    {new Date(event.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            )) : (
              <p style={{ color: 'var(--text-muted)' }}>No events scheduled for this day.</p>
            )}
          </div>
        </div>

        {/* Add Event Modal */}
        {showAddForm && (
          <div className="modal-overlay" onClick={() => setShowAddForm(false)} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal)', backdropFilter: 'blur(4px)' }}>
            <div className="card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px' }}>
              <h2 style={{ marginBottom: 'var(--space-4)' }}>New Event</h2>
              <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Event Title</label>
                  <input type="text" className="input" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} required autoFocus />
                </div>
                <div className="grid-2">
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Start Time</label>
                    <input type="datetime-local" className="input" value={newEvent.start_time} onChange={e => setNewEvent({...newEvent, start_time: e.target.value})} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>End Time</label>
                    <input type="datetime-local" className="input" value={newEvent.end_time} onChange={e => setNewEvent({...newEvent, end_time: e.target.value})} required />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Color Tag</label>
                  <input type="color" className="input" style={{ height: '40px', padding: '0 8px' }} value={newEvent.color} onChange={e => setNewEvent({...newEvent, color: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Event</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
