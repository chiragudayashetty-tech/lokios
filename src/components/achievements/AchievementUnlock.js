'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Badge } from '@/components/achievements/AchievementGallery'
import { ACHIEVEMENTS, RARITY, achievementXp } from '@/lib/achievements'
import { celebrateBig } from '@/lib/utils/celebrate'

const ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }

/** "Achievement unlocked" moment: one badge large, or a summary when several land together. */
export default function AchievementUnlock() {
  const [queue, setQueue] = useState([]) // [{ ids, history }]

  useEffect(() => {
    const on = (e) => {
      const d = e.detail
      if (d?.type !== 'achievement-unlocked' || !d.ids?.length) return
      setQueue((q) => [...q, { ids: d.ids, history: !!d.history }])
    }
    window.addEventListener('lokios:game', on)
    return () => window.removeEventListener('lokios:game', on)
  }, [])

  const cur = queue[0]
  const close = () => setQueue((q) => q.slice(1))
  useEffect(() => {
    if (!cur) return
    const t = setTimeout(() => celebrateBig(), 250)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [cur])

  if (!cur || typeof document === 'undefined') return null
  const items = cur.ids.map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean)
    .map((a) => ({ ...a, progress: a.target || 1 })).sort((x, y) => ORDER[x.rarity] - ORDER[y.rarity])
  if (!items.length) return null
  const xp = items.reduce((s, a) => s + achievementXp(a), 0)
  const one = items.length === 1 ? items[0] : null
  const top = one ? RARITY[one.rarity] : RARITY[items[0].rarity]

  return createPortal(
    <div className="ach-pop" role="dialog" aria-modal="true" aria-label="Achievement unlocked" onClick={close}>
      <div className={`ach-pop-card ach--${items[0].rarity}`} style={{ '--rc': top.color }} onClick={(e) => e.stopPropagation()}>
        <span className="ach-pop-rays" aria-hidden />
        <span className="ach-pop-kicker">{one ? `${top.label} achievement unlocked` : cur.history ? 'Unlocked from your history' : 'Achievements unlocked'}</span>
        {one ? (
          <>
            <Badge a={one} earnedAt={new Date().toISOString()} size="lg" />
            <h2 className="ach-pop-title">{one.name}</h2>
            <p className="ach-pop-desc">{one.description}</p>
          </>
        ) : (
          <>
            <h2 className="ach-pop-title">{items.length} badges earned</h2>
            <div className="ach-pop-grid">{items.slice(0, 6).map((a) => <Badge key={a.id} a={a} earnedAt={new Date().toISOString()} size="sm" />)}</div>
            {items.length > 6 && <p className="ach-pop-desc">+{items.length - 6} more in your collection</p>}
          </>
        )}
        <div className="ach-pop-xp">+{xp.toLocaleString()} XP</div>
        <div className="ach-pop-actions">
          <button type="button" className="btn btn-primary" onClick={() => { celebrateBig(); close() }} autoFocus>Collect</button>
          <Link href="/achievements" className="btn btn-ghost" onClick={close}>See all badges</Link>
        </div>
      </div>
    </div>,
    document.body,
  )
}
