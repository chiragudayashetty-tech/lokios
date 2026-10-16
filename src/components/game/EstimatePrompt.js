'use client'

import { useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import { useOSSlice } from '@/lib/context/OSContext'
import { duelScore, estimateLabel } from '@/lib/games/discipline'

/** After completing a task with an estimate: "how long did it really take?" → estimate duel. */
export default function EstimatePrompt() {
  const tasksSlice = useOSSlice('tasks')
  const [ask, setAsk] = useState(null)
  const [val, setVal] = useState('')
  useEffect(() => {
    const on = (e) => { setAsk(e.detail); setVal(String(e.detail?.logged || e.detail?.estimate || '')) }
    window.addEventListener('lokios:estimate-ask', on)
    return () => window.removeEventListener('lokios:estimate-ask', on)
  }, [])
  if (!ask) return null
  const m = parseInt(val, 10)
  const s = duelScore(ask.estimate, m, ask.max)
  const save = async () => {
    if (!(m > 0)) return
    await tasksSlice?.patchTask?.(ask.id, { actual_minutes: m })
    setAsk(null)
  }
  return (
    <Sheet open onClose={() => setAsk(null)} title="Estimate duel">
      <div className="dg-prompt">
        <p><Target size={15} /> <b>{ask.title}</b> — you estimated <b>{estimateLabel({ estimate_minutes: ask.estimate, estimate_max_minutes: ask.max })}</b>.{ask.logged ? <> You logged <b>{ask.logged} min</b> in sessions — confirm or correct the total.</> : ' How long did it really take in total?'}</p>
        <div className="dg-btns">
          {[0.5, 1, 1.5, 2, 3].map((k) => { const v = Math.round(ask.estimate * k / 5) * 5 || 5; return <button key={k} type="button" className={`td-pill ${m === v ? 'is-on' : ''}`} onClick={() => setVal(String(v))}>{v >= 60 ? `${+(v / 60).toFixed(1)}h` : `${v}m`}</button> })}
          <input className="input dg-min" type="number" min="1" step="5" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} aria-label="Real minutes" />
        </div>
        {s && <p className={`dg-result ${s.xp ? 'is-good' : 'is-bad'}`}>{s.verdict} — {Math.round(s.off * 100)}% off{s.xp ? ` · +${s.xp} XP` : ''}</p>}
        <div className="dg-btns">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsk(null)}>Skip</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!(m > 0)}>Save real time</button>
        </div>
      </div>
    </Sheet>
  )
}
