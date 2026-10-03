'use client'

import { useMemo, useState } from 'react'
import {
  Flame, Shield, Crown, Sparkles, CalendarCheck, Snowflake, Zap, Repeat, Cog, Mountain, Medal, Gem, Link2, Target, Gift,
  CheckSquare, ListChecks, Rocket, CalendarClock, Inbox, Flag, MapPin, Briefcase, TrendingUp, Ghost, Swords, Skull, Dices,
  Wallet, PiggyBank, Trophy, BookOpen, ScrollText, Moon, ClipboardCheck, Smartphone, ShieldOff, Focus, BedDouble, Sunrise, Lock, Award,
} from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import SchemaHint from '@/components/ui/SchemaHint'
import { useAchievements } from '@/lib/hooks/useAchievements'
import { CATEGORIES, RARITY, achievementXp } from '@/lib/achievements'

export const ICONS = { Flame, Shield, Crown, Sparkles, CalendarCheck, Snowflake, Zap, Repeat, Cog, Mountain, Medal, Gem, Link2, Target, Gift, CheckSquare, ListChecks, Rocket, CalendarClock, Inbox, Flag, MapPin, Briefcase, TrendingUp, Ghost, Swords, Skull, Dices, Wallet, PiggyBank, Trophy, BookOpen, ScrollText, Moon, ClipboardCheck, Smartphone, ShieldOff, Focus, BedDouble, Sunrise }

const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function Badge({ a, earnedAt, size = 'md', onClick }) {
  const Icon = ICONS[a.icon] || Award
  const r = RARITY[a.rarity]
  const pct = a.target ? a.progress / a.target : 0
  return (
    <button type="button" className={`ach ach--${a.rarity} ach--${size} ${earnedAt ? 'is-earned' : 'is-locked'}`} style={{ '--rc': r.color }} onClick={onClick} aria-label={`${a.name}, ${earnedAt ? 'earned' : 'locked'}`}>
      <span className="ach-icon">{earnedAt ? <Icon size={size === 'lg' ? 30 : 22} /> : <Lock size={size === 'lg' ? 24 : 16} />}</span>
      <span className="ach-name">{a.name}</span>
      {earnedAt ? (
        <span className="ach-sub">{fmt(earnedAt)}</span>
      ) : (
        <span className="ach-progress"><span className="ach-bar"><i style={{ width: `${Math.min(100, pct * 100)}%` }} /></span><em>{a.target > 1 ? `${a.progress}/${a.target}` : 'Locked'}</em></span>
      )}
    </button>
  )
}

/** Progress → Achievements (#29): every badge by category with rarity and progress. */
export default function AchievementGallery() {
  const ach = useAchievements()
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('all')
  const groups = useMemo(() => CATEGORIES.map((c) => ({ c, items: ach.list.filter((a) => a.category === c) })).filter((g) => g.items.length), [ach.list])

  if (!ach.ready) return <section className="hud-panel p-5 arena-skeleton" aria-busy="true" />
  const earnedCount = ach.list.filter((a) => ach.earned.has(a.id)).length
  const xp = ach.list.filter((a) => ach.earned.has(a.id)).reduce((s, a) => s + achievementXp(a), 0)
  const show = (a) => filter === 'all' || (filter === 'earned' ? ach.earned.has(a.id) : !ach.earned.has(a.id))
  const sel = open && ach.list.find((a) => a.id === open)

  return (
    <div className="progress-extras ach-gallery">
      {ach.missing && <SchemaHint feature="Saving achievements" />}
      <section className="hud-panel p-5 ach-summary">
        <div>
          <span className="record-label">Collected</span>
          <span className="record-value">{earnedCount}<em> / {ach.list.length}</em></span>
          <span className="record-sub">+{xp} XP from achievements</span>
        </div>
        <div className="ach-rarity-key">{Object.entries(RARITY).map(([k, r]) => <span key={k} style={{ '--rc': r.color }}><i /> {r.label} · {r.xp} XP</span>)}</div>
        <div className="tk-chips">
          {['all', 'earned', 'locked'].map((f) => <button key={f} type="button" className={`tk-chip ${filter === f ? 'is-on' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
        </div>
      </section>
      {groups.map(({ c, items }) => {
        const vis = items.filter(show)
        if (!vis.length) return null
        return (
          <section key={c} className="hud-panel p-5">
            <div className="arena-card-head mb-3">{c} <span className="arena-hint ml-auto">{items.filter((a) => ach.earned.has(a.id)).length}/{items.length}</span></div>
            <div className="ach-grid">
              {vis.map((a) => <Badge key={a.id} a={a} earnedAt={ach.earned.get(a.id)} onClick={() => setOpen(a.id)} />)}
            </div>
          </section>
        )
      })}
      <Sheet open={!!sel} onClose={() => setOpen(null)} title={sel?.name} subtitle={sel ? `${RARITY[sel.rarity].label} · ${sel.category}` : null}>
        {sel && (
          <div className="ach-detail">
            <Badge a={sel} earnedAt={ach.earned.get(sel.id)} size="lg" />
            <p className="ach-desc">{sel.description}</p>
            <p className="ach-meta">{ach.earned.get(sel.id) ? `Earned ${fmt(ach.earned.get(sel.id))} · +${achievementXp(sel)} XP` : `Progress ${sel.progress}/${sel.target} · unlocks +${achievementXp(sel)} XP`}</p>
          </div>
        )}
      </Sheet>
    </div>
  )
}
