'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function XPToastStack({ events = [], onDismiss }) {
  return (
    <div className="xp-toast-stack" aria-live="polite" aria-label="XP feedback">
      <AnimatePresence initial={false}>
        {events.slice(-3).map(event => {
          const positive = event.amount >= 0
          return (
            <motion.div
              key={event.id}
              className={`xp-toast ${positive ? 'xp-toast-positive' : 'xp-toast-negative'}`}
              initial={{ opacity: 0, x: 24, y: 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="xp-toast-row">
                <span>{positive ? '+' : ''}{event.amount} XP · {event.source}</span>
                <button type="button" onClick={() => onDismiss(event.id)} aria-label="Dismiss XP feedback">
                  <X size={12} />
                </button>
              </div>
              {!positive && <div className="xp-toast-loss">MOMENTUM LOST</div>}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
