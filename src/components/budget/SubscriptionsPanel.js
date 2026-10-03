'use client'

import { useMemo, useState } from 'react'
import { Plus, CreditCard, Pencil, Trash2, CalendarClock, Repeat } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import SchemaHint from '@/components/ui/SchemaHint'
import { useTable } from '@/lib/hooks/useTable'
import { getSettings } from '@/lib/settings'
import { getLocalDateStr } from '@/lib/utils/dates'
import { formatMoney } from '@/lib/utils/money'
import { CYCLES, monthlyCost, advanceDate, runSubscriptionAutopilot } from '@/lib/utils/subscriptions'
import { BUDGET_CATEGORIES } from '@/lib/utils/budget'

const daysUntil = (d, today) => Math.round((new Date(`${d}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000)
const relDay = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? `${-n}d overdue` : `in ${n} days`)

function SubForm({ sub, onClose, onSave }) {
  const today = getLocalDateStr()
  const [f, setF] = useState(() => ({
    name: sub?.name || '',
    amount: sub?.amount ?? '',
    cycle: sub?.cycle || 'monthly',
    next_charge_date: sub?.next_charge_date || today,
    category: sub?.category || 'subscriptions',
    active: sub?.active ?? true,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))
  const submit = async (e) => {
    e.preventDefault()
    if (!f.name.trim() || !(Number(f.amount) > 0)) { setError('Name and an amount above 0 are required.'); return }
    setBusy(true)
    const res = await onSave({ name: f.name.trim(), amount: Number(f.amount), cycle: f.cycle, next_charge_date: f.next_charge_date, billing_day: new Date(`${f.next_charge_date}T12:00:00`).getDate(), category: f.category, active: f.active, currency: 'INR' })
    setBusy(false)
    if (res?.error) setError(res.error.message); else onClose()
  }
  return (
    <form className="td" onSubmit={submit}>
      <input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Claude Pro, Jio Fiber, Gym" autoFocus aria-label="Name" />
      <div className="td-grid">
        <div className="td-field"><label className="td-label" htmlFor="sf-amt">Amount ({getSettings().currency || '₹'})</label><input id="sf-amt" className="input" type="number" min="0" step="1" inputMode="decimal" value={f.amount} onChange={set('amount')} /></div>
        <div className="td-field"><label className="td-label" htmlFor="sf-cy">Cycle</label><select id="sf-cy" className="select" value={f.cycle} onChange={set('cycle')}>{Object.entries(CYCLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div className="td-grid">
        <div className="td-field"><label className="td-label" htmlFor="sf-next">Next charge</label><input id="sf-next" className="input" type="date" value={f.next_charge_date} onChange={set('next_charge_date')} /></div>
        <div className="td-field"><label className="td-label" htmlFor="sf-cat">Category</label><select id="sf-cat" className="select" value={f.category} onChange={set('category')}>{BUDGET_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.shortLabel}</option>)}</select></div>
      </div>
      <label className="sub-active"><input type="checkbox" checked={f.active} onChange={(e) => set('active')(e.target.checked)} /> Active — log it automatically on the billing date</label>
      {error && <p className="tm-warn">{error}</p>}
      <button type="submit" className="btn btn-primary td-submit" disabled={busy}>{busy ? 'Saving…' : sub ? 'Save' : 'Add subscription'}</button>
    </form>
  )
}

/** Budget → Subscriptions (#25): recurring bills logged automatically. */
export default function SubscriptionsPanel({ userId, billsLimit }) {
  const subs = useTable('subscriptions', userId, { order: ['next_charge_date', true] })
  const [editing, setEditing] = useState(null) // sub | 'new'
  const [running, setRunning] = useState(false)
  const today = getLocalDateStr()

  const active = subs.rows.filter((s) => s.active)
  const monthly = useMemo(() => active.reduce((sum, s) => sum + monthlyCost(s), 0), [active])
  const upcoming = useMemo(() => active.filter((s) => { const n = daysUntil(s.next_charge_date, today); return n >= 0 && n <= 7 }), [active, today])
  const pct = billsLimit ? Math.min(1, monthly / billsLimit) : 0

  if (subs.missing) return <section className="hud-panel p-5"><SchemaHint feature="Subscriptions" /></section>

  const runNow = async () => {
    setRunning(true)
    await runSubscriptionAutopilot(userId)
    subs.reload()
    setRunning(false)
  }

  return (
    <div className="bud-panel">
      <section className="hud-panel p-5 sub-summary">
        <div className="sub-total">
          <span className="record-label">Monthly total</span>
          <span className="record-value">{formatMoney(monthly)}</span>
          <span className="record-sub">{active.length} active · bills limit {formatMoney(billsLimit)}</span>
        </div>
        <div className="sub-bar" aria-label={`${Math.round(pct * 100)}% of the monthly bills limit`}><span style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--danger)' : pct > 0.8 ? 'var(--warning)' : 'var(--accent-gradient)' }} /></div>
        <div className="sub-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={14} /> Subscription</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={runNow} disabled={running}>{running ? 'Checking…' : 'Log due charges now'}</button>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="sub-upcoming" aria-label="Upcoming in 7 days">
          <span className="sub-up-label"><CalendarClock size={13} /> Next 7 days</span>
          {upcoming.map((s) => <span key={s.id} className="sub-up-chip"><b>{s.name}</b> {formatMoney(s.amount)} · {relDay(daysUntil(s.next_charge_date, today))}</span>)}
        </section>
      )}

      {subs.rows.length === 0 && !subs.loading ? (
        <div className="tb-empty"><div className="tb-empty-art"><CreditCard size={22} /></div><p>Add your recurring bills once — they log themselves from then on.</p><button type="button" className="tb-empty-cta" onClick={() => setEditing('new')}><Plus size={13} /> Add a subscription</button></div>
      ) : (
        <div className="sub-list">
          {subs.rows.map((s) => {
            const n = daysUntil(s.next_charge_date, today)
            return (
              <article key={s.id} className={`sub-row ${s.active ? '' : 'is-off'}`}>
                <span className="sub-icon"><CreditCard size={16} /></span>
                <div className="sub-main">
                  <b>{s.name}</b>
                  <span><Repeat size={11} /> {CYCLES[s.cycle]} · next {new Date(`${s.next_charge_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ({relDay(n)}) · then {new Date(`${advanceDate(s.next_charge_date, s.cycle, s.billing_day)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <span className="sub-amt">{formatMoney(s.amount)}<em>/{s.cycle === 'weekly' ? 'wk' : s.cycle === 'yearly' ? 'yr' : 'mo'}</em></span>
                <button type="button" className={`settings-toggle ${s.active ? 'is-on' : ''}`} onClick={() => subs.update(s.id, { active: !s.active })} aria-label={s.active ? 'Pause' : 'Activate'} aria-pressed={s.active}><span /></button>
                <button type="button" className="tl-icon" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
                <button type="button" className="tl-icon is-danger" onClick={() => { if (window.confirm(`Delete ${s.name}? Past charges stay in your budget log.`)) subs.remove(s.id) }} aria-label={`Delete ${s.name}`}><Trash2 size={14} /></button>
              </article>
            )
          })}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New subscription' : 'Edit subscription'}>
        {editing && <SubForm key={editing === 'new' ? 'new' : editing.id} sub={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={(row) => (editing === 'new' ? subs.insert(row) : subs.update(editing.id, row))} />}
      </Sheet>
    </div>
  )
}
