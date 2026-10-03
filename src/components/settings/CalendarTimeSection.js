'use client'

import { Clock } from 'lucide-react'
import { Section, Row, Segmented } from './controls'
import { formatClock } from '@/lib/utils/appDate'

const BOUNDARIES = ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00']

/** Week start, 12/24h clock and the day boundary for night owls. */
export default function CalendarTimeSection({ s, update }) {
  return (
    <Section id="time" icon={Clock} color="var(--info)" title="Calendar & time">
      <Row label="Week starts on" hint="Calendar, weekly reviews and the week grid">
        <Segmented label="Week starts on" value={s.weekStart} options={[{ id: 1, label: 'Monday' }, { id: 0, label: 'Sunday' }]} onChange={(v) => update({ weekStart: v })} />
      </Row>
      <Row label="Clock" hint={`Times show as ${formatClock('21:30', s)}`}>
        <Segmented label="Clock format" value={s.timeFormat} options={[{ id: '24h', label: '24-hour' }, { id: '12h', label: '12-hour' }]} onChange={(v) => update({ timeFormat: v })} />
      </Row>
      <Row label="Day ends at" hint={s.dayBoundary === '00:00' ? 'Midnight. Pick a later time if you often finish after 12' : `Anything before ${formatClock(s.dayBoundary, s)} counts for the previous day`}>
        <select className="select settings-date" value={s.dayBoundary} onChange={(e) => update({ dayBoundary: e.target.value })} aria-label="Day ends at">
          {BOUNDARIES.map((b) => <option key={b} value={b}>{b === '00:00' ? 'Midnight' : formatClock(b, s)}</option>)}
        </select>
      </Row>
    </Section>
  )
}
