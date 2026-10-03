'use client'

import { useMemo, useState } from 'react'
import { BedDouble, Sunrise, Moon, Star } from 'lucide-react'
import Ring from '@/components/ui/Ring'
import SchemaHint from '@/components/ui/SchemaHint'
import { sleepScore, sleepWindow, hhmmOf, formatDuration, scoreTone } from '@/lib/utils/sleep'
import { SLEEP_LOG_XP } from '@/lib/hooks/useSleep'

/** Morning "How did you sleep?" card (#24). One log per wake-up date; editable. */
export default function SleepCard({ today, logs, missing, onSave, compact = false }) {
  const todays = logs.find((l) => l.date === today)
  const history = useMemo(() => logs.filter((l) => l.date < today), [logs, today])
  const last = history[0]
  const [open, setOpen] = useState(!compact && !todays)
  const [bed, setBed] = useState(todays ? hhmmOf(todays.bedtime) : last ? hhmmOf(last.bedtime) : '23:00')
  const [wake, setWake] = useState(todays ? hhmmOf(todays.wake_time) : last ? hhmmOf(last.wake_time) : '07:00')
  const [quality, setQuality] = useState(todays?.quality || 3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const win = useMemo(() => sleepWindow(today, bed, wake), [today, bed, wake])
  const preview = useMemo(() => (win ? sleepScore({ ...win, quality }, history) : { minutes: 0, score: 0 }), [win, quality, history])
  const tone = scoreTone(todays && !open ? todays.score : preview.score)

  if (missing) return <section className="slp"><div className="slp-head"><BedDouble size={16} /> Sleep</div><SchemaHint feature="Sleep logging" /></section>

  if (!open) {
    return (
      <section className={`slp slp--compact ${todays ? 'is-logged' : ''}`}>
        {todays ? (
          <>
            <Ring value={todays.score / 100} size={42} stroke={5} color={tone.color}><b className="slp-ring-num">{todays.score}</b></Ring>
            <div className="slp-compact-text">
              <span className="slp-compact-title">Slept {formatDuration(todays.duration_minutes)}</span>
              <span className="slp-compact-sub">{tone.label} · {hhmmOf(todays.bedtime)} → {hhmmOf(todays.wake_time)}</span>
            </div>
            <button type="button" className="td-link" onClick={() => setOpen(true)}>Edit</button>
          </>
        ) : (
          <>
            <span className="slp-icon"><BedDouble size={18} /></span>
            <div className="slp-compact-text">
              <span className="slp-compact-title">How did you sleep?</span>
              <span className="slp-compact-sub">Log last night · +{SLEEP_LOG_XP} XP</span>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>Log</button>
          </>
        )}
      </section>
    )
  }

  const save = async () => {
    if (!win) return
    setSaving(true)
    setError(null)
    const res = await onSave({ date: today, ...win, quality })
    setSaving(false)
    if (res?.error) setError(res.error.message || 'Could not save')
    else setOpen(false)
  }

  return (
    <section className="slp">
      <div className="slp-head"><BedDouble size={16} /> How did you sleep? {!todays && <span className="eod-xp">+{SLEEP_LOG_XP} XP</span>}</div>
      <div className="slp-grid">
        <div className="slp-inputs">
          <label className="slp-time"><span><Moon size={13} /> Bedtime</span><input type="time" className="input" value={bed} onChange={(e) => setBed(e.target.value)} /></label>
          <label className="slp-time"><span><Sunrise size={13} /> Woke up</span><input type="time" className="input" value={wake} onChange={(e) => setWake(e.target.value)} /></label>
        </div>
        <div className="slp-score">
          <Ring value={preview.score / 100} size={74} stroke={7} color={tone.color}>
            <b className="slp-score-num">{preview.score}</b>
            <span className="slp-score-lbl">score</span>
          </Ring>
          <span className="slp-score-sub">{win ? `${formatDuration(preview.minutes)} · ${tone.label}` : 'Set both times'}</span>
        </div>
      </div>
      <div className="eod-scale" role="radiogroup" aria-label="Sleep quality">
        <span className="eod-scale-label">Quality</span>
        <div className="eod-scale-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={quality === n} aria-label={`Quality ${n}`} className={quality >= n ? 'is-on is-star' : 'is-star'} onClick={() => setQuality(n)}><Star size={16} /></button>
          ))}
        </div>
      </div>
      {error && <p className="tm-warn">{error}</p>}
      <div className="slp-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !win}>{saving ? 'Saving…' : todays ? 'Update' : 'Save sleep'}</button>
        {(todays || compact) && <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>}
      </div>
    </section>
  )
}
