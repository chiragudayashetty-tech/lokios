'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gift, Trophy, Zap, Medal, Swords, Snowflake, Dices, ScrollText, Sparkles, CalendarClock, AlertTriangle, CheckCircle2, Link2, Moon, Wallet, PiggyBank, Inbox, Award, Target, Flag } from 'lucide-react'
import { confetti, celebrateBig, haptic } from '@/lib/utils/celebrate'

const ICONS = {
  trophy: Trophy, zap: Zap, medal: Medal, swords: Swords, snowflake: Snowflake, dice: Dices, scroll: ScrollText, sparkles: Sparkles,
  calendar: CalendarClock, alert: AlertTriangle, check: CheckCircle2, link: Link2, moon: Moon, wallet: Wallet, piggy: PiggyBank,
  inbox: Inbox, award: Award, target: Target, flag: Flag,
}
const GOLD = ['#FFD166', '#FFE29A', '#FFB547', '#FFFFFF', '#F7C873']

/** Mystery chest reveal, game toasts and critical-hit bursts (driven by lokios:game events). */
export default function GameOverlays() {
  const [chest, setChest] = useState(null) // { xp, mult, phase: 'closed' | 'open' }
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const onGame = (e) => {
      const d = e.detail || {}
      if (d.type === 'chest') {
        setChest({ ...d, phase: 'closed' })
      } else if (d.type === 'crit') {
        haptic([10, 30, 20])
        confetti({ x: 0.5, y: 0.45, count: 90, power: 11, colors: GOLD })
        pushToast({ icon: 'sparkles', title: 'Critical hit ×2!', sub: `${d.title} · +${d.xp} XP`, tone: 'gold' })
      } else if (d.type === 'toast') {
        if (d.big) celebrateBig()
        pushToast(d)
      }
    }
    const pushToast = (t) => {
      const id = `${Date.now()}_${Math.random()}`
      setToasts(prev => [...prev.slice(-2), { ...t, id }])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4600)
    }
    window.addEventListener('lokios:game', onGame)
    return () => window.removeEventListener('lokios:game', onGame)
  }, [])

  const openChest = () => {
    setChest(c => ({ ...c, phase: 'open' }))
    haptic([20, 40, 30])
    confetti({ x: 0.5, y: 0.45, count: 120, power: 13, colors: GOLD })
    setTimeout(() => confetti({ x: 0.5, y: 0.45, count: 80, power: 8 }), 180)
  }

  return (
    <>
      <div className="game-toast-stack" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map(t => {
            const Icon = ICONS[t.icon] || Sparkles
            return (
              <motion.div
                key={t.id}
                layout
                className={`game-toast game-toast--${t.tone || 'accent'}`}
                initial={{ opacity: 0, y: -18, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.95, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              >
                <span className="game-toast-icon"><Icon size={18} /></span>
                <span className="flex flex-col min-w-0">
                  <span className="game-toast-title">{t.title}</span>
                  {t.sub && <span className="game-toast-sub">{t.sub}</span>}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {chest && (
          <motion.div className="levelup-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => chest.phase === 'open' && setChest(null)}>
            <motion.div
              className="levelup-card chest-card"
              initial={{ scale: 0.6, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="levelup-rays" />
              <motion.button
                type="button"
                className={`chest ${chest.phase === 'open' ? 'is-open' : ''}`}
                onClick={chest.phase === 'closed' ? openChest : undefined}
                animate={chest.phase === 'closed' ? { rotate: [0, -6, 6, -4, 4, 0], y: [0, -4, 0] } : { scale: [1, 1.15, 1] }}
                transition={chest.phase === 'closed' ? { duration: 1.1, repeat: Infinity, repeatDelay: 0.6 } : { duration: 0.5 }}
                aria-label="Open mystery chest"
              >
                <Gift size={56} strokeWidth={1.6} />
              </motion.button>
              <div className="levelup-kicker">Perfect day · mystery chest</div>
              {chest.phase === 'closed' ? (
                <>
                  <div className="levelup-title">You found a chest!</div>
                  <div className="levelup-sub">Tap it to open</div>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="levelup-title chest-amount">+{chest.xp} XP</div>
                  <div className="levelup-sub">×{chest.mult} multiplier · see you tomorrow</div>
                  <button type="button" className="btn btn-primary" onClick={() => setChest(null)}>Collect</button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
