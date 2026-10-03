'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Swords, AlertTriangle, ArrowRight, Sparkles, Moon, CalendarClock } from 'lucide-react'

const KIND_COPY = {
  overdue: { label: 'Overdue task', icon: AlertTriangle, tone: 'danger' },
  boss: { label: 'Boss habit', icon: Swords, tone: 'boss' },
  habit: { label: 'Next habit', icon: Sparkles, tone: 'accent' },
  task: { label: 'Due today', icon: CalendarClock, tone: 'accent' },
  protocol: { label: 'Log it', icon: Moon, tone: 'info' },
}

/** The single most urgent thing to do now, with one big ✓. */
export default function NextUpHero({ item, busy, onDone, onSkip, leftCount, allDone, onReview }) {
  if (allDone || !item) {
    return (
      <section className="nu nu--clear">
        <div className="nu-kicker"><Sparkles size={13} /> Next up</div>
        <h2 className="nu-title">Everything done today.</h2>
        <p className="nu-sub">Close the loop with a 20-second review.</p>
        {onReview && <button type="button" className="btn btn-primary nu-cta" onClick={onReview}><Moon size={16} /> Review the day</button>}
      </section>
    )
  }
  const copy = item.late ? KIND_COPY.overdue : item.boss ? KIND_COPY.boss : KIND_COPY[item.kind] || KIND_COPY.habit
  const Icon = copy.icon
  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={`${item.kind}_${item.id}`}
        className={`nu nu--${copy.tone}`}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.16 } }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <div className="nu-kicker"><Icon size={13} /> {copy.label}{leftCount > 1 && <span className="nu-left">· {leftCount - 1} more after this</span>}</div>
        <div className="nu-body">
          <div className="nu-text">
            <h2 className="nu-title">{item.title}</h2>
            {item.sub && <p className="nu-sub">{item.sub}</p>}
          </div>
          {item.kind === 'protocol' ? (
            <Link href={item.href} className="nu-check nu-check--link" aria-label={`Log ${item.title}`}><ArrowRight size={26} /></Link>
          ) : (
            <button type="button" className="nu-check" disabled={busy} onClick={() => onDone(item)} data-celebrate aria-label={`Complete ${item.title}`}>
              <Check size={30} strokeWidth={3} />
            </button>
          )}
        </div>
        <button type="button" className="nu-skip" onClick={() => onSkip(item)}>Skip for now</button>
      </motion.section>
    </AnimatePresence>
  )
}
