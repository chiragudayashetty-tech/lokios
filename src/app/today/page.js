'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Briefcase, Monitor, Mic, Wallet, Sun, Sunrise, CloudSun, Sunset, Infinity as InfinityIcon, Flame, Swords, Gift } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import Ring from '@/components/ui/Ring'
import NextUpHero from '@/components/today/NextUpHero'
import TimelineSection from '@/components/today/TimelineSection'
import EndOfDayReview from '@/components/today/EndOfDayReview'
import SleepCard from '@/components/today/SleepCard'
import { useOS, useOSSlice } from '@/lib/context/OSContext'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { getAppDateStr, getAppHour, formatTimeOf } from '@/lib/utils/appDate'
import { habitsScheduledOn, STREAK_DAY_THRESHOLD, PERFECT_DAY_XP } from '@/lib/utils/xpRules'
import { fetchBudgetLogs, isExcludedFromDaily, getLocalDailyBudget } from '@/lib/utils/budget'
import { orderWithChains, chainState } from '@/lib/utils/habitChains'
import { useGameState } from '@/lib/hooks/useGameState'
import { useSleep } from '@/lib/hooks/useSleep'
import { useDailyReview } from '@/lib/hooks/useDailyReview'

const PROTOCOLS = [
  { id: 'journal', label: 'Daily journal', href: '/journal', icon: BookOpen },
  { id: 'work', label: 'Work session', href: '/work', icon: Briefcase },
  { id: 'screen', label: 'Screen time', href: '/screen-time', icon: Monitor },
  { id: 'speaking', label: 'Speaking practice', href: '/speaking', icon: Mic },
  { id: 'budget', label: 'Budget', href: '/budget', icon: Wallet },
]

const SECTIONS = [
  { id: 'morning', label: 'Morning', range: 'Before 12:00', icon: Sunrise, from: 0, to: 12 },
  { id: 'afternoon', label: 'Afternoon', range: '12:00 – 17:00', icon: CloudSun, from: 12, to: 17 },
  { id: 'evening', label: 'Evening', range: 'After 17:00', icon: Sunset, from: 17, to: 48 },
  { id: 'anytime', label: 'Anytime', range: 'Whenever fits', icon: InfinityIcon },
]
const ORDER = { morning: 0, afternoon: 1, evening: 2, anytime: 3 }
const sectionForHour = (h) => (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening')

/** Today's protocol log status, fetched directly (one small query each). */
function useProtocolStatus(userId, today) {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const sb = createClient()
    const has = (q) => q.then(({ data }) => (data || []).length > 0).catch(() => false)
    Promise.all([
      has(sb.from('journal_entries').select('id').eq('user_id', userId).eq('date', today).limit(1)),
      has(sb.from('work_logs').select('id').eq('user_id', userId).eq('date', today).not('title', 'ilike', 'Weekly Debrief%').limit(1)),
      has(sb.from('screen_time_logs').select('id').eq('user_id', userId).eq('date', today).limit(1)),
      has(sb.from('speaking_logs').select('id').eq('user_id', userId).eq('date', today).limit(1)),
      fetchBudgetLogs(userId).then(logs => {
        const todays = (logs || []).filter(l => l.date === today)
        const spent = todays.filter(l => !isExcludedFromDaily(l)).reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
        return { logged: todays.length > 0, spent, limit: getLocalDailyBudget(userId) }
      }).catch(() => ({ logged: false })),
    ]).then(([journal, work, screen, speaking, budget]) => {
      if (!cancelled) setStatus({ journal, work, screen, speaking, budget: budget.logged })
    })
    return () => { cancelled = true }
  }, [userId, today])
  return status
}

/** Calendar time blocks for tasks today (#40): task_id → start time. Empty until the column exists. */
function useTaskBlocks(userId, today) {
  const [blocks, setBlocks] = useState(() => new Map())
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const start = new Date(`${today}T00:00:00`)
    const end = new Date(start.getTime() + 36 * 3600000)
    createClient().from('calendar_events').select('task_id, start_time').eq('user_id', userId).not('task_id', 'is', null)
      .gte('start_time', start.toISOString()).lt('start_time', end.toISOString())
      .then(({ data, error }) => { if (!cancelled && !error) setBlocks(new Map((data || []).map(b => [b.task_id, b.start_time]))) })
    return () => { cancelled = true }
  }, [userId, today])
  return blocks
}

