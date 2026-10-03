'use client'

import { useEffect, useRef } from 'react'
import { Check, RotateCw, CheckSquare } from 'lucide-react'
import { categoryOf } from '@/lib/utils/calendarBlocks'
import { formatTimeOf } from '@/lib/utils/appDate'
import { haptic } from '@/lib/utils/celebrate'

const HOLD_MS = 350

/**
 * One event / time block on the week grid. Mouse: drag to move, drag the
 * bottom edge to resize. Touch: long-press to pick up. Tap opens it.
 * onGesture(phase, kind, ev, dx, dy) with kind = 'move' | 'resize'.
 */
export default function EventBlock({ ev, box, lane, lanes, task, isPast, onOpen, onGesture, onRoll, preview }) {
  const ref = useRef(null)
  const g = useRef({})
  const cat = categoryOf(ev)
  const done = ev.completed || task?.status === 'completed'
  const canRoll = isPast && ev.task_id && !done
  const short = box.height < 40

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const block = (e) => { if (g.current.active) e.preventDefault() }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  const start = (e, kind) => {
    if (e.button && e.button !== 0) return
    e.stopPropagation()
    const s = g.current
    s.kind = kind
    s.x0 = e.clientX
    s.y0 = e.clientY
    s.id = e.pointerId
    s.touch = e.pointerType !== 'mouse'
    s.active = false
    s.moved = false
    clearTimeout(s.timer)
    if (s.touch && kind === 'move') {
      s.timer = setTimeout(() => {
        s.active = true
        haptic(16)
        try { ref.current?.setPointerCapture(s.id) } catch {}
        onGesture('start', kind, ev, 0, 0)
      }, HOLD_MS)
    } else {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    }
  }

  const move = (e) => {
    const s = g.current
    if (!s.kind) return
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0
    if (!s.active) {
      if (Math.abs(dx) + Math.abs(dy) < 5) return
      if (s.touch && s.kind === 'move') { clearTimeout(s.timer); s.kind = null; return } // a scroll, not a drag
      s.active = true
      onGesture('start', s.kind, ev, 0, 0)
    }
    s.moved = true
    onGesture('move', s.kind, ev, dx, dy)
  }

  const end = (e, cancelled) => {
    const s = g.current
    clearTimeout(s.timer)
    if (s.active) onGesture(cancelled ? 'cancel' : 'end', s.kind, ev, e.clientX - s.x0, e.clientY - s.y0)
    s.suppress = s.active && s.moved
    s.kind = null
    s.active = false
  }

  return (
    <div
      ref={ref}
      className={`eb ${done ? 'is-done' : ''} ${ev.task_id ? 'is-task' : ''} ${preview ? 'is-preview' : ''} ${short ? 'is-short' : ''} ${canRoll ? 'is-missed' : ''}`}
      style={{
        '--ec': cat.color,
        top: box.top,
        height: Math.max(18, box.height - 2),
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
      }}
      onPointerDown={(e) => start(e, 'move')}
      onPointerMove={move}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      onClick={(e) => { e.stopPropagation(); if (g.current.suppress) { g.current.suppress = false; return } onOpen(ev) }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(ev) }}
      aria-label={`${ev.title}, ${formatTimeOf(ev.start_time)}`}
    >
      <div className="eb-title">
        {ev.task_id && (done ? <Check size={11} strokeWidth={3} /> : <CheckSquare size={11} />)}
        <span>{ev.title}</span>
      </div>
      {!short && <div className="eb-time">{formatTimeOf(ev.start_time)}{ev.end_time ? ` – ${formatTimeOf(ev.end_time)}` : ''}</div>}
      {canRoll && !short && (
        <button type="button" className="eb-roll" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRoll(ev) }}>
          <RotateCw size={11} /> <span className="eb-roll-long">Roll to next free slot</span><span className="eb-roll-short">Roll</span>
        </button>
      )}
      <span className="eb-resize" onPointerDown={(e) => start(e, 'resize')} aria-hidden />
    </div>
  )
}
