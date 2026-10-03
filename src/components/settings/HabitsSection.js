'use client'

import { Repeat, BellRing, X } from 'lucide-react'
import { Section, Row, NumberField, Segmented } from './controls'
import { useOSSlice } from '@/lib/context/OSContext'

const TIMES = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'anytime', label: 'Anytime' },
]

/** Defaults for new habits and per-habit reminder times (fired by AppServices). */
export default function HabitsSection({ s, update }) {
  const { habits = [] } = useOSSlice('habits')
  const active = habits.filter((h) => h.is_active !== false)
  const reminders = s.habitReminders || {}
  const setReminder = (id, time) => {
    const next = { ...reminders }
    if (time) next[id] = time; else delete next[id]
    update({ habitReminders: next })
  }
  return (
    <Section id="habits" icon={Repeat} color="var(--success)" title="Habits">
      <Row label="Default XP" hint="Pre-filled when you create a habit">
        <NumberField label="Default habit XP" value={s.defaultHabitXp} min={1} max={500} step={5} onCommit={(v) => update({ defaultHabitXp: v })} /><span className="settings-unit">XP</span>
      </Row>
      <Row label="Default time of day" stack>
        <Segmented label="Default time of day" value={s.defaultTimeOfDay} options={TIMES} onChange={(v) => update({ defaultTimeOfDay: v })} />
      </Row>
      <div className="set-sub"><BellRing size={13} /> Reminder per habit <span className="settings-hint">Only fires on days the habit is scheduled and still open. Needs notifications on.</span></div>
      {active.length === 0 ? <p className="set-hint">No active habits yet.</p> : (
        <ul className="set-habits">
          {active.map((h) => (
            <li key={h.id}>
              <span className="set-habit-name">{h.title}</span>
              <input type="time" className="input settings-date" value={reminders[h.id] || ''} onChange={(e) => setReminder(h.id, e.target.value)} aria-label={`Reminder for ${h.title}`} />
              {reminders[h.id] && <button type="button" className="tl-icon" onClick={() => setReminder(h.id, null)} aria-label={`Clear reminder for ${h.title}`}><X size={13} /></button>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
