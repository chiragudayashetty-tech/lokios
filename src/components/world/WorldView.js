'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Play, Pause, RotateCcw, TreePine, Home, Landmark, Sailboat, CloudRain, Sun, Cloud, CloudFog, X, ArrowUpRight } from 'lucide-react'
import IslandScene from '@/components/world/IslandScene'
import { buildWorld, worldStart, worldDiff, TREE_STAGES, TASKS_PER_HOUSE } from '@/lib/world/worldModel'
import { getLocalDateStr } from '@/lib/utils/dates'

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }
const span = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000)
const fmt = (ds, o = { month: 'short', day: 'numeric', year: 'numeric' }) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', o)
const WEATHER = { clear: { Icon: Sun, label: 'Clear skies' }, cloudy: { Icon: Cloud, label: 'Cloudy' }, rain: { Icon: CloudRain, label: 'Rain' } }

function Details({ o, onClose }) {
  if (!o) return null
  let body
  if (o.kind === 'tree') {
    const next = TREE_STAGES[o.stage + 1]
    body = (
      <>
        <b>{o.name}</b>
        <span>{o.stump ? 'Habit stopped — a stump remains.' : `${TREE_STAGES[o.stage].name} · ${o.count} check-ins`}</span>
        {!o.stump && next && <span>{next.min - o.count} more to become a {next.name.toLowerCase()}.</span>}
        {o.dry && <span className="is-bad">Drying out: not done in 7+ days. One check-in turns it green again.</span>}
        {o.bloom && <span className="is-good">In bloom: done this day.</span>}
      </>
    )
  } else if (o.kind === 'house') {
    body = (<><b>{o.name}</b><span>Built {fmt(o.built)} from {o.tasks.length} finished tasks:</span><ul>{o.tasks.map((t, i) => <li key={i}>{t}</li>)}</ul></>)
  } else {
    body = (
      <>
        <b>{o.name}</b>
        <span>{o.kind === 'landmark' ? `Landmark · mission completed ${fmt(o.completed)}` : o.kind === 'ruin' ? 'Ruin · mission failed' : `Under construction · ${o.progress}% of its tasks done`}</span>
        {o.deadline && o.kind === 'site' && <span className={o.late ? 'is-bad' : ''}>Deadline {fmt(o.deadline)}{o.late ? ' — past deadline, scaffolding turned red' : ''}</span>}
      </>
    )
  }
  return (
    <div className="wd-details" role="status">
      <button type="button" className="wd-x" onClick={onClose} aria-label="Close"><X size={14} /></button>
      {body}
    </div>
  )
}

/** Full island: tap anything, scrub the timelapse from day one to today. */
export default function WorldView({ data }) {
  const today = getLocalDateStr()
  const start = useMemo(() => worldStart(data), [data])
  const total = Math.max(0, span(start, today))
  const [offset, setOffset] = useState(null) // null = today
  const [playing, setPlaying] = useState(false)
  const [picked, setPicked] = useState(null)
  const asOf = offset == null ? today : addDays(start, offset)
  const world = useMemo(() => buildWorld(data, asOf), [data, asOf])
  const prev = useMemo(() => buildWorld(data, addDays(asOf, -1)), [data, asOf])
  const changes = useMemo(() => worldDiff(prev, world), [prev, world])
  const timer = useRef(null)

  useEffect(() => {
    if (!playing) return
    const step = Math.max(1, Math.round(total / 120)) // a whole history plays in ~12s
    timer.current = setInterval(() => {
      setOffset((o) => {
        const n = (o ?? 0) + step
        if (n >= total) { setPlaying(false); return null }
        return n
      })
    }, 100)
    return () => clearInterval(timer.current)
  }, [playing, total])

  const pickedObj = picked && [...world.trees, ...world.houses, ...world.landmarks].find((o) => o.id === picked)
  const W = WEATHER[world.weather]
  const s = world.stats

  return (
    <div className="wd">
      <div className="wd-stage">
        <IslandScene world={world} picked={picked} onPick={(o) => setPicked(o.id === picked ? null : o.id)} />
        <div className="wd-badge"><W.Icon size={13} /> {W.label}{world.fog ? ` · fog (${world.fogMinutes}m over screen limits)` : ''}</div>
        <Details o={pickedObj} onClose={() => setPicked(null)} />
      </div>

      <div className="wd-time">
        <button type="button" className="tl-icon" onClick={() => { if (!playing && offset == null) setOffset(0); setPlaying((p) => !p) }} aria-label={playing ? 'Pause timelapse' : 'Play timelapse'} disabled={!total}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <input type="range" min={0} max={total} value={offset ?? total} onChange={(e) => { setPlaying(false); const v = +e.target.value; setOffset(v >= total ? null : v) }} aria-label="Timelapse date" disabled={!total} />
        <button type="button" className="tl-icon" onClick={() => { setPlaying(false); setOffset(null) }} aria-label="Back to today" disabled={offset == null}><RotateCcw size={14} /></button>
      </div>
      <div className="wd-when">
        <b>{offset == null ? 'Today' : fmt(asOf, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</b>
        <span>Day {world.age} of your island</span>
      </div>
      {changes.length > 0 && <ul className="wd-changes">{changes.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}</ul>}

      <div className="wd-stats">
        <div><TreePine size={14} /><b>{s.trees}</b><span>trees · {s.ancient} great+{s.dry ? ` · ${s.dry} dry` : ''}</span></div>
        <div><Home size={14} /><b>{s.houses}</b><span>houses · next in {world.nextHouse} task{world.nextHouse === 1 ? '' : 's'}</span></div>
        <div><Landmark size={14} /><b>{s.landmarks}</b><span>landmarks · {s.sites} building</span></div>
        <div><Sailboat size={14} /><b>{world.boats}</b><span>boats · {world.streak}-day streak</span></div>
      </div>

      <details className="wd-rules">
        <summary>How the island grows</summary>
        <ul>
          <li><TreePine size={12} /> Every habit is a tree. It grows with check-ins: sprout (1), sapling (5), tree (15), great tree (40), ancient (100). It blooms on days you do it and dries out after 7 days untouched. Stopped habits leave a stump.</li>
          <li><Home size={12} /> Every {TASKS_PER_HOUSE} finished tasks build a house in the village.</li>
          <li><Landmark size={12} /> Each mission is a construction site that rises with its tasks. Finished missions become landmarks; failed ones become ruins. Past-deadline sites turn red.</li>
          <li><Sailboat size={12} /> One boat for each full week of your streak.</li>
          <li><CloudRain size={12} /> Weather follows the day: clear at 70%+ habits, cloudy below, rain when the day falls apart. <CloudFog size={12} /> Fog when social, YouTube or entertainment went over the limit.</li>
          <li>Day and night follow your clock.</li>
        </ul>
      </details>
    </div>
  )
}

/** Compact island for Home. */
export function WorldCard({ data }) {
  const world = useMemo(() => (data ? buildWorld(data, getLocalDateStr()) : null), [data])
  if (!world) return null
  const W = WEATHER[world.weather]
  return (
    <Link href="/world" className="dashboard-card wd-card" aria-label="Open your island">
      <IslandScene world={world} compact />
      <div className="wd-card-foot">
        <span><W.Icon size={12} /> {world.stats.trees} trees · {world.stats.houses} houses · {world.stats.landmarks} landmarks</span>
        <span className="wd-card-go">Island <ArrowUpRight size={12} /></span>
      </div>
    </Link>
  )
}
