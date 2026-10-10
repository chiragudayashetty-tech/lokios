'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Swords, Link2, AlertTriangle, ArrowRight, Clock, X } from 'lucide-react'

const rowAnim = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } },
  transition: { type: 'spring', stiffness: 420, damping: 32 },
}

function Row({ item, busy, onToggle }) {
  const cls = ['tdy-row', item.done && 'is-done', item.failed && 'is-failed', item.late && 'is-late', item.boss && !item.done && 'is-boss', item.linked && 'is-linked'].filter(Boolean).join(' ')
  return (
    <motion.div layout {...rowAnim} className={cls}>
      {item.linked && <span className="tdy-row-link" aria-hidden />}
      {item.kind === 'protocol' && !item.done && !item.capture ? (
        <Link href={item.href} className="tdy-row-check is-link" aria-label={`Log ${item.title}`}><ArrowRight size={15} /></Link>
      ) : (
        <button
          type="button"
          className={`tdy-row-check ${item.done ? 'is-done' : item.failed ? 'is-failed' : ''}`}
          disabled={busy || ((item.done || item.failed) && item.kind !== 'habit' && !item.capture)}
          onClick={() => onToggle(item)}
          data-celebrate={item.done || item.failed ? undefined : ''}
          aria-label={item.done ? `Undo ${item.title}` : item.failed ? `Clear failed ${item.title}` : `Complete ${item.title}`}
        >
          {item.failed ? <X size={15} strokeWidth={3} /> : <Check size={15} strokeWidth={3} />}
        </button>
      )}
      <span className="tdy-row-main">
        <span className="tdy-row-title">
          {item.title}
          {item.failed && <span className="today-tag tdy-failed-tag">failed</span>}
          {item.boss && !item.done && !item.failed && <span className="today-tag today-tag--boss"><Swords size={10} /> boss</span>}
          {item.chainRun > 1 && <span className="tdy-chain-tag"><Link2 size={10} /> ×{item.chainRun}</span>}
        </span>
        <span className="tdy-row-sub">
          {item.late && <AlertTriangle size={11} />}
          {item.time && <><Clock size={11} /> {item.time} · </>}
          {item.sub}
        </span>
      </span>
    </motion.div>
  )
}

/**
 * One time-of-day block. Past blocks collapse to "Morning · 4/5 done";
 * the current block is highlighted.
 */
export default function TimelineSection({ section, items, phase, expanded, onToggleExpand, onToggleItem, busy }) {
  const done = items.filter((i) => i.done).length
  const failed = items.filter((i) => i.failed).length
  const total = items.length
  const allDone = total > 0 && done === total
  const Icon = section.icon
  return (
    <section className={`tls tls--${phase} ${allDone ? 'is-complete' : ''}`} aria-label={section.label}>
      <button type="button" className="tls-head" onClick={onToggleExpand} aria-expanded={expanded}>
        <span className="tls-dot"><Icon size={14} /></span>
        <span className="tls-title">{section.label}</span>
        <span className="tls-range">{section.range}</span>
        {phase === 'current' && <span className="tls-now">Now</span>}
        <span className="tls-count">{total ? `${done}/${total} done${failed ? ` · ${failed} failed` : ''}` : 'Nothing planned'}</span>
        <ChevronDown size={15} className="tls-chev" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && total > 0 && (
          <motion.div className="tls-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <Row key={`${item.kind}_${item.id}`} item={item} busy={busy.has(item.id)} onToggle={onToggleItem} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
