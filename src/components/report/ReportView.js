'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import { ArrowLeft, Printer, Share2, Sun, Moon, ArrowUpRight, ArrowDownRight, Minus, Check } from 'lucide-react'
import { useOSSlice } from '@/lib/context/OSContext'
import { useIsClient } from '@/lib/hooks/useMediaQuery'
import { fetchReport, parseReportParams } from '@/lib/report/reportData'
import { SCREEN_CATEGORIES, UNCATEGORIZED } from '@/lib/utils/screenIntel'
import { formatMoney } from '@/lib/utils/money'
import { RARITY } from '@/lib/achievements'

// Fixed-size charts (they print the same as they render); CSS scales them down on narrow screens.
const W = 680
const BLUE = '#3987e5'
const fmtH = (h) => (h == null ? '—' : `${(+h).toFixed(1)}h`)
const fmtMin = (m) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`)
const fmtClock = (mins) => (mins == null ? '—' : `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)
const fmtDate = (ds, o = { month: 'short', day: 'numeric' }) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', o)

function Delta({ cur, prev, unit = '%', invert = false }) {
  if (prev == null || cur == null) return null
  if (!prev) return cur ? <span className="rp-delta">new this period</span> : null
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100)
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  const good = invert ? pct < 0 : pct > 0
  return <span className={`rp-delta ${pct === 0 ? '' : good ? 'is-good' : 'is-bad'}`}><Icon size={11} /> {Math.abs(pct)}{unit} vs previous</span>
}

function Kpi({ label, value, sub, children }) {
  return <div className="rp-kpi"><span className="rp-kpi-label">{label}</span><b className="rp-kpi-value">{value}</b>{sub && <span className="rp-kpi-sub">{sub}</span>}{children}</div>
}

function Section({ title, children, note }) {
  return <section className="rp-section"><h2 className="rp-h2">{title}{note && <span>{note}</span>}</h2>{children}</section>
}

function Chart({ children, label }) {
  return <div className="rp-chart" role="img" aria-label={label}>{children}</div>
}

function useChartColors(theme) {
  return theme === 'dark'
    ? { grid: 'rgba(255,255,255,0.08)', axis: '#9a99a8', ref: 'rgba(255,255,255,0.35)', gap: '#0e0d18' }
    : { grid: '#ececf0', axis: '#6b6a75', ref: '#a3a2ad', gap: '#ffffff' }
}

