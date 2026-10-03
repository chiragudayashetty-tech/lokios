'use client'

import { useMemo } from 'react'
import { Trophy, Medal, CalendarDays, Swords, Snowflake, Flame, Lightbulb } from 'lucide-react'
import { useGameState } from '@/lib/hooks/useGameState'
import { masteryTier, nextMasteryTier, MASTERY_TIERS } from '@/lib/utils/xpRules'
import { shiftDate } from '@/lib/utils/streakCalc'
import { getLocalDateStr } from '@/lib/utils/dates'

const fmtDate = (d) => d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'

function heatColor(stats, frozen) {
  if (frozen) return 'rgba(143, 211, 255, 0.55)'
  if (!stats || stats.ratio === null) return 'rgba(255,255,255,0.04)'
  if (stats.perfect) return 'var(--success)'
  if (stats.qualifies) return 'color-mix(in oklab, var(--success) 65%, transparent)'
  if (stats.ratio >= 0.6) return 'color-mix(in oklab, var(--accent-primary) 45%, transparent)'
  if (stats.ratio > 0) return 'color-mix(in oklab, var(--accent-primary) 20%, transparent)'
  return 'rgba(255, 92, 122, 0.18)'
}

/** Personal records, year streak calendar, habit mastery and trophy shelf (Progress page). */
export default function ProgressExtras() {
  const g = useGameState()

  const weeks = useMemo(() => {
    if (!g.ready) return []
    const today = g.today
    // 53 columns ending this week, Monday-first rows
    const end = shiftDate(today, 6 - ((new Date(`${today}T12:00:00`).getDay() + 6) % 7))
    const start = shiftDate(end, -(53 * 7) + 1)
    const cols = []
    for (let w = 0; w < 53; w++) {
      cols.push(Array.from({ length: 7 }, (_, d) => {
        const date = shiftDate(start, w * 7 + d)
        return { date, future: date > today, stats: date <= today ? g.model.dayStats(date) : null, frozen: g.model.frozenDates.has(date) }
      }))
    }
    return cols
  }, [g.ready, g.model, g.today])

  if (!g.ready) return null
  const { records, model, habits, xpRows, season } = g
  const insights = g.insights()
  const trophies = [
    ...xpRows.filter(r => r.source_type === 'weekly_boss').map(r => ({ icon: Swords, label: 'Boss slain', sub: String(r.description || '').replace(/^.*— /, '').replace(/\s\[#.*\]$/, ''), color: '#FF8A5C' })),
    ...xpRows.filter(r => r.source_type === 'mastery').map(r => ({ icon: Medal, label: String(r.description || '').match(/(Bronze|Silver|Gold|Diamond)/)?.[1] || 'Mastery', sub: String(r.description || '').replace(/^.*— /, '').replace(/\s\(.*$/, ''), color: '#FFD166' })),
    ...xpRows.filter(r => r.source_type === 'streak_milestone').map(r => ({ icon: Flame, label: String(r.description || '').replace(/ — .*$/, '').replace(/🔥|👑/g, '').trim(), sub: 'Streak milestone', color: 'var(--warning)' })),
    ...(season.title ? [{ icon: Snowflake, label: season.title, sub: `${season.name} · tier ${season.tier}`, color: 'var(--accent-primary)' }] : []),
  ]
  const mastery = habits.filter(h => h.is_active !== false)
    .map(h => ({ h, n: model.doneCountByHabit.get(h.id) || 0 }))
    .sort((a, b) => b.n - a.n)

  const recordTiles = [
    { label: 'Best XP day', value: records.bestDay ? `+${records.bestDay.value}` : '—', sub: fmtDate(records.bestDay?.date) },
    { label: 'Best week', value: records.bestWeek ? `+${records.bestWeek.value.toLocaleString()}` : '—', sub: records.bestWeek ? `wk of ${fmtDate(records.bestWeek.date)}` : '' },
    { label: 'Longest streak', value: `${records.longestStreak}d`, sub: '90%+ days in a row' },
    { label: 'Most habits / day', value: records.mostHabits?.value ?? '—', sub: fmtDate(records.mostHabits?.date) },
    { label: 'Lowest doomscroll', value: records.lowestDoom ? `${records.lowestDoom.value}m` : '—', sub: fmtDate(records.lowestDoom?.date) },
    { label: 'Today', value: `${records.todayXp >= 0 ? '+' : ''}${records.todayXp}`, sub: records.bestDay && records.todayXp > records.bestDay.value ? 'New record! 🏆' : records.bestDay ? `${Math.max(0, records.bestDay.value - records.todayXp)} to beat best` : '' },
  ]

  return (
    <div className="progress-extras">
      <section className="hud-panel p-5">
        <div className="arena-card-head mb-3"><Lightbulb size={15} style={{ color: '#FFD166' }} /> Insights <span className="arena-hint ml-auto">from your last 120 days</span></div>
        {insights.length ? (
          <div className="insights-list">
            {insights.map((it, i) => (
              <div key={it.label} className="insight" style={{ animationDelay: `${i * 60}ms` }}>
                <span className={`insight-delta ${it.diff >= 0 ? 'is-up' : 'is-down'}`}>{it.diff >= 0 ? '+' : '−'}{Math.round(Math.abs(it.diff) * 100)}%</span>
                <span className="insight-text">
                  {it.text.split('**').map((part, j) => (j % 2 ? <b key={j}>{part.trim()}</b> : <span key={j}>{part}</span>))}
                </span>
              </div>
            ))}
          </div>
        ) : <div className="arena-line">Keep logging for a couple of weeks — patterns appear once there are enough days to compare.</div>}
      </section>
      <section className="hud-panel p-5">
        <div className="arena-card-head mb-3"><Trophy size={15} style={{ color: '#FFD166' }} /> Personal records</div>
        <div className="records-grid">
          {recordTiles.map(t => (
            <div key={t.label} className="record-tile">
              <span className="record-label">{t.label}</span>
              <span className="record-value">{t.value}</span>
              <span className="record-sub">{t.sub}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="hud-panel p-5">
        <div className="arena-card-head mb-3"><CalendarDays size={15} /> Streak calendar <span className="arena-hint ml-auto">last 12 months</span></div>
        <div className="heatmap-scroll">
          <div className="heatmap">
            {weeks.map((col, i) => (
              <div key={i} className="heatmap-col">
                {col.map(c => (
                  <span
                    key={c.date}
                    className={`heatmap-cell ${c.date === getLocalDateStr() ? 'is-today' : ''}`}
                    style={{ background: c.future ? 'transparent' : heatColor(c.stats, c.frozen) }}
                    title={c.future ? '' : `${fmtDate(c.date)} · ${c.frozen ? 'freeze used' : c.stats?.ratio === null ? 'nothing scheduled' : `${c.stats.done}/${c.stats.scheduled} habits`}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="heatmap-legend">
          <span><i style={{ background: 'rgba(255, 92, 122, 0.18)' }} /> missed</span>
          <span><i style={{ background: 'color-mix(in oklab, var(--accent-primary) 45%, transparent)' }} /> 60%+</span>
          <span><i style={{ background: 'color-mix(in oklab, var(--success) 65%, transparent)' }} /> streak day</span>
          <span><i style={{ background: 'var(--success)' }} /> perfect</span>
          <span><i style={{ background: 'rgba(143, 211, 255, 0.55)' }} /> freeze</span>
        </div>
      </section>

      <section className="hud-panel p-5">
        <div className="arena-card-head mb-3"><Medal size={15} style={{ color: '#FFD166' }} /> Habit mastery <span className="arena-hint ml-auto">{MASTERY_TIERS.map(t => `${t.label} ${t.at}`).join(' · ')}</span></div>
        <div className="mastery-list">
          {mastery.map(({ h, n }) => {
            const tier = masteryTier(n)
            const nx = nextMasteryTier(n)
            const from = tier ? tier.at : 0
            return (
              <div key={h.id} className="mastery-row">
                <span className="mastery-badge" style={{ color: tier?.color || 'var(--text-disabled)', borderColor: tier ? `color-mix(in oklab, ${tier.color} 45%, transparent)` : 'var(--border-color)' }}>
                  <Medal size={14} />
                </span>
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="mastery-name">{h.title}</span>
                  <span className="arena-bar"><span style={{ width: `${nx ? ((n - from) / (nx.at - from)) * 100 : 100}%`, background: tier?.color || 'var(--accent-primary)' }} /></span>
                </span>
                <span className="mastery-count">{n}{nx ? <em> / {nx.at}</em> : ' 💎'}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="hud-panel p-5">
        <div className="arena-card-head mb-3"><Trophy size={15} style={{ color: '#FFD166' }} /> Trophy shelf</div>
        {trophies.length ? (
          <div className="trophy-shelf">
            {trophies.map((t, i) => {
              const Icon = t.icon
              return (
                <div key={i} className="trophy">
                  <span className="trophy-icon" style={{ color: t.color }}><Icon size={20} /></span>
                  <span className="trophy-label">{t.label}</span>
                  <span className="trophy-sub">{t.sub}</span>
                </div>
              )
            })}
          </div>
        ) : <div className="arena-line">Beat a weekly boss, hit a streak milestone or reach a mastery tier to earn trophies.</div>}
      </section>
    </div>
  )
}
