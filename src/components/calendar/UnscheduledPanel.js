'use client'

import { useState } from 'react'
import { Inbox, GripVertical, X, Clock } from 'lucide-react'
import { priorityOf, dueLabel, formatMinutes } from '@/lib/utils/taskBoard'

/**
 * Open tasks without a time block. Desktop: drag onto the grid. Phone: tap a
 * task, then tap a slot (pick mode).
 */
export default function UnscheduledPanel({ tasks, today, phone, picking, onPick, collapsedDefault = false }) {
  const [open, setOpen] = useState(!collapsedDefault)
  return (
    <aside className={`up ${open ? 'is-open' : ''}`} aria-label="Unscheduled tasks">
      <button type="button" className="up-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Inbox size={14} /> Unscheduled <span className="up-count">{tasks.length}</span>
        <span className="up-hint">{phone ? 'tap, then tap a slot' : 'drag onto the grid'}</span>
      </button>
      {open && (
        <ul className="up-list">
          {tasks.length === 0 && <li className="up-empty">Every open task has a slot. 🎯</li>}
          {tasks.map((t) => {
            const pr = priorityOf(t)
            const due = dueLabel(t, today)
            const isPicked = picking?.id === t.id
            return (
              <li
                key={t.id}
                className={`up-item ${isPicked ? 'is-picked' : ''}`}
                style={{ '--pr': pr.color }}
                draggable={!phone}
                onDragStart={(e) => { e.dataTransfer.setData('text/task-id', t.id); e.dataTransfer.effectAllowed = 'copy' }}
                onClick={() => phone && onPick(isPicked ? null : t)}
              >
                {!phone && <GripVertical size={13} className="up-grip" />}
                <span className="up-title">{t.title}</span>
                <span className="up-meta">
                  {t.estimate_minutes ? <><Clock size={10} /> {formatMinutes(t.estimate_minutes)}</> : null}
                  {due && <em className={due.late ? 'is-late' : ''}>{due.text}</em>}
                </span>
                {isPicked && <X size={13} />}
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
