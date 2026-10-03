'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Circle, AlertTriangle, BookOpen, Briefcase, Monitor, Mic, Wallet, ChevronDown, Sun, Flame, Swords, Gift } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import { useOS, useOSSlice } from '@/lib/context/OSContext'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { habitsScheduledOn, STREAK_DAY_THRESHOLD, PERFECT_DAY_XP } from '@/lib/utils/xpRules'
import { fetchBudgetLogs, isExcludedFromDaily, getLocalDailyBudget } from '@/lib/utils/budget'
import { useGameState } from '@/lib/hooks/useGameState'

const PROTOCOLS = [
  { id: 'journal', label: 'Daily journal', href: '/journal', icon: BookOpen },
  { id: 'work', label: 'Work session', href: '/work', icon: Briefcase },
  { id: 'screen', label: 'Screen time', href: '/screen-time', icon: Monitor },
  { id: 'speaking', label: 'Speaking practice', href: '/speaking', icon: Mic },
  { id: 'budget', label: 'Budget', href: '/budget', icon: Wallet },
]

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
      if (!cancelled) setStatus({ journal, work, screen, speaking, budget: budget.logged, budgetInfo: budget })
    })
    return () => { cancelled = true }
  }, [userId, today])
  return status
}

const rowAnim = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 24, transition: { duration: 0.18 } },
  transition: { type: 'spring', stiffness: 420, damping: 32 },
}

