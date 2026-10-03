'use client'

import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid } from 'recharts'
import { BedDouble, Moon, Gauge, Clock3, Target } from 'lucide-react'
import SchemaHint from '@/components/ui/SchemaHint'
import { useOSSlice } from '@/lib/context/OSContext'
import { useSleep } from '@/lib/hooks/useSleep'
import { getLocalDateStr } from '@/lib/utils/dates'
import { bedMinutesFromNoon, formatDuration, hhmmOf, scoreTone } from '@/lib/utils/sleep'

const DAYS = 30
const axis = { fontSize: 11, fill: 'var(--text-muted)' }

function Tip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (d.minutes == null) return <div className="chart-tip"><b>{d.label}</b><span>No log</span></div>
  return (
    <div className="chart-tip">
      <b>{d.label}</b>
      {unit === 'h' ? <span>{formatDuration(d.minutes)} · {d.bed} → {d.wake}</span> : <span>Score {d.score} · {scoreTone(d.score).label}</span>}
    </div>
  )
}

/** Progress → Sleep (#24): 30 nights of duration (7–9h target band), score and consistency. */
export default function SleepPanel() {
  const { user } = useOSSlice('auth')
  const sleep = useSleep(user?.id, 60)

  const { rows, stats } = useMemo(() => {
    const byDate = new Map(sleep.logs.map((l) => [l.date, l]))
    const out = []
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = getLocalDateStr(d)
      const l = byDate.get(ds)
      out.push({
        date: ds,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tick: d.toLocaleDateString('en-US', { day: 'numeric' }),
        hours: l ? +(l.duration_minutes / 60).toFixed(2) : null,
        minutes: l ? l.duration_minutes : null,
        score: l?.score ?? null,
        bed: l ? hhmmOf(l.bedtime) : null,
        wake: l ? hhmmOf(l.wake_time) : null,
      })
    }
    const logged = out.filter((r) => r.minutes != null)
    const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
    const beds = sleep.logs.slice(0, 14).filter((l) => l.bedtime).map((l) => bedMinutesFromNoon(l.bedtime))
    const mean = avg(beds)
    const sd = beds.length >= 3 ? Math.round(Math.sqrt(avg(beds.map((b) => (b - mean) ** 2)))) : null
    return {
      rows: out,
      stats: {
        nights: logged.length,
        avgMin: logged.length ? Math.round(avg(logged.map((r) => r.minutes))) : null,
        avgScore: logged.length ? Math.round(avg(logged.map((r) => r.score))) : null,
        sd,
        inBand: logged.filter((r) => r.minutes >= 420 && r.minutes <= 540).length,
      },
    }
  }, [sleep.logs])

  if (sleep.missing) return <section className="hud-panel p-5"><SchemaHint feature="Sleep tracking" /></section>
  if (sleep.loading) return <section className="hud-panel p-5 arena-skeleton" />

  const tone = stats.avgScore != null ? scoreTone(stats.avgScore) : null
  return (
    <div className="progress-extras sleep-panel">
      <section className="hud-panel p-5">
        <div className="arena-card-head mb-3"><BedDouble size={15} style={{ color: '#9aa8ff' }} /> Sleep · last {DAYS} nights</div>
        <div className="records-grid">
          <div className="record-tile"><span className="record-label"><Clock3 size={11} /> Avg sleep</span><span className="record-value">{stats.avgMin != null ? formatDuration(stats.avgMin) : '—'}</span><span className="record-sub">{stats.nights} nights logged</span></div>
          <div className="record-tile"><span className="record-label"><Gauge size={11} /> Avg score</span><span className="record-value">{stats.avgScore ?? '—'}</span><span className="record-sub">{tone?.label || 'Log a few nights'}</span></div>
          <div className="record-tile"><span className="record-label"><Moon size={11} /> Bedtime spread</span><span className="record-value">{stats.sd != null ? `±${stats.sd}m` : '—'}</span><span className="record-sub">last 14 nights · lower is steadier</span></div>
          <div className="record-tile"><span className="record-label"><Target size={11} /> In 7–9h band</span><span className="record-value">{stats.nights ? `${stats.inBand}/${stats.nights}` : '—'}</span><span className="record-sub">nights on target</span></div>
        </div>
      </section>

      <section className="hud-panel p-5">
        <div className="arena-card-head mb-1">Duration <span className="arena-hint ml-auto">shaded band = 7–9h target</span></div>
        {stats.nights === 0 ? <p className="arena-line">No sleep logged yet — use the “How did you sleep?” card on Today.</p> : (
          <div className="chart-box" role="img" aria-label={`Sleep duration for the last ${DAYS} nights`}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <ReferenceArea y1={7} y2={9} fill="var(--success)" fillOpacity={0.1} stroke="none" ifOverflow="extendDomain" />
                <XAxis dataKey="tick" tick={axis} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={axis} tickLine={false} axisLine={false} domain={[0, 12]} ticks={[0, 3, 6, 9, 12]} unit="h" />
                <Tooltip content={<Tip unit="h" />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="hours" fill="#9aa8ff" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {stats.nights > 0 && (
        <section className="hud-panel p-5">
          <div className="arena-card-head mb-1">Sleep score <span className="arena-hint ml-auto">0–100 · 70+ = good</span></div>
          <div className="chart-box" role="img" aria-label="Sleep score trend">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <ReferenceArea y1={70} y2={100} fill="var(--success)" fillOpacity={0.07} stroke="none" />
                <XAxis dataKey="tick" tick={axis} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={axis} tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 50, 70, 100]} />
                <Tooltip content={<Tip unit="score" />} cursor={{ stroke: 'rgba(255,255,255,0.25)' }} />
                <Line type="monotone" dataKey="score" stroke="var(--accent-primary)" strokeWidth={2} connectNulls dot={{ r: 3, strokeWidth: 0, fill: 'var(--accent-primary)' }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  )
}
