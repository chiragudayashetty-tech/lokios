'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, Swords, Dices, X } from 'lucide-react'
import { useGameState } from '@/lib/hooks/useGameState'
import { gradeWeek } from '@/lib/utils/gamification'
import { shiftDate } from '@/lib/utils/streakCalc'
import { getSettings } from '@/lib/settings'
import { celebrateBig } from '@/lib/utils/celebrate'

/** Weekly scorecard: pops up on the first app open each Sunday (Settings → Sunday scorecard). */
export default function WeeklyScorecard() {
  const g = useGameState()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!g.ready) return
    // Preview any day with ?scorecard in the URL
    if (new URLSearchParams(window.location.search).has('scorecard')) { setOpen(true); return }
    const isSunday = new Date(`${g.today}T12:00:00`).getDay() === 0
    if (!isSunday || !getSettings().sundayRecap) return
    const key = `lokios_scorecard_${g.weekStart}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch { return }
    setOpen(true)
  }, [g.ready, g.today, g.weekStart])

  const r = open ? g.weekRecap(g.weekStart) : null
  const last = open ? g.weekRecap(shiftDate(g.weekStart, -7)) : null
  const grade = r ? gradeWeek(r) : null

  useEffect(() => {
    if (open && grade && (grade.grade === 'S' || grade.grade === 'A')) setTimeout(celebrateBig, 350)
  }, [open, grade?.grade])

  if (!r) return null
  const delta = r.net - last.net
  const focusHabit = r.worst.find(w => w.rate < 0.9) || null

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="levelup-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div
            className="levelup-card scorecard"
            initial={{ scale: 0.85, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="scorecard-close" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            <div className="levelup-kicker">Sunday scorecard</div>
            <motion.div
              className="scorecard-grade"
              style={{ color: grade.color, borderColor: grade.color }}
              initial={{ scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.15 }}
            >{grade.grade}</motion.div>
            <div className="levelup-sub">{grade.line}</div>

            <div className="scorecard-stats">
              <div><b style={{ color: r.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{r.net >= 0 ? '+' : ''}{r.net}</b><span>net XP</span></div>
              <div><b>{r.streakDays}/7</b><span>streak days</span></div>
              <div><b>{r.perfectDays}</b><span>perfect days</span></div>
              <div><b>{r.avgCompletion}%</b><span>completion</span></div>
            </div>

            <div className="scorecard-lines">
              <div className="scorecard-line">
                {delta >= 0 ? <TrendingUp size={15} style={{ color: 'var(--success)' }} /> : <TrendingDown size={15} style={{ color: 'var(--danger)' }} />}
                <span>{delta >= 0 ? '+' : ''}{delta} XP vs last week ({last.net >= 0 ? '+' : ''}{last.net})</span>
              </div>
              {g.boss && (
                <div className="scorecard-line">
                  <Swords size={15} style={{ color: g.boss.defeated ? '#FFD166' : 'var(--danger)' }} />
                  <span>Boss {g.boss.habit.title}: {g.boss.defeated ? 'defeated 🏆' : `${g.boss.hits}/${g.boss.target} — still standing`}</span>
                </div>
              )}
              {g.bet && (
                <div className="scorecard-line">
                  <Dices size={15} style={{ color: 'var(--accent-2)' }} />
                  <span>Bet {g.bet.target} streak days: {g.bet.paid ? `won +${g.bet.stake * 2} XP` : `${r.streakDays}/${g.bet.target}`}</span>
                </div>
              )}
              {r.best[0] && (
                <div className="scorecard-line">
                  <TrendingUp size={15} style={{ color: 'var(--success)' }} />
                  <span>MVP habit: {r.best[0].habit.title} ({r.best[0].done}/{r.best[0].scheduled})</span>
                </div>
              )}
            </div>

            {focusHabit && (
              <div className="scorecard-focus">
                <Target size={16} />
                <span>Next week, fix one thing: <b>{focusHabit.habit.title}</b> — {focusHabit.done}/{focusHabit.scheduled} this week.</span>
              </div>
            )}

            <div className="scorecard-actions">
              <Link href="/journal" className="btn btn-primary" onClick={() => setOpen(false)}>Write weekly debrief +50 XP</Link>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Later</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
