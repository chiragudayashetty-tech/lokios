'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { CheckSquare, Trash2, Rocket, StickyNote, Hash, Lightbulb } from 'lucide-react'
import { tagsOf, textOf, ageLabel } from '@/lib/utils/brainDump'

const THRESH = 110

function TopCard({ item, now, onTask, onTrash, onMission, onOpen }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-10, 10])
  const taskHint = useTransform(x, [30, THRESH], [0, 1])
  const trashHint = useTransform(x, [-THRESH, -30], [1, 0])
  const upHint = useTransform(y, [-THRESH, -30], [1, 0])
  const [exit, setExit] = useState({ x: 0, y: 0 })

  const onDragEnd = (_, info) => {
    const { offset, velocity } = info
    if (offset.x > THRESH || velocity.x > 700) { setExit({ x: 600, y: 0 }); onTask(item) }
    else if (offset.x < -THRESH || velocity.x < -700) { setExit({ x: -600, y: 0 }); onTrash(item) }
    else if (offset.y < -THRESH || velocity.y < -700) { setExit({ x: 0, y: -600 }); onMission(item) }
  }

  return (
    <motion.article
      className="ibx-card is-top"
      style={{ x, y, rotate }}
      drag
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.94, opacity: 0, y: 14 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ x: exit.x, y: exit.y, opacity: 0, transition: { duration: 0.25 } }}
      onTap={() => onOpen(item)}
      whileTap={{ cursor: 'grabbing' }}
    >
      <motion.span className="ibx-hint is-task" style={{ opacity: taskHint }}><CheckSquare size={14} /> Task</motion.span>
      <motion.span className="ibx-hint is-trash" style={{ opacity: trashHint }}><Trash2 size={14} /> Trash</motion.span>
      <motion.span className="ibx-hint is-mission" style={{ opacity: upHint }}><Rocket size={14} /> Mission idea</motion.span>
      <div className="ibx-meta"><span className="ibx-age">{ageLabel(item, now)}</span>{tagsOf(item).map((t) => <span key={t} className="bd-tag"><Hash size={10} />{t}</span>)}</div>
      <p className="ibx-text">{textOf(item)}</p>
    </motion.article>
  )
}

/**
 * Inbox as a card stack. Phone: swipe right → task, left → trash, up → mission idea,
 * tap → editor. Desktop: the same as buttons.
 */
export default function InboxStack({ items, now, onTask, onTrash, onMission, onOpen, onKeep }) {
  const top = items[0]
  const behind = items.slice(1, 3)
  return (
    <div className="ibx">
      <div className="ibx-deck">
        {behind.map((it, i) => (
          <div key={it.id} className="ibx-card is-behind" style={{ transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.04})`, zIndex: 2 - i }} aria-hidden>
            <p className="ibx-text">{textOf(it)}</p>
          </div>
        ))}
        <AnimatePresence mode="popLayout">
          {top && <TopCard key={top.id} item={top} now={now} onTask={onTask} onTrash={onTrash} onMission={onMission} onOpen={onOpen} />}
        </AnimatePresence>
      </div>
      {top && (
        <div className="ibx-actions">
          <button type="button" className="ibx-btn is-trash" onClick={() => onTrash(top)}><Trash2 size={16} /><span>Trash</span></button>
          <button type="button" className="ibx-btn is-note" onClick={() => onKeep(top, 'note')}><StickyNote size={16} /><span>Note</span></button>
          <button type="button" className="ibx-btn is-idea" onClick={() => onKeep(top, 'idea')}><Lightbulb size={16} /><span>Idea</span></button>
          <button type="button" className="ibx-btn is-mission" onClick={() => onMission(top)}><Rocket size={16} /><span>Mission</span></button>
          <button type="button" className="ibx-btn is-task" onClick={() => onTask(top)}><CheckSquare size={16} /><span>Task</span></button>
        </div>
      )}
      {top && <p className="ibx-help">Swipe right → task · left → trash · up → mission idea · tap to edit</p>}
    </div>
  )
}
