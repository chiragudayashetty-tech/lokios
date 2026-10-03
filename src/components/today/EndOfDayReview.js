'use client'

import { useState } from 'react'
import { Moon, Check, Zap } from 'lucide-react'
import SchemaHint from '@/components/ui/SchemaHint'
import { REVIEW_XP } from '@/lib/hooks/useDailyReview'

const MOODS = ['😞', '😕', '😐', '🙂', '😄']
const MOOD_LABELS = ['Rough', 'Meh', 'Okay', 'Good', 'Great']

function Scale({ label, value, onChange, render, labels }) {
  return (
    <div className="eod-scale" role="radiogroup" aria-label={label}>
      <span className="eod-scale-label">{label}</span>
      <div className="eod-scale-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${label} ${n}${labels ? ` — ${labels[n - 1]}` : ''}`} className={value === n ? 'is-on' : ''} onClick={() => onChange(n)}>
            {render(n)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Three taps: mood, energy, today's win (+ optional intention). Editable the same day. */
export default function EndOfDayReview({ review, missing, onSave }) {
  const [mood, setMood] = useState(review?.mood || null)
  const [energy, setEnergy] = useState(review?.energy || null)
  const [win, setWin] = useState(review?.win || '')
  const [intention, setIntention] = useState(review?.intention || '')
  const [editing, setEditing] = useState(!review)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (missing) return <section className="eod"><div className="eod-head"><Moon size={16} /> End-of-day review</div><SchemaHint feature="The daily review" /></section>

  if (review && !editing) {
    return (
      <section className="eod eod--done">
        <div className="eod-head"><Moon size={16} /> Day reviewed <Check size={14} className="eod-ok" /></div>
        <p className="eod-summary">
          {review.mood ? MOODS[review.mood - 1] : ''} mood {review.mood || '–'}/5 · energy {review.energy || '–'}/5
          {review.win ? <> · <b>Win:</b> {review.win}</> : null}
        </p>
        {review.intention && <p className="eod-summary"><b>Tomorrow:</b> {review.intention}</p>}
        <button type="button" className="td-link" onClick={() => setEditing(true)}>Edit review</button>
      </section>
    )
  }

  const save = async () => {
    if (!mood || !energy || saving) return
    setSaving(true)
    setError(null)
    const res = await onSave({ mood, energy, win: win.trim() || null, intention: intention.trim() || null })
    setSaving(false)
    if (res?.error) setError(res.error.message || 'Could not save')
    else setEditing(false)
  }

  return (
    <section className="eod" id="eod">
      <div className="eod-head"><Moon size={16} /> End-of-day review {!review && <span className="eod-xp">+{REVIEW_XP} XP</span>}</div>
      <Scale label="Mood" value={mood} onChange={setMood} labels={MOOD_LABELS} render={(n) => <span className="eod-emoji">{MOODS[n - 1]}</span>} />
      <Scale label="Energy" value={energy} onChange={setEnergy} render={(n) => <span className="eod-bolts">{Array.from({ length: n }, (_, i) => <Zap key={i} size={10} />)}</span>} />
      <label className="eod-field">
        <span className="eod-scale-label">Today&apos;s win</span>
        <input className="input" value={win} onChange={(e) => setWin(e.target.value)} placeholder="One line — what went right?" maxLength={160} />
      </label>
      <label className="eod-field">
        <span className="eod-scale-label">Tomorrow&apos;s intention <em>(optional)</em></span>
        <input className="input" value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="The one thing that matters tomorrow" maxLength={160} />
      </label>
      {error && <p className="tm-warn">{error}</p>}
      <button type="button" className="btn btn-primary eod-save" disabled={!mood || !energy || saving} onClick={save} data-celebrate>
        {saving ? 'Saving…' : review ? 'Update review' : 'Save review'}
      </button>
    </section>
  )
}
