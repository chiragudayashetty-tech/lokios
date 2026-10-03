'use client'

import { Check, CheckSquare, Flag, CalendarDays } from 'lucide-react'
import { getLocalDateStr } from '@/lib/utils/dates'
import { categoryOf } from '@/lib/utils/calendarBlocks'
import { formatTimeOf } from '@/lib/utils/appDate'

/** Next 14 days as a list: timed events first, then tasks due and mission deadlines. */
export default function AgendaView({ from, events, tasks, goals, today, onOpen }) {
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(`${from}T12:00:00`); d.setDate(d.getDate() + i); return getLocalDateStr(d) })
  const rows = days.map((ds) => ({
    ds,
    events: events.filter((e) => getLocalDateStr(new Date(e.start_time)) === ds).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    tasks: tasks.filter((t) => t.due_date && String(t.due_date).slice(0, 10) === ds && !['cancelled', 'failed'].includes(t.status)),
    goals: goals.filter((g) => g.deadline && String(g.deadline).slice(0, 10) === ds),
  })).filter((r) => r.events.length || r.tasks.length || r.goals.length)

  if (!rows.length) return <div className="tb-empty ag-empty"><div className="tb-empty-art"><CalendarDays size={22} /></div><p>Nothing scheduled in the next two weeks.</p></div>

  return (
    <div className="ag">
      {rows.map((r) => {
        const d = new Date(`${r.ds}T12:00:00`)
        return (
          <section key={r.ds} className={`ag-day ${r.ds === today ? 'is-today' : ''}`}>
            <header className="ag-head">
              <span className="ag-num">{d.getDate()}</span>
              <span className="ag-name">{r.ds === today ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long' })}<em>{d.toLocaleDateString('en-US', { month: 'short' })}</em></span>
            </header>
            <ul className="ag-list">
              {r.events.map((e) => (
                <li key={e.id}>
                  <button type="button" className="ag-item" style={{ '--ic': categoryOf(e).color }} onClick={() => onOpen(e)}>
                    <span className="ag-time">{formatTimeOf(e.start_time)}</span>
                    <span className="ag-title">{e.task_id && (e.completed ? <Check size={12} /> : <CheckSquare size={12} />)} {e.title}</span>
                  </button>
                </li>
              ))}
              {r.tasks.map((t) => (
                <li key={t.id} className={`ag-item is-flat ${t.status === 'completed' ? 'is-done' : ''}`}>
                  <span className="ag-time">Task</span>
                  <span className="ag-title">{t.status === 'completed' ? <Check size={12} /> : <CheckSquare size={12} />} {t.title}</span>
                </li>
              ))}
              {r.goals.map((g) => (
                <li key={g.id} className="ag-item is-flat is-goal">
                  <span className="ag-time">Deadline</span>
                  <span className="ag-title"><Flag size={12} /> {g.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
