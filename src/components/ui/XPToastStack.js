'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Sparkles, TrendingDown } from 'lucide-react'
import { celebrateSmall, haptic } from '@/lib/utils/celebrate'

export default function XPToastStack({ events = [], onDismiss }) {
  const celebrated = useRef(new Set())

  // Fire one celebration per new event (gains get confetti, losses a soft buzz).
  useEffect(() => {
    for (const event of events) {
      if (celebrated.current.has(event.id)) continue
      celebrated.current.add(event.id)
      if (event.amount > 0) celebrateSmall()
      else haptic([8, 40, 8])
    }
  }, [events])

  return (
    <div className="xp-toast-stack" aria-live="polite" aria-label="XP feedback">
      <AnimatePresence initial={false}>
        {events.slice(-3).map(event => {
          const positive = event.amount >= 0
          return (
            <motion.div
              key={event.id}
              layout
              className={`xp-toast ${positive ? 'xp-toast-positive' : 'xp-toast-negative'}`}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <div className="xp-toast-row">
                <motion.div
                  className="xp-toast-orb"
                  initial={{ rotate: -20, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.05 }}
                >
                  {positive ? <Sparkles size={18} /> : <TrendingDown size={18} />}
                </motion.div>
                <div className="xp-toast-body">
                  <span className="xp-toast-amount">{positive ? '+' : ''}{event.amount} XP</span>
                  <span className="xp-toast-source">{positive ? event.source : 'Momentum lost · ' + event.source}</span>
                </div>
                <button type="button" onClick={() => onDismiss(event.id)} aria-label="Dismiss XP feedback">
                  <X size={14} />
                </button>
              </div>
              <span className="xp-toast-timer" />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
