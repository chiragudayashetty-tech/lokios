'use client'

import { useMemo, useState } from 'react'
import {
  Flame, Shield, Crown, Sparkles, CalendarCheck, Snowflake, Zap, Repeat, Cog, Mountain, Medal, Gem, Link2, Target, Gift,
  CheckSquare, ListChecks, Rocket, CalendarClock, Inbox, Flag, MapPin, Briefcase, TrendingUp, Ghost, Swords, Skull, Dices,
  Wallet, PiggyBank, Trophy, BookOpen, ScrollText, Moon, ClipboardCheck, Smartphone, ShieldOff, Focus, BedDouble, Sunrise, Lock, Award,
} from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import Ring from '@/components/ui/Ring'
import SchemaHint from '@/components/ui/SchemaHint'
import { useAchievements } from '@/lib/hooks/useAchievements'
import { PENDING } from '@/lib/stores/achievementStore'
import { CATEGORIES, RARITY, achievementXp } from '@/lib/achievements'

export const ICONS = { Flame, Shield, Crown, Sparkles, CalendarCheck, Snowflake, Zap, Repeat, Cog, Mountain, Medal, Gem, Link2, Target, Gift, CheckSquare, ListChecks, Rocket, CalendarClock, Inbox, Flag, MapPin, Briefcase, TrendingUp, Ghost, Swords, Skull, Dices, Wallet, PiggyBank, Trophy, BookOpen, ScrollText, Moon, ClipboardCheck, Smartphone, ShieldOff, Focus, BedDouble, Sunrise }

const fmt = (iso) => (iso === PENDING ? 'Earned · XP pending' : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

export function Badge({ a, earnedAt, size = 'md', onClick }) {
  const Icon = ICONS[a.icon] || Award
  const r = RARITY[a.rarity]
  const pct = a.target ? Math.min(1, a.progress / a.target) : 0
  const close = !earnedAt && pct >= 0.7
  const iconSize = size === 'lg' ? 34 : 24
  return (
    <button type="button" className={`ach ach--${a.rarity} ach--${size} ${earnedAt ? 'is-earned' : 'is-locked'} ${close ? 'is-close' : ''}`} style={{ '--rc': r.color }} onClick={onClick} aria-label={`${a.name}, ${r.label}, ${earnedAt ? 'earned' : `${Math.round(pct * 100)}% done`}`}>
      <span className="ach-medal">
        <span className="ach-icon"><Icon size={iconSize} strokeWidth={earnedAt ? 2.2 : 1.8} /></span>
        {!earnedAt && <span className="ach-lock" aria-hidden><Lock size={10} /></span>}
      </span>
      <span className="ach-name">{a.name}</span>
      {earnedAt ? (
        <span className="ach-sub">{earnedAt === PENDING ? <>Earned · <b>+{achievementXp(a)} XP</b> pending</> : <><b>+{achievementXp(a)} XP</b> · {fmt(earnedAt)}</>}</span>
      ) : (
        <span className="ach-progress"><span className="ach-bar"><i style={{ width: `${pct * 100}%` }} /></span><em>{a.target > 1 ? `${a.progress}/${a.target}` : close ? 'Almost' : 'Not yet'}</em></span>
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
  const pending = (ach.missing || ach.saveError) && earnedCount > 0
  const nextUp = ach.list.filter((a) => !ach.earned.has(a.id) && a.target > 0 && a.progress > 0).sort((x, y) => y.progress / y.target - x.progress / x.target).slice(0, 4)
  const show = (a) => filter === 'all' || (filter === 'earned' ? ach.earned.has(a.id) : !ach.earned.has(a.id))
  const sel = open && ach.list.find((a) => a.id === open)

  return (
    <div className="progress-extras ach-gallery">
      {ach.missing && <SchemaHint feature="Saving achievements" />}
      {!ach.missing && ach.saveError && <p className="cal-notice is-bad">Your badges couldn&apos;t be saved yet, so their XP is on hold ({ach.saveError}). Run <code>supabase/migrations/20261008_round2_repair.sql</code> in Supabase, then reload.</p>}
      <section className="hud-panel p-5 ach-summary">
        <Ring value={ach.list.length ? earnedCount / ach.list.length : 0} size={64} stroke={7} gradient label={`${earnedCount} of ${ach.list.length} badges`}><b className="ach-ring-num">{Math.round((earnedCount / (ach.list.length || 1)) * 100)}%</b></Ring>
        <div>
          <span className="record-label">Collected</span>
          <span className="record-value">{earnedCount}<em> / {ach.list.length}</em></span>
          <span className="record-sub">{pending ? `+${xp} XP waiting — paid once the database update is run` : `+${xp} XP from achievements`}</span>
        </div>
        <div className="ach-rarity-key">{Object.entries(RARITY).map(([k, r]) => <span key={k} style={{ '--rc': r.color }}><i /> {r.label} · {r.xp} XP</span>)}</div>
        <div className="tk-chips">
          {['all', 'earned', 'locked'].map((f) => <button key={f} type="button" className={`tk-chip ${filter === f ? 'is-on' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
        </div>
      </section>
      {nextUp.length > 0 && filter !== 'earned' && (
        <section className="hud-panel p-5">
          <div className="arena-card-head mb-3">Next up <span className="arena-hint ml-auto">closest to unlocking</span></div>
          <div className="ach-grid">{nextUp.map((a) => <Badge key={a.id} a={a} onClick={() => setOpen(a.id)} />)}</div>
        </section>
      )}
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
            <p className="ach-meta">{ach.earned.get(sel.id) === PENDING ? `Earned · +${achievementXp(sel)} XP is paid once it's saved` : ach.earned.get(sel.id) ? `Earned ${fmt(ach.earned.get(sel.id))} · +${achievementXp(sel)} XP` : `Progress ${sel.progress}/${sel.target} · unlocks +${achievementXp(sel)} XP`}</p>
          </div>
        )}
      </Sheet>
    </div>
  )
}
