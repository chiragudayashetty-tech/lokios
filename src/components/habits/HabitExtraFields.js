'use client'

import { Sunrise, CloudSun, Sunset, Infinity as InfinityIcon, Link2, Target } from 'lucide-react'
import SchemaHint from '@/components/ui/SchemaHint'
import { canFollow } from '@/lib/utils/habitChains'

export const TIMES_OF_DAY = [
  { id: 'morning', label: 'Morning', icon: Sunrise },
  { id: 'afternoon', label: 'Afternoon', icon: CloudSun },
  { id: 'evening', label: 'Evening', icon: Sunset },
  { id: 'anytime', label: 'Anytime', icon: InfinityIcon },
]

/**
 * Round-2 habit fields: time of day (#41), "do this after…" (#17) and the mission
 * it supports (#37). value = { time_of_day, after_habit_id, goal_id }.
 * Hidden behind a hint while the habits table lacks the new columns.
 */
export default function HabitExtraFields({ value, onChange, habitId = null, habits = [], goals = [], available = true }) {
  if (!available) return <SchemaHint feature="Time of day, habit chains and mission links" />
  const set = (k, v) => onChange({ ...value, [k]: v })
  const options = habits.filter((h) => h.id !== habitId && h.is_active !== false && (!habitId || canFollow(habits, habitId, h.id)))
  const activeGoals = goals.filter((g) => !['completed', 'cancelled', 'failed'].includes(g.status) || g.id === value.goal_id)
  return (
    <div className="hx">
      <div className="hx-field">
        <span className="hx-label">Time of day</span>
        <div className="hx-seg" role="radiogroup" aria-label="Time of day">
          {TIMES_OF_DAY.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={(value.time_of_day || 'anytime') === id} className={(value.time_of_day || 'anytime') === id ? 'is-on' : ''} onClick={() => set('time_of_day', id)}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="hx-row">
        <label className="hx-field">
          <span className="hx-label"><Link2 size={11} /> Do this after…</span>
          <select className="select" value={value.after_habit_id || ''} onChange={(e) => set('after_habit_id', e.target.value || null)}>
            <option value="">No chain</option>
            {options.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
          </select>
        </label>
        <label className="hx-field">
          <span className="hx-label"><Target size={11} /> Supports mission</span>
          <select className="select" value={value.goal_id || ''} onChange={(e) => set('goal_id', e.target.value || null)}>
            <option value="">None</option>
            {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>
      </div>
      {value.after_habit_id && <p className="hx-hint">Doing it right after its predecessor pays +5 XP per link, and +25 for a chain of 3+ in order.</p>}
    </div>
  )
}
