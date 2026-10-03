'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, Trophy } from 'lucide-react'
import { useOSSlice } from '@/lib/context/OSContext'
import { celebrateBig } from '@/lib/utils/celebrate'
import { getMilestones, setMilestoneDone } from '@/lib/stores/milestoneStore'
import { milestoneXp, milestonesOf } from '@/lib/utils/missions'

/**
 * Global mission overlays:
 * - "milestone-ready": the last task of a milestone was completed → confirm it (#22)
 * - "mission-complete": full-screen celebration when a mission is finished (#37)
 */
export default function MissionOverlays() {
  const { user } = useOSSlice('auth')
  const { goals = [] } = useOSSlice('goals')
  const [ready, setReady] = useState(null) // { milestone, goal }
  const [party, setParty] = useState(null) // { title, xp }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onGame = (e) => {
      const d = e.detail || {}
      if (d.type === 'milestone-ready') {
        const milestone = getMilestones().find((m) => m.id === d.milestoneId)
        if (milestone && !milestone.done_at) setReady({ milestoneId: d.milestoneId, goalId: d.goalId })
      }
      if (d.type === 'mission-complete') {
        setParty({ title: d.title, xp: d.xp })
        celebrateBig()
      }
    }
    window.addEventListener('lokios:game', onGame)
    return () => window.removeEventListener('lokios:game', onGame)
  }, [])

  const milestone = ready && getMilestones().find((m) => m.id === ready.milestoneId)
  const goal = ready && goals.find((g) => g.id === ready.goalId)
  const xp = goal ? milestoneXp(goal, milestonesOf(goal.id, getMilestones()).length) : 0

  const confirm = async () => {
    if (!milestone || !goal || busy) return
    setBusy(true)
    await setMilestoneDone(user?.id, goal, milestone, true)
    setBusy(false)
    setReady(null)
  }

  return (
    <>
      <AnimatePresence>
        {milestone && goal && (
          <motion.div className="ms-ready" role="alertdialog" aria-label="Complete milestone?" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>
            <span className="ms-ready-icon"><Flag size={18} /></span>
            <div className="ms-ready-text">
              <b>All tasks for “{milestone.title}” are done</b>
              <span>Mark the milestone complete? +{xp} XP</span>
            </div>
            <div className="ms-ready-actions">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={confirm} data-celebrate>Complete</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReady(null)}>Not yet</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {party && (
          <motion.div className="levelup-backdrop" role="dialog" aria-modal="true" aria-label="Mission complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setParty(null)}>
            <motion.div className="levelup-card" initial={{ scale: 0.6, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} onClick={(e) => e.stopPropagation()}>
              <div className="levelup-rays" />
              <motion.div className="levelup-gem mission-gem" initial={{ rotate: -30, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 10, delay: 0.15 }}>
                <Trophy size={44} />
              </motion.div>
              <div className="levelup-kicker">Mission complete</div>
              <div className="levelup-title">{party.title}</div>
              {party.xp ? <div className="levelup-sub">+{party.xp} XP · the roadmap is done</div> : null}
              <button type="button" className="btn btn-primary" onClick={() => setParty(null)}>Onward</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
