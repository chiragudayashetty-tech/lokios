'use client'

import { useEffect, useState } from 'react'
import { Shield, Target, AlertTriangle, Tv, ChevronDown } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import SchemaHint from '@/components/ui/SchemaHint'
import ScreenCharts from '@/components/screentime/ScreenCharts'
import { TodayRings, CategoryBreakdown, CapsCard } from '@/components/screentime/ScreenPanels'
import { createClient } from '@/lib/supabase/client'
import { useOSSlice } from '@/lib/context/OSContext'
import { useSettings } from '@/lib/hooks/useSettings'
import { calculateScreenTimeXP, syncScreenTimeXP } from '@/lib/utils/screenTimeXP'
import { getAppDateStr } from '@/lib/utils/appDate'
import { emitGame } from '@/lib/utils/gamification'
import { isMissingSchema } from '@/lib/utils/schema'
import { SCREEN_CATEGORIES } from '@/lib/utils/screenIntel'

/** Phone Addiction battle: each metric over its limit heals the enemy, under it deals damage. */
async function updatePhoneBattle(supabase, userId, { total, doom, streaming }) {
  let hpChange = 0
  hpChange += total <= 6 ? -5 : 10
  hpChange += doom <= 60 ? -5 : 10
  hpChange += streaming <= 2 ? -5 : 10
  const { data: bp } = await supabase.from('user_blueprints').select('*').eq('user_id', userId).single()
  if (!bp?.battles) return ''
  let note = ''
  let changed = false
  const battles = bp.battles.map((battle) => {
    const name = battle.name?.toLowerCase() || ''
    if (battle.status === 'defeated' || !(name.includes('phone') || name.includes('screen') || name.includes('addiction'))) return battle
    changed = true
    const oldHp = battle.hp ?? 100
    const hp = Math.max(0, Math.min(100, oldHp + hpChange))
    if (hp === 0 && oldHp > 0) note = ' · Phone war won'
    else note = hpChange < 0 ? ` · ${hpChange} enemy HP` : ` · +${hpChange} enemy heal`
    return { ...battle, hp, status: hp === 0 ? 'defeated' : battle.status }
  })
  if (changed) await supabase.from('user_blueprints').update({ battles }).eq('id', bp.id)
  return note
}

