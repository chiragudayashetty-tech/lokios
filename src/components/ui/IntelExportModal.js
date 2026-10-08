'use client'

import { useMemo, useState } from 'react'
import { FileDown, Eye, Share2, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import { getLocalDateStr, getStartOfWeek } from '@/lib/utils/dates'
import { REPORT_KINDS } from '@/lib/report/reportData'

const MODES = [{ id: 'week', label: 'Weekly' }, { id: 'month', label: 'Monthly' }, { id: 'custom', label: 'Custom' }]

function rangeFor(mode, offset, custom) {
  const today = new Date()
  if (mode === 'week') {
    const start = getStartOfWeek(today)
    start.setDate(start.getDate() + offset * 7)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { from: getLocalDateStr(start), to: getLocalDateStr(end > today ? today : end) }
  }
  if (mode === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const end = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0)
    return { from: getLocalDateStr(start), to: getLocalDateStr(end > today ? today : end) }
  }
  return custom
}

const fmt = (ds, o = { month: 'short', day: 'numeric' }) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', o)

/** Report launcher (#42): pick a period, report card or full report, and theme → /report (print = Download PDF). */
export default function IntelExportModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('week')
  const [offset, setOffset] = useState(0)
  const [custom, setCustom] = useState(() => { const t = new Date(); const f = new Date(); f.setDate(t.getDate() - 29); return { from: getLocalDateStr(f), to: getLocalDateStr(t) } })
  const [kind, setKind] = useState('card')
  const [theme, setTheme] = useState('light')
  const [copied, setCopied] = useState(false)

  const range = rangeFor(mode, offset, custom)
  const valid = range.from && range.to && range.from <= range.to
  const query = useMemo(() => new URLSearchParams({ from: range.from, to: range.to, kind, theme }).toString(), [range.from, range.to, kind, theme])
  const label = mode === 'week' ? (offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `Week of ${fmt(range.from)}`)
    : mode === 'month' ? fmt(range.from, { month: 'long', year: 'numeric' }) : 'Custom range'

  const open = (print) => { window.open(`/report?${query}${print ? '&print=1' : ''}`, '_blank', 'noopener'); }
  const share = async () => {
    const url = `${window.location.origin}/report?${query}`
    try {
      if (navigator.share) await navigator.share({ title: `ChiragOS ${kind === 'full' ? 'full report' : 'report card'} · ${label}`, url })
      else { await navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    } catch {}
  }

  return (
    <Sheet open={!!isOpen} onClose={onClose} title="Export a report">
      <div className="xr">
        <div className="set-seg" role="radiogroup" aria-label="Report period">
          {MODES.map((m) => <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'is-on' : ''} onClick={() => { setMode(m.id); setOffset(0) }}>{m.label}</button>)}
        </div>

        {mode === 'custom' ? (
          <div className="xr-dates">
            <label><span>From</span><input className="input" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></label>
            <label><span>To</span><input className="input" type="date" value={custom.to} min={custom.from} max={getLocalDateStr()} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></label>
          </div>
        ) : (
          <div className="xr-step">
            <button type="button" className="tl-icon" onClick={() => setOffset((o) => o - 1)} aria-label="Previous period"><ChevronLeft size={16} /></button>
            <div className="xr-step-label"><b>{label}</b><span>{fmt(range.from)} – {fmt(range.to, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
            <button type="button" className="tl-icon" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} aria-label="Next period"><ChevronRight size={16} /></button>
          </div>
        )}

        <div className="xr-block">
          <div className="xr-head"><span>Report</span></div>
          <div className="set-seg" role="radiogroup" aria-label="Report type">
            {REPORT_KINDS.map((k) => <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={kind === k.id ? 'is-on' : ''} onClick={() => setKind(k.id)}>{k.label}</button>)}
          </div>
          <p className="xr-hint">{REPORT_KINDS.find((k) => k.id === kind).hint}</p>
        </div>

        <div className="xr-block">
          <div className="xr-head"><span>Paper</span></div>
          <div className="set-seg" role="radiogroup" aria-label="Report theme">
            {[{ id: 'light', label: 'Light (print)' }, { id: 'dark', label: 'Dark' }].map((t) => <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className={theme === t.id ? 'is-on' : ''} onClick={() => setTheme(t.id)}>{t.label}</button>)}
          </div>
        </div>

        <p className="xr-hint">Download opens the report in a new tab with the print dialog — choose “Save as PDF”.</p>
        <div className="xr-actions">
          <button type="button" className="btn btn-primary" onClick={() => open(true)} disabled={!valid}><FileDown size={15} /> Download PDF</button>
          <button type="button" className="btn btn-secondary" onClick={() => open(false)} disabled={!valid}><Eye size={15} /> Preview</button>
          <button type="button" className="btn btn-ghost" onClick={share} disabled={!valid}>{copied ? <Check size={15} /> : <Share2 size={15} />} {copied ? 'Link copied' : 'Share'}</button>
        </div>
      </div>
    </Sheet>
  )
}
