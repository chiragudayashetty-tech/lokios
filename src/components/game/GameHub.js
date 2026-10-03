'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Snowflake, Swords, Trophy, Dices, Gift, Crown } from 'lucide-react'
import { useGameState } from '@/lib/hooks/useGameState'
import { nextStreakMilestone, FREEZE_MAX, BOSS_XP, BET_STAKES, BET_TARGETS, CHEST_CHANCE, PERFECT_DAY_XP, STREAK_DAY_THRESHOLD } from '@/lib/utils/xpRules'
import { placeBet, weekStreakDays } from '@/lib/utils/gamification'

const Bar = ({ value, color = 'var(--opal-gradient)' }) => (
  <div className="arena-bar"><motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} style={{ background: color }} /></div>
)

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Dashboard "Arena": streak & freezes, weekly boss, season pass, weekly bet, today's chest odds. */
export default function GameHub() {
  const g = useGameState()
  if (!g.ready) return <div className="arena-grid arena-loading">{[0, 1, 2, 3].map(i => <div key={i} className="arena-card arena-skeleton" />)}</div>

  const { model, boss, season, bet, today, weekStart } = g
  const todayStats = model.dayStats(today)
  const need = todayStats.scheduled ? Math.max(0, Math.ceil(todayStats.scheduled * STREAK_DAY_THRESHOLD) - todayStats.done) : 0
  const next = nextStreakMilestone(model.current)
  const prevMilestoneDays = next ? Math.max(0, ...[0, 3, 7, 10, 15, 21, 30, 45, 60, 75, 100, 150, 200].filter(d => d < next.days)) : 0

  return (
    <section className="arena">
      <div className="arena-head">
        <span className="arena-title"><Crown size={15} /> Arena</span>
        <span className="arena-sub">Streaks, bosses, bets &amp; season rewards</span>
      </div>
      <div className="arena-grid">
        {/* Streak + freezes */}
        <div className="arena-card">
          <div className="arena-card-head"><Flame size={15} style={{ color: 'var(--warning)' }} /> Streak</div>
          <div className="arena-big">{model.current}<span>day{model.current === 1 ? '' : 's'}</span></div>
          <div className="arena-line">
            {need > 0 ? <>{need} more habit{need === 1 ? '' : 's'} today to keep it</> : todayStats.scheduled ? <span style={{ color: 'var(--success)' }}>Today counts ✓</span> : 'Rest day'}
          </div>
          {next && (
            <>
              <Bar value={(model.current - prevMilestoneDays) / (next.days - prevMilestoneDays)} />
              <div className="arena-line">{next.days - model.current}d → <b style={{ color: 'var(--success)' }}>+{next.xp} XP</b></div>
            </>
          )}
          <div className="arena-freezes" title="Earn 1 freeze per 7 streak days (max 3). A freeze saves your streak on a missed day.">
            {Array.from({ length: FREEZE_MAX }, (_, i) => (
              <span key={i} className={i < model.freezes ? 'is-on' : ''}><Snowflake size={13} /></span>
            ))}
            <em>{model.freezes} freeze{model.freezes === 1 ? '' : 's'}</em>
          </div>
        </div>

        {/* Weekly boss */}
        <div className={`arena-card ${boss?.defeated ? 'arena-card--won' : ''}`}>
          <div className="arena-card-head"><Swords size={15} style={{ color: 'var(--danger)' }} /> Weekly boss</div>
          {boss ? (
            <>
              <div className="arena-boss-name">{boss.habit.title}</div>
              <div className="arena-line">Weakest habit · {Math.round(boss.priorRate * 100)}% last 2 weeks</div>
              <Bar value={boss.target ? 1 - boss.hp / boss.target : 0} color={boss.defeated ? 'linear-gradient(90deg,#FFD166,#FFB547)' : 'linear-gradient(90deg,#FF5C7A,#FF8A5C)'} />
              <div className="arena-pips">
                {boss.days.map((d, i) => <span key={d.date} className={d.hit ? 'is-hit' : d.future ? 'is-future' : ''}>{DOW[i]}</span>)}
              </div>
              <div className="arena-line">
                {boss.defeated
                  ? <span style={{ color: '#FFD166' }}><Trophy size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Defeated · +{BOSS_XP} XP</span>
                  : <>HP {boss.hp} · hit it {boss.target}× this week → <b style={{ color: 'var(--success)' }}>+{BOSS_XP} XP</b></>}
              </div>
            </>
          ) : <div className="arena-line">Add habits to summon a boss.</div>}
        </div>

        {/* Season pass */}
        <div className="arena-card arena-card--season">
          <div className="arena-card-head"><Snowflake size={15} style={{ color: 'var(--accent-primary)' }} /> {season.name} pass</div>
          <div className="arena-big">{season.tier}<span>/ {season.tiers.length}</span></div>
          <div className="arena-line">{season.title ? <>Title: <b>{season.title}</b></> : 'Earn XP to reach tier 1'}</div>
          <div className="arena-tiers">
            {season.tiers.map((t, i) => <span key={t.at} className={i < season.tier ? 'is-on' : ''} title={`${t.title} · ${t.at} XP · +${t.xp}`} />)}
          </div>
          {season.next
            ? <><Bar value={season.progress} /><div className="arena-line">{(season.next.at - season.gained).toLocaleString()} XP → <b>{season.next.title}</b></div></>
            : <div className="arena-line" style={{ color: 'var(--success)' }}>You survived winter ❄️</div>}
        </div>

        {/* Weekly bet */}
        <BetCard bet={bet} model={model} weekStart={weekStart} today={today} userId={g.userId} />

        {/* Today's chest */}
        <div className="arena-card">
          <div className="arena-card-head"><Gift size={15} style={{ color: '#FFD166' }} /> Perfect day</div>
          <div className="arena-big">{todayStats.done}<span>/ {todayStats.scheduled || 0}</span></div>
          <Bar value={todayStats.scheduled ? todayStats.done / todayStats.scheduled : 0} color="linear-gradient(90deg,#FFD166,#FF7AC6)" />
          <div className="arena-line">
            {todayStats.perfect && todayStats.scheduled
              ? <span style={{ color: 'var(--success)' }}>Perfect day ✓ +{PERFECT_DAY_XP} XP</span>
              : <>Finish all for <b>+{PERFECT_DAY_XP} XP</b> and a {Math.round(CHEST_CHANCE * 100)}% mystery chest</>}
          </div>
          <div className="arena-line arena-hint">First habit each day pays ×2 · 1 in 20 completions crit ×2</div>
        </div>
      </div>
    </section>
  )
}

