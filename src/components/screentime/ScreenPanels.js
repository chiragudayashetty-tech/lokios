'use client'

import { useState } from 'react'
import { Check, AlertTriangle, Flame, Pencil, Zap } from 'lucide-react'
import Ring from '@/components/ui/Ring'
import { saveSettings } from '@/lib/settings'
import { calculateScreenTimeXPPure, screenBreakdown } from '@/lib/utils/screenTimeScore'
import { SCREEN_CATEGORIES, UNCATEGORIZED, CAP_LABELS, DEFAULT_CAPS, categoryMinutes, capMinutes, capStreak, disciplineScore } from '@/lib/utils/screenIntel'

const fmtM = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${Math.round(m % 60)}m` : ''}` : `${Math.round(m)}m`)
const fmt = (v, unit) => (unit === 'm' ? `${Math.round(v)}m` : `${+v.toFixed(1)}h`)

/** Today: four rings against the XP targets, plus the XP impact of the day. */
export function TodayRings({ log, dateLabel, isToday = true }) {
  const { xpAmount, finalReason } = calculateScreenTimeXPPure(log)
  const score = disciplineScore(log)
  return (
    <section className="pf-card si-today">
      <div className="pf-card-head">
        {isToday ? 'Today' : 'Last logged'} · {dateLabel}
        {score != null && <span className="arena-hint ml-auto">Discipline {score}/100</span>}
      </div>
      {!log ? (
        <p className="ms-muted">Nothing logged yet today. Log it below.</p>
      ) : (
        <>
          <div className="si-rings">
            {(() => {
              const b = screenBreakdown(log)
              const items = [
                { id: 'prod', label: 'Productive', v: b.productive, ok: b.productive > 0, ratio: Math.min(1, b.productive / 240), state: b.productive > 0 ? 'rewarded' : 'none yet' },
                ...b.leisure.map((l) => ({ id: l.id, label: l.label, v: l.used, ok: l.over === 0, ratio: l.limit ? l.used / l.limit : 0, state: l.over ? `${Math.round(l.over)}m over ${l.limit}m` : `within ${l.limit}m` })),
              ]
              return items.map((t) => (
                <div key={t.id} className="si-ring">
                  <Ring value={t.ratio} size={74} stroke={7} color={t.ok ? 'var(--success)' : 'var(--danger)'} label={`${t.label} ${fmtM(t.v)}, ${t.state}`}>
                    <b>{fmtM(t.v)}</b>
                  </Ring>
                  <span className="si-ring-label">{t.label}</span>
                  <span className={`si-ring-state ${t.ok ? 'is-ok' : 'is-bad'}`}>{t.ok ? <Check size={11} /> : <AlertTriangle size={11} />}{t.state}</span>
                </div>
              ))
            })()}
          </div>
          {!isToday && <p className="ms-muted">Today isn&apos;t logged yet — these are your latest numbers.</p>}
          <div className={`si-xp ${xpAmount >= 0 ? 'is-pos' : 'is-neg'}`}>
            <Zap size={13} /> <b>{xpAmount > 0 ? '+' : ''}{xpAmount} XP</b> <span>{finalReason}</span>
          </div>
        </>
      )}
    </section>
  )
}

