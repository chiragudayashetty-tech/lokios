'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sun, CalendarRange, Inbox, CheckCircle2, Plus, AlertTriangle } from 'lucide-react'
import TaskCard from './TaskCard'
import { COLUMNS, columnOf, sortColumn, weekEndOf, dueOf } from '@/lib/utils/taskBoard'

const COLUMN_ICONS = { today: Sun, week: CalendarRange, later: Inbox, done: CheckCircle2 }
const EMPTY_COPY = {
  today: { title: 'Nothing due today', cta: 'Plan a task for today' },
  week: { title: 'The rest of the week is open', cta: 'Add a task this week' },
  later: { title: 'No backlog — nice', cta: 'Park an idea for later' },
  done: { title: 'Nothing finished this week yet', cta: null },
}
const DONE_PREVIEW = 10

/**
 * Kanban board: Today / This week / Later / Done.
 * onMove(taskId, columnId, beforeTaskId | null) decides what a drop means.
 */
export default function TaskBoard({ tasks, today, goalsById, phone, onOpen, onComplete, onPush, onMove, onAdd }) {
  const weekEnd = weekEndOf(today)
  const columns = useMemo(() => {
    const buckets = Object.fromEntries(COLUMNS.map((c) => [c.id, []]))
    for (const t of tasks) {
      const col = columnOf(t, today, weekEnd)
      if (col) buckets[col].push(t)
    }
    return Object.fromEntries(COLUMNS.map((c) => [c.id, sortColumn(buckets[c.id], c.id, today)]))
  }, [tasks, today, weekEnd])

  const [showAllDone, setShowAllDone] = useState(false)
  const [activeCol, setActiveCol] = useState('today')
  const [hover, setHover] = useState(null) // { col, before }
  const [touchDrag, setTouchDrag] = useState(null) // { task, x, y }
  const scroller = useRef(null)
  const edgeTimer = useRef(0)

  // ── Desktop: HTML5 drag & drop ────────────────────────────────────────────
  const targetFrom = (el) => {
    const colEl = el?.closest?.('[data-col]')
    if (!colEl) return null
    const cardEl = el.closest('[data-task-id]')
    return { col: colEl.dataset.col, before: cardEl?.dataset.taskId || null }
  }

  const onDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const t = targetFrom(e.target)
    if (t && (t.col !== hover?.col || t.before !== hover?.before)) setHover(t)
  }
  const onDrop = (e) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/task-id')
    const t = targetFrom(e.target)
    setHover(null)
    if (id && t) onMove(id, t.col, t.before === id ? null : t.before)
  }

  // ── Phone: long-press drag with a floating ghost ──────────────────────────
  const onTouchDrag = useCallback((phase, task, x, y) => {
    if (phase === 'start') { setTouchDrag({ task, x, y }); return }
    if (phase === 'move') {
      setTouchDrag((d) => (d ? { ...d, x, y } : d))
      const el = document.elementFromPoint(x, y)
      const t = targetFrom(el)
      setHover((h) => (t && (t.col !== h?.col || t.before !== h?.before) ? t : h))
      // Near a screen edge: page the carousel to the neighbouring column
      const sc = scroller.current
      const now = Date.now()
      if (sc && now - edgeTimer.current > 650) {
        if (x < 28) { sc.scrollBy({ left: -sc.clientWidth, behavior: 'smooth' }); edgeTimer.current = now }
        else if (x > window.innerWidth - 28) { sc.scrollBy({ left: sc.clientWidth, behavior: 'smooth' }); edgeTimer.current = now }
      }
      return
    }
    const el = phase === 'end' ? document.elementFromPoint(x, y) : null
    const t = targetFrom(el)
    setTouchDrag(null)
    setHover(null)
    if (t) onMove(task.id, t.col, t.before === task.id ? null : t.before)
  }, [onMove])

  // Keep the column tabs in sync with the carousel position
  useEffect(() => {
    const sc = scroller.current
    if (!sc || !phone) return
    const onScroll = () => {
      const i = Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth))
      setActiveCol(COLUMNS[Math.min(COLUMNS.length - 1, Math.max(0, i))].id)
    }
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => sc.removeEventListener('scroll', onScroll)
  }, [phone])

  const goTo = (id) => {
    const i = COLUMNS.findIndex((c) => c.id === id)
    scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' })
    setActiveCol(id)
  }

  return (
    <div className="tb">
      {phone && (
        <div className="tb-tabs" role="tablist">
          {COLUMNS.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={activeCol === c.id} className={activeCol === c.id ? 'is-on' : ''} onClick={() => goTo(c.id)}>
              {c.label} <span>{columns[c.id].length}</span>
            </button>
          ))}
        </div>
      )}

      <div ref={scroller} className={`tb-columns ${phone ? 'is-carousel' : ''}`} onDragOver={phone ? undefined : onDragOver} onDrop={phone ? undefined : onDrop} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHover(null) }}>
        {COLUMNS.map((c) => {
          const Icon = COLUMN_ICONS[c.id]
          const all = columns[c.id]
          const list = c.id === 'done' && !showAllDone ? all.slice(0, DONE_PREVIEW) : all
          const overdue = c.id === 'today' ? all.filter((t) => dueOf(t) && dueOf(t) < today).length : 0
          const isHover = hover?.col === c.id
          const empty = EMPTY_COPY[c.id]
          return (
            <section key={c.id} className={`tb-col tb-col--${c.id} ${isHover ? 'is-hover' : ''}`} data-col={c.id} aria-label={c.label}>
              <header className="tb-col-head">
                <span className="tb-col-icon"><Icon size={14} /></span>
                <span className="tb-col-title">{c.label}</span>
                <span className="tb-col-count">{all.length}</span>
                {overdue > 0 && <span className="tb-col-late"><AlertTriangle size={11} /> {overdue} late</span>}
                {c.id !== 'done' && (
                  <button type="button" className="tb-col-add" onClick={() => onAdd(c.id)} aria-label={`Add task to ${c.label}`}><Plus size={14} /></button>
                )}
              </header>

              <div className="tb-col-body">
                {list.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    today={today}
                    missionTitle={t.goal_id ? goalsById.get(t.goal_id)?.title : null}
                    onOpen={onOpen}
                    onComplete={onComplete}
                    onPush={onPush}
                    touch={phone}
                    onTouchDrag={onTouchDrag}
                    dragging={touchDrag?.task.id === t.id}
                    dropBefore={hover?.col === c.id && hover?.before === t.id}
                  />
                ))}
                {isHover && !hover.before && <div className="tb-drop-line" aria-hidden />}

                {all.length === 0 && (
                  <div className="tb-empty">
                    <div className="tb-empty-art"><Icon size={22} /></div>
                    <p>{empty.title}</p>
                    {empty.cta && <button type="button" className="tb-empty-cta" onClick={() => onAdd(c.id)}><Plus size={13} /> {empty.cta}</button>}
                  </div>
                )}

                {c.id === 'done' && all.length > DONE_PREVIEW && (
                  <button type="button" className="tb-more" onClick={() => setShowAllDone((v) => !v)}>
                    {showAllDone ? 'Show less' : `Show ${all.length - DONE_PREVIEW} more`}
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {touchDrag && typeof document !== 'undefined' && createPortal(
        <div className="tb-ghost" style={{ left: touchDrag.x, top: touchDrag.y }} aria-hidden>
          {touchDrag.task.title}
        </div>,
        document.body
      )}
    </div>
  )
}
