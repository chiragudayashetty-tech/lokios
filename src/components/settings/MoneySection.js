'use client'

import { Wallet } from 'lucide-react'
import { Section, Row, NumberField } from './controls'

const CURRENCIES = ['₹', '$', '€', '£', '¥', 'AED ', 'S$']

/** Currency and budget limits (budget pages read these). */
export default function MoneySection({ s, update }) {
  return (
    <Section id="money" icon={Wallet} color="var(--success)" title="Money">
      <Row label="Currency" hint="Symbol used across budget, subscriptions and savings">
        <select className="select settings-date" value={s.currency} onChange={(e) => update({ currency: e.target.value })} aria-label="Currency">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c.trim()}</option>)}
        </select>
      </Row>
      <Row label="Daily allowance" hint="Everyday spending. Bills & subscriptions don't count here">
        <span className="settings-unit">{s.currency}</span><NumberField label="Daily allowance" value={s.dailyBudget} min={0} max={1000000} step={50} onCommit={(v) => update({ dailyBudget: v })} />
      </Row>
      <Row label="Monthly bills limit" hint="Subscriptions, rent, utilities">
        <span className="settings-unit">{s.currency}</span><NumberField label="Monthly bills limit" value={s.monthlyBills} min={0} max={10000000} step={500} onCommit={(v) => update({ monthlyBills: v })} />
      </Row>
    </Section>
  )
}
