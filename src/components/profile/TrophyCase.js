'use client'

import Link from 'next/link'
import { Award } from 'lucide-react'
import { Badge } from '@/components/achievements/AchievementGallery'
import { useAchievements } from '@/lib/hooks/useAchievements'

const ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }

/** Larger trophy case from the same achievements data as the gallery (#29). */
export default function TrophyCase({ limit = 8 }) {
  const ach = useAchievements()
  const earned = ach.list.filter((a) => ach.earned.has(a.id)).sort((a, b) => ORDER[a.rarity] - ORDER[b.rarity] || String(ach.earned.get(b.id)).localeCompare(String(ach.earned.get(a.id))))
  return (
    <section className="pf-card">
      <div className="pf-card-head"><Award size={15} /> Trophy case <Link href="/achievements" className="pf-link">{earned.length}/{ach.list.length || '—'} · see all</Link></div>
      {!ach.ready ? <div className="arena-skeleton pf-skel" /> : earned.length === 0 ? (
        <p className="ms-muted">No achievements yet — your first habit unlocks one.</p>
      ) : (
        <div className="pf-trophies">{earned.slice(0, limit).map((a) => <Badge key={a.id} a={a} earnedAt={ach.earned.get(a.id)} />)}</div>
      )}
    </section>
  )
}