/** /report (#42): A4 print-ready summary of a period. `?print=1` opens the print dialog once rendered. */
export default function ReportView({ search }) {
  const params = useMemo(() => parseReportParams(search), [search])
  const { from, to, kind, theme, print } = params
  const auth = useOSSlice('auth')
  const isClient = useIsClient()
  // Server HTML has no session; resolve auth-dependent UI after mount to keep hydration stable
  const user = isClient ? auth.user : null
  const authLoading = !isClient || auth.loading
  const [state, setState] = useState({ key: null, data: null, error: null })
  const [shared, setShared] = useState(false)
  const key = `${user?.id}|${from}|${to}`
  const c = useChartColors(theme)
  
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetchReport(user.id, { from, to })
      .then((data) => { if (!cancelled) setState({ key: `${user.id}|${from}|${to}`, data, error: null }) })
      .catch((e) => { if (!cancelled) setState({ key: `${user.id}|${from}|${to}`, data: null, error: e?.message || String(e) }) })
    return () => { cancelled = true }
  }, [user?.id, from, to])

  const r = state.key === key ? state.data : null

  useEffect(() => {
    if (!r || !print) return
    const t = setTimeout(() => window.print(), 700)
    return () => clearTimeout(t)
  }, [r, print])

  const period = `${fmtDate(from, { month: 'short', day: 'numeric', year: from.slice(0, 4) !== to.slice(0, 4) ? 'numeric' : undefined })} – ${fmtDate(to, { month: 'short', day: 'numeric', year: 'numeric' })}`
  const name = r?.profile?.full_name || r?.profile?.username || user?.user_metadata?.full_name || 'Operator'
  const otherTheme = new URLSearchParams({ from, to, kind, theme: theme === 'dark' ? 'light' : 'dark' }).toString()

  const share = async () => {
    const url = window.location.href.replace(/([?&])print=1&?/, '$1').replace(/[?&]$/, '')
    const text = r ? `${period}: ${r.card.overallGrade} overall${r.habits.rate != null ? ` · ${r.habits.rate}% habits` : ''} · ${r.tasks.done.length} tasks done` : period
    try {
      if (navigator.share) await navigator.share({ title: `ChiragOS report · ${period}`, text, url })
      else { await navigator.clipboard?.writeText(`${text}\n${url}`); setShared(true); setTimeout(() => setShared(false), 1600) }
    } catch {}
  }

  return (
    <div className="rp-root" data-theme={theme}>
      <div className="rp-toolbar no-print">
        <Link href="/dashboard" className="rp-tool"><ArrowLeft size={15} /> Back</Link>
        <span className="rp-tool-title">Report · {period}</span>
        <Link href={`/report?${otherTheme}`} className="rp-tool" replace>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} {theme === 'dark' ? 'Light' : 'Dark'}</Link>
        <button type="button" className="rp-tool" onClick={share} disabled={!r}>{shared ? <Check size={15} /> : <Share2 size={15} />} {shared ? 'Copied' : 'Share'}</button>
        <button type="button" className="rp-tool is-primary" onClick={() => window.print()} disabled={!r}><Printer size={15} /> Download PDF</button>
      </div>

      <article className="rp-sheet">
        <div className="rp-cover">
          <div className="rp-brand">ChiragOS · {kind === 'full' ? 'Full report' : 'Report card'}</div>
          <h1 className="rp-title">{period}</h1>
          <p className="rp-meta">{name} · {r?.len || ''} days {isClient ? ` · generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
        </div>

        {!user && !authLoading && <p className="rp-empty">Sign in to see your report. <Link href="/login">Sign in</Link></p>}
        {(authLoading || (user && !r && !state.error)) && <p className="rp-empty" role="status">Building your report…</p>}
        {state.error && state.key === key && <p className="rp-empty">Couldn&apos;t build the report: {state.error}</p>}

        {r && (
          <>
            {kind === 'full' ? <FullReport r={r} c={c} /> : <CardReport r={r} />}
            <p className="rp-foot">ChiragOS · {kind === 'full' ? 'Full report' : 'Report card'} · {period} · {name}</p>
          </>
        )}
      </article>
    </div>
  )
}

const fmtD = (ds) => <span className="rp-nw">{ds ? fmtDate(ds) : '—'}</span>
const STATUS = { completed: 'Done', pending: 'To do', in_progress: 'In progress', todo: 'To do', active: 'Active', paused: 'Paused', failed: 'Failed', cancelled: 'Cancelled' }
const status = (s) => STATUS[s] || String(s || '—').replace(/_/g, ' ')
const xAxis = (r, c, key = 'label') => <XAxis dataKey={key} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} interval={r.len > 14 ? Math.ceil(r.len / 10) - 1 : 0} />

function Grade({ g }) {
  return <span className={`rp-grade is-${g === '—' ? 'na' : g[0].toLowerCase()}`}>{g}</span>
}

/** Short report: one grade per area, analysis and achievements. */
function CardReport({ r }) {
  const { card } = r
  return (
    <>
      <Section title="Overall">
        <div className="rp-overall">
          <Grade g={card.overallGrade} />
          <div>
            <b>{card.overall == null ? 'Not enough data' : `${card.overall}/100`}</b>
            <span>Average of {card.grades.filter((g) => g.score != null).length} graded areas</span>
          </div>
        </div>
      </Section>
      <Section title="Grades">
        <table className="rp-table rp-grades">
          <thead><tr><th>Area</th><th className="num">Grade</th><th className="rp-barcol">Score</th><th>Detail</th></tr></thead>
          <tbody>{card.grades.map((g) => (
            <tr key={g.id}><td><b>{g.label}</b></td><td className="num"><Grade g={g.grade} /></td>
              <td className="rp-barcol">{g.score == null ? <span className="rp-muted">—</span> : <div className="rp-barwrap"><span className="rp-bar"><i style={{ width: `${g.score}%` }} /></span><span className="num">{g.score}</span></div>}</td>
              <td className="rp-detail">{g.detail}</td></tr>
          ))}</tbody>
        </table>
      </Section>
      <Section title="Analysis">
        {card.notes.length === 0 ? <p className="rp-muted">Log more data for an analysis.</p> : (
          <ul className="rp-notes">{card.notes.map((n, i) => <li key={i} className={`is-${n.tone}`}>{n.tone === 'good' ? <ArrowUpRight size={13} /> : n.tone === 'bad' ? <ArrowDownRight size={13} /> : <Minus size={13} />}<span>{n.text}</span></li>)}</ul>
        )}
      </Section>
      <Section title="Achievements" note={`${r.achievements.length} unlocked`}>
        {r.achievements.length === 0 ? <p className="rp-muted">None unlocked in this period.</p> : (
          <ul className="rp-list">{r.achievements.map((a) => <li key={a.id}><span><b>{a.name}</b> — {a.description}</span><time>{RARITY[a.rarity]?.label || a.rarity} · {fmtDate(a.earned_at.slice(0, 10))}</time></li>)}</ul>
        )}
      </Section>
    </>
  )
}

/** Long report: every record in the period, with dates, for analysis. No XP or achievements. */
function FullReport({ r, c }) {
  const d = r.detail
  return (
    <>
      <Section title="Overview">
        <div className="rp-kpis">
          <Kpi label="Habit completion" value={r.habits.rate == null ? '—' : `${r.habits.rate}%`} sub={`${r.habits.perfectDays} perfect day${r.habits.perfectDays === 1 ? '' : 's'}`} />
          <Kpi label="Tasks done" value={r.tasks.done.length} sub={`${r.tasks.overdue} overdue`}><Delta cur={r.tasks.done.length} prev={r.tasks.prev} /></Kpi>
          <Kpi label="Work" value={fmtH(d.work.hours)} sub={`${d.work.days.length} days logged`} />
          <Kpi label="Avg sleep" value={r.sleep.avgMinutes == null ? '—' : fmtMin(r.sleep.avgMinutes)} sub={r.sleep.avgBed != null ? `bed ~${fmtClock(r.sleep.avgBed)}` : 'not logged'} />
          <Kpi label="Weight" value={d.weight.end == null ? '—' : `${d.weight.end} kg`} sub={d.weight.change == null ? 'not logged' : `${d.weight.change > 0 ? '+' : ''}${d.weight.change} kg`} />
          <Kpi label="Speaking" value={d.speaking.length} sub="sessions" />
          <Kpi label="Books" value={d.books.length} sub="finished" />
          <Kpi label="Spent" value={formatMoney(r.budget.total)} sub={`${d.noSpendDays} no-spend day${d.noSpendDays === 1 ? '' : 's'}`} />
        </div>
      </Section>

      <Section title="Habits" note={r.habits.rate != null ? `${r.habits.rate}% of scheduled check-ins` : null}>
        {r.habits.rows.length === 0 ? <p className="rp-muted">No habits scheduled in this period.</p> : (
          <>
            {r.len > 1 && (
              <Chart label="Daily habit completion">
                <LineChart width={W} height={150} data={r.habits.daily} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="date" tickFormatter={(x) => fmtDate(x, r.len > 14 ? { month: 'short', day: 'numeric' } : { weekday: 'short' })} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} interval={r.len > 14 ? Math.ceil(r.len / 10) - 1 : 0} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
                  <Line dataKey="rate" stroke={BLUE} strokeWidth={2} dot={r.len <= 31 ? { r: 3, fill: BLUE, strokeWidth: 0 } : false} connectNulls isAnimationActive={false} />
                </LineChart>
              </Chart>
            )}
            <table className="rp-table">
              <thead><tr><th>Habit</th><th className="num">Done</th><th className="rp-barcol">Rate</th></tr></thead>
              <tbody>{r.habits.rows.map((h) => (
                <tr key={h.id}><td>{h.title}</td><td className="num">{h.done}/{h.scheduled}</td><td className="rp-barcol"><div className="rp-barwrap"><span className="rp-bar"><i style={{ width: `${h.rate}%` }} /></span><span className="num">{h.rate}%</span></div></td></tr>
              ))}</tbody>
            </table>
            <table className="rp-table rp-mt">
              <thead><tr><th>Date</th><th className="num">Completion</th></tr></thead>
              <tbody>{r.habits.daily.map((x) => <tr key={x.date}><td>{fmtDate(x.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td><td className="num">{x.rate == null ? '—' : `${x.rate}%`}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </Section>

      <Section title="Missions" note={`${d.missions.length} in period`}>
        {d.missions.length === 0 ? <p className="rp-muted">No missions.</p> : (
          <table className="rp-table">
            <thead><tr><th>Mission</th><th>Status</th><th>Started</th><th>Deadline</th><th>Completed</th><th className="num">Progress</th></tr></thead>
            <tbody>{d.missions.map((m) => (
              <tr key={m.id}>
                <td><b>{m.title}</b>{m.milestones.length > 0 && <ul className="rp-sub">{m.milestones.map((x, i) => <li key={i}>{x.done ? '✓' : '○'} {x.title}{x.target ? ` · target ${fmtDate(x.target)}` : ''}{x.done ? ` · done ${fmtDate(x.done)}` : ''}</li>)}</ul>}</td>
                <td>{status(m.status)}</td><td>{fmtD(m.created)}</td><td>{fmtD(m.deadline)}</td><td>{fmtD(m.completed)}</td><td className="num">{m.progress}%</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      <Section title="Tasks" note={`${r.tasks.done.length} completed · ${d.tasks.length} listed`}>
        {d.tasks.length === 0 ? <p className="rp-muted">No tasks in this period.</p> : (
          <table className="rp-table">
            <thead><tr><th>Task</th><th>Mission</th><th>Status</th><th>Added</th><th>Due</th><th>Completed</th></tr></thead>
            <tbody>{d.tasks.map((t) => (
              <tr key={t.id}><td>{t.title}</td><td>{t.mission || '—'}</td><td>{status(t.status)}</td><td>{fmtD(t.created)}</td><td className={t.due && !t.completed && t.due < r.to ? 'is-bad' : ''}>{fmtD(t.due)}</td><td>{fmtD(t.completed)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      <Section title="Work" note={`${fmtH(d.work.hours)} over ${d.work.days.length} days`}>
        {d.work.days.length === 0 && d.work.logs.length === 0 ? <p className="rp-muted">No work logged.</p> : (
          <>
            {d.work.days.length > 0 && (
              <table className="rp-table">
                <thead><tr><th>Date</th><th className="num">Hours</th><th className="num">Focused</th><th className="num">Deep</th></tr></thead>
                <tbody>{d.work.days.map((w) => <tr key={w.date}><td>{fmtDate(w.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td><td className="num">{fmtH(w.total_hours_worked)}</td><td className="num">{fmtH(w.focused_hours)}</td><td className="num">{fmtH(w.deep_execution_hours)}</td></tr>)}</tbody>
              </table>
            )}
            {d.work.logs.length > 0 && <ul className="rp-entries">{d.work.logs.map((l, i) => <li key={l.id || i}><time>{fmtDate(l.date)}</time><b>{l.title}</b>{l.description && <p>{l.description}</p>}</li>)}</ul>}
          </>
        )}
      </Section>

      <Section title="Speaking practice" note={`${d.speaking.length} session${d.speaking.length === 1 ? '' : 's'}`}>
        {d.speaking.length === 0 ? <p className="rp-muted">No speaking sessions.</p> : (
          <table className="rp-table">
            <thead><tr><th>Date</th><th>Topic</th><th>Category</th><th className="num">Rating</th></tr></thead>
            <tbody>{d.speaking.map((s, i) => <tr key={s.id || i}><td>{fmtDate(s.date)}</td><td>{s.topic || '—'}{s.notes ? <div className="rp-detail">{s.notes}</div> : null}</td><td>{s.category || '—'}</td><td className="num">{s.rating ?? '—'}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section title="Journal" note={`${d.journal.length} entr${d.journal.length === 1 ? 'y' : 'ies'}${r.journal.avgMood != null ? ` · avg mood ${r.journal.avgMood.toFixed(1)}/5` : ''}`}>
        {d.journal.length === 0 ? <p className="rp-muted">No journal entries.</p> : (
          <ul className="rp-entries">{d.journal.map((j, i) => <li key={j.id || i}><time>{fmtDate(j.date, { weekday: 'short', month: 'short', day: 'numeric' })}{j.mood != null ? ` · mood ${j.mood}/5` : ''}</time>{j.title && <b>{j.title}</b>}{j.content && <p>{j.content}</p>}</li>)}</ul>
        )}
      </Section>

      <Section title="Daily reviews" note={`${d.reviews.length}`}>
        {d.reviews.length === 0 ? <p className="rp-muted">No daily reviews.</p> : (
          <table className="rp-table">
            <thead><tr><th>Date</th><th className="num">Mood</th><th className="num">Energy</th><th>Win</th><th>Intention</th></tr></thead>
            <tbody>{d.reviews.map((x) => <tr key={x.date}><td>{fmtDate(x.date)}</td><td className="num">{x.mood ?? '—'}</td><td className="num">{x.energy ?? '—'}</td><td>{x.win || '—'}</td><td>{x.intention || '—'}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section title="Weekly debriefs" note={`${d.debriefs.length}`}>
        {d.debriefs.length === 0 ? <p className="rp-muted">No weekly debriefs in this period.</p> : (
          <ul className="rp-entries">{d.debriefs.map((l, i) => <li key={l.id || i}><time>{fmtDate(l.date)}</time><b>{l.title}</b>{l.description && <p>{l.description}</p>}</li>)}</ul>
        )}
      </Section>

      <Section title="Sleep" note={`${d.nights.length} nights logged`}>
        {d.nights.length === 0 ? <p className="rp-muted">No sleep logged.</p> : (
          <>
            <Chart label="Hours slept per night">
              <BarChart width={W} height={150} data={r.sleep.daily} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                {xAxis(r, c)}
                <YAxis unit="h" domain={[0, 10]} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
                <ReferenceLine y={7} stroke={c.ref} strokeDasharray="4 4" />
                <Bar dataKey="hours" fill={BLUE} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={36} />
              </BarChart>
            </Chart>
            <table className="rp-table">
              <thead><tr><th>Woke on</th><th>Bed</th><th>Wake</th><th className="num">Duration</th><th className="num">Score</th></tr></thead>
              <tbody>{d.nights.map((n) => <tr key={n.date}><td>{fmtDate(n.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td><td>{n.bed || '—'}</td><td>{n.wake || '—'}</td><td className="num">{fmtMin(n.minutes)}</td><td className="num">{n.score ?? '—'}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </Section>

      <Section title="Weight" note={d.weight.change == null ? null : `${d.weight.start} → ${d.weight.end} kg`}>
        {d.weight.entries.length === 0 ? <p className="rp-muted">No weigh-ins in this period.</p> : (
          <>
            {d.weight.entries.length > 1 && (
              <Chart label="Weight over the period">
                <LineChart width={W} height={130} data={d.weight.entries.map((w) => ({ ...w, label: fmtDate(w.date) }))} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} unit="kg" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Line dataKey="kg" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE, strokeWidth: 0 }} isAnimationActive={false} />
                </LineChart>
              </Chart>
            )}
            <table className="rp-table">
              <thead><tr><th>Date</th><th className="num">Weight</th></tr></thead>
              <tbody>{d.weight.entries.map((w) => <tr key={w.date}><td>{fmtDate(w.date)}</td><td className="num">{w.kg} kg</td></tr>)}</tbody>
            </table>
          </>
        )}
      </Section>

      <Section title="Books read" note={`${d.books.length}`}>
        {d.books.length === 0 ? <p className="rp-muted">No books finished in this period.</p> : (
          <ul className="rp-entries">{d.books.map((b, i) => <li key={b.id || i}><time>{fmtDate(String(b.date_completed).slice(0, 10))}{b.rating ? ` · ${b.rating}/5` : ''}</time><b>{b.title}</b>{b.author ? ` — ${b.author}` : ''}{b.takeaways && <p>{b.takeaways}</p>}</li>)}</ul>
        )}
      </Section>

      <Section title="Budget" note={`${formatMoney(r.budget.total)} · ${r.budget.entries} entries`}>
        {r.budget.entries === 0 ? <p className="rp-muted">No spending logged.</p> : (
          <>
            <table className="rp-table">
              <thead><tr><th>Category</th><th className="num">Spent</th><th className="rp-barcol">Share</th></tr></thead>
              <tbody>{r.budget.byCategory.map((b) => {
                const pct = r.budget.total ? Math.round((b.amount / r.budget.total) * 100) : 0
                return <tr key={b.name}><td className="cap">{b.name}</td><td className="num">{formatMoney(b.amount)}</td><td className="rp-barcol"><div className="rp-barwrap"><span className="rp-bar"><i style={{ width: `${pct}%` }} /></span><span className="num">{pct}%</span></div></td></tr>
              })}</tbody>
              <tfoot><tr><td>Total</td><td className="num">{formatMoney(r.budget.total)}</td><td /></tr></tfoot>
            </table>
            <table className="rp-table rp-mt">
              <thead><tr><th>Date</th><th>Category</th><th>Note</th><th className="num">Amount</th></tr></thead>
              <tbody>{d.spend.map((l, i) => <tr key={l.id || i}><td className="rp-nw">{fmtDate(l.date)}</td><td className="cap">{l.custom_category || l.category || 'other'}</td><td>{String(l.description || '').replace(/\s*\[SUB:[^\]]*\]/g, '') || '—'}</td><td className="num">{formatMoney(Number(l.amount) || 0)}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </Section>

      <Section title="Screen time" note={r.screen.logged ? `${r.screen.logged} of ${r.len} days logged` : null}>
        {r.screen.logged === 0 ? <p className="rp-muted">No screen time logged.</p> : (
          <>
            <Chart label="Screen time per day by category">
              <BarChart width={W} height={170} data={r.screen.daily} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                {xAxis(r, c)}
                <YAxis unit="h" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
                {(r.screen.hasCats ? [...SCREEN_CATEGORIES, UNCATEGORIZED] : [UNCATEGORIZED]).map((s) => <Bar key={s.id} dataKey={s.id} stackId="s" fill={r.screen.hasCats ? s.color : BLUE} stroke={c.gap} strokeWidth={1} isAnimationActive={false} maxBarSize={36} />)}
              </BarChart>
            </Chart>
            {r.screen.hasCats && <div className="rp-legend">{[...SCREEN_CATEGORIES, UNCATEGORIZED].map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.label}</span>)}</div>}
          </>
        )}
      </Section>
    </>
  )
}
