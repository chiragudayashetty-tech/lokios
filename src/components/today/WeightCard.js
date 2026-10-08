'use client'

import { useEffect, useState } from 'react'
import { Scale, TrendingUp, TrendingDown, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TARGET_WEIGHT = 70
const cacheKey = (id) => `lokios_weight_logs_${id}`

/** Weight log on Today: one entry per day (upserts), latest, change and distance to target. */
export default function WeightCard({ userId, today }) {
  const [logs, setLogs] = useState([])
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    try { const c = localStorage.getItem(cacheKey(userId)); if (c) Promise.resolve().then(() => { if (!cancelled) setLogs(JSON.parse(c)) }) } catch {}
    createClient().from('weight_logs').select('*').eq('user_id', userId).order('date', { ascending: true }).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setLogs(data)
      try { localStorage.setItem(cacheKey(userId), JSON.stringify(data)) } catch {}
    })
    return () => { cancelled = true }
  }, [userId])

  const sorted = [...logs].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const latest = sorted[sorted.length - 1]
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null
  const diff = latest && prev ? Number((latest.weight_kg - prev.weight_kg).toFixed(2)) : 0
  const todays = sorted.find((l) => l.date === today)

  const save = async (e) => {
    e.preventDefault()
    const num = parseFloat(value)
    if (!userId || Number.isNaN(num) || num <= 20 || num > 300) return
    const entry = { user_id: userId, date: today, weight_kg: Number(num.toFixed(2)), created_at: new Date().toISOString() }
    const next = [...logs.filter((l) => l.date !== today), entry]
    setLogs(next); setValue(''); setSaved(true); setTimeout(() => setSaved(false), 2500)
    try { localStorage.setItem(cacheKey(userId), JSON.stringify(next)) } catch {}
    await createClient().from('weight_logs').upsert(entry, { onConflict: 'user_id,date' })
  }

  return (
    <section className="slp slp--compact wt-card">
      <span className="slp-icon"><Scale size={18} /></span>
      <div className="slp-compact-text">
        <span className="slp-compact-title">{latest ? `${latest.weight_kg} kg` : 'Weight'}{todays ? ' · logged today' : ''}</span>
        <span className="slp-compact-sub">
          {prev && diff !== 0 && <>{diff > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {diff > 0 ? '+' : ''}{diff} kg · </>}
          {latest ? `${Math.abs(latest.weight_kg - TARGET_WEIGHT).toFixed(1)} kg ${latest.weight_kg > TARGET_WEIGHT ? 'to go' : 'below'} ${TARGET_WEIGHT} kg` : 'Log your weight'}
        </span>
      </div>
      <form className="wt-form" onSubmit={save}>
        <input className="input" type="number" step="0.1" min="20" max="300" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={todays ? String(todays.weight_kg) : 'kg'} aria-label="Weight in kg" />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={!value}>{saved ? <Check size={14} /> : todays ? 'Update' : 'Log'}</button>
      </form>
    </section>
  )
}
