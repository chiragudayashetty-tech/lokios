'use client'

import { useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { GOAL_TYPES, COVER_COLORS, COVER_EMOJIS, deadlineOf } from '@/lib/utils/missions'
import { parseTaskNotes } from '@/lib/utils/dates'

const CATEGORIES = [
  { id: 'business', label: 'Beyond Tattva (business)' },
  { id: 'personal', label: 'Personal mission' },
  { id: 'learning', label: 'Learning / skills' },
  { id: 'health', label: 'Fitness / health' },
  { id: 'other', label: 'Other' },
]
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXTREME']

const fromGoal = (g) => ({
  title: g?.title || '',
  type: g?.type || 'side_quest',
  difficulty: g?.difficulty || 'HARD',
  deadline: deadlineOf(g) || '',
  category: g?.category || 'personal',
  description: parseTaskNotes(g?.description || '').cleanDesc,
  why: g?.why || '',
  cover: g?.cover || '',
})

/** Create / edit a mission. `extras` = whether the why / cover columns exist yet. */
export default function MissionForm({ open, goal, extras = true, onClose, onSave }) {
  const [form, setForm] = useState(() => fromGoal(goal))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || busy) return
    if (form.type === 'long_term' && !form.deadline) { setError('Long-range missions need a deadline.'); return }
    setBusy(true)
    const payload = {
      title: form.title.trim(),
      type: form.type,
      difficulty: form.difficulty,
      deadline: form.deadline || null,
      category: form.category,
      description: form.description.trim() || null,
    }
    // Keep completion / failure notes that live inside the stored description
    if (goal?.description) {
      const { completionNote, failureNote } = parseTaskNotes(goal.description)
      let d = payload.description || ''
      if (completionNote) d += `\n\n[Completion Note]\n${completionNote}`
      if (failureNote) d += `\n\n[Failure Note]\n${failureNote}`
      payload.description = d.trim() || null
    }
    if (extras) { payload.why = form.why.trim() || null; payload.cover = form.cover || null }
    const res = await onSave(payload)
    setBusy(false)
    if (res?.error) { setError(res.error.message || String(res.error)); return }
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={goal ? 'Edit mission' : 'New mission'} subtitle={goal ? null : 'A clear target, a deadline and a reason.'}>
      <form className="td" onSubmit={submit}>
        <textarea className="td-title" rows={1} value={form.title} onChange={set('title')} placeholder="e.g. Pilot Beyond Tattva in 3 schools" required autoFocus aria-label="Mission title" />
        <div className="td-field">
          <span className="td-label">Type</span>
          <div className="td-seg ms-seg">
            {Object.entries(GOAL_TYPES).map(([id, t]) => (
              <button key={id} type="button" className={form.type === id ? 'is-on' : ''} style={{ '--pr': 'var(--accent-primary)' }} onClick={() => set('type')(id)}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="td-grid">
          <div className="td-field">
            <label className="td-label" htmlFor="mf-dl">Deadline</label>
            <input id="mf-dl" type="date" className="input" value={form.deadline} onChange={set('deadline')} required={form.type === 'long_term'} />
          </div>
          <div className="td-field">
            <label className="td-label" htmlFor="mf-diff">Difficulty</label>
            <select id="mf-diff" className="select" value={form.difficulty} onChange={set('difficulty')}>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>
        <div className="td-field">
          <label className="td-label" htmlFor="mf-cat">Category</label>
          <select id="mf-cat" className="select" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            {!CATEGORIES.some((c) => c.id === form.category) && <option value={form.category}>{form.category}</option>}
          </select>
        </div>
        {extras && (
          <>
            <div className="td-field">
              <label className="td-label" htmlFor="mf-why">Why it matters</label>
              <textarea id="mf-why" className="textarea" rows={2} value={form.why} onChange={set('why')} placeholder="The reason you'll read on a bad day" />
            </div>
            <div className="td-field">
              <span className="td-label">Cover</span>
              <div className="ms-cover-pick">
                <button type="button" className={`ms-cover-opt ${!form.cover ? 'is-on' : ''}`} onClick={() => set('cover')('')} aria-label="Default cover">–</button>
                {COVER_COLORS.map((c) => (
                  <button key={c} type="button" className={`ms-cover-opt is-${c} ${form.cover === c ? 'is-on' : ''}`} onClick={() => set('cover')(c)} aria-label={`${c} cover`} />
                ))}
                {COVER_EMOJIS.map((e) => (
                  <button key={e} type="button" className={`ms-cover-opt is-emoji ${form.cover === e ? 'is-on' : ''}`} onClick={() => set('cover')(e)} aria-label={`Emoji ${e}`}>{e}</button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="td-field">
          <label className="td-label" htmlFor="mf-desc">Details</label>
          <textarea id="mf-desc" className="textarea" rows={3} value={form.description} onChange={set('description')} placeholder="Scope, definition of done…" />
        </div>
        {error && <p className="tm-warn">{error}</p>}
        <button type="submit" className="btn btn-primary td-submit" disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : goal ? 'Save mission' : 'Create mission'}</button>
      </form>
    </Sheet>
  )
}
