'use client'

import Link from 'next/link'
import { Flag, ListChecks, Quote, Check, AlertTriangle, Pause } from 'lucide-react'
import Ring from '@/components/ui/Ring'
import { typeLabel, countdown, milestonesOf, tasksOf, COVER_COLORS } from '@/lib/utils/missions'

export function Cover({ goal, size = 'md' }) {
  const cover = goal?.cover || ''
  const isColor = COVER_COLORS.includes(cover)
  return (
    <span className={`ms-cover ms-cover--${size} ${isColor ? `is-${cover}` : 'is-violet'}`} aria-hidden>
      {!isColor && cover ? cover : !cover ? <Flag size={size === 'lg' ? 26 : 16} /> : null}
    </span>
  )
}

/** Grid card for one mission: ring, type, countdown, why, milestone / task counts. */
export default function MissionCard({ goal, progress, milestones, tasks, today }) {
  const ms = milestonesOf(goal.id, milestones)
  const ts = tasksOf(goal.id, tasks)
  const cd = countdown(goal, today)
  const done = goal.status === 'completed'
  const failed = goal.status === 'failed' || goal.status === 'cancelled'
  const paused = goal.status === 'paused'
  const color = done ? 'var(--success)' : failed ? 'var(--danger)' : 'var(--accent-primary)'
  return (
    <Link href={`/goals/${goal.id}`} className={`ms-card ${done ? 'is-done' : ''} ${failed ? 'is-failed' : ''} ${cd?.urgent ? 'is-urgent' : ''}`}>
      <div className={`ms-card-band ms-band--${COVER_COLORS.includes(goal.cover) ? goal.cover : 'violet'}`} aria-hidden />
      <div className="ms-card-top">
        <Cover goal={goal} />
        <span className={`ms-type ms-type--${goal.type || 'side_quest'}`}>{typeLabel(goal)}</span>
        {paused && <span className="ms-type is-paused"><Pause size={10} /> Paused</span>}
        {cd && <span className={`ms-cd ${cd.urgent ? 'is-urgent' : ''}`}>{cd.late && <AlertTriangle size={11} />}{cd.text}</span>}
        {done && <span className="ms-cd is-done"><Check size={11} /> Done</span>}
      </div>
      <div className="ms-card-mid">
        <Ring value={progress / 100} size={62} stroke={6} color={color} gradient={!done && !failed}>
          <b className="ms-ring-num">{progress}%</b>
        </Ring>
        <h3 className="ms-card-title">{goal.title}</h3>
      </div>
      {goal.why && <p className="ms-why"><Quote size={11} /> {goal.why}</p>}
      <div className="ms-card-foot">
        {ms.length > 0 && <span><Flag size={11} /> {ms.filter((m) => m.done_at).length}/{ms.length} milestones</span>}
        {ts.length > 0 && <span><ListChecks size={12} /> {ts.filter((t) => t.status === 'completed').length}/{ts.length} tasks</span>}
        {!ms.length && !ts.length && <span>No milestones yet</span>}
      </div>
    </Link>
  )
}
