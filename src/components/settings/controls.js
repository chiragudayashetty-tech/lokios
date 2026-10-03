'use client'

import { useState } from 'react'

export function Section({ id, icon: Icon, title, color, children, hint }) {
  return (
    <section id={`set-${id}`} className="hud-panel settings-card set-section">
      <div className="arena-card-head">{Icon && <Icon size={15} style={{ color: color || 'var(--accent-primary)' }} />} {title}</div>
      {hint && <p className="set-hint">{hint}</p>}
      {children}
    </section>
  )
}

export function Row({ label, hint, children, stack = false }) {
  return (
    <div className={`settings-row ${stack ? 'is-stack' : ''}`}>
      <div className="settings-row-text">
        <span className="settings-label">{label}</span>
        {hint && <span className="settings-hint">{hint}</span>}
      </div>
      <div className="settings-control">{children}</div>
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled} className={`settings-toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

/** Segmented control: options = [{ id, label }]. */
export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="set-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)} title={o.hint}>{o.label}</button>
      ))}
    </div>
  )
}

function NumberDraft({ value, min, max, step, onCommit, label }) {
  const [draft, setDraft] = useState(String(value ?? ''))
  const commit = () => {
    const v = Math.min(max, Math.max(min, Number(draft) || 0))
    setDraft(String(v))
    if (v !== value) onCommit(v)
  }
  return (
    <input type="number" inputMode="decimal" className="input settings-number" aria-label={label} value={draft} min={min} max={max} step={step}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
  )
}

/** Number input that commits on blur / Enter, clamped to [min, max]. Resets when the stored value changes elsewhere. */
export function NumberField(props) {
  return <NumberDraft key={String(props.value)} {...props} />
}
