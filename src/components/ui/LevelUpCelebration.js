'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { celebrateBig } from '@/lib/utils/celebrate'

const STORAGE_KEY = 'lokios_last_seen_level'

/**
 * Watches the player's level and throws a celebration when it goes up.
 * The last seen level is persisted, so a level gained on another device
 * (or while the app was closed) is still celebrated on the next visit.
 */
export default function LevelUpCelebration({ level, rankTitle }) {
  const [shownLevel, setShownLevel] = useState(null)

  useEffect(() => {
    if (!level || level < 1) return
    let previous = null
    try {
      previous = Number(localStorage.getItem(STORAGE_KEY)) || null
      localStorage.setItem(STORAGE_KEY, String(level))
    } catch {}
    // First run on this device: record silently instead of celebrating.
    if (previous && level > previous) {
      setShownLevel(level)
      celebrateBig()
    }
  }, [level])

  useEffect(() => {
    if (!shownLevel) return
    const onKey = (e) => { if (e.key === 'Escape') setShownLevel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shownLevel])

  return (
    <AnimatePresence>
      {shownLevel && (
        <motion.div
          className="levelup-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Level ${shownLevel} reached`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShownLevel(null)}
        >
          <motion.div
            className="levelup-card"
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="levelup-rays" />
            <motion.div
              className="levelup-gem"
              initial={{ rotate: -30, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 10, delay: 0.15 }}
            >
              {shownLevel}
            </motion.div>
            <div className="levelup-kicker">Level up</div>
            <div className="levelup-title">You reached Lv. {shownLevel}</div>
            {rankTitle && <div className="levelup-sub">{rankTitle} · keep the streak alive</div>}
            <button type="button" className="btn btn-primary" onClick={() => setShownLevel(null)}>
              Let&apos;s go
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
