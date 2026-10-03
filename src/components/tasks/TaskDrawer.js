'use client'

import { useEffect, useMemo, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Check, GripVertical, Plus, Trash2, X, CalendarClock, RotateCcw, Zap, Flag } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import SchemaHint from '@/components/ui/SchemaHint'
import { createClient } from '@/lib/supabase/client'
import { parseTaskNotes } from '@/lib/utils/dates'
import { PRIORITIES, CATEGORY_LABELS, taskXp, dueOf, shiftDay, newSubtaskId, subtaskProgress } from '@/lib/utils/taskBoard'

const PRIORITY_ORDER = ['EASY', 'MEDIUM', 'HARD', 'EXTREME', 'NONE']
const ESTIMATES = [15, 30, 45, 60, 90, 120]
const NO_SUBTASKS = []

/** Rebuild the stored description: keep tags and completion / failure notes around the edited text. */
function rebuildDescription(original, clean, category, customCategory) {
  const orig = String(original || '')
  const duration = orig.match(/\[Duration:\s*([^\]]+)\]/)
  const { completionNote, failureNote } = parseTaskNotes(orig)
  let out = ''
  if (category === 'other' && customCategory) out += `[Category: ${customCategory}]\n\n`
  if (duration) out += `[Duration: ${duration[1]}]\n\n`
  out += clean || ''
  if (completionNote) out += `\n\n[Completion Note]\n${completionNote}`
  if (failureNote) out += `\n\n[Failure Note]\n${failureNote}`
  return out.trim() || null
}

function draftFrom(task) {
  const custom = String(task?.description || '').match(/^\[Category:\s*([^\]]+)\]/)
  return {
    title: task?.title || '',
    description: parseTaskNotes(task?.description).cleanDesc.replace(/^\[Duration:[^\]]*\]\s*/, ''),
    due_date: dueOf(task) || '',
    difficulty: (task?.difficulty || 'MEDIUM').toUpperCase(),
    category: task?.category || 'beyond_tatva',
    customCategory: custom ? custom[1] : '',
    goal_id: task?.goal_id || '',
    milestone_id: task?.milestone_id || '',
    estimate_minutes: task?.estimate_minutes ?? '',
    actual_minutes: task?.actual_minutes ?? '',
  }
}

function SubtaskRow({ item, onToggle, onRename, onRemove, onDragEnd }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="td-sub">
      <button type="button" className="td-sub-grip" onPointerDown={(e) => controls.start(e)} aria-label="Reorder"><GripVertical size={14} /></button>
      <button type="button" className={`td-check ${item.done ? 'is-on' : ''}`} onClick={onToggle} aria-label={item.done ? 'Mark not done' : 'Mark done'}>
        {item.done && <Check size={12} strokeWidth={3} />}
      </button>
      <input className={`td-sub-input ${item.done ? 'is-done' : ''}`} defaultValue={item.title} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.title) onRename(v) }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} aria-label="Subtask" />
      <button type="button" className="td-icon-btn" onClick={onRemove} aria-label="Remove subtask"><X size={14} /></button>
    </Reorder.Item>
  )
}

