'use client'

import { Flame } from 'lucide-react'
import { Section, Row, NumberField } from './controls'

/** Streaks, penalties, rewards and the season pass. */
export default function RulesSection({ s, update }) {
  return (
    <Section id="rules" icon={Flame} color="var(--warning)" title="Rules">
      <Row label="Streak day threshold" hint={`A day counts when ${Math.round(s.streakThreshold * 100)}% of scheduled habits are done`}>
        <input type="range" min="0.5" max="1" step="0.05" value={s.streakThreshold} onChange={(e) => update({ streakThreshold: Number(e.target.value) })} className="settings-range" aria-label="Streak day threshold" />
        <span className="settings-value">{Math.round(s.streakThreshold * 100)}%</span>
      </Row>
      <Row label="Penalty cap" hint={`Repeated misses escalate ×1 → ×1.5 → … up to ×${s.penaltyCap}`}>
        <input type="range" min="1" max="5" step="0.5" value={s.penaltyCap} onChange={(e) => update({ penaltyCap: Number(e.target.value) })} className="settings-range" aria-label="Penalty cap" />
        <span className="settings-value">×{s.penaltyCap}</span>
      </Row>
      <Row label="Auto-fail look-back" hint="Missed habits older than this are never penalised (protects you after a break)">
        <NumberField label="Auto-fail look-back" value={s.autofailDays} min={0} max={30} step={1} onCommit={(v) => update({ autofailDays: v })} /><span className="settings-unit">days</span>
      </Row>
      <Row label="Perfect day bonus" hint="XP for completing every scheduled habit (also rolls the 25% mystery chest)">
        <NumberField label="Perfect day bonus" value={s.perfectDayXp} min={0} max={500} step={5} onCommit={(v) => update({ perfectDayXp: v })} /><span className="settings-unit">XP</span>
      </Row>
      <Row label="Season start" hint="The season pass counts XP gained from this date">
        <input type="date" className="input settings-date" value={s.seasonStart} onChange={(e) => e.target.value && update({ seasonStart: e.target.value })} aria-label="Season start" />
      </Row>
    </Section>
  )
}
