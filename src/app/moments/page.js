'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, Download, Camera, Trash2, Pencil, Check, Film, Flame, Video } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import CaptureSheet from '@/components/moments/CaptureSheet'
import FilmPlayer from '@/components/moments/FilmPlayer'
import { useOSSlice } from '@/lib/context/OSContext'
import { getLocalDateStr } from '@/lib/utils/dates'
import { listMoments, deleteMoment, updateCaption } from '@/lib/moments/moments'
import { exportFilm } from '@/lib/moments/film'

const monthStart = (y, m) => getLocalDateStr(new Date(y, m, 1))
const monthEnd = (y, m) => getLocalDateStr(new Date(y, m + 1, 0))
const monthLabel = (y, m) => new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** /moments — one photo or ≤5 s video a day, played back as a monthly film. */
export default function MomentsPage() {
  const { user } = useOSSlice('auth')
  const today = getLocalDateStr()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [rows, setRows] = useState([])
  const [todayRow, setTodayRow] = useState(null)
  const [streak, setStreak] = useState(0)
  const [state, setState] = useState({ loading: true, error: null })
  const [capture, setCapture] = useState(null) // date being captured
  const [player, setPlayer] = useState(null) // { rows, index, title }
  const [exporting, setExporting] = useState(null)
  const [editCap, setEditCap] = useState(null)

  const from = monthStart(ym.y, ym.m)
  const to = monthEnd(ym.y, ym.m)
  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()

  const load = useCallback(async () => {
    if (!user?.id) return
    const [{ rows: month, error }, recent] = await Promise.all([
      listMoments(user.id, from, to),
      listMoments(user.id, addDays(today, -400), today),
    ])
    setRows(month)
    const dates = new Set(recent.rows.map((r) => r.date))
    setTodayRow(recent.rows.find((r) => r.date === today) || null)
    let s = 0
    for (let d = dates.has(today) ? today : addDays(today, -1); dates.has(d); d = addDays(d, -1)) s++
    setStreak(s)
    setState({ loading: false, error })
  }, [user?.id, from, to, today])

  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect

  const days = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1)
    const lead = (first.getDay() + 6) % 7 // Monday first
    const n = new Date(ym.y, ym.m + 1, 0).getDate()
    const byDate = new Map(rows.map((r) => [r.date, r]))
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, k) => { const ds = getLocalDateStr(new Date(ym.y, ym.m, k + 1)); return { ds, day: k + 1, row: byDate.get(ds) || null } })]
  }, [ym, rows])

  const playable = rows.filter((r) => r.url)
  const title = monthLabel(ym.y, ym.m)
  const elapsed = isThisMonth ? now.getDate() : new Date(ym.y, ym.m + 1, 0).getDate()
  const shift = (d) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() } })

  const doExport = async () => {
    if (!playable.length) return
    setExporting(0)
    try {
      const { blob, ext } = await exportFilm(playable, { title, sub: `${playable.length} day${playable.length === 1 ? '' : 's'}`, onProgress: (p) => setExporting(p) })
      download(blob, `moments-${from.slice(0, 7)}.${ext}`)
    } catch (e) {
      alert(e?.message || 'Export failed')
    } finally { setExporting(null) }
  }

  const removeToday = async () => {
    if (!todayRow || !confirm('Delete today’s moment?')) return
    await deleteMoment(user.id, todayRow)
    load()
  }

  return (
    <AppShell>
      <div className="page-container mo-page">
        <header className="mo-head">
          <h1><Film size={22} /> Moments</h1>
          <p>One photo or up to 5 seconds a day. At the end of the month it plays as a film.</p>
        </header>

        {state.error && /daily_moments|relation|schema/i.test(state.error) && (
          <p className="mo-err">Moments isn&apos;t set up in the database yet — run <code>supabase/migrations/20261010_moments.sql</code> in the Supabase SQL editor.</p>
        )}

        {/* Today */}
        <section className="mo-today">
          {todayRow ? (
            <>
              <button type="button" className="mo-today-media" onClick={() => setPlayer({ rows: [todayRow], index: 0, title: 'Today' })} aria-label="Play today’s moment">
                {todayRow.thumb ? <img src={todayRow.thumb} alt="" /> : <span />}
                {todayRow.kind === 'video' && <i className="mo-badge"><Video size={11} /> {Math.round((todayRow.duration_ms || 0) / 1000)}s</i>}
              </button>
              <div className="mo-today-body">
                <b>Today is captured</b>
                {editCap != null ? (
                  <form className="mo-capedit" onSubmit={async (e) => { e.preventDefault(); await updateCaption(user.id, today, editCap); setEditCap(null); load() }}>
                    <input className="input" autoFocus maxLength={80} value={editCap} onChange={(e) => setEditCap(e.target.value)} placeholder="Caption" />
                    <button type="submit" className="tl-icon" aria-label="Save caption"><Check size={14} /></button>
                  </form>
                ) : (
                  <span className="mo-cap">{todayRow.caption || 'No caption'} <button type="button" className="tl-icon" onClick={() => setEditCap(todayRow.caption || '')} aria-label="Edit caption"><Pencil size={12} /></button></span>
                )}
                <div className="mo-today-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCapture(today)}><Camera size={14} /> Replace</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={removeToday}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            </>
          ) : (
            <button type="button" className="mo-cta" onClick={() => setCapture(today)} disabled={!user}>
              <Camera size={26} />
              <b>Capture today</b>
              <span>Photo or 5-second video</span>
            </button>
          )}
          <div className="mo-stats">
            <div><Flame size={14} /><b>{streak}</b><span>day streak</span></div>
            <div><Film size={14} /><b>{rows.length}/{elapsed}</b><span>days this month</span></div>
          </div>
        </section>

        {/* Month */}
        <section className="mo-month">
          <div className="mo-month-head">
            <button type="button" className="tl-icon" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <b>{title}</b>
            <button type="button" className="tl-icon" onClick={() => shift(1)} disabled={isThisMonth} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <div className="mo-film-actions">
            <button type="button" className="btn btn-primary" disabled={!playable.length} onClick={() => setPlayer({ rows: playable, index: 0, title })}><Play size={15} /> Play film</button>
            <button type="button" className="btn btn-secondary" disabled={!playable.length || exporting != null} onClick={doExport}>
              <Download size={15} /> {exporting != null ? `Rendering ${Math.round(exporting * 100)}%` : 'Download video'}
            </button>
          </div>
          {exporting != null && <p className="mo-hint">Keep this tab open — the film renders in real time (about {Math.round(playable.reduce((s, r) => s + (r.kind === 'video' ? (r.duration_ms || 3000) : 2000), 0) / 1000) + 3}s).</p>}

          <div className="mo-grid" role="grid" aria-label={`Moments in ${title}`}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => <span key={k} className="mo-dow">{d}</span>)}
            {days.map((c, k) => c == null ? <span key={k} /> : (
              <button
                key={c.ds} type="button"
                className={`mo-cell ${c.row ? 'has' : ''} ${c.ds === today ? 'is-today' : ''} ${c.ds > today ? 'is-future' : ''}`}
                disabled={c.ds > today}
                onClick={() => (c.row ? setPlayer({ rows: playable, index: Math.max(0, playable.findIndex((r) => r.date === c.ds)), title }) : setCapture(c.ds))}
                aria-label={c.row ? `Play ${c.ds}` : `Add a moment for ${c.ds}`}
              >
                {c.row?.thumb && <img src={c.row.thumb} alt="" loading="lazy" />}
                {c.row?.kind === 'video' && <i className="mo-vdot" />}
                <em>{c.day}</em>
              </button>
            ))}
          </div>
          {state.loading && <p className="mo-hint">Loading…</p>}
          {!state.loading && !rows.length && <p className="mo-hint">Nothing captured in {title}. Tap a past day to add one.</p>}
        </section>
      </div>

      {capture && (
        <CaptureSheet open userId={user?.id} date={capture} existing={rows.find((r) => r.date === capture) || (capture === today ? todayRow : null)} onClose={() => setCapture(null)} onSaved={() => load()} />
      )}
      {player && <FilmPlayer rows={player.rows} startIndex={player.index} title={player.title} onClose={() => setPlayer(null)} />}
    </AppShell>
  )
}
