'use client'

import { useMemo, useState } from 'react'
import { Plus, Minus, PiggyBank, Trash2, History, Pencil, Trophy } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import SchemaHint from '@/components/ui/SchemaHint'
import { useTable } from '@/lib/hooks/useTable'
import { getSettings } from '@/lib/settings'
import { getLocalDateStr } from '@/lib/utils/dates'
import { formatMoney } from '@/lib/utils/money'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { emitGame } from '@/lib/utils/gamification'
import { celebrateBig } from '@/lib/utils/celebrate'

export const JAR_DONE_XP = 50
const EMOJIS = ['🏍️', '💻', '✈️', '🏠', '📷', '🎓', '🛟', '💍', '🎸', '🚀']

/** Animated liquid jar (pct 0–1). */
export function Jar({ pct, size = 86, done }) {
  const fill = Math.max(0, Math.min(1, pct))
  const y = 100 - fill * 86 - 8
  return (
    <svg className={`jar ${done ? 'is-done' : ''}`} width={size} height={size * 1.15} viewBox="0 0 100 115" aria-hidden>
      <defs>
        <clipPath id={`jar-clip-${size}`}><path d="M24 14 h52 v8 c10 4 14 12 14 22 v52 c0 10 -8 16 -18 16 H28 C18 112 10 106 10 96 V44 c0 -10 4 -18 14 -22 z" /></clipPath>
        <linearGradient id="jar-liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-2)" /><stop offset="100%" stopColor="var(--accent-primary)" /></linearGradient>
      </defs>
      <g clipPath={`url(#jar-clip-${size})`}>
        <rect x="0" y="0" width="100" height="115" fill="rgba(255,255,255,0.04)" />
        <g className="jar-liquid" style={{ transform: `translateY(${y}px)` }}>
          <path className="jar-wave" d="M-100 8 q 25 -8 50 0 t 50 0 t 50 0 t 50 0 t 50 0 v 140 h -250 z" fill="url(#jar-liquid)" opacity="0.95" />
          <path className="jar-wave jar-wave--b" d="M-100 10 q 25 -6 50 0 t 50 0 t 50 0 t 50 0 t 50 0 v 140 h -250 z" fill="var(--accent-primary)" opacity="0.45" />
        </g>
      </g>
      <path d="M24 14 h52 v8 c10 4 14 12 14 22 v52 c0 10 -8 16 -18 16 H28 C18 112 10 106 10 96 V44 c0 -10 4 -18 14 -22 z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
      <rect x="20" y="6" width="60" height="10" rx="4" fill="rgba(255,255,255,0.18)" />
    </svg>
  )
}

function JarForm({ jar, onSave, onClose }) {
  const [f, setF] = useState(() => ({ name: jar?.name || '', emoji: jar?.emoji || '🚀', target_amount: jar?.target_amount ?? '', target_date: jar?.target_date || '' }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))
  const submit = async (e) => {
    e.preventDefault()
    if (!f.name.trim() || !(Number(f.target_amount) > 0)) { setError('A name and a target above 0 are required.'); return }
    setBusy(true)
    const res = await onSave({ name: f.name.trim(), emoji: f.emoji, target_amount: Number(f.target_amount), target_date: f.target_date || null })
    setBusy(false)
    if (res?.error) setError(res.error.message); else onClose()
  }
  return (
    <form className="td" onSubmit={submit}>
      <input className="input" value={f.name} onChange={set('name')} placeholder="e.g. New laptop, Emergency fund" autoFocus aria-label="Jar name" />
      <div className="ms-cover-pick">{EMOJIS.map((e) => <button key={e} type="button" className={`ms-cover-opt is-emoji ${f.emoji === e ? 'is-on' : ''}`} onClick={() => set('emoji')(e)} aria-label={`Emoji ${e}`}>{e}</button>)}</div>
      <div className="td-grid">
        <div className="td-field"><label className="td-label" htmlFor="jf-t">Target ({getSettings().currency || '₹'})</label><input id="jf-t" className="input" type="number" min="1" inputMode="decimal" value={f.target_amount} onChange={set('target_amount')} /></div>
        <div className="td-field"><label className="td-label" htmlFor="jf-d">Target date</label><input id="jf-d" className="input" type="date" value={f.target_date} onChange={set('target_date')} /></div>
      </div>
      {error && <p className="tm-warn">{error}</p>}
      <button type="submit" className="btn btn-primary td-submit" disabled={busy}>{busy ? 'Saving…' : jar ? 'Save jar' : 'Create jar'}</button>
    </form>
  )
}