export default function TaskDrawer({ task, goals, today, schemaReady, onClose, patchTask, onComplete, onFail, onDelete, onPush, onReopen }) {
  const [draft, setDraft] = useState(() => draftFrom(task))
  const [saving, setSaving] = useState(false)
  const [newSub, setNewSub] = useState('')
  const [milestoneData, setMilestoneData] = useState(null) // { goalId, list }
  const [schemaGone, setSchemaGone] = useState(false)
  const [askComplete, setAskComplete] = useState(false)

  // Milestones of the linked mission (#22) — hidden until the table exists.
  // The parent re-keys the drawer per task, so the draft never needs resetting.
  useEffect(() => {
    if (!draft.goal_id) return
    let cancelled = false
    createClient().from('goal_milestones').select('id, title, done_at, position').eq('goal_id', draft.goal_id).order('position')
      .then(({ data, error }) => { if (!cancelled) setMilestoneData({ goalId: draft.goal_id, list: error ? null : data || [] }) })
    return () => { cancelled = true }
  }, [draft.goal_id])
  const milestones = milestoneData?.goalId === draft.goal_id ? milestoneData.list : null

  const original = useMemo(() => draftFrom(task), [task])
  const dirty = task && JSON.stringify(draft) !== JSON.stringify(original)
  const boardCols = schemaReady !== false && !schemaGone
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : NO_SUBTASKS
  // Local order while dragging; written once on drop
  const [dragOrder, setDragOrder] = useState(null)
  const subs = dragOrder || subtasks
  const isDone = task?.status === 'completed'
  const isOpenTask = task && !['completed', 'cancelled', 'failed'].includes(task.status)
  const xp = task ? taskXp(task, today) : null
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e?.target ? e.target.value : e }))

  const buildPatch = () => {
    const p = {}
    if (draft.title.trim() && draft.title.trim() !== task.title) p.title = draft.title.trim()
    const desc = rebuildDescription(task.description, draft.description.trim(), draft.category, draft.customCategory.trim())
    if ((desc || null) !== (task.description || null)) p.description = desc
    if ((draft.due_date || null) !== (dueOf(task) || null)) p.due_date = draft.due_date || null
    if (draft.difficulty !== (task.difficulty || 'MEDIUM').toUpperCase()) p.difficulty = draft.difficulty
    if (draft.category !== (task.category || 'beyond_tatva')) p.category = draft.category
    if ((draft.goal_id || null) !== (task.goal_id || null)) { p.goal_id = draft.goal_id || null; if (!draft.goal_id && task.milestone_id) p.milestone_id = null }
    if (boardCols) {
      if ((draft.milestone_id || null) !== (task.milestone_id || null) && draft.goal_id) p.milestone_id = draft.milestone_id || null
      const num = (v) => (v === '' || v == null ? null : Math.max(0, parseInt(v, 10) || 0))
      if (num(draft.estimate_minutes) !== (task.estimate_minutes ?? null)) p.estimate_minutes = num(draft.estimate_minutes)
      if (num(draft.actual_minutes) !== (task.actual_minutes ?? null)) p.actual_minutes = num(draft.actual_minutes)
    }
    return p
  }

  const save = async () => {
    if (!task || !dirty) return true
    const p = buildPatch()
    if (!Object.keys(p).length) return true
    setSaving(true)
    const res = await patchTask(task.id, p)
    setSaving(false)
    if (res?.missingSchema) setSchemaGone(true)
    return !res?.error
  }

  const close = async () => { if (dirty) await save(); onClose() }

  const writeSubtasks = async (next) => {
    const res = await patchTask(task.id, { subtasks: next })
    if (res?.missingSchema) setSchemaGone(true)
    return res
  }

  const toggleSub = async (id) => {
    const next = subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    const res = await writeSubtasks(next)
    const nowAll = next.length > 0 && next.every((s) => s.done)
    setAskComplete(!res?.error && nowAll && isOpenTask)
  }

  const addSub = async () => {
    const title = newSub.trim()
    if (!title) return
    setNewSub('')
    await writeSubtasks([...subtasks, { id: newSubtaskId(), title, done: false }])
  }

  if (!task) return <Sheet open={false} onClose={onClose} />

  const sub = subtaskProgress(task)
  const activeGoals = (goals || []).filter((g) => !['completed', 'cancelled', 'failed'].includes(g.status) || g.id === task.goal_id)

  return (
    <Sheet
      open={!!task}
      onClose={close}
      title={isDone ? 'Completed task' : 'Task'}
      subtitle={xp ? `${isDone ? 'Paid' : 'Pays'} +${isDone ? xp.base : xp.net} XP${xp.late && !isDone ? ` · −${xp.late * 5} late penalty` : ''}` : null}
      footer={
        <div className="td-foot">
          {isOpenTask && <button type="button" className="btn btn-primary td-foot-main" onClick={async () => { if (dirty) await save(); onComplete(task) }} data-celebrate><Check size={16} /> Complete</button>}
          {isDone && <button type="button" className="btn btn-secondary td-foot-main" onClick={() => onReopen(task)}><RotateCcw size={15} /> Reopen</button>}
          <button type="button" className="btn btn-secondary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button>
        </div>
      }
    >
      <div className="td">
        <textarea className="td-title" rows={1} value={draft.title} onChange={set('title')} placeholder="Task title" aria-label="Title" />

        <div className="td-field">
          <label className="td-label">Due</label>
          <div className="td-row">
            <input type="date" className="input td-date" value={draft.due_date} onChange={set('due_date')} />
            <button type="button" className={`td-pill ${draft.due_date === today ? 'is-on' : ''}`} onClick={() => set('due_date')(today)}>Today</button>
            <button type="button" className={`td-pill ${draft.due_date === shiftDay(today, 1) ? 'is-on' : ''}`} onClick={() => set('due_date')(shiftDay(today, 1))}>Tomorrow</button>
            {task.type !== 'recurring' && <button type="button" className={`td-pill ${!draft.due_date ? 'is-on' : ''}`} onClick={() => set('due_date')('')}>No date</button>}
          </div>
        </div>

        <div className="td-field">
          <label className="td-label">Priority</label>
          <div className="td-seg" role="radiogroup" aria-label="Priority">
            {PRIORITY_ORDER.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={draft.difficulty === k} className={draft.difficulty === k ? 'is-on' : ''} style={{ '--pr': PRIORITIES[k].color }} onClick={() => set('difficulty')(k)}>
                <Flag size={11} /> {PRIORITIES[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="td-grid">
          <div className="td-field">
            <label className="td-label" htmlFor="td-cat">Category</label>
            <select id="td-cat" className="select" value={draft.category} onChange={set('category')}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {!CATEGORY_LABELS[draft.category] && <option value={draft.category}>{draft.category}</option>}
            </select>
            {draft.category === 'other' && <input className="input td-mt" placeholder="Custom category" value={draft.customCategory} onChange={set('customCategory')} />}
          </div>
          <div className="td-field">
            <label className="td-label" htmlFor="td-goal">Mission</label>
            <select id="td-goal" className="select" value={draft.goal_id} onChange={(e) => setDraft((d) => ({ ...d, goal_id: e.target.value, milestone_id: '' }))}>
              <option value="">No mission</option>
              {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            {boardCols && draft.goal_id && milestones && milestones.length > 0 && (
              <select className="select td-mt" value={draft.milestone_id} onChange={set('milestone_id')} aria-label="Milestone">
                <option value="">No milestone</option>
                {milestones.map((m) => <option key={m.id} value={m.id}>{m.done_at ? '✓ ' : ''}{m.title}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="td-field">
          <label className="td-label" htmlFor="td-desc">Notes</label>
          <textarea id="td-desc" className="textarea td-desc" rows={3} value={draft.description} onChange={set('description')} placeholder="Details, links, acceptance criteria…" />
        </div>

        {boardCols ? (
          <>
            <div className="td-field">
              <label className="td-label">Subtasks {sub.total > 0 && <span className="td-label-count">{sub.done}/{sub.total}</span>}</label>
              {sub.total > 0 && <div className="td-progress"><span style={{ width: `${(sub.done / sub.total) * 100}%` }} /></div>}
              {askComplete && (
                <div className="td-ask" role="alert">
                  <span>All subtasks done — complete the task?</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={async () => { setAskComplete(false); if (dirty) await save(); onComplete(task) }} data-celebrate>Complete</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAskComplete(false)}>Not yet</button>
                </div>
              )}
              <Reorder.Group axis="y" values={subs} onReorder={setDragOrder} className="td-subs">
                {subs.map((s) => (
                  <SubtaskRow
                    key={s.id}
                    item={s}
                    onToggle={() => toggleSub(s.id)}
                    onRename={(title) => writeSubtasks(subtasks.map((x) => (x.id === s.id ? { ...x, title } : x)))}
                    onRemove={() => writeSubtasks(subtasks.filter((x) => x.id !== s.id))}
                    onDragEnd={async () => {
                      if (!dragOrder) return
                      const changed = dragOrder.map((x) => x.id).join() !== subtasks.map((x) => x.id).join()
                      if (changed) await writeSubtasks(dragOrder)
                      setDragOrder(null)
                    }}
                  />
                ))}
              </Reorder.Group>
              <div className="td-row td-add-sub">
                <input className="input" value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }} placeholder="Add a subtask" aria-label="New subtask" />
                <button type="button" className="btn btn-secondary btn-sm" onClick={addSub} disabled={!newSub.trim()}><Plus size={14} /> Add</button>
              </div>
            </div>

            <div className="td-grid">
              <div className="td-field">
                <label className="td-label" htmlFor="td-est">Estimate (min)</label>
                <input id="td-est" type="number" min="0" step="5" inputMode="numeric" className="input" value={draft.estimate_minutes} onChange={set('estimate_minutes')} placeholder="e.g. 45" />
                <div className="td-row td-mt">
                  {ESTIMATES.map((m) => <button key={m} type="button" className={`td-pill ${Number(draft.estimate_minutes) === m ? 'is-on' : ''}`} onClick={() => set('estimate_minutes')(m)}>{m >= 60 ? `${m / 60}h` : `${m}m`}</button>)}
                </div>
              </div>
              <div className="td-field">
                <label className="td-label" htmlFor="td-act">Actual (min)</label>
                <input id="td-act" type="number" min="0" step="5" inputMode="numeric" className="input" value={draft.actual_minutes} onChange={set('actual_minutes')} placeholder="Time spent" />
                {draft.estimate_minutes && draft.actual_minutes ? (
                  <p className={`td-delta ${Number(draft.actual_minutes) > Number(draft.estimate_minutes) ? 'is-over' : 'is-under'}`}>
                    {Number(draft.actual_minutes) > Number(draft.estimate_minutes) ? `${draft.actual_minutes - draft.estimate_minutes}m over estimate` : `${draft.estimate_minutes - draft.actual_minutes}m under estimate`}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <SchemaHint feature="Subtasks, estimates and milestones" />
        )}

        <div className="td-danger-row">
          {isOpenTask && <button type="button" className="td-link" onClick={() => onPush(task)}><CalendarClock size={14} /> Push to tomorrow</button>}
          {isOpenTask && <button type="button" className="td-link is-danger" onClick={() => onFail(task)}><Zap size={14} /> Mark failed</button>}
          <button type="button" className="td-link is-danger" onClick={() => onDelete(task)}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </Sheet>
  )
}
