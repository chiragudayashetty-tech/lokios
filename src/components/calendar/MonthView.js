'use client'

import { getLocalDateStr, getStartOfWeek } from '@/lib/utils/dates'
import { categoryOf } from '@/lib/utils/calendarBlocks'
import { formatTimeOf } from '@/lib/utils/appDate'

/** Month grid: events, tasks due and mission deadlines per day; tap a day to open it in the week view. */
export default function MonthView({ anchor, events, tasks, goals, today, onPickDay }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = getStartOfWeek(first)
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  const month = anchor.getMonth()
  const itemsFor = (ds) => [
    ...events.filter((e) => getLocalDateStr(new Date(e.start_time)) === ds).map((e) => ({ id: e.id, kind: 'event', title: e.title, color: categoryOf(e).color, time: formatTimeOf(e.start_time) })),
    ...tasks.filter((t) => t.due_date && String(t.due_date).slice(0, 10) === ds && t.status !== 'cancelled').map((t) => ({ id: t.id, kind: 'task', title: t.title, color: t.status === 'completed' ? 'var(--success)' : 'var(--text-muted)', done: t.status === 'completed' })),
    ...goals.filter((g) => g.deadline && String(g.deadline).slice(0, 10) === ds).map((g) => ({ id: g.id, kind: 'goal', title: `🏁 ${g.title}`, color: '#ffd166' })),
  ]
  const weekdays = cells.slice(0, 7).map((d) => d.toLocaleDateString('en-US', { weekday: 'short' }))
  return (
    <div className="mv">
      {weekdays.map((w) => <div key={w} className="mv-wd">{w}</div>)}
      {cells.map((d) => {
        const ds = getLocalDateStr(d)
        const items = itemsFor(ds)
        return (
          <button key={ds} type="button" className={`mv-cell ${d.getMonth() !== month ? 'is-out' : ''} ${ds === today ? 'is-today' : ''}`} onClick={() => onPickDay(ds)}>
            <span className="mv-num">{d.getDate()}</span>
            <span className="mv-items">
              {items.slice(0, 3).map((it) => (
                <span key={`${it.kind}_${it.id}`} className={`mv-item ${it.done ? 'is-done' : ''}`} style={{ '--ic': it.color }}>{it.title}</span>
              ))}
              {items.length > 3 && <span className="mv-more">+{items.length - 3} more</span>}
            </span>
            {items.length > 0 && <span className="mv-dots" aria-hidden>{items.slice(0, 4).map((it) => <i key={`${it.kind}_${it.id}`} style={{ background: it.color }} />)}</span>}
          </button>
        )
      })}
    </div>
  )
}
