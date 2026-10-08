'use client'

import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { TrendingDown, TrendingUp, Trophy, AlertTriangle } from 'lucide-react'
import { getLocalDateStr } from '@/lib/utils/dates'
import { SCREEN_CATEGORIES, UNCATEGORIZED, categoryMinutes } from '@/lib/utils/screenIntel'
import { disciplineScore } from '@/lib/utils/screenTimeScore'

const RANGES = [7, 30, 90]
const axis = { fontSize: 11, fill: 'var(--text-muted)' }
const SERIES = [...SCREEN_CATEGORIES, UNCATEGORIZED]

function StackTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d.logged) return <div className="chart-tip"><b>{d.label}</b><span>No log</span></div>
  return (
    <div className="chart-tip">
      <b>{d.label} · {d.totalH}h</b>
      {SERIES.filter((s) => d[s.id] > 0).map((s) => <span key={s.id} className="tip-row"><i style={{ background: s.color }} />{s.label} {Math.round(d[s.id] * 60)}m</span>)}
    </div>
  )
}
function LineTip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return <div className="chart-tip"><b>{d.label}</b>{payload.map((p) => <span key={p.dataKey}>{p.name}: {p.value == null ? '—' : `${p.value}${unit}`}</span>)}</div>
}

/** 7 / 30 / 90-day charts: stacked category bars, doomscroll trend + 7-day avg, focus ratio, best / worst day. */
export default function ScreenCharts({ logs }) {
  const [range, setRange] = useState(30)
  const { rows, hasCats, best, worst, avgRatio } = useMemo(() => {
    const byDate = new Map(logs.map((l) => [l.date, l]))
    const out = []
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = getLocalDateStr(d)
      const l = byDate.get(ds)
      const cats = l ? categoryMinutes(l) : null
      const row = {
        date: ds,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tick: range <= 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        logged: !!l,
        totalH: l ? Number(l.total_hours) || 0 : null,
        doom: l ? Number(l.doom_scroll_minutes) || 0 : null,
        // focus can include off-screen work, so the share is capped at 100%
        ratio: l && Number(l.total_hours) > 0 ? Math.min(100, Math.round(((Number(l.focus_hours) || 0) / Number(l.total_hours)) * 100)) : null,
        score: disciplineScore(l),
      }
      for (const s of SERIES) row[s.id] = cats ? +(cats[s.id] / 60).toFixed(2) : 0
      out.push(row)
    }
    // trailing 7-day average of logged doomscroll
    out.forEach((r, i) => {
      const win = out.slice(Math.max(0, i - 6), i + 1).filter((x) => x.doom != null)
      r.doomAvg = win.length ? Math.round(win.reduce((s, x) => s + x.doom, 0) / win.length) : null
    })
    const logged = out.filter((r) => r.logged)
    const sorted = [...logged].sort((a, b) => b.score - a.score)
    const ratios = logged.filter((r) => r.ratio != null)
    return {
      rows: out,
      hasCats: logs.some((l) => l.categories && Object.keys(l.categories).length),
      best: sorted[0],
      worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
      avgRatio: ratios.length ? Math.round(ratios.reduce((s, r) => s + r.ratio, 0) / ratios.length) : null,
    }
  }, [logs, range])

  const interval = range <= 7 ? 0 : range <= 30 ? 4 : 13
  const active = SERIES.filter((s) => (hasCats ? true : s.id === 'uncategorized'))

  return (
    <div className="si-charts">
      <div className="si-range" role="tablist" aria-label="Range">
        {RANGES.map((r) => <button key={r} type="button" role="tab" aria-selected={range === r} className={`tk-chip ${range === r ? 'is-on' : ''}`} onClick={() => setRange(r)}>{r} days</button>)}
      </div>

      <section className="pf-card">
        <div className="pf-card-head">Screen time by category <span className="arena-hint ml-auto">hours / day</span></div>
        <div className="chart-box" role="img" aria-label={`Daily screen time for the last ${range} days`}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={range > 30 ? 1 : 3}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="tick" tick={axis} tickLine={false} axisLine={false} interval={interval} />
              <YAxis tick={axis} tickLine={false} axisLine={false} unit="h" allowDecimals={false} />
              <Tooltip content={<StackTip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <ReferenceLine y={6} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
              {active.map((s, i) => <Bar key={s.id} dataKey={s.id} name={s.label} stackId="a" fill={s.color} stroke="var(--bg-secondary)" strokeWidth={1} radius={i === active.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="si-legend">
          {active.map((s) => <span key={s.id}><i style={{ background: s.color }} /> {s.label}</span>)}
          <span><i className="is-line" /> 6h target</span>
        </div>
        {!hasCats && <p className="ms-muted">Log minutes per category to split the bars.</p>}
      </section>

      <div className="si-two">
        <section className="pf-card">
          <div className="pf-card-head">Doomscroll <span className="arena-hint ml-auto">min / day · dashed = 7-day avg</span></div>
          <div className="chart-box" role="img" aria-label="Doomscroll trend">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="tick" tick={axis} tickLine={false} axisLine={false} interval={interval} />
                <YAxis tick={axis} tickLine={false} axisLine={false} />
                <ReferenceLine y={60} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
                <Tooltip content={<LineTip unit="m" />} />
                <Line dataKey="doom" name="Doomscroll" stroke="#d95926" strokeWidth={2} dot={range <= 30 ? { r: 3, strokeWidth: 0, fill: '#d95926' } : false} connectNulls isAnimationActive={false} />
                <Line dataKey="doomAvg" name="7-day avg" stroke="var(--text-secondary)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="pf-card">
          <div className="pf-card-head">Focus share of screen time <span className="arena-hint ml-auto">{avgRatio != null ? `avg ${avgRatio}%` : ''}</span></div>
          <div className="chart-box" role="img" aria-label="Focus hours as a share of screen time">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="tick" tick={axis} tickLine={false} axisLine={false} interval={interval} />
                <YAxis tick={axis} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                <Tooltip content={<LineTip unit="%" />} />
                <Line dataKey="ratio" name="Focus share" stroke="#199e70" strokeWidth={2} dot={range <= 30 ? { r: 3, strokeWidth: 0, fill: '#199e70' } : false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {best && (
        <div className="si-bestworst">
          <div className="record-tile"><span className="record-label"><Trophy size={11} /> Best day</span><span className="record-value">{best.score}</span><span className="record-sub">{best.label} · {best.totalH}h screen · {best.doom}m doom</span></div>
          {worst && <div className="record-tile"><span className="record-label"><AlertTriangle size={11} /> Worst day</span><span className="record-value">{worst.score}</span><span className="record-sub">{worst.label} · {worst.totalH}h screen · {worst.doom}m doom</span></div>}
          {avgRatio != null && <div className="record-tile"><span className="record-label">{avgRatio >= 40 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} Focus ratio</span><span className="record-value">{avgRatio}%</span><span className="record-sub">of screen time was focus</span></div>}
        </div>
      )}
    </div>
  )
}
