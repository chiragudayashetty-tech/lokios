'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Plus, Trash2, Target, CheckSquare, CalendarDays, ChevronDown } from 'lucide-react'
import SchemaHint from '@/components/ui/SchemaHint'
import { getLocalDateStr } from '@/lib/utils/dates'
import { isMissingSchema } from '@/lib/utils/schema'
import { fetchChecklist, addChecklistItem, setChecklistDone, deleteChecklistItem, updateChecklistItem, groupChecklist, CHECKLIST_GROUPS } from '@/lib/utils/checklist'

const MIGRATION = 'supabase/migrations/20261108_checklist.sql'
const fmtDue = (ds, today) => {
  if (!ds) return null
  const days = Math.round((new Date(`${ds}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${-days}d late`
  return new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', { weekday: days < 7 ? 'short' : undefined, month: 'short', day: 'numeric' })
}

function Item({ item, today, task, goal, onToggle, onDelete, onDue }) {
  const late = !item.done_at && item.due_date && item.due_date < today
  return (
    <li className={`ck-item ${item.done_at ? 'is-done' : ''} ${late ? 'is-late' : ''}`}>
      <button type="button" className={`ck-box ${item.done_at ? 'is-on' : ''}`} onClick={() => onToggle(item)} aria-label={item.done_at ? `Undo ${item.title}` : `Done: ${item.title}`}><Check size={13} strokeWidth={3} /></button>
      <div className="ck-main">
        <span className="ck-title">{item.title}</span>
        <span className="ck-meta">
          <label className="ck-due">
            <CalendarDays size={11} /> {fmtDue(item.due_date, today) || 'no deadline'}
            <input type="date" value={item.due_date || ''} onChange={(e) => onDue(item, e.target.value || null)} aria-label={`Deadline for ${item.title}`} />
          </label>
          {task && <span className="ck-link"><CheckSquare size={11} /> {task.title}</span>}
          {goal && <span className="ck-link is-goal"><Target size={11} /> {goal.title}</span>}
        </span>
      </div>
      <button type="button" className="tl-icon" onClick={() => onDelete(item)} aria-label={`Delete ${item.title}`}><Trash2 size={13} /></button>
    </li>
  )
}

/** Checklist: deadline to-dos with no XP, optionally tied to a task and/or a mission. */
export default function ChecklistView({ userId, tasks, goals, today = getLocalDateStr() }) {
  const [state, setState] = useState({ items: [], loading: true, missing: false })
  const [f, setF] = useState({ title: '', due_date: today, task_id: '', goal_id: '' })
  const [showDone, setShowDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    const { items, error } = await fetchChecklist(userId)
    setState({ items, loading: false, missing: isMissingSchema(error) })
  }, [userId])
  useEffect(() => { load() }, [load])

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals])
  const openTasks = useMemo(() => tasks.filter((t) => !['completed', 'cancelled', 'failed'].includes(t.status)), [tasks])
  const activeGoals = useMemo(() => goals.filter((g) => !['completed', 'failed', 'cancelled'].includes(g.status)), [goals])
  const groups = useMemo(() => groupChecklist(state.items, today), [state.items, today])

  // Picking a task fills in its mission, so the chain stays mission → task → checklist
  const pickTask = (id) => setF((x) => ({ ...x, task_id: id, goal_id: id ? taskById.get(id)?.goal_id || x.goal_id : x.goal_id }))

  const add = async (e) => {
    e.preventDefault()
    if (!f.title.trim() || busy) return
    setBusy(true)
    const res = await addChecklistItem(userId, f)
    setBusy(false)
    if (!res.error) { setF((x) => ({ ...x, title: '' })); setState((s) => ({ ...s, items: [...s.items, res.data] })) }
  }
  const patchLocal = (id, patch) => setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const toggle = async (it) => {
    const done_at = it.done_at ? null : new Date().toISOString()
    patchLocal(it.id, { done_at })
    const res = await setChecklistDone(userId, it.id, !it.done_at)
    if (res.error) patchLocal(it.id, { done_at: it.done_at })
  }
  const setDue = async (it, due_date) => { patchLocal(it.id, { due_date }); await updateChecklistItem(userId, it.id, { due_date }) }
  const remove = async (it) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== it.id) }))
    await deleteChecklistItem(userId, it.id)
  }

  if (state.missing) return <SchemaHint feature="The checklist" file={MIGRATION} />
  const openCount = state.items.filter((i) => !i.done_at).length

  return (
    <section className="ck">
      <p className="ck-intro">Precise to-dos with a deadline — no XP. Link one to a task or a mission to keep the chain: <b>Mission</b> (long goal) → <b>Task</b> (earns XP) → <b>Checklist</b> (get it done by a date).</p>
      <form className="ck-add" onSubmit={add}>
        <input className="input ck-add-title" value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} placeholder="Add a to-do… (Enter to save)" aria-label="Checklist item" />
        <div className="ck-add-row">
          <input className="input" type="date" value={f.due_date} onChange={(e) => setF((x) => ({ ...x, due_date: e.target.value }))} aria-label="Deadline" />
          <select className="input" value={f.task_id} onChange={(e) => pickTask(e.target.value)} aria-label="Link to task">
            <option value="">No task</option>
            {openTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <select className="input" value={f.goal_id} onChange={(e) => setF((x) => ({ ...x, goal_id: e.target.value }))} aria-label="Link to mission">
            <option value="">No mission</option>
            {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !f.title.trim()}><Plus size={15} /> Add</button>
        </div>
      </form>

      {!state.loading && openCount === 0 && !groups.done.length && <p className="ck-empty">Nothing on the checklist. Add the small things you need done by a date.</p>}

      {CHECKLIST_GROUPS.filter((g) => g.id !== 'done' && groups[g.id].length).map((g) => (
        <div key={g.id} className={`ck-group ck-group--${g.id}`}>
          <h3>{g.label} <span>{groups[g.id].length}</span></h3>
          <ul>{groups[g.id].map((it) => <Item key={it.id} item={it} today={today} task={taskById.get(it.task_id)} goal={goalById.get(it.goal_id)} onToggle={toggle} onDelete={remove} onDue={setDue} />)}</ul>
        </div>
      ))}

      {groups.done.length > 0 && (
        <div className="ck-group ck-group--done">
          <button type="button" className="ck-done-toggle" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            Done <span>{groups.done.length}</span> <ChevronDown size={14} style={{ transform: showDone ? 'rotate(180deg)' : 'none' }} />
          </button>
          {showDone && <ul>{groups.done.slice(0, 50).map((it) => <Item key={it.id} item={it} today={today} task={taskById.get(it.task_id)} goal={goalById.get(it.goal_id)} onToggle={toggle} onDelete={remove} onDue={setDue} />)}</ul>}
        </div>
      )}
    </section>
  )
}
