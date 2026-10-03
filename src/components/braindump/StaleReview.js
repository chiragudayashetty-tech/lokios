'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { History, Check, Archive, Trash2 } from 'lucide-react'
import { useOSSlice } from '@/lib/context/OSContext'
import { kindOf, ageDays, textOf, STALE_DAYS } from '@/lib/utils/brainDump'
import { weekStartOf } from '@/lib/utils/gamification'

const KEY = 'lokios_stale_kept'
const readKept = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v.week === weekStartOf() ? v.ids : [] } catch { return [] } }

/**
 * "Still relevant?" carousel for inbox items older than 14 days. Shown on
 * Sundays on the brain dump page and inside the weekly debrief.
 */
export default function StaleReview({ compact = false }) {
  const { items = [], updateItem, trashItem } = useOSSlice('brainDump')
  const [kept, setKept] = useState(() => (typeof window === 'undefined' ? [] : readKept()))
  const [now] = useState(() => Date.now())
  const stale = useMemo(() => items.filter((i) => kindOf(i) === 'inbox' && ageDays(i, now) >= STALE_DAYS && !kept.includes(i.id)), [items, kept, now])
  const item = stale[0]
  if (!item) return null

  const keep = () => {
    const next = [...kept, item.id]
    setKept(next)
    try { localStorage.setItem(KEY, JSON.stringify({ week: weekStartOf(), ids: next })) } catch {}
  }

  return (
    <section className={`stale ${compact ? 'is-compact' : ''}`} aria-label="Still relevant?">
      <div className="stale-head"><History size={15} /> Still relevant? <span>{stale.length} item{stale.length === 1 ? '' : 's'} older than {STALE_DAYS} days</span></div>
      <AnimatePresence mode="wait">
        <motion.div key={item.id} className="stale-card" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
          <p className="stale-text">{textOf(item)}</p>
          <span className="stale-age">{ageDays(item, now)} days in the inbox</span>
        </motion.div>
      </AnimatePresence>
      <div className="stale-actions">
        <button type="button" className="td-pill" onClick={keep}><Check size={13} /> Keep</button>
        <button type="button" className="td-pill" onClick={() => updateItem(item.id, { kind: 'archived', status: 'done' })}><Archive size={13} /> Archive</button>
        <button type="button" className="td-pill is-danger" onClick={() => trashItem(item.id)}><Trash2 size={13} /> Trash</button>
      </div>
    </section>
  )
}
