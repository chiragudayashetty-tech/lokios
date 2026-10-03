'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import EventBlock from './EventBlock'
import { getLocalDateStr } from '@/lib/utils/dates'
import { DAY_START_HOUR, DAY_END_HOUR, HOUR_PX, SLOT_MIN, blockBox, layoutLanes, atMinutes, snap, minutesOfDay, durationMin } from '@/lib/utils/calendarBlocks'
import { formatClock } from '@/lib/utils/appDate'
import { habitsScheduledOn } from '@/lib/utils/xpRules'

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i)
const BODY_PX = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX
const HOLD_MS = 420

/**
 * Week (desktop) / 3-day (phone) time grid, 06:00–24:00 in 30-minute slots.
 * Drop a task from the Unscheduled panel to time-block it; drag / resize blocks;
 * click (desktop) or long-press (phone) an empty slot to create an event.
 */
export default function WeekGrid({ days, events, tasksById, habits, logs, today, now, phone, pickTask, onCreateAt, onMove, onOpen, onRoll, onSwipe }) {
  const scrollRef = useRef(null)
  const bodyRef = useRef(null)
  const [drag, setDrag] = useState(null) // { id, kind, dDay, dMin }
  const [dropHint, setDropHint] = useState(null) // { day, min }
  const press = useRef({})

  // Start scrolled to ~1h before now (or 08:00)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const h = Math.max(DAY_START_HOUR, Math.min(DAY_END_HOUR - 4, new Date().getHours() - 1))
    el.scrollTop = (h - DAY_START_HOUR) * HOUR_PX
  }, [])

  const byDay = useMemo(() => {
    const m = new Map(days.map((d) => [d, []]))
    for (const ev of events) {
      const d = getLocalDateStr(new Date(ev.start_time))
      if (m.has(d)) m.get(d).push(ev)
    }
    return m
  }, [days, events])

  const colWidth = () => {
    const col = bodyRef.current?.querySelector('.wg-col')
    return col ? col.getBoundingClientRect().width : 100
  }

  // Slot under a pointer position
  const slotAt = (clientX, clientY) => {
    const cols = [...(bodyRef.current?.querySelectorAll('.wg-col') || [])]
    const col = cols.find((c) => { const r = c.getBoundingClientRect(); return clientX >= r.left && clientX < r.right })
    if (!col) return null
    const r = col.getBoundingClientRect()
    const min = Math.max(0, Math.floor(((clientY - r.top) / HOUR_PX) * 60 / SLOT_MIN) * SLOT_MIN) + DAY_START_HOUR * 60
    return { day: col.dataset.day, min: Math.min(min, DAY_END_HOUR * 60 - SLOT_MIN) }
  }

  const onGesture = (phase, kind, ev, dx, dy) => {
    if (phase === 'start') { setDrag({ id: ev.id, kind, dDay: 0, dMin: 0 }); return }
    const dMin = snap((dy / HOUR_PX) * 60)
    const dDay = kind === 'move' ? Math.round(dx / colWidth()) : 0
    if (phase === 'move') { setDrag({ id: ev.id, kind, dDay, dMin }); return }
    setDrag(null)
    if (phase === 'cancel' || (!dMin && !dDay)) return
    const s = new Date(ev.start_time)
    const e = new Date(ev.end_time || s.getTime() + 3600000)
    if (kind === 'move') {
      const dayIdx = days.indexOf(getLocalDateStr(s))
      const target = days[Math.max(0, Math.min(days.length - 1, dayIdx + dDay))] || getLocalDateStr(s)
      const startMin = Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - SLOT_MIN, minutesOfDay(s) + dMin))
      const ns = atMinutes(target, startMin)
      onMove(ev, ns, new Date(ns.getTime() + durationMin(ev) * 60000))
    } else {
      const ne = new Date(e.getTime() + dMin * 60000)
      if (ne - s >= 15 * 60000) onMove(ev, s, ne)
    }
  }

  // Empty-slot creation: click (mouse) / long-press (touch) / tap while picking a task
  const slotDown = (e) => {
    if (e.target.closest('.eb')) return
    const p = press.current
    p.x = e.clientX; p.y = e.clientY; p.touch = e.pointerType !== 'mouse'; p.fired = false
    clearTimeout(p.timer)
    if (p.touch && !pickTask) {
      p.timer = setTimeout(() => {
        const slot = slotAt(p.x, p.y)
        if (slot) { p.fired = true; onCreateAt(slot.day, slot.min, null) }
      }, HOLD_MS)
    }
  }
  const slotMove = (e) => {
    const p = press.current
    if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 8) clearTimeout(p.timer)
  }
  const slotUp = (e) => {
    const p = press.current
    clearTimeout(p.timer)
    if (e.target.closest('.eb') || p.fired) return
    const moved = Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y)
    // Horizontal swipe on phone pages the 3-day window
    if (p.touch && Math.abs(e.clientX - p.x) > 60 && Math.abs(e.clientX - p.x) > Math.abs(e.clientY - p.y) * 1.5) { onSwipe?.(e.clientX < p.x ? 1 : -1); return }
    if (moved > 8) return
    if (p.touch && !pickTask) return
    const slot = slotAt(e.clientX, e.clientY)
    if (slot) onCreateAt(slot.day, slot.min, pickTask?.id || null)
  }

  // Desktop: drop an unscheduled task
  const onDragOver = (e) => {
    if (!e.dataTransfer.types.includes('text/task-id')) return
    e.preventDefault()
    const s = slotAt(e.clientX, e.clientY)
    if (s && (s.day !== dropHint?.day || s.min !== dropHint?.min)) setDropHint(s)
  }
  const onDrop = (e) => {
    const id = e.dataTransfer.getData('text/task-id')
    const s = slotAt(e.clientX, e.clientY)
    setDropHint(null)
    if (id && s) { e.preventDefault(); onCreateAt(s.day, s.min, id) }
  }

  const nowTop = ((minutesOfDay(now) - DAY_START_HOUR * 60) / 60) * HOUR_PX
  const doneOn = (habitId, d) => logs.some((l) => l.habit_id === habitId && l.date === d && (!l.status || l.status === 'completed'))

  return (
    <div className={`wg ${pickTask ? 'is-picking' : ''}`} style={{ '--cols': days.length, '--hour': `${HOUR_PX}px` }}>
      <div className="wg-head">
        <div className="wg-gutter" />
        {days.map((d) => {
          const date = new Date(`${d}T12:00:00`)
          const sched = habitsScheduledOn((habits || []).filter((h) => h.is_active !== false), d)
          return (
            <div key={d} className={`wg-day-head ${d === today ? 'is-today' : ''}`}>
              <span className="wg-dow">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="wg-date">{date.getDate()}</span>
              {sched.length > 0 && (
                <span className="wg-dots" title={`${sched.filter((h) => doneOn(h.id, d)).length}/${sched.length} habits`}>
                  {sched.slice(0, 8).map((h) => {
                    const st = doneOn(h.id, d) ? 'is-done' : d < today ? 'is-missed' : ''
                    return <i key={h.id} className={st} title={h.title} />
                  })}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="wg-scroll" ref={scrollRef}>
        <div className="wg-body" ref={bodyRef} style={{ height: BODY_PX }} onPointerDown={slotDown} onPointerMove={slotMove} onPointerUp={slotUp} onDragOver={onDragOver} onDragLeave={() => setDropHint(null)} onDrop={onDrop}>
          <div className="wg-hours" aria-hidden>
            {HOURS.map((h) => <span key={h} style={{ top: (h - DAY_START_HOUR) * HOUR_PX }}>{formatClock(`${h}:00`)}</span>)}
          </div>
          {days.map((d) => {
            const list = byDay.get(d) || []
            const lanes = layoutLanes(list)
            return (
              <div key={d} className={`wg-col ${d === today ? 'is-today' : ''}`} data-day={d}>
                {dropHint?.day === d && <div className="wg-drop" style={{ top: ((dropHint.min - DAY_START_HOUR * 60) / 60) * HOUR_PX }} />}
                {list.map((ev) => {
                  let box = blockBox(ev)
                  let shifted = false
                  if (drag?.id === ev.id) {
                    if (drag.kind === 'move') box = { ...box, top: box.top + (drag.dMin / 60) * HOUR_PX }
                    else box = { ...box, height: Math.max(12, box.height + (drag.dMin / 60) * HOUR_PX) }
                    shifted = true
                  }
                  const l = lanes.get(ev.id) || { lane: 0, lanes: 1 }
                  const style = shifted && drag.dDay ? { transform: `translateX(${drag.dDay * 100}%)` } : null
                  return (
                    <div key={ev.id} className="eb-wrap" style={style || undefined}>
                      <EventBlock
                        ev={ev}
                        box={box}
                        lane={shifted ? 0 : l.lane}
                        lanes={shifted ? 1 : l.lanes}
                        task={ev.task_id ? tasksById.get(ev.task_id) : null}
                        isPast={new Date(ev.end_time || ev.start_time) < now}
                        onOpen={onOpen}
                        onGesture={onGesture}
                        onRoll={onRoll}
                        preview={shifted}
                      />
                    </div>
                  )
                })}
                {d === today && nowTop >= 0 && nowTop <= BODY_PX && <div className="wg-now" style={{ top: nowTop }} aria-label="Now" />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