function BetCard({ bet, model, weekStart, today, userId }) {
  const [stake, setStake] = useState(BET_STAKES[0])
  const [target, setTarget] = useState(5)
  const [busy, setBusy] = useState(false)
  const dayIndex = (new Date(`${today}T12:00:00`).getDay() + 6) % 7 // Mon = 0
  const canPlace = dayIndex <= 2 // bets close after Wednesday
  const days = weekStreakDays(model, weekStart)

  return (
    <div className="arena-card">
      <div className="arena-card-head"><Dices size={15} style={{ color: 'var(--accent-2)' }} /> Weekly bet</div>
      {bet ? (
        <>
          <div className="arena-big">{days}<span>/ {bet.target} days</span></div>
          <Bar value={days / bet.target} color={bet.paid ? 'linear-gradient(90deg,#3DDC97,#2FC7C9)' : 'var(--accent-gradient)'} />
          <div className="arena-line">
            {bet.paid ? <span style={{ color: 'var(--success)' }}>Won · +{bet.stake * 2} XP</span> : <>Staked {bet.stake} · win <b>{bet.stake * 2} XP</b> at {bet.target} streak days</>}
          </div>
        </>
      ) : canPlace ? (
        <>
          <div className="arena-line">Bet XP on streak days (90%+) this week. Hit it → double. Miss → stake lost.</div>
          <div className="arena-chips">
            {BET_TARGETS.map(t => <button key={t} type="button" className={t === target ? 'is-on' : ''} onClick={() => setTarget(t)}>{t}d</button>)}
          </div>
          <div className="arena-chips">
            {BET_STAKES.map(s => <button key={s} type="button" className={s === stake ? 'is-on' : ''} onClick={() => setStake(s)}>{s}</button>)}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm w-full mt-1"
            disabled={busy}
            onClick={async () => {
              if (!confirm(`Stake ${stake} XP on ${target} streak days this week? Win ${stake * 2} XP if you hit it.`)) return
              setBusy(true)
              try { await placeBet(userId, weekStart, stake, target) } finally { setBusy(false) }
            }}
          >Place bet · win {stake * 2}</button>
        </>
      ) : (
        <div className="arena-line">Bets open Monday–Wednesday. Next week: stake 100–500 XP on 4–7 streak days.</div>
      )}
    </div>
  )
}
