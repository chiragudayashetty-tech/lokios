'use client'

import { useState } from 'react'
import { Trash2, Check, RotateCw } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import { CATEGORIES, toLocalInput } from '@/lib/utils/calendarBlocks'

/** Create / edit an event or task block. draft = { start, end, task_id?, ... } for new ones. */
export default function EventSheet({ open, event, draft, tasks, blockColumns, onClose, onSave, onDelete, onCompleteTask, onRoll }) {
  const base = event || draft || {}
  const [form, setForm] = useState(() => ({
    title: base.title || '',
    category: base.category || (base.task_id ? 'work' : 'other'),
    start: toLocalInput(base.start_time || base.start || new Date()),
    end: toLocalInput(base.end_time || base.end || new Date(Date.now() + 3600000)),
    description: base.description || '',
    location: base.location || '',
    task_id: base.task_id || '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))
  const task = form.task_id ? tasks.find((t) => t.id === form.task_id) : null
  const openTasks = tasks.filter((t) => !['completed', 'cancelled', 'failed'].includes(t.status) || t.id === form.task_id)

  const submit = async (e) => {
    e.preventDefault()
    const title = form.title.trim() || task?.title || ''
    if (!title || busy) return
    if (new Date(form.end) <= new Date(form.start)) { setError('End must be after start.'); return }
    setBusy(true)
    const payload = { title, start_time: new Date(form.start).toISOString(), end_time: new Date(form.end).toISOString(), description: form.description || null, location: form.location || null }
    if (blockColumns !== false) { payload.category = form.category; payload.task_id = form.task_id || null }
    const res = await onSave(payload)
    setBusy(false)
    if (res?.error) { setError(res.error.message || 'Could not save'); return }
    onClose()
  }

  const taskDone = task?.status === 'completed'
  return (
    <Sheet open={open} onClose={onClose} title={event ? (event.task_id ? 'Time block' : 'Event') : 'New block'}>
      <form className="td" onSubmit={submit}>
        {blockColumns !== false && (
          <div className="td-field">
            <label className="td-label" htmlFor="ev-task">Task</label>
            <select id="ev-task" className="select" value={form.task_id} onChange={(e) => { const t = tasks.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, task_id: e.target.value, title: t && !f.title ? t.title : f.title })) }}>
              <option value="">No task — plain event</option>
              {openTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}
        <textarea className="td-title" rows={1} value={form.title} onChange={set('title')} placeholder={task?.title || 'Event title'} aria-label="Title" />
        {blockColumns !== false && (
          <div className="td-field">
            <span className="td-label">Category</span>
            <div className="td-row">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={`td-pill ev-cat ${form.category === c.id ? 'is-on' : ''}`} style={{ '--ec': c.color }} onClick={() => set('category')(c.id)}><i /> {c.label}</button>
              ))}
            </div>
          </div>
        )}
        <div className="td-grid">
          <div className="td-field"><label className="td-label" htmlFor="ev-s">Start</label><input id="ev-s" type="datetime-local" className="input" value={form.start} onChange={set('start')} /></div>
          <div className="td-field"><label className="td-label" htmlFor="ev-e">End</label><input id="ev-e" type="datetime-local" className="input" value={form.end} onChange={set('end')} /></div>
        </div>
        <div className="td-field"><label className="td-label" htmlFor="ev-loc">Location</label><input id="ev-loc" className="input" value={form.location} onChange={set('location')} placeholder="Optional" /></div>
        <div className="td-field"><label className="td-label" htmlFor="ev-d">Notes</label><textarea id="ev-d" className="textarea" rows={2} value={form.description} onChange={set('description')} /></div>
        {error && <p className="tm-warn">{error}</p>}
        <button type="submit" className="btn btn-primary td-submit" disabled={busy}>{busy ? 'Saving…' : event ? 'Save' : 'Add to calendar'}</button>
        {event && (
          <div className="td-danger-row">
            {event.task_id && task && !taskDone && <button type="button" className="td-link" onClick={() => onCompleteTask(event, task)} data-celebrate><Check size={14} /> Complete task</button>}
            {event.task_id && !taskDone && new Date(event.end_time || event.start_time) < new Date() && <button type="button" className="td-link" onClick={() => onRoll(event)}><RotateCw size={14} /> Roll to next free slot</button>}
            <button type="button" className="td-link is-danger" onClick={() => onDelete(event)}><Trash2 size={14} /> Delete</button>
          </div>
        )}
      </form>
    </Sheet>
  )
}
