'use client'

import { useState } from 'react'
import { Reorder, useDragControls, AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, GripVertical, Plus, Trash2, Flag, Target, CalendarDays, CircleDot } from 'lucide-react'
import { milestoneTaskStats, milestoneXp, currentMilestone } from '@/lib/utils/missions'

const fmt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null)

function Bar({ done, total }) {
  const pct = total ? (done / total) * 100 : 0
  return <span className="gt-bar" aria-hidden><span style={{ width: `${pct}%` }} /></span>
}

function TaskRow({ task, onToggle, busy }) {
  const done = task.status === 'completed'
  return (
    <li className={`gt-task ${done ? 'is-done' : ''}`}>
      <button type="button" className={`gt-check ${done ? 'is-on' : ''}`} disabled={done || busy} onClick={() => onToggle(task)} data-celebrate={done ? undefined : ''} aria-label={done ? `${task.title} done` : `Complete ${task.title}`}>
        {done && <Check size={11} strokeWidth={3} />}
      </button>
      <span className="gt-task-title">{task.title}</span>
      {task.due_date && !done && <span className="gt-task-due">{fmt(String(task.due_date).slice(0, 10))}</span>}
    </li>
  )
}

function QuickAdd({ placeholder, onAdd }) {
  const [v, setV] = useState('')
  const submit = async () => { const t = v.trim(); if (!t) return; setV(''); await onAdd(t) }
  return (
    <div className="gt-quick">
      <Plus size={13} />
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} placeholder={placeholder} aria-label={placeholder} />
      {v.trim() && <button type="button" className="td-link" onClick={submit}>Add</button>}
    </div>
  )
}

function MilestoneNode({ goal, milestone, count, tasks, isCurrent, open, onToggleOpen, onToggleDone, onRename, onDate, onDelete, onToggleTask, onAddTask, busyTask, onDragEnd }) {
  const controls = useDragControls()
  const st = milestoneTaskStats(milestone.id, tasks)
  const done = !!milestone.done_at
  const xp = milestoneXp(goal, count)
  return (
    <Reorder.Item value={milestone} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className={`gt-ms ${done ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
      <span className="gt-dot" aria-hidden>{done ? <Check size={12} strokeWidth={3} /> : isCurrent ? <CircleDot size={12} /> : null}</span>
      <div className="gt-ms-card">
        <div className="gt-ms-head">
          <button type="button" className="gt-grip" onPointerDown={(e) => controls.start(e)} aria-label="Reorder milestone"><GripVertical size={14} /></button>
          <button type="button" className={`gt-check gt-check--lg ${done ? 'is-on' : ''}`} onClick={() => onToggleDone(milestone, !done)} data-celebrate={done ? undefined : ''} aria-label={done ? `Reopen ${milestone.title}` : `Complete ${milestone.title}`}>
            {done && <Check size={13} strokeWidth={3} />}
          </button>
          <input className="gt-ms-title" defaultValue={milestone.title} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== milestone.title) onRename(milestone, v) }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} aria-label="Milestone title" />
          <button type="button" className="gt-chev" onClick={onToggleOpen} aria-expanded={open} aria-label={open ? 'Collapse' : 'Expand'}><ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none' }} /></button>
        </div>
        <div className="gt-ms-meta">
          <label className="gt-date"><CalendarDays size={11} /><input type="date" value={milestone.target_date || ''} onChange={(e) => onDate(milestone, e.target.value || null)} aria-label="Target date" /></label>
          {st.total > 0 ? <><Bar done={st.done} total={st.total} /><span>{st.done}/{st.total} tasks</span></> : <span>No tasks yet</span>}
          <span className="gt-xp">{done ? 'Paid' : 'Pays'} +{xp} XP</span>
          {isCurrent && <span className="gt-now">Current</span>}
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div className="gt-children" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <ul className="gt-tasks">{st.tasks.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggleTask} busy={busyTask === t.id} />)}</ul>
              <QuickAdd placeholder="Add a task to this milestone" onAdd={(title) => onAddTask(title, milestone.id)} />
              <button type="button" className="td-link is-danger gt-del" onClick={() => onDelete(milestone)}><Trash2 size={13} /> Delete milestone</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  )
}

/**
 * Mission → milestones → tasks (#22) drawn as the vertical roadmap (#37).
 * Each node shows its own progress; ticking a task updates everything above it.
 */
export default function GoalTree({ goal, progress, milestones, tasks, onToggleTask, busyTask, onAddMilestone, onToggleMilestone, onUpdateMilestone, onDeleteMilestone, onReorder, onAddTask }) {
  const [openIds, setOpenIds] = useState(() => new Set(currentMilestone(milestones) ? [currentMilestone(milestones).id] : []))
  const [dragOrder, setDragOrder] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const shown = dragOrder || milestones
  const current = currentMilestone(milestones)
  const unassigned = tasks.filter((t) => !t.milestone_id || !milestones.some((m) => m.id === t.milestone_id))
  const doneTasks = tasks.filter((t) => t.status === 'completed').length
  const toggleOpen = (id) => setOpenIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const add = async () => {
    const title = newTitle.trim()
    if (!title) return
    const res = await onAddMilestone({ title, target_date: newDate || null })
    if (!res?.error) { setNewTitle(''); setNewDate('') }
  }

  return (
    <div className="gt">
      <div className="gt-root">
        <span className="gt-root-icon"><Target size={16} /></span>
        <div className="gt-root-text">
          <b>{goal.title}</b>
          <span className="gt-root-meta"><Bar done={progress} total={100} /> {progress}% · {milestones.filter((m) => m.done_at).length}/{milestones.length} milestones · {doneTasks}/{tasks.length} tasks</span>
        </div>
      </div>

      <Reorder.Group axis="y" values={shown} onReorder={setDragOrder} className="gt-list">
        {shown.map((m) => (
          <MilestoneNode
            key={m.id}
            goal={goal}
            milestone={m}
            count={milestones.length}
            tasks={tasks}
            isCurrent={current?.id === m.id}
            open={openIds.has(m.id)}
            onToggleOpen={() => toggleOpen(m.id)}
            onToggleDone={onToggleMilestone}
            onRename={(ms, title) => onUpdateMilestone(ms.id, { title })}
            onDate={(ms, target_date) => onUpdateMilestone(ms.id, { target_date })}
            onDelete={onDeleteMilestone}
            onToggleTask={onToggleTask}
            onAddTask={onAddTask}
            busyTask={busyTask}
            onDragEnd={async () => {
              if (!dragOrder) return
              if (dragOrder.map((x) => x.id).join() !== milestones.map((x) => x.id).join()) await onReorder(dragOrder)
              setDragOrder(null)
            }}
          />
        ))}
      </Reorder.Group>

      <div className="gt-add">
        <span className="gt-dot gt-dot--add" aria-hidden><Flag size={11} /></span>
        <div className="gt-add-row">
          <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="Add a milestone" aria-label="New milestone" />
          <input className="input gt-add-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="Target date" />
          <button type="button" className="btn btn-secondary btn-sm" disabled={!newTitle.trim()} onClick={add}><Plus size={14} /> Add</button>
        </div>
      </div>

      <div className="gt-unassigned">
        <div className="gt-unassigned-head">
          <span>Tasks without a milestone</span>
          <span>{unassigned.filter((t) => t.status === 'completed').length}/{unassigned.length}</span>
        </div>
        <ul className="gt-tasks">{unassigned.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggleTask} busy={busyTask === t.id} />)}</ul>
        <QuickAdd placeholder="Add a task to this mission" onAdd={(title) => onAddTask(title, null)} />
      </div>
    </div>
  )
}