function MoneyForm({ jar, mode, onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const max = mode === 'withdraw' ? Number(jar.saved_amount) || 0 : Infinity
  const submit = async (e) => {
    e.preventDefault()
    const v = Number(amount)
    if (!(v > 0) || v > max) return
    setBusy(true)
    await onSubmit(mode === 'withdraw' ? -v : v, note.trim() || null)
    setBusy(false)
    onClose()
  }
  return (
    <form className="td" onSubmit={submit}>
      <div className="jar-quick">{[500, 1000, 2000, 5000].map((v) => <button key={v} type="button" className={`td-pill ${Number(amount) === v ? 'is-on' : ''}`} onClick={() => setAmount(String(v))} disabled={v > max}>{formatMoney(v)}</button>)}</div>
      <input className="input jar-amount" type="number" min="1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" autoFocus aria-label="Amount" />
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
      {mode === 'withdraw' && <p className="tm-sub">Available: {formatMoney(max)}</p>}
      <button type="submit" className={`btn ${mode === 'withdraw' ? 'btn-secondary' : 'btn-primary'} td-submit`} disabled={busy || !(Number(amount) > 0) || Number(amount) > max} data-celebrate={mode === 'add' ? '' : undefined}>{mode === 'withdraw' ? 'Withdraw' : 'Add to jar'}</button>
    </form>
  )
}

/** Budget → Savings (#26): jars with liquid fill, deposits / withdrawals, history and a finish bonus. */
export default function SavingsPanel({ userId }) {
  const jars = useTable('savings_goals', userId)
  const entries = useTable('savings_entries', userId, { order: ['created_at', false] })
  const [sheet, setSheet] = useState(null) // { kind: 'new' | 'edit' | 'add' | 'withdraw', jar }
  const [open, setOpen] = useState(null)
  const today = getLocalDateStr()

  const totals = useMemo(() => {
    const m = new Map()
    for (const e of entries.rows) m.set(e.goal_id, (m.get(e.goal_id) || 0) + Number(e.amount))
    return m
  }, [entries.rows])

  if (jars.missing || entries.missing) return <section className="hud-panel p-5"><SchemaHint feature="Savings jars" /></section>

  const move = async (jar, amount, note) => {
    const res = await entries.insert({ goal_id: jar.id, amount, note })
    if (res.error) return
    const saved = Math.max(0, (totals.get(jar.id) || 0) + amount)
    const patch = { saved_amount: saved }
    const reached = saved >= Number(jar.target_amount)
    if (reached && !jar.completed_at) patch.completed_at = new Date().toISOString()
    await jars.update(jar.id, patch)
    if (reached && !jar.completed_at) {
      await robustAwardXP(userId, JAR_DONE_XP, 'savings_jar', `jar_${jar.id}_done`, `🫙 Savings goal reached — ${jar.name}`, 'discipline')
      celebrateBig()
      emitGame('toast', { icon: 'piggy', title: `${jar.name} fully funded!`, sub: `${formatMoney(jar.target_amount)} saved · +${JAR_DONE_XP} XP`, tone: 'gold', big: true })
    }
  }

  const all = [...jars.rows].sort((a, b) => (!!a.completed_at - !!b.completed_at) || String(a.target_date || '9999').localeCompare(String(b.target_date || '9999')))
  const totalSaved = all.reduce((s, j) => s + (totals.get(j.id) ?? Number(j.saved_amount) ?? 0), 0)

  return (
    <div className="bud-panel">
      <section className="hud-panel p-5 sub-summary">
        <div className="sub-total">
          <span className="record-label">Saved across jars</span>
          <span className="record-value">{formatMoney(totalSaved)}</span>
          <span className="record-sub">{all.filter((j) => !j.completed_at).length} in progress · deposits don&apos;t count as spending</span>
        </div>
        <div className="sub-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => setSheet({ kind: 'new' })}><Plus size={14} /> New jar</button></div>
      </section>

      {all.length === 0 && !jars.loading ? (
        <div className="tb-empty"><div className="tb-empty-art"><PiggyBank size={22} /></div><p>Name what you&apos;re saving for and watch the jar fill.</p><button type="button" className="tb-empty-cta" onClick={() => setSheet({ kind: 'new' })}><Plus size={13} /> Create a jar</button></div>
      ) : (
        <div className="jar-grid">
          {all.map((j) => {
            const saved = totals.get(j.id) ?? Number(j.saved_amount) ?? 0
            const target = Number(j.target_amount) || 1
            const pct = saved / target
            const left = Math.max(0, target - saved)
            const days = j.target_date ? Math.round((new Date(`${j.target_date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000) : null
            const perWeek = days != null && days > 0 && left > 0 ? left / Math.max(1, days / 7) : null
            const hist = entries.rows.filter((e) => e.goal_id === j.id)
            return (
              <article key={j.id} className={`jar-card ${j.completed_at ? 'is-done' : ''}`}>
                <div className="jar-top">
                  <Jar pct={pct} done={!!j.completed_at} />
                  <div className="jar-info">
                    <span className="jar-name"><span className="jar-emoji">{j.emoji || '🫙'}</span> {j.name}</span>
                    <span className="jar-amounts"><b>{formatMoney(saved)}</b> / {formatMoney(target)}</span>
                    <span className="jar-pct">{Math.min(100, Math.round(pct * 100))}%{j.completed_at && <> · <Trophy size={12} /> done</>}</span>
                    {!j.completed_at && (
                      <span className="jar-need">
                        {days == null ? `${formatMoney(left)} to go` : days < 0 ? `Target date passed · ${formatMoney(left)} to go` : perWeek ? `${formatMoney(Math.ceil(perWeek))}/week to hit ${new Date(`${j.target_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'On target'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="jar-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setSheet({ kind: 'add', jar: j })}><Plus size={14} /> Add money</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSheet({ kind: 'withdraw', jar: j })} disabled={saved <= 0}><Minus size={14} /> Withdraw</button>
                  <button type="button" className="tl-icon" onClick={() => setOpen(open === j.id ? null : j.id)} aria-label="History" aria-expanded={open === j.id}><History size={14} /></button>
                  <button type="button" className="tl-icon" onClick={() => setSheet({ kind: 'edit', jar: j })} aria-label={`Edit ${j.name}`}><Pencil size={14} /></button>
                  <button type="button" className="tl-icon is-danger" onClick={() => { if (window.confirm(`Delete the ${j.name} jar and its history?`)) jars.remove(j.id) }} aria-label={`Delete ${j.name}`}><Trash2 size={14} /></button>
                </div>
                {open === j.id && (
                  <ul className="jar-history">
                    {hist.length === 0 && <li className="ms-muted">No deposits yet.</li>}
                    {hist.map((e) => (
                      <li key={e.id}><span className={Number(e.amount) >= 0 ? 'is-in' : 'is-out'}>{Number(e.amount) >= 0 ? '+' : ''}{formatMoney(e.amount)}</span><span>{e.note || (Number(e.amount) >= 0 ? 'Deposit' : 'Withdrawal')}</span><time>{new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time></li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
        </div>
      )}

      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet?.kind === 'new' ? 'New savings jar' : sheet?.kind === 'edit' ? 'Edit jar' : sheet?.kind === 'add' ? `Add to ${sheet?.jar?.name}` : `Withdraw from ${sheet?.jar?.name}`}>
        {sheet?.kind === 'new' && <JarForm onClose={() => setSheet(null)} onSave={(row) => jars.insert({ ...row, saved_amount: 0 })} />}
        {sheet?.kind === 'edit' && <JarForm key={sheet.jar.id} jar={sheet.jar} onClose={() => setSheet(null)} onSave={(row) => jars.update(sheet.jar.id, row)} />}
        {(sheet?.kind === 'add' || sheet?.kind === 'withdraw') && <MoneyForm key={`${sheet.kind}_${sheet.jar.id}`} jar={{ ...sheet.jar, saved_amount: totals.get(sheet.jar.id) ?? sheet.jar.saved_amount }} mode={sheet.kind} onClose={() => setSheet(null)} onSubmit={(amt, note) => move(sheet.jar, amt, note)} />}
      </Sheet>
    </div>
  )
}
