'use client'

import { useRef, useState } from 'react'
import { Send, Hash } from 'lucide-react'
import { parseCapture } from '@/lib/utils/brainDump'

/** Fast capture: Enter saves, Shift+Enter adds a line, #tags become tags. */
export default function CaptureBar({ onCapture, autoFocus = false }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  const { tags } = parseCapture(value)

  const save = async () => {
    if (!value.trim() || busy) return
    setBusy(true)
    const res = await onCapture(value)
    setBusy(false)
    if (!res?.error) { setValue(''); ref.current?.focus() }
  }

  return (
    <div className="cb">
      <textarea
        ref={ref}
        className="cb-input"
        rows={1}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); save() } }}
        placeholder="What's on your mind? Use #tags · Enter to save"
        aria-label="Capture a thought"
      />
      <div className="cb-foot">
        <span className="cb-tags">
          {tags.length ? tags.map((t) => <span key={t} className="bd-tag"><Hash size={10} />{t}</span>) : <span className="cb-hint">Shift+Enter for a new line</span>}
        </span>
        <button type="button" className="btn btn-primary btn-sm cb-send" onClick={save} disabled={!value.trim() || busy} aria-label="Save capture"><Send size={14} /> Capture</button>
      </div>
    </div>
  )
}
