'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, ChevronLeft, ChevronRight, Download, Trash2, Plus, ExternalLink } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import SchemaHint from '@/components/ui/SchemaHint'
import { useOSSlice } from '@/lib/context/OSContext'
import { getLocalDateStr } from '@/lib/utils/dates'
import { isMissingSchema } from '@/lib/utils/schema'
import { BIZ_CATEGORIES, PAYMENT_MODES, bizCategory, inr, fetchBusinessExpenses, addBusinessExpense, deleteBusinessExpense, monthSummary, monthKey, shiftMonth, monthLabel, toCsv } from '@/lib/utils/businessExpenses'

const MIGRATION = 'supabase/migrations/20261106_business_expenses.sql'
const fmtDay = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function AddForm({ userId, onSaved }) {
  const blank = { amount: '', category: 'software', vendor: '', description: '', date: getLocalDateStr(), payment_mode: 'upi', receipt_url: '' }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    if (!userId || busy) return
    setBusy(true); setError(null)
    const res = await addBusinessExpense(userId, f)
    setBusy(false)
    if (res.error) { setError(res.error.message); return }
    setF({ ...blank, category: f.category, payment_mode: f.payment_mode, date: f.date })
    onSaved()
  }
  return (
    <form className="pf-card bx-form" onSubmit={save}>
      <div className="pf-card-head">Log a business expense</div>
      <div className="bx-row">
        <label className="bx-amount"><span>₹</span><input className="input" type="number" min="1" step="any" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="Amount" aria-label="Amount" required /></label>
        <input className="input" type="date" value={f.date} onChange={set('date')} aria-label="Date" />
      </div>
      <div className="bx-chips" role="radiogroup" aria-label="Category">
        {BIZ_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={f.category === c.id} className={`tk-chip ${f.category === c.id ? 'is-on' : ''}`} onClick={() => setF((x) => ({ ...x, category: c.id }))}>
            <i className="bx-dot" style={{ background: c.color }} /> {c.label}
          </button>
        ))}
      </div>
      <div className="bx-row">
        <input className="input" value={f.vendor} onChange={set('vendor')} placeholder="Paid to (vendor)" aria-label="Vendor" />
        <input className="input" value={f.description} onChange={set('description')} placeholder="What for?" aria-label="Description" />
      </div>
      <div className="bx-row">
        <div className="bx-chips" role="radiogroup" aria-label="Payment mode">
          {PAYMENT_MODES.map((m) => <button key={m} type="button" role="radio" aria-checked={f.payment_mode === m} className={`tk-chip ${f.payment_mode === m ? 'is-on' : ''}`} onClick={() => setF((x) => ({ ...x, payment_mode: m }))}>{m.toUpperCase()}</button>)}
        </div>
        <input className="input" type="url" value={f.receipt_url} onChange={set('receipt_url')} placeholder="Receipt / invoice link (optional)" aria-label="Receipt link" />
      </div>
      {error && <p className="tm-warn">Couldn&apos;t save: {error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy || !f.amount}><Plus size={16} /> {busy ? 'Saving…' : 'Add expense'}</button>
    </form>
  )
}

