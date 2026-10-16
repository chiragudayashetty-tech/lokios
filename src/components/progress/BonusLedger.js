'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react'
import { isBonusXP, bonusKind, BONUS_XP_LABELS } from '@/lib/utils/xpRules'

const monthKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (k) => new Date(`${k}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const clean = (s = '') => String(s).replace(/\s\[#.*\]$/, '')

/**
 * Bonus XP ledger: achievements, season tiers, streak milestones, mastery, boss, bets and
 * savings goals, month by month. These count toward total XP but never toward a day.
 */
export default function BonusLedger({ rows }) {
  const bonus = useMemo(() => (rows || []).filter(isBonusXP).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), [rows])
  const months = useMemo(() => [...new Set(bonus.map((r) => monthKey(r.created_at)))], [bonus])
  const [i, setI] = useState(0)
  const key = months[i]
  const list = bonus.filter((r) => monthKey(r.created_at) === key)
  const total = list.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const byKind = Object.entries(list.reduce((m, r) => { const k = bonusKind(r.source_type); m[k] = (m[k] || 0) + (Number(r.amount) || 0); return m }, {}))
  const allTime = bonus.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  return (
    <section className="pf-card bl">
      <div className="pf-card-head"><Gift size={15} /> Bonus XP ledger <span className="arena-hint ml-auto">{allTime >= 0 ? '+' : ''}{allTime.toLocaleString()} all-time · not in daily totals</span></div>
      {!months.length ? <p className="ms-muted">No bonus XP yet. Achievements, season tiers, streak milestones, mastery, bosses, bets and savings goals land here.</p> : (
        <>
          <div className="bl-month">
            <button type="button" className="tl-icon" onClick={() => setI((x) => Math.min(months.length - 1, x + 1))} disabled={i >= months.length - 1} aria-label="Earlier month"><ChevronLeft size={15} /></button>
            <b>{monthLabel(key)}</b>
            <span className={total >= 0 ? 'is-pos' : 'is-neg'}>{total >= 0 ? '+' : ''}{total.toLocaleString()} XP</span>
            <button type="button" className="tl-icon" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label="Later month"><ChevronRight size={15} /></button>
          </div>
          <div className="bl-kinds">{byKind.map(([k, v]) => <span key={k}>{BONUS_XP_LABELS[k] || k} <b>{v >= 0 ? '+' : ''}{v}</b></span>)}</div>
          <ul className="bl-list">{list.map((r, n) => (
            <li key={r.id || `${r.source_id}-${n}`}>
              <time>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time>
              <span><em>{BONUS_XP_LABELS[bonusKind(r.source_type)] || r.source_type}</em> {clean(r.description)}</span>
              <b className={r.amount >= 0 ? 'is-pos' : 'is-neg'}>{r.amount >= 0 ? '+' : ''}{r.amount}</b>
            </li>
          ))}</ul>
        </>
      )}
    </section>
  )
}
