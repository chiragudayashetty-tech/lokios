'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Check, Clock, Target, ListChecks, CalendarClock, Repeat, Zap } from 'lucide-react'
import { priorityOf, categoryLabel, dueLabel, taskXp, subtaskProgress, formatMinutes } from '@/lib/utils/taskBoard'
import { haptic } from '@/lib/utils/celebrate'

const SWIPE_AT = 88
const HOLD_MS = 380

/**
 * One board card. Desktop: native drag & drop. Touch: swipe right = complete,
 * swipe left = push to tomorrow, long-press = pick up and drag to another column.
 */
function TaskCard({ task, today, missionTitle, onOpen, onComplete, onPush, touch, onTouchDrag, dragging, dropBefore }) {
  const pr = priorityOf(task)
  const done = task.status === 'completed'
  const due = done
    ? (task.completed_at ? { text: `Done ${new Date(task.completed_at).toLocaleDateString('en-US', { weekday: 'short' })}` } : null)
    : dueLabel(task, today)
  const xp = taskXp(task, today)
  const sub = subtaskProgress(task)
  const est = formatMinutes(task.estimate_minutes)

  const ref = useRef(null)
  const g = useRef({ mode: null })
  const [dx, setDx] = useState(0)

  // Non-passive touchmove so an active swipe / drag can stop the page scrolling.
  useEffect(() => {
    const el = ref.current
    if (!el || !touch) return
    const block = (e) => { if (g.current.mode === 'swipe' || g.current.mode === 'drag') e.preventDefault() }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [touch])

  const onPointerDown = (e) => {
    if (!touch || e.pointerType === 'mouse' || done) return
    const s = g.current
    s.mode = 'pending'
    s.x0 = e.clientX
    s.y0 = e.clientY
    s.id = e.pointerId
    clearTimeout(s.timer)
    s.timer = setTimeout(() => {
      if (s.mode !== 'pending') return
      s.mode = 'drag'
      haptic(18)
      try { ref.current?.setPointerCapture(s.id) } catch {}
      onTouchDrag?.('start', task, s.x0, s.y0)
    }, HOLD_MS)
  }

  const onPointerMove = (e) => {
    const s = g.current
    if (!s.mode) return
    const mx = e.clientX - s.x0, my = e.clientY - s.y0
    if (s.mode === 'drag') { onTouchDrag?.('move', task, e.clientX, e.clientY); return }
    if (s.mode === 'pending') {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) {
        clearTimeout(s.timer)
        s.mode = 'swipe'
        try { ref.current?.setPointerCapture(s.id) } catch {}
      } else if (Math.abs(my) > 10) {
        clearTimeout(s.timer)
        s.mode = null
      }
    }
    if (s.mode === 'swipe') setDx(Math.max(-140, Math.min(140, mx)))
  }

  const finish = (e, cancelled = false) => {
    const s = g.current
    clearTimeout(s.timer)
    if (s.mode === 'drag') onTouchDrag?.(cancelled ? 'cancel' : 'end', task, e.clientX, e.clientY)
    if (s.mode === 'swipe' && !cancelled) {
      if (dx >= SWIPE_AT) { haptic(14); onComplete(task) }
      else if (dx <= -SWIPE_AT) { haptic(14); onPush(task) }
    }
    s.suppressClick = s.mode === 'swipe' || s.mode === 'drag'
    s.mode = null
    setDx(0)
  }

  const wasGesture = () => {
    const hit = g.current.suppressClick
    g.current.suppressClick = false
    return hit
  }

  return (
    <div className={`tb-card-wrap ${dropBefore ? 'is-drop-before' : ''}`} data-task-id={task.id}>
      {touch && dx !== 0 && (
        <div className={`tb-swipe-bg ${dx > 0 ? 'is-done' : 'is-push'}`} aria-hidden>
          {dx > 0 ? <><Check size={16} /> Complete</> : <><CalendarClock size={16} /> Tomorrow</>}
        </div>
      )}
      <article
        ref={ref}
        className={`tb-card ${done ? 'is-done' : ''} ${due?.late ? 'is-late' : ''} ${dragging ? 'is-dragging' : ''}`}
        style={{ '--pr': pr.color, transform: dx ? `translateX(${dx}px)` : undefined, touchAction: touch ? 'pan-y' : undefined }}
        draggable={!touch}
        onDragStart={(e) => { e.dataTransfer.setData('text/task-id', task.id); e.dataTransfer.effectAllowed = 'move' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onClick={() => { if (!wasGesture()) onOpen(task) }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(task) } }}
        tabIndex={0}
        role="button"
        aria-label={`${task.title}${due ? `, due ${due.text}` : ''}`}
      >
        <div className="tb-card-top">
          <span className="tb-chip">{categoryLabel(task)}</span>
          {task.recurrence_type && <span className="tb-chip is-info"><Repeat size={10} /> {task.recurrence_type}</span>}
          {due && <span className={`tb-due ${due.late ? 'is-late' : ''}`}>{due.text}</span>}
        </div>
        <h3 className="tb-title">{task.title}</h3>
        <div className="tb-meta">
          <span className={`tb-xp ${xp.late && !done ? 'is-late' : ''}`}><Zap size={11} /> {done ? `+${xp.base}` : `+${xp.net}`} XP</span>
          {sub.total > 0 && <span className={`tb-meta-item ${sub.done === sub.total ? 'is-ok' : ''}`}><ListChecks size={12} /> {sub.done}/{sub.total}</span>}
          {est && <span className="tb-meta-item"><Clock size={12} /> {est}</span>}
          {missionTitle && <span className="tb-meta-item tb-mission"><Target size={12} /> <span>{missionTitle}</span></span>}
        </div>
        {!done && !touch && (
          <button type="button" className="tb-quick-done" title="Complete" aria-label={`Complete ${task.title}`} onClick={(e) => { e.stopPropagation(); onComplete(task) }}>
            <Check size={14} />
          </button>
        )}
      </article>
    </div>
  )
}

export default memo(TaskCard)