/** Average minutes per category over the last `days` logged days. */
export function CategoryBreakdown({ logs, days = 7 }) {
  const recent = logs.slice(0, days).filter((l) => l.categories && Object.keys(l.categories).length)
  if (!recent.length) {
    return (
      <section className="pf-card">
        <div className="pf-card-head">Where the time goes</div>
        <p className="ms-muted">No category split yet. Add minutes per category when you log a day.</p>
      </section>
    )
  }
  const sums = Object.fromEntries([...SCREEN_CATEGORIES, UNCATEGORIZED].map((c) => [c.id, 0]))
  for (const l of recent) { const m = categoryMinutes(l); for (const k in sums) sums[k] += m[k] }
  const rows = [...SCREEN_CATEGORIES, UNCATEGORIZED]
    .map((c) => ({ ...c, avg: Math.round(sums[c.id] / recent.length) }))
    .filter((c) => c.avg > 0)
    .sort((a, b) => b.avg - a.avg)
  const max = Math.max(...rows.map((r) => r.avg), 1)
  const total = rows.reduce((s, r) => s + r.avg, 0)
  return (
    <section className="pf-card">
      <div className="pf-card-head">Where the time goes <span className="arena-hint ml-auto">avg / day · last {recent.length} logged</span></div>
      <ul className="si-cats">
        {rows.map((r) => (
          <li key={r.id}>
            <span className="si-cat-name"><i style={{ background: r.color }} />{r.label}</span>
            <span className="si-cat-bar"><span style={{ width: `${(r.avg / max) * 100}%`, background: r.color }} /></span>
            <span className="si-cat-val">{r.avg >= 60 ? `${Math.floor(r.avg / 60)}h ${r.avg % 60}m` : `${r.avg}m`}<small>{Math.round((r.avg / total) * 100)}%</small></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CapEditor({ caps, userId, onDone }) {
  const [draft, setDraft] = useState(() => ({ ...caps }))
  const save = async (e) => {
    e.preventDefault()
    const next = {}
    for (const [k, v] of Object.entries(draft)) { const n = parseInt(v, 10); if (n > 0) next[k] = n }
    await saveSettings({ screenCaps: next }, userId)
    onDone()
  }
  return (
    <form className="si-cap-edit" onSubmit={save}>
      {Object.keys(CAP_LABELS).map((k) => (
        <label key={k}>
          <span>{CAP_LABELS[k]}</span>
          <input className="input" type="number" min="0" step="5" inputMode="numeric" placeholder="off" value={draft[k] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
          <small>min</small>
        </label>
      ))}
      <p className="ms-muted">Leave empty to turn a cap off.</p>
      <div className="si-cap-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm">Save caps</button>
      </div>
    </form>
  )
}

/** Per-category daily caps (settings.screenCaps) with "kept the cap" streaks. */
export function CapsCard({ logs, caps = DEFAULT_CAPS, userId, today }) {
  const [editing, setEditing] = useState(false)
  const todayLog = logs.find((l) => l.date === today)
  const entries = Object.entries(caps || {}).filter(([k, v]) => CAP_LABELS[k] && v > 0)
  return (
    <section className="pf-card">
      <div className="pf-card-head">Daily caps
        {!editing && <button type="button" className="tl-icon ml-auto" onClick={() => setEditing(true)} aria-label="Edit caps"><Pencil size={13} /></button>}
      </div>
      {editing ? <CapEditor caps={caps} userId={userId} onDone={() => setEditing(false)} /> : entries.length === 0 ? (
        <p className="ms-muted">No caps set. Add one to start a streak.</p>
      ) : (
        <ul className="si-caps">
          {entries.map(([id, cap]) => {
            const used = capMinutes(todayLog, id)
            const over = used != null && used > cap
            const streak = capStreak(logs, cap, (l) => capMinutes(l, id), today)
            const color = id === 'doom' ? '#d95926' : SCREEN_CATEGORIES.find((c) => c.id === id)?.color
            return (
              <li key={id}>
                <span className="si-cat-name"><i style={{ background: color }} />{CAP_LABELS[id]}</span>
                <span className="si-cap-meter" aria-hidden><span className={over ? 'is-over' : ''} style={{ width: `${Math.min(100, ((used || 0) / cap) * 100)}%` }} /></span>
                <span className={`si-cap-val ${over ? 'is-bad' : ''}`}>{used == null ? '—' : `${used}m`} / {cap}m</span>
                <span className={`si-streak ${streak ? 'is-on' : ''}`} title="Days in a row under the cap"><Flame size={12} /> {streak}d</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
