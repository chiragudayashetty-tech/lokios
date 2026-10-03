'use client'

import { Wand2, TrendingUp, TrendingDown } from 'lucide-react'
import { useGameState } from '@/lib/hooks/useGameState'
import { DEBRIEF_XP } from '@/lib/utils/xpRules'

const pct = (r) => `${Math.round((r || 0) * 100)}%`
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Data-driven recap of a week for the weekly debrief, with one-tap draft text. */
export default function DebriefRecap({ weekStart, onAutofill }) {
  const g = useGameState()
  if (!g.ready || !weekStart) return null
  const r = g.weekRecap(weekStart)
  const isThisWeek = weekStart === g.weekStart
  const boss = isThisWeek ? g.boss : null
  const bet = isThisWeek ? g.bet : weekStart === g.lastBet?.weekStart ? g.lastBet : null

  const draft = () => {
    const wins = [
      `Net ${r.net >= 0 ? '+' : ''}${r.net} XP (+${r.gained} / ${r.lost}), ${r.streakDays} streak day${r.streakDays === 1 ? '' : 's'}, ${r.perfectDays} perfect day${r.perfectDays === 1 ? '' : 's'}.`,
      ...r.best.filter(b => b.rate >= 0.7).map(b => `${b.habit.title}: ${b.done}/${b.scheduled} (${pct(b.rate)})`),
      boss?.defeated ? `Defeated the weekly boss: ${boss.habit.title}.` : null,
      bet?.paid ? `Won my bet (${bet.target} streak days).` : null,
    ].filter(Boolean).map(l => `- ${l}`).join('\n')
    const fails = [
      ...r.worst.filter(w => w.rate < 0.7).map(w => `${w.habit.title}: only ${w.done}/${w.scheduled} (${pct(w.rate)})`),
      r.avgCompletion < 90 ? `Average completion ${r.avgCompletion}% — below the 90% streak bar.` : null,
      boss && !boss.defeated ? `Boss still standing: ${boss.habit.title} (${boss.hits}/${boss.target}).` : null,
    ].filter(Boolean).map(l => `- ${l}`).join('\n')
    onAutofill?.(wins, fails || '- No major misses this week.')
  }

  return (
    <div className="debrief-recap">
      <div className="debrief-recap-head">
        <span className="arena-card-head">Week in numbers</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={draft}><Wand2 size={14} /> Auto-fill from data</button>
      </div>
      <div className="debrief-stats">
        <div><b style={{ color: r.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{r.net >= 0 ? '+' : ''}{r.net}</b><span>net XP</span></div>
        <div><b>{r.streakDays}/7</b><span>streak days</span></div>
        <div><b>{r.perfectDays}</b><span>perfect days</span></div>
        <div><b>{r.avgCompletion}%</b><span>avg completion</span></div>
      </div>
      <div className="debrief-days">
        {r.days.map((d, i) => (
          <span key={d.date} title={d.ratio === null ? 'nothing scheduled' : `${d.done}/${d.scheduled}`}
            className={d.date > g.today ? 'is-future' : d.perfect ? 'is-perfect' : d.qualifies ? 'is-streak' : d.ratio ? 'is-partial' : 'is-miss'}>
            {DOW[i]}
          </span>
        ))}
      </div>
      <div className="debrief-columns">
        <div>
          <div className="debrief-col-title" style={{ color: 'var(--success)' }}><TrendingUp size={13} /> Strongest</div>
          {r.best.map(b => <div key={b.habit.id} className="debrief-habit"><span>{b.habit.title}</span><em>{b.done}/{b.scheduled}</em></div>)}
        </div>
        <div>
          <div className="debrief-col-title" style={{ color: 'var(--danger)' }}><TrendingDown size={13} /> Needs work</div>
          {r.worst.map(w => <div key={w.habit.id} className="debrief-habit"><span>{w.habit.title}</span><em>{w.done}/{w.scheduled}</em></div>)}
        </div>
      </div>
      <div className="arena-hint">Saving this debrief earns +{DEBRIEF_XP} XP (once per week). Next week&apos;s boss is picked from your weakest habits.</div>
    </div>
  )
}
