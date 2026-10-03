'use client'

import { useEffect, useState } from 'react'
import { User, Target, Eye, Shield, AlertTriangle, Flame, Heart, Pencil, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const FIELDS = [
  { key: 'identity', label: 'Identity', icon: User, tone: 'info' },
  { key: 'mission', label: 'Mission', icon: Target, tone: 'accent' },
  { key: 'motives', label: 'Why I do this', icon: Heart, tone: 'rose' },
  { key: 'future_vision', label: '5-year endgame', icon: Eye, tone: 'muted' },
  { key: 'strengths', label: 'Strengths', icon: Shield, tone: 'success', list: true },
  { key: 'weaknesses', label: 'Weaknesses', icon: AlertTriangle, tone: 'danger', list: true },
  { key: 'values_list', label: 'The code — non-negotiables', icon: Flame, tone: 'warning', list: true, numbered: true },
]

/** The existing blueprint (user_blueprints), restyled as editable cards. Battles are left untouched. */
export default function BlueprintCards({ userId }) {
  const [bp, setBp] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(null) // key
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    createClient().from('user_blueprints').select('*').eq('user_id', userId).limit(1)
      .then(({ data }) => { if (!cancelled) { setBp(data?.[0] || null); setLoaded(true) } })
    return () => { cancelled = true }
  }, [userId])

  const valueOf = (f) => {
    const v = bp?.[f.key]
    if (f.list) return Array.isArray(v) ? v : []
    return v || ''
  }

  const save = async (f) => {
    setSaving(true)
    const value = f.list ? draft.split('\n').map((s) => s.trim()).filter(Boolean) : draft.trim()
    const sb = createClient()
    const res = bp
      ? await sb.from('user_blueprints').update({ [f.key]: value }).eq('id', bp.id).select().single()
      : await sb.from('user_blueprints').insert({ user_id: userId, [f.key]: value }).select().single()
    setSaving(false)
    if (!res.error) { setBp(res.data); setEditing(null) }
    else alert(`Could not save: ${res.error.message}`)
  }

  if (!loaded) return <div className="arena-skeleton pf-skel" />

  return (
    <div className="bp-grid">
      {FIELDS.map((f) => {
        const Icon = f.icon
        const v = valueOf(f)
        const isEditing = editing === f.key
        const empty = f.list ? v.length === 0 : !v
        return (
          <section key={f.key} className={`pf-card bp-card bp--${f.tone} ${f.list ? '' : 'is-text'}`}>
            <div className="pf-card-head">
              <Icon size={15} /> {f.label}
              {!isEditing && <button type="button" className="tl-icon pf-edit" onClick={() => { setEditing(f.key); setDraft(f.list ? v.join('\n') : v) }} aria-label={`Edit ${f.label}`}><Pencil size={13} /></button>}
            </div>
            {isEditing ? (
              <>
                <textarea className="textarea" rows={f.list ? 6 : 5} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus aria-label={f.label} />
                {f.list && <span className="ms-muted">One per line</span>}
                <div className="bp-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => save(f)} disabled={saving}><Check size={14} /> {saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}><X size={14} /> Cancel</button>
                </div>
              </>
            ) : empty ? (
              <p className="ms-muted">Nothing written yet.</p>
            ) : f.list ? (
              <ul className={`bp-list ${f.numbered ? 'is-numbered' : ''}`}>{v.map((item, i) => <li key={i}>{f.numbered && <b>{String(i + 1).padStart(2, '0')}</b>}{item}</li>)}</ul>
            ) : (
              <p className="bp-text">{v}</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
