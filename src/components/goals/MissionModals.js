'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, AlertTriangle, Trophy } from 'lucide-react'
import { missionXp, deadlineOf, dayDiff } from '@/lib/utils/missions'

function Shell({ open, onClose, tone, label, children }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="modal-overlay tm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label={label}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className={`tm tm--${tone}`}>{children}</motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Net XP for completing now (−5 per day past the deadline), same as completeGoal. */
export function missionPayout(goal, today) {
  const base = missionXp(goal)
  const dl = deadlineOf(goal)
  const late = dl && dl < today ? Math.max(1, dayDiff(dl, today)) : 0
  return { base, late, net: Math.max(0, base - late * 5) }
}

function CompleteForm({ goal, today, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const pay = missionPayout(goal, today)
  const submit = async (skip) => {
    if (busy) return
    setBusy(true)
    try { await onSubmit(goal, skip ? null : url.trim() || null, skip ? null : note.trim() || null, pay.net) } finally { setBusy(false) }
  }
  return (
    <>
      <div className="tm-head">
        <span className="tm-title"><Trophy size={18} /> Complete mission</span>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <p className="tm-task">{goal.title}</p>
      {pay.late > 0 && <div className="tm-warn"><AlertTriangle size={13} /> {pay.late}d past the deadline · −{pay.late * 5} XP</div>}
      <label className="td-label" htmlFor="mm-note">Reflection — what did this unlock?</label>
      <textarea id="mm-note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Results, numbers, lessons…" autoFocus />
      <label className="td-label" htmlFor="mm-url">Proof link (optional)</label>
      <input id="mm-url" type="url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      <div className="tm-actions">
        <button type="button" className="btn btn-primary" onClick={() => submit(false)} disabled={busy}><Check size={16} /> Complete · +{pay.net} XP</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => submit(true)} disabled={busy}>Complete without notes</button>
      </div>
    </>
  )
}

export function CompleteMissionModal({ goal, today, onClose, onSubmit }) {
  return (
    <Shell open={!!goal} onClose={onClose} tone="success" label="Complete mission">
      {goal && <CompleteForm key={goal.id} goal={goal} today={today} onClose={onClose} onSubmit={onSubmit} />}
    </Shell>
  )
}

function FailForm({ goal, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  return (
    <>
      <div className="tm-head">
        <span className="tm-title is-danger"><AlertTriangle size={18} /> Mark mission failed</span>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <p className="tm-task">{goal.title}</p>
      <p className="tm-sub">Costs {missionXp(goal)} XP. You can restore it later.</p>
      <label className="td-label" htmlFor="mm-reason">What got in the way? (optional)</label>
      <textarea id="mm-reason" className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      <div className="tm-actions is-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={() => onSubmit(goal, reason)}><X size={16} /> Mark failed</button>
      </div>
    </>
  )
}

export function FailMissionModal({ goal, onClose, onSubmit }) {
  return (
    <Shell open={!!goal} onClose={onClose} tone="danger" label="Mark mission failed">
      {goal && <FailForm key={goal.id} goal={goal} onClose={onClose} onSubmit={onSubmit} />}
    </Shell>
  )
}
