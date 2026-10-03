'use client'

import Link from 'next/link'
import { Flag } from 'lucide-react'
import { milestonesOf, deadlineOf, dayDiff, typeLabel } from '@/lib/utils/missions'
import { Cover } from './MissionCard'

const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * Roadmap view (#22): every active mission as a horizontal timeline — milestones
 * as dots on a shared date axis, a today marker and the deadline flag.
 */
export default function GoalRoadmap({ goals, milestones, progressById, today }) {
  if (!goals.length) return <p className="tb-empty">No active missions to plan.</p>

  // Shared axis: earliest start → latest deadline / milestone (at least 4 weeks)
  const dates = [today]
  const add = (d) => { const s = String(d || '').slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime())) dates.push(s) }
  for (const g of goals) {
    add(g.created_at)
    add(deadlineOf(g))
    for (const m of milestonesOf(g.id, milestones)) add(m.target_date)
  }
  dates.sort()
  let start = dates[0]
  let end = dates[dates.length - 1]
  if (dayDiff(start, end) < 28) end = new Date(new Date(`${start}T12:00:00`).getTime() + 28 * 86400000).toISOString().slice(0, 10)
  const span = Math.max(1, dayDiff(start, end))
  const pos = (d) => `${Math.min(100, Math.max(0, (dayDiff(start, d) / span) * 100))}%`

  // Month ticks along the axis
  const ticks = []
  const t = new Date(`${start}T12:00:00`)
  t.setDate(1)
  t.setMonth(t.getMonth() + 1)
  while (t.toISOString().slice(0, 10) <= end && ticks.length < 24) {
    const d = t.toISOString().slice(0, 10)
    const at = dayDiff(start, d) / span
    if (at > 0.07 && at < 0.93) ticks.push(d) // keep clear of the start / end labels
    t.setMonth(t.getMonth() + 1)
  }

  return (
    <div className="rm">
      <div className="rm-axis" aria-hidden>
        <span style={{ left: 0 }}>{fmt(start)}</span>
        {ticks.map((d) => <span key={d} style={{ left: pos(d) }}>{new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</span>)}
        <span style={{ right: 0, left: 'auto' }}>{fmt(end)}</span>
      </div>
      {goals.map((g) => {
        const ms = milestonesOf(g.id, milestones)
        const from = g.created_at ? String(g.created_at).slice(0, 10) : today
        const dl = deadlineOf(g)
        const pct = progressById.get(g.id) || 0
        return (
          <Link key={g.id} href={`/goals/${g.id}`} className="rm-row">
            <div className="rm-label">
              <Cover goal={g} size="sm" />
              <span className="rm-title">{g.title}</span>
              <span className="rm-meta">{typeLabel(g)} · {pct}%</span>
            </div>
            <div className="rm-track">
              <div className="rm-line" style={{ left: pos(from), right: `calc(100% - ${pos(dl || end)})` }}>
                <span className="rm-fill" style={{ width: `${pct}%` }} />
              </div>
              {ticks.map((d) => <i key={d} className="rm-grid" style={{ left: pos(d) }} />)}
              <i className="rm-today" style={{ left: pos(today) }} title="Today" />
              {ms.filter((m) => m.target_date).map((m) => (
                <span key={m.id} className={`rm-dot ${m.done_at ? 'is-done' : m.target_date < today ? 'is-late' : ''}`} style={{ left: pos(m.target_date) }} title={`${m.title} · ${fmt(m.target_date)}${m.done_at ? ' · done' : ''}`} />
              ))}
              {dl && <span className={`rm-flag ${dl < today ? 'is-late' : ''}`} style={{ left: pos(dl) }} title={`Deadline ${fmt(dl)}`}><Flag size={11} /></span>}
            </div>
          </Link>
        )
      })}
      <div className="rm-legend">
        <span><i className="rm-dot is-done" /> Milestone done</span>
        <span><i className="rm-dot" /> Upcoming</span>
        <span><i className="rm-dot is-late" /> Overdue</span>
        <span><i className="rm-today-key" /> Today</span>
      </div>
    </div>
  )
}