export default function BusinessExpensesPage() {
  const { user } = useOSSlice('auth')
  const [state, setState] = useState({ rows: [], loading: true, missing: false })
  const [month, setMonth] = useState(() => monthKey())

  const load = useCallback(async () => {
    if (!user?.id) return
    const { rows, error } = await fetchBusinessExpenses(user.id)
    setState({ rows, loading: false, missing: isMissingSchema(error) })
  }, [user?.id])
  useEffect(() => { load() }, [load])

  const cur = useMemo(() => monthSummary(state.rows, month), [state.rows, month])
  const prev = useMemo(() => monthSummary(state.rows, shiftMonth(month, -1)), [state.rows, month])
  const trend = useMemo(() => [-5, -4, -3, -2, -1, 0].map((n) => monthSummary(state.rows, shiftMonth(month, n))), [state.rows, month])
  const yearTotal = useMemo(() => state.rows.filter((r) => String(r.date).startsWith(month.slice(0, 4))).reduce((s, r) => s + Number(r.amount || 0), 0), [state.rows, month])
  const peak = Math.max(1, ...trend.map((t) => t.total))
  const delta = prev.total ? Math.round(((cur.total - prev.total) / prev.total) * 100) : null

  const remove = async (r) => {
    if (!confirm(`Delete ${inr(r.amount)} · ${r.description || bizCategory(r.category).label}?`)) return
    await deleteBusinessExpense(user.id, r.id)
    load()
  }
  const exportCsv = () => {
    const blob = new Blob([toCsv(cur.rows)], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `business-expenses-${month}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  if (state.loading) return <AppShell><WinterLoader label="Loading business expenses" /></AppShell>

  return (
    <AppShell>
      <div className="page-container bx-page">
        <header className="tk-head">
          <div>
            <h1 className="page-title flex items-center gap-3"><Building2 className="text-amber" /> Business expenses</h1>
            <p className="page-subtitle">Business spend — kept apart from your personal budget.</p>
          </div>
        </header>

        {state.missing ? <SchemaHint feature="Business expenses" file={MIGRATION} /> : <AddForm userId={user?.id} onSaved={load} />}

        <section className="pf-card bx-month">
          <div className="bx-month-head">
            <button type="button" className="tl-icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <b>{monthLabel(month)}</b>
            <button type="button" className="tl-icon" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= monthKey()} aria-label="Next month"><ChevronRight size={16} /></button>
            {cur.count > 0 && <button type="button" className="tk-chip bx-export" onClick={exportCsv}><Download size={13} /> CSV</button>}
          </div>
          <div className="bx-stats">
            <div><span>This month</span><b>{inr(cur.total)}</b><small>{cur.count} expense{cur.count === 1 ? '' : 's'}{delta !== null ? ` · ${delta >= 0 ? '+' : ''}${delta}% vs last month` : ''}</small></div>
            <div><span>Last month</span><b>{inr(prev.total)}</b><small>{monthLabel(prev.month)}</small></div>
            <div><span>{month.slice(0, 4)} so far</span><b>{inr(yearTotal)}</b><small>all categories</small></div>
          </div>

          {cur.byCategory.length > 0 && (
            <ul className="bx-cats" aria-label="Spend by category">
              {cur.byCategory.map((c) => (
                <li key={c.id}>
                  <span className="bx-cat-name"><i className="bx-dot" style={{ background: c.color }} /> {c.label}</span>
                  <span className="bx-bar"><i style={{ width: `${(c.amount / cur.total) * 100}%`, background: c.color }} /></span>
                  <b>{inr(c.amount)}</b>
                </li>
              ))}
            </ul>
          )}

          <div className="bx-trend" aria-label="Last 6 months">
            {trend.map((t) => (
              <button key={t.month} type="button" className={`bx-trend-col ${t.month === month ? 'is-on' : ''}`} onClick={() => setMonth(t.month)} title={`${monthLabel(t.month)}: ${inr(t.total)}`}>
                <span className="bx-trend-bar"><i style={{ height: `${(t.total / peak) * 100}%` }} /></span>
                <small>{new Date(`${t.month}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="pf-card">
          <div className="pf-card-head">{monthLabel(month)} · entries</div>
          {cur.rows.length === 0 ? <p className="bx-empty">No business expenses logged this month.</p> : (
            <ul className="bx-list">
              {cur.rows.map((r) => (
                <li key={r.id}>
                  <i className="bx-dot" style={{ background: bizCategory(r.category).color }} />
                  <div className="bx-item">
                    <b>{r.description || bizCategory(r.category).label}</b>
                    <small>{fmtDay(r.date)} · {bizCategory(r.category).label}{r.vendor ? ` · ${r.vendor}` : ''}{r.payment_mode ? ` · ${r.payment_mode.toUpperCase()}` : ''}</small>
                  </div>
                  {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noreferrer" className="tl-icon" aria-label="Open receipt"><ExternalLink size={13} /></a>}
                  <b className="bx-amt">{inr(r.amount)}</b>
                  <button type="button" className="tl-icon" onClick={() => remove(r)} aria-label="Delete expense"><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  )
}
