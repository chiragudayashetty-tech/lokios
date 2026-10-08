// Daily momentum (-10 to +10): the one engine behind the dashboard ring and the header pill.
// Each factor is scaled and capped so no single backlog or lucky streak dominates.
import { habitsScheduledOn } from '@/lib/utils/xpRules'
import { disciplineScore } from '@/lib/utils/screenTimeScore'
import { getLocalDateStr } from '@/lib/utils/dates'

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }
const isDone = (l) => !l.status || l.status === 'completed'
const activeOn = (habits, ds) => habitsScheduledOn(habits.filter((h) => h.is_active !== false && (!h.created_at || h.created_at.slice(0, 10) <= ds)), ds)

/**
 * Weekly win rate: share of scheduled habit check-ins done since Monday.
 * Past days count in full; today only adds what's already done, so an unfinished
 * morning never drags the rate down. Null when nothing was scheduled yet.
 */
export function weeklyWinRate(habits = [], logs = [], todayStr, mondayStr) {
  const done = new Set(logs.filter(isDone).map((l) => `${l.habit_id}|${l.date}`))
  let scheduled = 0
  let hit = 0
  for (let d = mondayStr; d <= todayStr; d = addDays(d, 1)) {
    for (const h of activeOn(habits, d)) {
      const ok = done.has(`${h.id}|${d}`)
      if (d === todayStr && !ok) continue
      scheduled++
      if (ok) hit++
    }
  }
  return scheduled ? Math.round((hit / scheduled) * 100) : null
}

export function computeMomentum({ habits = [], habitLogs = [], tasks = [], goals = [], streak = 0, winRate = null, screenLog = null, todayStr }) {
  const dayOf = (iso) => (iso ? getLocalDateStr(new Date(iso)) : null)

  // 1. Habits (±4): share of today's scheduled habits done, minus failures
  const scheduled = activeOn(habits, todayStr)
  const todays = habitLogs.filter((l) => l.date === todayStr)
  const doneIds = new Set(todays.filter(isDone).map((l) => l.habit_id))
  const habitsDone = scheduled.filter((h) => doneIds.has(h.id)).length
  const habitsFailed = todays.filter((l) => l.status === 'failed').length
  const habit = scheduled.length ? Math.max(-4, Math.min(4, (habitsDone / scheduled.length) * 4 - Math.min(4, habitsFailed))) : 0

  // 2. Tasks (±2.5): +0.75 per task done today (max +2.5), −0.5 per overdue task (max −2)
  const tasksDone = tasks.filter((t) => t.status === 'completed' && dayOf(t.completed_at) === todayStr).length
  const tasksOverdue = tasks.filter((t) => !['completed', 'cancelled', 'failed'].includes(t.status) && t.due_date && t.due_date < todayStr).length
  const ops = Math.min(2.5, tasksDone * 0.75) - Math.min(2, tasksOverdue * 0.5)

  // 3. Missions (±1.5): finished today vs past-deadline active missions
  const missionsDone = goals.filter((g) => g.status === 'completed' && dayOf(g.completed_at) === todayStr).length
  const missionsStalled = goals.filter((g) => !['completed', 'cancelled', 'failed'].includes(g.status) && g.deadline && g.deadline < todayStr).length
  const missions = Math.min(1.5, missionsDone * 1.5) - Math.min(1.5, missionsStalled * 0.5)

  // 4. Streak (0…+1.5) and weekly win rate (−1…+1.5; neutral before anything was scheduled)
  const streakPart = streak >= 14 ? 1.5 : streak >= 7 ? 1 : streak >= 1 ? 0.5 : 0
  const win = winRate == null ? 0 : winRate >= 80 ? 1.5 : winRate >= 60 ? 0.75 : winRate >= 40 ? 0 : -1

  // 5. Digital discipline (±1.5) from the screen-time score (0–100)
  const screenScore = screenLog ? disciplineScore(screenLog) : null
  const screen = screenScore == null ? 0 : Math.round(((screenScore - 50) / 50) * 1.5 * 10) / 10

  const score = Math.max(-10, Math.min(10, +(habit + ops + missions + streakPart + win + screen).toFixed(1)))
  const label = score >= 5 ? 'SURGING' : score >= 2 ? 'BUILDING' : score >= 0 ? 'STEADY' : 'SLIPPING'
  const color = score >= 5 ? 'var(--success)' : score >= 0 ? 'var(--warning)' : 'var(--danger)'
  return {
    score, label, color,
    habits: { done: habitsDone, scheduled: scheduled.length, failed: habitsFailed, part: habit },
    tasks: { done: tasksDone, overdue: tasksOverdue, part: ops },
    missions: { done: missionsDone, stalled: missionsStalled, part: missions },
    streak: { days: streak, part: streakPart },
    winRate: { rate: winRate, part: win },
    screen: { score: screenScore, part: screen },
  }
}

// The dashboard computes the full score; the header pill on other pages reads the last one.
const KEY = 'lokios_momentum'
export function publishMomentum(m, todayStr) {
  try { localStorage.setItem(KEY, JSON.stringify({ date: todayStr, score: m.score, label: m.label, color: m.color })) } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('lokios:momentum'))
}
export function readMomentum(todayStr = getLocalDateStr()) {
  try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); return m?.date === todayStr ? m : null } catch { return null }
}
