'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, AlertTriangle, CheckCircle2, Flag, Repeat } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import { taskXp, PRIORITIES, CATEGORY_LABELS } from '@/lib/utils/taskBoard'

function ModalShell({ open, onClose, tone = 'accent', children, label }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="modal-overlay tm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label={label}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className={`tm tm--${tone}`}>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Existing completion flow: optional reflection + proof link, then completeOperation. */
export function CompleteTaskModal({ task, today, onClose, onSubmit }) {
  return (
    <ModalShell open={!!task} onClose={onClose} tone="success" label="Complete task">
      {task && <CompleteForm key={task.id} task={task} today={today} onClose={onClose} onSubmit={onSubmit} />}
    </ModalShell>
  )
}

function CompleteForm({ task, today, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const xp = taskXp(task, today)

  const submit = async (skip) => {
    if (busy) return
    setBusy(true)
    try { await onSubmit(task, skip ? null : url.trim() || null, skip ? null : note.trim() || null) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="tm-head">
        <span className="tm-title"><CheckCircle2 size={18} /> Complete task</span>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <p className="tm-task">{task?.title}</p>
      {xp?.late > 0 && (
        <div className="tm-warn"><AlertTriangle size={13} /> {xp.late}d late · −{xp.late * 5} XP (you get +{xp.net})</div>
      )}
      <label className="td-label" htmlFor="tm-note">What did you get done?</label>
      <textarea id="tm-note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Outcome, numbers, what you learned…" autoFocus />
      <label className="td-label" htmlFor="tm-url">Proof link (optional)</label>
      <input id="tm-url" type="url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      <div className="tm-actions">
        <button type="button" className="btn btn-primary" onClick={() => submit(false)} disabled={busy} data-celebrate><Check size={16} /> Complete · +{xp?.net ?? 0} XP</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => submit(true)} disabled={busy} data-celebrate>Quick complete (skip notes)</button>
      </div>
    </>
  )
}

export function FailTaskModal({ task, onClose, onSubmit }) {
  return (
    <ModalShell open={!!task} onClose={onClose} tone="danger" label="Mark task failed">
      {task && <FailForm key={task.id} task={task} onClose={onClose} onSubmit={onSubmit} />}
    </ModalShell>
  )
}

function FailForm({ task, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  return (
    <>
      <div className="tm-head">
        <span className="tm-title is-danger"><AlertTriangle size={18} /> Mark as failed</span>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <p className="tm-task">{task?.title}</p>
      <p className="tm-sub">An XP penalty applies, based on priority and days late.</p>
      <label className="td-label" htmlFor="tm-reason">Why did it fail? (optional)</label>
      <textarea id="tm-reason" className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Blockers, distractions, missing pieces…" autoFocus />
      <div className="tm-actions is-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={() => onSubmit(task, reason)}><X size={16} /> Mark failed</button>
      </div>
    </>
  )
}

const DAYS = [{ l: 'Mon', v: 1 }, { l: 'Tue', v: 2 }, { l: 'Wed', v: 3 }, { l: 'Thu', v: 4 }, { l: 'Fri', v: 5 }, { l: 'Sat', v: 6 }, { l: 'Sun', v: 0 }]
const blank = (due) => ({ title: '', description: '', difficulty: 'MEDIUM', category: 'beyond_tatva', customCategory: '', recurrence_type: '', due_date: due ?? '', goal_id: '', weeklyDays: [new Date().getDay()], weeklyDuration: 0, estimate_minutes: '' })

/** "+ Task" sheet. preset = { due_date } from the column the user tapped. */
export function NewTaskSheet({ open, preset, goals, today, schemaReady, onClose, onCreate }) {
  // Parent re-keys this sheet per opening, so the form starts fresh each time
  const [form, setForm] = useState(() => blank(preset?.due_date === undefined ? today : preset.due_date))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || busy) return
    setBusy(true)
    let desc = form.description.trim()
    if (form.category === 'other' && form.customCategory.trim()) desc = `[Category: ${form.customCategory.trim()}]\n\n${desc}`.trim()
    let due = form.due_date || null
    let days = form.recurrence_type === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : null
    if (form.recurrence_type === 'weekly') {
      days = form.weeklyDays.length ? form.weeklyDays : [new Date().getDay()]
      if (form.weeklyDuration > 0) desc = `[Duration: ${form.weeklyDuration}]\n\n${desc}`.trim()
      const from = new Date()
      const cur = from.getDay()
      const sorted = [...days].sort((a, b) => a - b)
      const next = sorted.find((d) => d >= cur)
      from.setDate(from.getDate() + (next !== undefined ? next - cur : 7 - cur + sorted[0]) + (parseInt(form.weeklyDuration, 10) || 0))
      due = from.toISOString().split('T')[0]
    }
    if (form.recurrence_type && !due) due = today
    const payload = {
      title: form.title.trim(),
      description: desc || null,
      due_date: due,
      difficulty: form.difficulty,
      category: form.category,
      type: form.recurrence_type ? 'recurring' : 'custom',
      recurrence_type: form.recurrence_type || null,
      recurrence_days: days,
      goal_id: form.goal_id || null,
    }
    if (schemaReady !== false && form.estimate_minutes) payload.estimate_minutes = Math.max(0, parseInt(form.estimate_minutes, 10) || 0)
    const res = await onCreate(payload)
    setBusy(false)
    if (res?.error) { setError(res.error.message || String(res.error)); return }
    onClose()
  }

  const activeGoals = (goals || []).filter((g) => !['completed', 'cancelled', 'failed'].includes(g.status))

  return (
    <Sheet open={open} onClose={onClose} title="New task" subtitle="Capture it, give it a day, ship it.">
      <form className="td" onSubmit={submit}>
        <textarea className="td-title" rows={1} value={form.title} onChange={set('title')} placeholder="What needs doing?" required autoFocus aria-label="Title" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e) }} />
        <div className="td-field">
          <label className="td-label">Priority</label>
          <div className="td-seg">
            {['EASY', 'MEDIUM', 'HARD', 'EXTREME', 'NONE'].map((k) => (
              <button key={k} type="button" className={form.difficulty === k ? 'is-on' : ''} style={{ '--pr': PRIORITIES[k].color }} onClick={() => set('difficulty')(k)}><Flag size={11} /> {PRIORITIES[k].label}</button>
            ))}
          </div>
        </div>
        <div className="td-grid">
          {form.recurrence_type !== 'weekly' && (
            <div className="td-field">
              <label className="td-label" htmlFor="nt-due">Due</label>
              <input id="nt-due" type="date" className="input" value={form.due_date} onChange={set('due_date')} />
            </div>
          )}
          <div className="td-field">
            <label className="td-label" htmlFor="nt-rec"><Repeat size={11} /> Repeat</label>
            <select id="nt-rec" className="select" value={form.recurrence_type} onChange={set('recurrence_type')}>
              <option value="">One time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
        {form.recurrence_type === 'weekly' && (
          <div className="td-field">
            <label className="td-label">Repeat on</label>
            <div className="td-row">
              {DAYS.map((d) => (
                <button key={d.v} type="button" className={`td-pill ${form.weeklyDays.includes(d.v) ? 'is-on' : ''}`} onClick={() => setForm((f) => ({ ...f, weeklyDays: f.weeklyDays.includes(d.v) ? f.weeklyDays.filter((x) => x !== d.v) : [...f.weeklyDays, d.v] }))}>{d.l}</button>
              ))}
            </div>
            <label className="td-label td-mt" htmlFor="nt-dur">Days to complete</label>
            <input id="nt-dur" type="number" min="0" max="14" className="input" value={form.weeklyDuration} onChange={(e) => setForm((f) => ({ ...f, weeklyDuration: parseInt(e.target.value, 10) || 0 }))} />
          </div>
        )}
        <div className="td-grid">
          <div className="td-field">
            <label className="td-label" htmlFor="nt-cat">Category</label>
            <select id="nt-cat" className="select" value={form.category} onChange={set('category')}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {form.category === 'other' && <input className="input td-mt" placeholder="Custom category" value={form.customCategory} onChange={set('customCategory')} />}
          </div>
          <div className="td-field">
            <label className="td-label" htmlFor="nt-goal">Mission</label>
            <select id="nt-goal" className="select" value={form.goal_id} onChange={set('goal_id')}>
              <option value="">No mission</option>
              {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
        </div>
        {schemaReady !== false && (
          <div className="td-field">
            <label className="td-label" htmlFor="nt-est">Estimate (min)</label>
            <input id="nt-est" type="number" min="0" step="5" inputMode="numeric" className="input" value={form.estimate_minutes} onChange={set('estimate_minutes')} placeholder="Optional, e.g. 45" />
          </div>
        )}
        <div className="td-field">
          <label className="td-label" htmlFor="nt-desc">Notes</label>
          <textarea id="nt-desc" className="textarea" rows={3} value={form.description} onChange={set('description')} placeholder="Optional details" />
        </div>
        {error && <p className="tm-warn"><AlertTriangle size={13} /> {error}</p>}
        <button type="submit" className="btn btn-primary td-submit" disabled={busy || !form.title.trim()}>{busy ? 'Adding…' : 'Add task'}</button>
      </form>
    </Sheet>
  )
}
