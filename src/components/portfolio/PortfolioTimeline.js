'use client'

import { useMemo } from 'react'
import { Rocket, Flag, BookOpen, TrendingUp, Hammer } from 'lucide-react'

const KINDS = {
  work: { icon: Rocket, label: 'Shipped', color: 'var(--accent-primary)' },
  log: { icon: Hammer, label: 'Work log', color: 'var(--info)' },
  mission: { icon: Flag, label: 'Mission', color: '#ffd166' },
  book: { icon: BookOpen, label: 'Book', color: 'var(--success)' },
  level: { icon: TrendingUp, label: 'Level up', color: 'var(--accent-2)' },
}

/** Level-ups from the XP ledger: the date the running total crossed each level. */
export function levelUps(xpRows) {
  const sorted = [...(xpRows || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  const out = []
  let total = 0, level = 1
  for (const r of sorted) {
    total += r.amount || 0
    const lv = total <= 0 ? 1 : Math.floor(Math.sqrt(total / 50)) + 1
    if (lv > level) { for (let l = level + 1; l <= lv; l++) out.push({ level: l, at: r.created_at }); level = lv }
    else if (lv < level) level = lv
  }
  return out
}

/** Portfolio → Timeline (#38): shipped work, completed missions, books and level-ups by month. */
export default function PortfolioTimeline({ items = [], logs = [], missions = [], books = [], xpRows = [] }) {
  const months = useMemo(() => {
    const ev = [
      ...items.map((i) => ({ kind: 'work', at: i.shipped_on || i.created_at, title: i.title, sub: i.impact })),
      ...logs.filter((l) => !/^Weekly Debrief/i.test(l.title || '')).map((l) => ({ kind: 'log', at: l.date || l.created_at, title: l.title, sub: l.description?.slice(0, 120) })),
      ...missions.map((m) => ({ kind: 'mission', at: m.completed_at, title: m.title })),
      ...books.map((b) => ({ kind: 'book', at: b.date_completed || b.created_at, title: b.title, sub: b.author })),
      ...levelUps(xpRows).map((l) => ({ kind: 'level', at: l.at, title: `Reached level ${l.level}` })),
    ].filter((e) => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at)))
    const m = new Map()
    for (const e of ev) {
      const d = new Date(String(e.at).length === 10 ? `${e.at}T12:00:00` : e.at)
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!m.has(key)) m.set(key, [])
      m.get(key).push({ ...e, day: d.getDate() })
    }
    return [...m.entries()]
  }, [items, logs, missions, books, xpRows])

  if (!months.length) return <div className="tb-empty"><p>Nothing on the timeline yet — ship something, finish a book or a mission.</p></div>

  return (
    <div className="ptl">
      {months.map(([month, list]) => (
        <section key={month} className="ptl-month">
          <h3 className="ptl-head">{month} <span>{list.length}</span></h3>
          <ol className="ptl-list">
            {list.map((e, i) => {
              const k = KINDS[e.kind]
              const Icon = k.icon
              return (
                <li key={i} className="ptl-item" style={{ '--kc': k.color }}>
                  <span className="ptl-dot"><Icon size={12} /></span>
                  <span className="ptl-day">{e.day}</span>
                  <div className="ptl-text">
                    <b>{e.title}</b>
                    <span>{k.label}{e.sub ? ` · ${e.sub}` : ''}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