function LogForm({ userId, date, log, catsMissing, onSaved }) {
  const [f, setF] = useState(() => ({
    total: log?.total_hours ?? '',
    focus: log?.focus_hours ?? '',
    doom: log?.doom_scroll_minutes ?? '',
    streaming: log?.streaming_hours ?? '',
    notes: log?.notes || '',
    cats: Object.fromEntries(SCREEN_CATEGORIES.map((c) => [c.id, log?.categories?.[c.id] ?? ''])),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const setCat = (k) => (e) => setF((x) => ({ ...x, cats: { ...x.cats, [k]: e.target.value } }))
  const catSum = Object.values(f.cats).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
  const totalMin = (parseFloat(f.total) || 0) * 60

  const save = async (e) => {
    e.preventDefault()
    if (!userId || saving) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const cats = Object.fromEntries(Object.entries(f.cats).map(([k, v]) => [k, parseInt(v, 10) || 0]).filter(([, v]) => v > 0))
      const payload = {
        user_id: userId,
        date,
        total_hours: parseFloat(f.total) || 0,
        focus_hours: parseFloat(f.focus) || 0,
        doom_scroll_minutes: parseInt(f.doom, 10) || 0,
        streaming_hours: parseFloat(f.streaming) || 0,
        notes: f.notes,
      }
      const full = catsMissing ? payload : { ...payload, categories: Object.keys(cats).length ? cats : null }

      const { data: existing } = await supabase.from('screen_time_logs').select('id').eq('user_id', userId).eq('date', date).maybeSingle()
      const write = (row) => (existing
        ? supabase.from('screen_time_logs').update(row).eq('id', existing.id).select().single()
        : supabase.from('screen_time_logs').insert(row).select().single())
      let res = await write(full)
      if (res.error && full !== payload && isMissingSchema(res.error)) res = await write(payload)
      if (res.error) { setError(res.error.message); return }
      const savedId = res.data?.id || existing?.id

      const { xpAmount, finalReason } = calculateScreenTimeXP(payload)
      const note = await updatePhoneBattle(supabase, userId, { total: payload.total_hours, doom: payload.doom_scroll_minutes, streaming: payload.streaming_hours })
      if (savedId) {
        await syncScreenTimeXP(userId, { id: savedId, ...payload })
        if (xpAmount !== 0) emitGame('toast', { icon: 'zap', title: `${xpAmount > 0 ? '+' : ''}${xpAmount} XP · screen time`, sub: finalReason + note, tone: xpAmount > 0 ? 'success' : 'danger' })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="pf-card si-form" onSubmit={save}>
      <div className="pf-card-head">Log a day</div>
      <div className="si-fields">
        <label><span>Total screen</span><input className="input" type="number" step="0.25" min="0" inputMode="decimal" value={f.total} onChange={set('total')} placeholder="0" /><small>hours</small></label>
        <label><span><Target size={12} /> Focus</span><input className="input" type="number" step="0.25" min="0" inputMode="decimal" value={f.focus} onChange={set('focus')} placeholder="0" /><small>hours</small></label>
        <label><span><AlertTriangle size={12} /> Doomscroll</span><input className="input" type="number" step="5" min="0" inputMode="numeric" value={f.doom} onChange={set('doom')} placeholder="0" /><small>minutes</small></label>
        <label><span><Tv size={12} /> Streaming</span><input className="input" type="number" step="0.25" min="0" inputMode="decimal" value={f.streaming} onChange={set('streaming')} placeholder="0" /><small>hours</small></label>
      </div>
      {catsMissing ? <SchemaHint feature="Category tracking" /> : (
        <details className="si-catform" open={catSum > 0 || undefined}>
          <summary><ChevronDown size={14} /> Categories <span className="arena-hint">optional · minutes</span></summary>
          <div className="si-fields is-cats">
            {SCREEN_CATEGORIES.map((c) => (
              <label key={c.id}><span><i style={{ background: c.color }} />{c.label}</span><input className="input" type="number" step="5" min="0" inputMode="numeric" value={f.cats[c.id]} onChange={setCat(c.id)} placeholder="0" /></label>
            ))}
          </div>
          {catSum > totalMin + 1 && totalMin > 0 && <p className="tm-warn">Categories add up to {catSum}m, more than the {Math.round(totalMin)}m total.</p>}
        </details>
      )}
      <textarea className="textarea" rows={2} value={f.notes} onChange={set('notes')} placeholder="Notes (optional)" aria-label="Notes" />
      {error && <p className="tm-warn">Couldn&apos;t save: {error}</p>}
      <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : log ? 'Update day' : 'Save day'}</button>
    </form>
  )
}

export default function ScreenIntel() {
  const { user } = useOSSlice('auth')
  const settings = useSettings()
  const today = getAppDateStr()
  const [date, setDate] = useState(today)
  const [state, setState] = useState({ logs: [], loading: true, catsMissing: false, version: 0 })

  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const supabase = createClient()
    Promise.all([
      supabase.from('screen_time_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('screen_time_logs').select('categories').limit(1),
    ]).then(([{ data }, probe]) => {
      if (cancelled) return
      setState((s) => ({ logs: data || [], loading: false, catsMissing: isMissingSchema(probe.error), version: s.version + 1 }))
    })
    return () => { cancelled = true }
  }, [user?.id, reload])

  if (state.loading) return <AppShell><WinterLoader label="Loading screen time" /></AppShell>

  const { logs } = state
  const todayLog = logs.find((l) => l.date === today)
  const ringLog = todayLog || logs.find((l) => l.date < today)
  const dateLog = logs.find((l) => l.date === date)

  return (
    <AppShell>
      <div className="page-container si-page">
        <header className="tk-head">
          <div>
            <h1 className="page-title flex items-center gap-3"><Shield className="text-info" /> Screen time</h1>
            <p className="page-subtitle">Where your attention went — and what it cost or earned.</p>
          </div>
        </header>

        <div className="si-top">
          <TodayRings log={ringLog} isToday={!!todayLog} dateLabel={new Date(`${ringLog?.date || today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} />
          <div className="si-formwrap">
            <label className="si-date"><span>Day</span><input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} /></label>
            <LogForm key={`${date}:${state.version}`} userId={user?.id} date={date} log={dateLog} catsMissing={state.catsMissing} onSaved={() => setReload((n) => n + 1)} />
          </div>
        </div>

        <ScreenCharts logs={logs} />

        <div className="si-two">
          <CategoryBreakdown logs={logs} />
          <CapsCard logs={logs} caps={settings.screenCaps} userId={user?.id} today={today} />
        </div>

      </div>
    </AppShell>
  )
}
