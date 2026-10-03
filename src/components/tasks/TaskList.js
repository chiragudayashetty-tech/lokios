'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Calendar, Trash2, Edit2, RotateCcw, Repeat, Target, AlertTriangle, CheckCircle2, Layers, Zap, ChevronDown, ChevronUp, ListChecks, Clock } from 'lucide-react'
import HudPanel from '@/components/ui/HudPanel'
import { parseTaskNotes } from '@/lib/utils/dates'
import { priorityOf, categoryLabel, dueOf, taskXp, subtaskProgress, formatMinutes, isOpen, dueLabel } from '@/lib/utils/taskBoard'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All open' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
]

function groupByMonth(list) {
  const months = new Map()
  for (const task of list) {
    const stamp = task.completed_at || task.updated_at || task.due_date || task.created_at
    const label = (stamp ? new Date(stamp) : new Date()).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    if (!months.has(label)) months.set(label, new Map())
    const cat = categoryLabel(task)
    const group = months.get(label)
    if (!group.has(cat)) group.set(cat, [])
    group.get(cat).push(task)
  }
  return months
}

/** The classic tab list (kept behind the Board / List toggle). Editing opens the task drawer. */
export default function TaskList({ tasks, today, goalsById, onOpen, onComplete, onPush, onFail, onDelete, onUndoComplete, onUndoFail, onAdd }) {
  const [tab, setTab] = useState('today')
  const [expanded, setExpanded] = useState(null)

  const lists = useMemo(() => {
    const open = tasks.filter(isOpen)
    const overdue = open.filter((t) => dueOf(t) && dueOf(t) < today).sort((a, b) => dueOf(a).localeCompare(dueOf(b)))
    const dueToday = open.filter((t) => dueOf(t) === today)
    const upcoming = open.filter((t) => !dueOf(t) || dueOf(t) > today).sort((a, b) => (dueOf(a) || '9999').localeCompare(dueOf(b) || '9999') || (a.title || '').localeCompare(b.title || ''))
    return {
      today: [...overdue, ...dueToday],
      upcoming,
      all: open,
      completed: tasks.filter((t) => t.status === 'completed').sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || ''))),
      failed: tasks.filter((t) => t.status === 'cancelled' || t.status === 'failed'),
    }
  }, [tasks, today])

  const active = lists[tab] || []
  const archived = tab === 'completed' || tab === 'failed'

  const renderOpen = (task) => {
    const pr = priorityOf(task)
    const xp = taskXp(task, today)
    const due = dueLabel(task, today)
    const sub = subtaskProgress(task)
    const est = formatMinutes(task.estimate_minutes)
    const { cleanDesc } = parseTaskNotes(task.description)
    return (
      <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
        <HudPanel glow className="tl-card" style={{ '--pr': pr.color }}>
          <div className="tl-card-top">
            <span className="tb-chip">{categoryLabel(task)}</span>
            <span className="tb-chip" style={{ color: pr.color }}>{pr.label}</span>
            {due?.late && <span className="tb-chip is-danger"><AlertTriangle size={10} /> {due.text} (−{xp.late * 5} XP)</span>}
            {task.recurrence_type && <span className="tb-chip is-info"><Repeat size={10} /> {task.recurrence_type}</span>}
            {task.goal_id && <span className="tb-chip tl-mission"><Target size={10} /> {goalsById.get(task.goal_id)?.title || 'Mission'}</span>}
          </div>
          <h3 className="tl-title">{task.title}</h3>
          {cleanDesc && <p className="tl-desc">{cleanDesc}</p>}
          <div className="tl-foot">
            <div className="tl-meta">
              {due && <span className={due.late ? 'is-late' : ''}><Calendar size={11} /> {due.text}</span>}
              {sub.total > 0 && <span><ListChecks size={11} /> {sub.done}/{sub.total}</span>}
              {est && <span><Clock size={11} /> {est}</span>}
              <span className="tl-xp">+{xp.net} XP</span>
            </div>
            <div className="tl-actions">
              <button type="button" className="btn btn-primary btn-sm tl-do" onClick={() => onComplete(task)}><Zap size={14} /> Complete</button>
              <button type="button" className="tl-icon" onClick={() => onOpen(task)} title="Edit" aria-label="Edit"><Edit2 size={14} /></button>
              <button type="button" className="tl-icon" onClick={() => onPush(task)} title="Push to tomorrow" aria-label="Push to tomorrow"><RotateCcw size={14} /></button>
              <button type="button" className="tl-icon is-danger" onClick={() => onFail(task)} title="Mark failed" aria-label="Mark failed"><X size={14} /></button>
              <button type="button" className="tl-icon is-danger" onClick={() => onDelete(task)} title="Delete" aria-label="Delete"><Trash2 size={14} /></button>
            </div>
          </div>
        </HudPanel>
      </motion.div>
    )
  }

  const renderArchived = (task) => {
    const done = task.status === 'completed'
    const isExpanded = expanded === task.id
    const when = task.completed_at ? new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : dueOf(task)
    const { cleanDesc, completionNote, failureNote } = parseTaskNotes(task.description)
    return (
      <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className={`tl-strip ${done ? 'is-done' : 'is-failed'}`}>
          <button type="button" className="tl-strip-head" onClick={() => setExpanded(isExpanded ? null : task.id)} aria-expanded={isExpanded}>
            <span className="tl-strip-icon">{done ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}</span>
            <span className="tl-strip-title">{task.title}</span>
            {when && <span className="tl-strip-date">{done ? 'Done' : 'Failed'} {when}</span>}
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="tl-strip-body">
                {cleanDesc && <p className="tl-desc">{cleanDesc}</p>}
                {completionNote && <div className="tl-note is-ok"><CheckCircle2 size={13} /> <span>{completionNote}</span></div>}
                {failureNote && <div className="tl-note is-bad"><AlertTriangle size={13} /> <span>{failureNote}</span></div>}
                {task.media_urls?.length > 0 && (
                  <div className="tl-proofs">
                    {task.media_urls.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer">Proof #{i + 1}</a>)}
                  </div>
                )}
                <div className="tl-strip-actions">
                  {done ? (
                    <button type="button" className="td-link" onClick={() => onUndoComplete(task)}><RotateCcw size={13} /> Reopen</button>
                  ) : (
                    <button type="button" className="td-link" onClick={() => onUndoFail(task)}><RotateCcw size={13} /> Restore</button>
                  )}
                  <button type="button" className="td-link" onClick={() => onOpen(task)}><Edit2 size={13} /> Details</button>
                  <button type="button" className="td-link is-danger" onClick={() => onDelete(task)}><Trash2 size={13} /> Delete</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="tl">
      <div className="tl-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            {t.label} <span>{lists[t.id].length}</span>
          </button>
        ))}
      </div>

      {active.length === 0 ? (
        <div className="tb-empty tl-empty">
          <div className="tb-empty-art"><Layers size={22} /></div>
          <p>Nothing here yet.</p>
          {!archived && <button type="button" className="tb-empty-cta" onClick={() => onAdd('today')}>Add a task</button>}
        </div>
      ) : archived ? (
        [...groupByMonth(active)].map(([month, cats]) => (
          <section key={month} className="tl-month">
            <h3 className="tl-month-head"><Calendar size={13} /> {month}</h3>
            {[...cats].map(([cat, list]) => (
              <div key={cat} className="tl-cat">
                <div className="tl-cat-head">{cat} <span>{list.length}</span></div>
                <div className="tl-grid"><AnimatePresence mode="popLayout">{list.map(renderArchived)}</AnimatePresence></div>
              </div>
            ))}
          </section>
        ))
      ) : (
        <div className="tl-grid"><AnimatePresence mode="popLayout">{active.map(renderOpen)}</AnimatePresence></div>
      )}
    </div>
  )
}
