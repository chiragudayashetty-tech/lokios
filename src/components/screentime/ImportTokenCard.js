'use client'

import { useState } from 'react'
import { KeyRound, Copy, Check, Trash2, Plus, Smartphone } from 'lucide-react'
import SchemaHint from '@/components/ui/SchemaHint'
import { useTable } from '@/lib/hooks/useTable'

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
const newToken = () => `cos_${[...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('')}`

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="td-pill" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}>
      {done ? <><Check size={12} /> Copied</> : <><Copy size={12} /> {label}</>}
    </button>
  )
}

/**
 * Personal tokens for POST /api/screen-time/import (#44). Only a SHA-256 hash is
 * stored; the token is shown once. Used on Screen time and Settings → Integrations.
 */
export default function ImportTokenCard({ userId }) {
  const tokens = useTable('api_tokens', userId)
  const [fresh, setFresh] = useState(null)
  const [busy, setBusy] = useState(false)
  const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/screen-time/import` : '/api/screen-time/import'

  if (tokens.missing) return <section className="pf-card"><div className="pf-card-head"><KeyRound size={15} /> Auto-import</div><SchemaHint feature="Screen-time import tokens" /></section>

  const create = async () => {
    setBusy(true)
    const token = newToken()
    const res = await tokens.insert({ token_hash: await sha256Hex(token), label: `Phone · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` })
    setBusy(false)
    if (!res.error) setFresh(token)
  }

  const curl = `curl -X POST ${endpoint} \\\n  -H "Authorization: Bearer ${fresh || '<your token>'}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"total_hours":5.5,"doom_scroll_minutes":45,"focus_hours":3,"streaming_hours":0.5,"categories":{"social":40,"video":30,"productivity":150}}'`

  return (
    <section className="pf-card imp">
      <div className="pf-card-head"><Smartphone size={15} /> Auto-import from your phone</div>
      <p className="imp-intro">Post your daily totals at 23:30 from an iOS Shortcut or an Android Tasker task. The day is upserted and its XP settled once; sending again just updates it.</p>

      {fresh && (
        <div className="imp-fresh" role="status">
          <b>New token — copy it now, it won&apos;t be shown again.</b>
          <code>{fresh}</code>
          <CopyButton text={fresh} label="Copy token" />
        </div>
      )}

      <div className="imp-tokens">
        {tokens.rows.map((t) => (
          <div key={t.id} className="imp-token">
            <KeyRound size={14} />
            <span className="imp-token-main"><b>{t.label || 'Token'}</b><span>{t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'never used'}</span></span>
            <button type="button" className="tl-icon is-danger" onClick={() => { if (window.confirm('Revoke this token? Automations using it will stop working.')) tokens.remove(t.id) }} aria-label="Revoke token"><Trash2 size={13} /></button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm imp-new" onClick={create} disabled={busy}><Plus size={14} /> {busy ? 'Creating…' : 'Generate token'}</button>
      </div>

      <details className="imp-howto">
        <summary>Set it up</summary>
        <div className="imp-endpoint"><span>Endpoint</span><code>{endpoint}</code><CopyButton text={endpoint} /></div>
        <ol>
          <li><b>iPhone (Shortcuts):</b> Automation → Time of day 23:30 → Run immediately. iOS doesn&apos;t let Shortcuts read Screen Time, so add “Ask for Input” (number) steps for total hours, doomscroll minutes, focus and streaming hours (copy them from Settings → Screen Time), then “Get contents of URL”: method POST, header <code>Authorization: Bearer &lt;token&gt;</code>, JSON body with those fields.</li>
          <li><b>Android (Tasker):</b> Profile → Time 23:30 → Task with an <i>HTTP Request</i> action (POST, same header and JSON body). Fill the values from your usage-stats plugin or with Variable Query prompts.</li>
          <li>Optional <code>categories</code> (minutes): social, video, productivity, messaging, games, other. Optional <code>date</code> (YYYY-MM-DD) — defaults to today in IST.</li>
        </ol>
        <pre className="imp-curl">{curl}</pre>
        <CopyButton text={curl} label="Copy curl example" />
      </details>
    </section>
  )
}