export default function TodayPage() {
  const { user } = useOSSlice('auth')
  const { habits = [], todayLogs = [], cycleHabitState, loading: habitsLoading } = useOSSlice('habits')
  const { tasks = [], loading: tasksLoading } = useOSSlice('tasks')
  const { completeOperation } = useOS()
  const game = useGameState()
  const today = getLocalDateStr()
  const protocols = useProtocolStatus(user?.id, today)
  const [showDone, setShowDone] = useState(false)
  const [busy, setBusy] = useState(() => new Set())

  const { pendingHabits, doneHabits, overdue, dueToday, doneTasks } = useMemo(() => {
    const scheduled = habitsScheduledOn(habits.filter(h => h.is_active !== false), today)
    const doneIds = new Set(todayLogs.filter(l => !l.status || l.status === 'completed').map(l => l.habit_id))
    const restIds = new Set(todayLogs.filter(l => ['rest', 'blocked', 'skipped'].includes(l.status)).map(l => l.habit_id))
    const active = scheduled.filter(h => !restIds.has(h.id))
    const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled')
    const due = (t) => (t.due_date ? String(t.due_date).slice(0, 10) : null)
    return {
      pendingHabits: active.filter(h => !doneIds.has(h.id)),
      doneHabits: active.filter(h => doneIds.has(h.id)),
      overdue: pending.filter(t => due(t) && due(t) < today).sort((a, b) => due(a).localeCompare(due(b))),
      dueToday: pending.filter(t => due(t) === today || (!due(t) && t.type === 'custom')),
      doneTasks: tasks.filter(t => t.status === 'completed' && t.completed_at && getLocalDateStr(new Date(t.completed_at)) === today),
    }
  }, [habits, todayLogs, tasks, today])

  const totalHabits = pendingHabits.length + doneHabits.length
  const needForStreak = totalHabits ? Math.max(0, Math.ceil(totalHabits * STREAK_DAY_THRESHOLD) - doneHabits.length) : 0
  const pendingProtocols = protocols ? PROTOCOLS.filter(p => !protocols[p.id]) : []
  const doneProtocols = protocols ? PROTOCOLS.filter(p => protocols[p.id]) : []
  const doneCount = doneHabits.length + doneTasks.length + doneProtocols.length
  const leftCount = pendingHabits.length + overdue.length + dueToday.length + pendingProtocols.length

  const withBusy = async (id, fn) => {
    if (busy.has(id)) return
    setBusy(prev => new Set(prev).add(id))
    try { await fn() } finally { setBusy(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  if ((habitsLoading || tasksLoading) && !habits.length && !tasks.length) {
    return <AppShell><WinterLoader label="Loading today" /></AppShell>
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell>
      <div className="page-container today-page">
        <header className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-3"><Sun className="text-amber" /> Today</h1>
            <p className="page-subtitle">{greeting} · {leftCount ? `${leftCount} thing${leftCount === 1 ? '' : 's'} left` : 'Everything done — legendary.'}</p>
          </div>
        </header>

        {/* Status strip */}
        <div className="today-strip">
          <div className="today-chip">
            <Flame size={15} style={{ color: 'var(--warning)' }} />
            <span><b>{game.model?.current ?? '–'}d</b> streak · {needForStreak > 0 ? `${needForStreak} habit${needForStreak === 1 ? '' : 's'} to keep it` : totalHabits ? 'today counts ✓' : 'rest day'}</span>
          </div>
          <div className="today-chip">
            <Gift size={15} style={{ color: '#FFD166' }} />
            <span><b>{doneHabits.length}/{totalHabits}</b> habits · {pendingHabits.length ? `perfect day +${PERFECT_DAY_XP}` : 'perfect ✓'}</span>
          </div>
          {game.boss && (
            <div className="today-chip">
              <Swords size={15} style={{ color: 'var(--danger)' }} />
              <span>Boss <b>{game.boss.habit.title}</b> · {game.boss.defeated ? 'defeated ✓' : `HP ${game.boss.hp}`}</span>
            </div>
          )}
        </div>

        {/* Overdue */}
        {overdue.length > 0 && (
          <section className="today-section">
            <div className="today-section-title" style={{ color: 'var(--danger)' }}><AlertTriangle size={14} /> Overdue</div>
            <AnimatePresence initial={false}>
              {overdue.map(t => (
                <motion.div key={t.id} {...rowAnim} className="today-row today-row--overdue">
                  <button type="button" className="today-check" data-celebrate disabled={busy.has(t.id)} onClick={() => withBusy(t.id, () => completeOperation?.(t.id))} aria-label={`Complete ${t.title}`}><Check size={16} /></button>
                  <span className="today-row-main">
                    <span className="today-row-title">{t.title}</span>
                    <span className="today-row-sub">Due {String(t.due_date).slice(0, 10)} · task</span>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        )}

        {/* Up next: habits, then today's tasks */}
        <section className="today-section">
          <div className="today-section-title">Up next</div>
          <AnimatePresence initial={false}>
            {pendingHabits.map(h => {
              const isBoss = game.boss?.habit?.id === h.id && !game.boss?.defeated
              return (
                <motion.div key={h.id} {...rowAnim} className={`today-row ${isBoss ? 'today-row--boss' : ''}`}>
                  <button type="button" className="today-check" data-celebrate disabled={busy.has(h.id)} onClick={() => withBusy(h.id, () => cycleHabitState?.(h.id, today, 'completed'))} aria-label={`Complete ${h.title}`}><Check size={16} /></button>
                  <span className="today-row-main">
                    <span className="today-row-title">{h.title}{isBoss && <span className="today-tag today-tag--boss"><Swords size={11} /> boss</span>}</span>
                    <span className="today-row-sub">Habit · +{h.xp_per_completion || 25} XP</span>
                  </span>
                </motion.div>
              )
            })}
            {dueToday.map(t => (
              <motion.div key={t.id} {...rowAnim} className="today-row">
                <button type="button" className="today-check" data-celebrate disabled={busy.has(t.id)} onClick={() => withBusy(t.id, () => completeOperation?.(t.id))} aria-label={`Complete ${t.title}`}><Check size={16} /></button>
                <span className="today-row-main">
                  <span className="today-row-title">{t.title}</span>
                  <span className="today-row-sub">Task{t.due_date ? ' · due today' : ''}</span>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {!pendingHabits.length && !dueToday.length && (
            <div className="today-empty">Nothing left for today. 🏔️</div>
          )}
        </section>

        {/* Protocols to log */}
        {pendingProtocols.length > 0 && (
          <section className="today-section">
            <div className="today-section-title">Log before bed</div>
            <div className="today-protocols">
              {pendingProtocols.map(p => {
                const Icon = p.icon
                return (
                  <Link key={p.id} href={p.href} className="today-protocol">
                    <Icon size={16} /><span>{p.label}</span><Circle size={12} className="ml-auto opacity-40" />
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Done */}
        {doneCount > 0 && (
          <section className="today-section">
            <button type="button" className="today-section-title today-done-toggle" onClick={() => setShowDone(v => !v)}>
              <Check size={14} style={{ color: 'var(--success)' }} /> Done today · {doneCount}
              <ChevronDown size={14} style={{ transform: showDone ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
            </button>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  {doneHabits.map(h => (
                    <div key={h.id} className="today-row today-row--done">
                      <button type="button" className="today-check is-done" disabled={busy.has(h.id)} onClick={() => withBusy(h.id, () => cycleHabitState?.(h.id, today, 'none'))} aria-label={`Undo ${h.title}`}><Check size={16} /></button>
                      <span className="today-row-main"><span className="today-row-title">{h.title}</span><span className="today-row-sub">Habit</span></span>
                    </div>
                  ))}
                  {doneTasks.map(t => (
                    <div key={t.id} className="today-row today-row--done">
                      <span className="today-check is-done"><Check size={16} /></span>
                      <span className="today-row-main"><span className="today-row-title">{t.title}</span><span className="today-row-sub">Task</span></span>
                    </div>
                  ))}
                  {doneProtocols.map(p => (
                    <div key={p.id} className="today-row today-row--done">
                      <span className="today-check is-done"><Check size={16} /></span>
                      <span className="today-row-main"><span className="today-row-title">{p.label}</span><span className="today-row-sub">Logged</span></span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
    </AppShell>
  )
}