export default function TodayPage() {
  const { user } = useOSSlice('auth')
  const { habits = [], monthLogs: todayLogs = [], cycleHabitState, loading: habitsLoading } = useOSSlice('habits')
  const { tasks = [], loading: tasksLoading } = useOSSlice('tasks')
  const { completeOperation } = useOS()
  const game = useGameState()
  const [now, setNow] = useState(() => new Date())
  const today = getAppDateStr(now)
  const calendarToday = getLocalDateStr(now)
  const appHour = getAppHour(now)
  const protocols = useProtocolStatus(user?.id, today)
  const blocks = useTaskBlocks(user?.id, today)
  const sleep = useSleep(user?.id)
  const review = useDailyReview(user?.id, today)
  const [busy, setBusy] = useState(() => new Set())
  const [expanded, setExpanded] = useState({})
  const [skipped, setSkipped] = useState([])
  const [showReview, setShowReview] = useState(false)

  // Keep "now" fresh so the current section and review prompt move with the clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const currentSection = sectionForHour(appHour)

  const model = useMemo(() => {
    const active = habits.filter(h => h.is_active !== false)
    const scheduled = habitsScheduledOn(active, today)
    const logs = todayLogs.filter(l => l.date === today)
    const doneIds = new Set(logs.filter(l => !l.status || l.status === 'completed').map(l => l.habit_id))
    const restIds = new Set(logs.filter(l => ['rest', 'blocked', 'skipped'].includes(l.status)).map(l => l.habit_id))
    const dayHabits = scheduled.filter(h => !restIds.has(h.id))
    const chains = chainState(active, logs, today)
    const bossId = game.boss && !game.boss.defeated ? game.boss.habit?.id : null

    const items = []
    for (const sec of SECTIONS) {
      const inSec = dayHabits.filter(h => (h.time_of_day || 'anytime') === sec.id)
      for (const { habit: h, linked } of orderWithChains(inSec, active)) {
        items.push({
          kind: 'habit', id: h.id, title: h.title, habit: h, section: sec.id, done: doneIds.has(h.id), linked,
          boss: h.id === bossId, chainRun: doneIds.has(h.id) ? chains.run.get(h.id) || 0 : 0,
          sub: `Habit · +${h.xp_per_completion || 25} XP${h.after_habit_id && linked ? ' · after ' + (active.find(x => x.id === h.after_habit_id)?.title || '') : ''}`,
        })
      }
    }

    const due = (t) => (t.due_date ? String(t.due_date).slice(0, 10) : null)
    const open = tasks.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status))
    const dayTasks = [
      ...open.filter(t => due(t) && due(t) <= today),
      ...tasks.filter(t => t.status === 'completed' && t.completed_at && getAppDateStr(new Date(t.completed_at)) === today),
    ]
    for (const t of dayTasks) {
      const block = blocks.get(t.id)
      const late = t.status !== 'completed' && due(t) < today
      items.push({
        kind: 'task', id: t.id, title: t.title, task: t, done: t.status === 'completed', late,
        section: block ? sectionForHour(new Date(block).getHours()) : 'anytime',
        time: block ? formatTimeOf(block) : null, start: block ? new Date(block).getTime() : null,
        sub: late ? `Task · due ${due(t)}` : 'Task · due today',
      })
    }

    for (const p of PROTOCOLS) {
      if (!protocols) break
      items.push({ kind: 'protocol', id: p.id, title: p.label, href: p.href, section: 'evening', done: !!protocols[p.id], sub: protocols[p.id] ? 'Logged' : 'Log before bed' })
    }

    // Within a section: pending first (time-blocked by time), done at the end.
    // A habit chain moves as one block so its connector lines stay intact.
    const bySection = Object.fromEntries(SECTIONS.map(s => [s.id, []]))
    for (const it of items) bySection[it.section].push(it)
    for (const id of Object.keys(bySection)) {
      const groups = []
      for (const it of bySection[id]) {
        if (it.linked && groups.length) groups[groups.length - 1].push(it)
        else groups.push([it])
      }
      const key = (g) => ({ done: g.every(x => x.done) ? 1 : 0, start: g[0].start ?? Infinity, late: g[0].late ? 0 : 1 })
      bySection[id] = groups
        .map((g, i) => ({ g, i, k: key(g) }))
        .sort((a, b) => (a.k.done - b.k.done) || (a.k.start - b.k.start) || (a.k.late - b.k.late) || (a.i - b.i))
        .flatMap(x => x.g)
    }

    // Next up: overdue task > boss habit > earliest-time habit > due task > unlogged protocol
    const pending = items.filter(i => !i.done)
    const candidates = [
      ...pending.filter(i => i.kind === 'task' && i.late),
      ...pending.filter(i => i.kind === 'habit' && i.boss),
      ...pending.filter(i => i.kind === 'habit' && !i.boss).sort((a, b) => ORDER[a.section] - ORDER[b.section]),
      ...pending.filter(i => i.kind === 'task' && !i.late).sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity)),
      ...pending.filter(i => i.kind === 'protocol'),
    ]

    const habitTotal = dayHabits.length
    const habitDone = dayHabits.filter(h => doneIds.has(h.id)).length
    return { items, bySection, candidates, total: items.length, done: items.length - pending.length, left: pending.length, habitTotal, habitDone }
  }, [habits, todayLogs, tasks, today, blocks, protocols, game.boss])

  const hero = model.candidates.find(c => !skipped.includes(`${c.kind}_${c.id}`)) || model.candidates[0] || null

  const skip = (item) => {
    const key = `${item.kind}_${item.id}`
    const remaining = model.candidates.filter(c => !skipped.includes(`${c.kind}_${c.id}`) && `${c.kind}_${c.id}` !== key)
    const next = remaining.length ? [...skipped, key] : [] // skipped everything → start over
    setSkipped(next)
  }

  const withBusy = async (id, fn) => {
    if (busy.has(id)) return
    setBusy(prev => new Set(prev).add(id))
    try { await fn() } finally { setBusy(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  const toggleItem = (item) => {
    if (item.kind === 'habit') return withBusy(item.id, () => cycleHabitState?.(item.id, today, item.done ? 'none' : 'completed'))
    if (item.kind === 'task' && !item.done) return withBusy(item.id, () => completeOperation?.(item.id))
  }

  // Sleep ≥ 70 auto-ticks a "Sleep" habit for that date
  const saveSleep = async (entry) => {
    const res = await sleep.save(entry)
    if (res?.data && res.data.score >= 70) {
      const sleepHabit = habitsScheduledOn(habits.filter(h => h.is_active !== false && /sleep/i.test(h.title || '')), entry.date)[0]
      const done = todayLogs.some(l => l.habit_id === sleepHabit?.id && l.date === entry.date && (!l.status || l.status === 'completed'))
      if (sleepHabit && !done && entry.date === today) await cycleHabitState?.(sleepHabit.id, entry.date, 'completed')
    }
    return res
  }

  if ((habitsLoading || tasksLoading) && !habits.length && !tasks.length) {
    return <AppShell><WinterLoader label="Loading today" /></AppShell>
  }

  const greeting = appHour < 12 ? 'Good morning' : appHour < 17 ? 'Good afternoon' : 'Good evening'
  const pct = model.total ? model.done / model.total : 0
  const needForStreak = model.habitTotal ? Math.max(0, Math.ceil(model.habitTotal * STREAK_DAY_THRESHOLD) - model.habitDone) : 0
  const allDone = model.total > 0 && model.left === 0
  const reviewVisible = showReview || appHour >= 20 || allDone || !!review.review
  const phaseOf = (id) => (id === 'anytime' ? 'anytime' : id === currentSection ? 'current' : ORDER[id] < ORDER[currentSection] ? 'past' : 'future')
  const isExpanded = (id) => (id in expanded ? expanded[id] : phaseOf(id) !== 'past')

  return (
    <AppShell>
      <div className="page-container today-page">
        <header className="tdy-head">
          <Ring value={pct} size={76} stroke={8} gradient label={`${Math.round(pct * 100)}% of today done`}>
            <b className="tdy-ring-num">{Math.round(pct * 100)}%</b>
            <span className="tdy-ring-lbl">{model.done}/{model.total}</span>
          </Ring>
          <div className="tdy-head-text">
            <h1 className="page-title flex items-center gap-3"><Sun className="text-amber" /> Today</h1>
            <p className="page-subtitle">{greeting} · {model.left ? `${model.left} thing${model.left === 1 ? '' : 's'} left` : model.total ? 'Everything done — legendary.' : 'A blank slate.'}</p>
          </div>
        </header>

        <div className="today-strip">
          <div className="today-chip">
            <Flame size={15} style={{ color: 'var(--warning)' }} />
            <span><b>{game.model?.current ?? '–'}d</b> streak · {needForStreak > 0 ? `${needForStreak} habit${needForStreak === 1 ? '' : 's'} to keep it` : model.habitTotal ? 'today counts ✓' : 'rest day'}</span>
          </div>
          <div className="today-chip">
            <Gift size={15} style={{ color: '#FFD166' }} />
            <span><b>{model.habitDone}/{model.habitTotal}</b> habits · {model.habitDone < model.habitTotal ? `perfect day +${PERFECT_DAY_XP}` : 'perfect ✓'}</span>
          </div>
          {game.boss && (
            <div className="today-chip">
              <Swords size={15} style={{ color: 'var(--danger)' }} />
              <span>Boss <b>{game.boss.habit.title}</b> · {game.boss.defeated ? 'defeated ✓' : `HP ${game.boss.hp}`}</span>
            </div>
          )}
        </div>

        <NextUpHero
          item={hero}
          busy={hero ? busy.has(hero.id) : false}
          onDone={toggleItem}
          onSkip={skip}
          leftCount={model.left}
          allDone={allDone}
          onReview={() => { setShowReview(true); setTimeout(() => document.getElementById('eod')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60) }}
        />

        {!sleep.loading && (
          <SleepCard key={`${today}_${sleep.logs.find(l => l.date === today)?.id || 'new'}`} today={today} logs={sleep.logs} missing={sleep.missing} onSave={saveSleep} compact={appHour >= 14 || today !== calendarToday} />
        )}

        <div className="tdy-timeline">
          {SECTIONS.map(sec => (
            <TimelineSection
              key={sec.id}
              section={sec}
              items={model.bySection[sec.id]}
              phase={phaseOf(sec.id)}
              expanded={isExpanded(sec.id)}
              onToggleExpand={() => setExpanded(e => ({ ...e, [sec.id]: !isExpanded(sec.id) }))}
              onToggleItem={toggleItem}
              busy={busy}
            />
          ))}
        </div>

        {reviewVisible && !review.loading && (
          <EndOfDayReview key={review.review?.id || 'new'} review={review.review} missing={review.missing} onSave={review.save} />
        )}
      </div>
    </AppShell>
  )
}
