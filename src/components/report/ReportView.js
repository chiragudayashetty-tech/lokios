'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import { ArrowLeft, Printer, Share2, Sun, Moon, ArrowUpRight, ArrowDownRight, Minus, Check } from 'lucide-react'
import { useOSSlice } from '@/lib/context/OSContext'
import { useIsClient } from '@/lib/hooks/useMediaQuery'
import { fetchReport, parseReportParams, REPORT_SECTIONS } from '@/lib/report/reportData'
import { SCREEN_CATEGORIES, UNCATEGORIZED } from '@/lib/utils/screenIntel'
import { calculateLevel, getRankForXp } from '@/lib/utils/xp'
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
  const { from, to, sections, theme, print } = params
  const auth = useOSSlice('auth')
  const isClient = useIsClient()
  // Server HTML has no session; resolve auth-dependent UI after mount to keep hydration stable
  const user = isClient ? auth.user : null
  const authLoading = !isClient || auth.loading
  const [state, setState] = useState({ key: null, data: null, error: null })
  const [shared, setShared] = useState(false)
  const key = `${user?.id}|${from}|${to}`
  const c = useChartColors(theme)
  const has = (id) => sections.includes(id)

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
  const otherTheme = new URLSearchParams({ from, to, sections: sections.join(','), theme: theme === 'dark' ? 'light' : 'dark' }).toString()

  const share = async () => {
    const url = window.location.href.replace(/([?&])print=1&?/, '$1').replace(/[?&]$/, '')
    const text = r ? `${period}: +${r.xp.total.toLocaleString()} XP${r.habits.rate != null ? ` · ${r.habits.rate}% habits` : ''} · ${r.tasks.done.length} tasks done` : period
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
          <div className="rp-brand">ChiragOS · {sections.length === REPORT_SECTIONS.length ? 'Full report' : 'Report'}</div>
          <h1 className="rp-title">{period}</h1>
          <p className="rp-meta">{name}{r?.profile ? ` · Level ${calculateLevel(r.profile.total_xp || 0)} · ${getRankForXp(r.profile.total_xp || 0).name || ''}` : ''} · {r?.len || ''} days {isClient ? ` · generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
        </div>

        {!user && !authLoading && <p className="rp-empty">Sign in to see your report. <Link href="/login">Sign in</Link></p>}
        {(authLoading || (user && !r && !state.error)) && <p className="rp-empty" role="status">Building your report…</p>}
        {state.error && state.key === key && <p className="rp-empty">Couldn&apos;t build the report: {state.error}</p>}

        {r && (
          <>
            {has('summary') && (
              <Section title="Summary">
                <div className="rp-kpis">
                  <Kpi label="XP gained" value={`+${r.xp.total.toLocaleString()}`} sub={`${r.xp.avg}/day`}><Delta cur={r.xp.total} prev={r.xp.prev} /></Kpi>
                  <Kpi label="Habit completion" value={r.habits.rate == null ? '—' : `${r.habits.rate}%`} sub={`${r.habits.perfectDays} perfect day${r.habits.perfectDays === 1 ? '' : 's'}`}>{r.habits.rate != null && r.habits.prevRate != null && <span className={`rp-delta ${r.habits.rate >= r.habits.prevRate ? 'is-good' : 'is-bad'}`}>{r.habits.rate >= r.habits.prevRate ? '+' : '−'}{Math.abs(r.habits.rate - r.habits.prevRate)} pts vs previous</span>}</Kpi>
                  <Kpi label="Tasks done" value={r.tasks.done.length} sub={r.tasks.overdue ? `${r.tasks.overdue} overdue now` : 'nothing overdue'}><Delta cur={r.tasks.done.length} prev={r.tasks.prev} /></Kpi>
                  <Kpi label="Missions" value={r.missions.done.length} sub={`completed · ${r.missions.milestonesDone.length} milestone${r.missions.milestonesDone.length === 1 ? '' : 's'}`} />
                  {has('sleep') && <Kpi label="Avg sleep" value={r.sleep.avgMinutes == null ? '—' : fmtMin(r.sleep.avgMinutes)} sub={r.sleep.avgBed != null ? `bed ~${fmtClock(r.sleep.avgBed)}` : 'not logged'} />}
                  {has('screen') && <Kpi label="Avg screen time" value={fmtH(r.screen.avgTotal)} sub={r.screen.avgDoom != null ? `${Math.round(r.screen.avgDoom)}m doomscroll` : 'not logged'} />}
                  {has('budget') && <Kpi label="Spent" value={formatMoney(r.budget.total)} sub={`${formatMoney(Math.round(r.budget.dailyAvg))}/day everyday spend`} />}
                  {has('achievements') && <Kpi label="Achievements" value={r.achievements.length} sub="unlocked" />}
                </div>
              </Section>
            )}

            {has('xp') && (
              <Section title="XP" note={r.xp.best ? `best day ${fmtDate(r.xp.best.date)} · +${r.xp.best.xp}` : null}>
                <Chart label="XP gained per day">
                  <BarChart width={W} height={170} data={r.xp.daily} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={c.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} interval={r.len > 14 ? Math.ceil(r.len / 10) - 1 : 0} />
                    <YAxis tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Bar dataKey="xp" fill={BLUE} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={36} />
                  </BarChart>
                </Chart>
                {r.xp.bySource.length > 0 && (
                  <table className="rp-table">
                    <thead><tr><th>Source</th><th className="num">XP</th><th className="num">Share</th></tr></thead>
                    <tbody>{r.xp.bySource.map((s) => <tr key={s.name}><td>{s.name}</td><td className="num">{s.xp > 0 ? '+' : ''}{s.xp.toLocaleString()}</td><td className="num">{r.xp.total ? Math.round((s.xp / r.xp.total) * 100) : 0}%</td></tr>)}</tbody>
                  </table>
                )}
              </Section>
            )}

            {has('habits') && (
              <Section title="Habits" note={r.habits.rate != null ? `${r.habits.rate}% of scheduled check-ins` : null}>
                {r.habits.rows.length === 0 ? <p className="rp-muted">No habits scheduled in this period.</p> : (
                  <>
                    {r.len > 1 && (
                      <Chart label="Daily habit completion">
                        <LineChart width={W} height={150} data={r.habits.daily} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke={c.grid} />
                          <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, r.len > 14 ? { month: 'short', day: 'numeric' } : { weekday: 'short' })} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} interval={r.len > 14 ? Math.ceil(r.len / 10) - 1 : 0} />
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
                  </>
                )}
              </Section>
            )}

            {has('missions') && (
              <Section title="Missions" note={`${r.missions.active.length} active`}>
                {r.missions.done.length > 0 && <p className="rp-callout"><Check size={13} /> Completed: {r.missions.done.map((g) => g.title).join(', ')}</p>}
                {r.missions.active.length === 0 ? <p className="rp-muted">No active missions.</p> : (
                  <table className="rp-table">
                    <thead><tr><th>Mission</th><th>Deadline</th><th className="rp-barcol">Progress</th></tr></thead>
                    <tbody>{r.missions.active.map((g) => (
                      <tr key={g.id}><td>{g.title}</td><td>{g.deadline ? fmtDate(g.deadline) : '—'}</td><td className="rp-barcol"><div className="rp-barwrap"><span className="rp-bar"><i style={{ width: `${g.progress}%` }} /></span><span className="num">{g.progress}%</span></div></td></tr>
                    ))}</tbody>
                  </table>
                )}
                {r.missions.milestonesDone.length > 0 && <p className="rp-muted">Milestones hit: {r.missions.milestonesDone.map((m) => m.title).join(' · ')}</p>}
              </Section>
            )}

            {has('tasks') && (
              <Section title="Tasks" note={`${r.tasks.done.length} completed`}>
                {r.tasks.done.length === 0 ? <p className="rp-muted">No tasks completed in this period.</p> : (
                  <ul className="rp-list">{r.tasks.done.slice(0, 20).map((t) => <li key={t.id}><span>{t.title}</span><time>{fmtDate(t.completed_at.slice(0, 10))}</time></li>)}</ul>
                )}
                {r.tasks.done.length > 20 && <p className="rp-muted">+{r.tasks.done.length - 20} more</p>}
              </Section>
            )}

            {has('work') && (r.work.days > 0 || r.work.logs.length > 0 || r.work.speaking.length > 0) && (
              <Section title="Work">
                <div className="rp-kpis is-3">
                  <Kpi label="Hours worked" value={fmtH(r.work.hours)} sub={`${r.work.days} day${r.work.days === 1 ? '' : 's'} logged`} />
                  <Kpi label="Focused" value={fmtH(r.work.focused)} sub={r.work.hours ? `${Math.round((r.work.focused / r.work.hours) * 100)}% of hours` : ''} />
                  <Kpi label="Speaking reps" value={r.work.speaking.length} sub={r.work.speaking.length ? `avg rating ${(r.work.speaking.reduce((s, l) => s + (l.rating || 0), 0) / r.work.speaking.length).toFixed(1)}` : ''} />
                </div>
                {r.work.logs.length > 0 && <ul className="rp-list">{r.work.logs.map((l, i) => <li key={i}><span>{l.title}</span><time>{fmtDate(l.date)}</time></li>)}</ul>}
              </Section>
            )}

            {has('screen') && (
              <Section title="Screen time" note={r.screen.logged ? `${r.screen.logged} of ${r.len} days logged` : null}>
                {r.screen.logged === 0 ? <p className="rp-muted">No screen time logged.</p> : (
                  <>
                    <div className="rp-kpis is-3">
                      <Kpi label="Avg / day" value={fmtH(r.screen.avgTotal)} sub="target 6h" />
                      <Kpi label="Doomscroll" value={fmtMin(r.screen.avgDoom)} sub="target ≤ 60m" />
                      <Kpi label="Focus" value={fmtH(r.screen.avgFocus)} sub="target 3h" />
                    </div>
                    <Chart label="Screen time per day by category">
                      <BarChart width={W} height={170} data={r.screen.daily} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={c.grid} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} interval={r.len > 14 ? Math.ceil(r.len / 10) - 1 : 0} />
                        <YAxis unit="h" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <ReferenceLine y={6} stroke={c.ref} strokeDasharray="4 4" />
                        {(r.screen.hasCats ? [...SCREEN_CATEGORIES, UNCATEGORIZED] : [UNCATEGORIZED]).map((s) => <Bar key={s.id} dataKey={s.id} stackId="s" fill={r.screen.hasCats ? s.color : BLUE} stroke={c.gap} strokeWidth={1} isAnimationActive={false} maxBarSize={36} />)}
                      </BarChart>
                    </Chart>
                    {r.screen.hasCats && <div className="rp-legend">{[...SCREEN_CATEGORIES, UNCATEGORIZED].map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.label}</span>)}<span><i className="is-line" />6h target</span></div>}
                  </>
                )}
              </Section>
            )}

            {has('sleep') && (
              <Section title="Sleep" note={r.sleep.logged ? `${r.sleep.logged} nights logged` : null}>
                {r.sleep.logged === 0 ? <p className="rp-muted">No sleep logged.</p> : (
                  <>
                    <div className="rp-kpis is-3">
                      <Kpi label="Avg duration" value={fmtMin(r.sleep.avgMinutes)} />
                      <Kpi label="Avg bedtime" value={fmtClock(r.sleep.avgBed)} />
                      <Kpi label="Avg score" value={r.sleep.avgScore == null ? '—' : Math.round(r.sleep.avgScore)} />
                    </div>
                    <Chart label="Hours slept per night">
                      <BarChart width={W} height={150} data={r.sleep.daily} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={c.grid} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} interval={r.len > 14 ? Math.ceil(r.len / 10) - 1 : 0} />
                        <YAxis unit="h" domain={[0, 10]} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
                        <ReferenceLine y={7} stroke={c.ref} strokeDasharray="4 4" />
                        <Bar dataKey="hours" fill={BLUE} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={36} />
                      </BarChart>
                    </Chart>
                  </>
                )}
              </Section>
            )}

            {has('budget') && (
              <Section title="Budget" note={`${r.budget.entries} entries`}>
                {r.budget.entries === 0 ? <p className="rp-muted">No spending logged.</p> : (
                  <table className="rp-table">
                    <thead><tr><th>Category</th><th className="num">Spent</th><th className="rp-barcol">Share</th></tr></thead>
                    <tbody>{r.budget.byCategory.map((b) => {
                      const pct = r.budget.total ? Math.round((b.amount / r.budget.total) * 100) : 0
                      return <tr key={b.name}><td className="cap">{b.name}</td><td className="num">{formatMoney(b.amount)}</td><td className="rp-barcol"><div className="rp-barwrap"><span className="rp-bar"><i style={{ width: `${pct}%` }} /></span><span className="num">{pct}%</span></div></td></tr>
                    })}</tbody>
                    <tfoot><tr><td>Total</td><td className="num">{formatMoney(r.budget.total)}</td><td /></tr></tfoot>
                  </table>
                )}
              </Section>
            )}

            {has('journal') && (
              <Section title="Journal mood" note={`${r.journal.entries} entr${r.journal.entries === 1 ? 'y' : 'ies'}${r.journal.avgMood != null ? ` · avg ${r.journal.avgMood.toFixed(1)}/5` : ''}`}>
                {r.journal.entries === 0 ? <p className="rp-muted">No journal entries.</p> : (
                  <Chart label="Average journal mood per day">
                    <LineChart width={W} height={130} data={r.journal.daily} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={c.grid} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} interval={r.len > 14 ? Math.ceil(r.len / 10) - 1 : 0} />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
                      <Line dataKey="mood" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </Chart>
                )}
                <p className="rp-muted">Only mood scores are included — entry text stays private.</p>
              </Section>
            )}

            {has('achievements') && (
              <Section title="Achievements" note={`${r.achievements.length} unlocked`}>
                {r.achievements.length === 0 ? <p className="rp-muted">None unlocked in this period.</p> : (
                  <ul className="rp-list">{r.achievements.map((a) => <li key={a.id}><span><b>{a.name}</b> — {a.description}</span><time>{RARITY[a.rarity]?.label || a.rarity} · {fmtDate(a.earned_at.slice(0, 10))}</time></li>)}</ul>
                )}
              </Section>
            )}

            <p className="rp-foot">ChiragOS · {period} · {name}</p>
          </>
        )}
      </article>
    </div>
  )
}
