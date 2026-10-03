// /report (#42): fetch one period (+ the previous period of equal length for deltas) and summarise it.
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { habitsScheduledOn } from '@/lib/utils/xpRules'
import { categoryMinutes, SCREEN_CATEGORIES, UNCATEGORIZED } from '@/lib/utils/screenIntel'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { progressOf } from '@/lib/utils/missions'

export const REPORT_SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'xp', label: 'XP' },
  { id: 'habits', label: 'Habits' },
  { id: 'missions', label: 'Missions' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'work', label: 'Work' },
  { id: 'screen', label: 'Screen time' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'budget', label: 'Budget' },
  { id: 'journal', label: 'Journal mood' },
  { id: 'achievements', label: 'Achievements' },
]
export const DEFAULT_SECTIONS = REPORT_SECTIONS.map((s) => s.id)

const PAGE = 1000
const DAY = 86400000
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '')
const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }
export const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / DAY) + 1
const dayOf = (iso) => (iso ? getLocalDateStr(new Date(iso)) : null)
const startIso = (ds) => new Date(`${ds}T00:00:00`).toISOString()
const endIso = (ds) => new Date(`${ds}T23:59:59.999`).toISOString()
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0)
const avg = (arr, f) => (arr.length ? sum(arr, f) / arr.length : null)

/** Normalise query params; defaults to the last 7 days. */
export function parseReportParams(sp = {}) {
  const today = getLocalDateStr()
  let to = isDate(sp.to) ? sp.to : today
  let from = isDate(sp.from) ? sp.from : addDays(to, -6)
  if (from > to) [from, to] = [to, from]
  if (daysBetween(from, to) > 366) from = addDays(to, -365)
  const wanted = String(sp.sections || '').split(',').filter((s) => DEFAULT_SECTIONS.includes(s))
  return { from, to, sections: wanted.length ? wanted : DEFAULT_SECTIONS, theme: sp.theme === 'dark' ? 'dark' : 'light', print: sp.print === '1' }
}

async function paged(q) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await q().range(from, from + PAGE - 1)
    if (error) return rows
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return rows
  }
}

export async function fetchReport(userId, { from, to }) {
  const sb = createClient()
  const len = daysBetween(from, to)
  const prevFrom = addDays(from, -len)
  const byDate = (t, f = prevFrom, sel = '*') => paged(() => sb.from(t).select(sel).eq('user_id', userId).gte('date', f).lte('date', to).order('date'))
  const [xp, habitLogs, habits, tasks, goals, milestones, screen, sleep, budget, journal, work, workLogs, speaking, achievements, profile] = await Promise.all([
    paged(() => sb.from('xp_history').select('amount, source_type, stat_category, created_at').eq('user_id', userId).gte('created_at', startIso(prevFrom)).lte('created_at', endIso(to)).order('created_at')),
    byDate('habit_logs', prevFrom, 'habit_id, date, status'),
    paged(() => sb.from('habits').select('*').eq('user_id', userId)),
    paged(() => sb.from('tasks').select('id, title, status, completed_at, due_date, difficulty, goal_id').eq('user_id', userId)),
    paged(() => sb.from('goals').select('*').eq('user_id', userId)),
    paged(() => sb.from('goal_milestones').select('id, goal_id, title, done_at, target_date').eq('user_id', userId)),
    byDate('screen_time_logs', from),
    byDate('sleep_logs', from),
    byDate('budget_logs', from),
    byDate('journal_entries', from, 'date, mood'),
    byDate('work_hours_logs', from),
    byDate('work_logs', from, 'date, title'),
    byDate('speaking_logs', from, 'date, topic, rating'),
    paged(() => sb.from('achievements').select('achievement_id, earned_at').eq('user_id', userId)),
    sb.from('profiles').select('full_name, username, total_xp, longest_streak').eq('id', userId).maybeSingle().then((r) => r.data),
  ])
  return summarise({ from, to, prevFrom, len, xp, habitLogs, habits, tasks, goals, milestones, screen, sleep, budget, journal, work, workLogs, speaking, achievements, profile })
}

function habitStats(habits, logs, from, to) {
  const active = habits.filter((h) => h.is_active !== false || (h.stopped_at && h.stopped_at.slice(0, 10) >= from))
  const done = new Set(logs.filter((l) => l.date >= from && l.date <= to && (!l.status || l.status === 'completed')).map((l) => `${l.habit_id}|${l.date}`))
  const per = new Map(active.map((h) => [h.id, { id: h.id, title: h.title, scheduled: 0, done: 0 }]))
  const daily = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const sched = habitsScheduledOn(active.filter((h) => !h.created_at || h.created_at.slice(0, 10) <= d), d)
    let n = 0
    for (const h of sched) { const p = per.get(h.id); p.scheduled++; if (done.has(`${h.id}|${d}`)) { p.done++; n++ } }
    daily.push({ date: d, rate: sched.length ? Math.round((n / sched.length) * 100) : null })
  }
  const rows = [...per.values()].filter((p) => p.scheduled).map((p) => ({ ...p, rate: Math.round((p.done / p.scheduled) * 100) })).sort((a, b) => b.rate - a.rate)
  const scheduled = sum(rows, (r) => r.scheduled)
  return { rows, daily, rate: scheduled ? Math.round((sum(rows, (r) => r.done) / scheduled) * 100) : null, perfectDays: daily.filter((d) => d.rate === 100).length }
}

const SOURCE_GROUPS = [
  ['Habits', /habit|streak|chain|perfect/], ['Tasks', /task|block/], ['Missions', /goal|mission|milestone/],
  ['Screen time', /screen/], ['Achievements', /achievement/], ['Bosses & bets', /boss|bet|chest|critical/],
]
const sourceGroup = (t = '') => (SOURCE_GROUPS.find(([, rx]) => rx.test(t)) || ['Other'])[0]

export function summarise(d) {
  const { from, to, prevFrom, len } = d
  const inRange = (ds) => ds && ds >= from && ds <= to
  const inPrev = (ds) => ds && ds >= prevFrom && ds < from
  const dates = []
  for (let x = from; x <= to; x = addDays(x, 1)) dates.push(x)
  const label = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', len > 14 ? { month: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric' })

  // XP
  const xpCur = d.xp.filter((r) => inRange(dayOf(r.created_at)))
  const xpPrev = d.xp.filter((r) => inPrev(dayOf(r.created_at)))
  const xpByDay = new Map()
  for (const r of xpCur) { const k = dayOf(r.created_at); xpByDay.set(k, (xpByDay.get(k) || 0) + (Number(r.amount) || 0)) }
  const bySource = new Map()
  for (const r of xpCur) { const g = sourceGroup(r.source_type); bySource.set(g, (bySource.get(g) || 0) + (Number(r.amount) || 0)) }
  const xpDaily = dates.map((ds) => ({ date: ds, label: label(ds), xp: xpByDay.get(ds) || 0 }))
  const bestDay = [...xpDaily].sort((a, b) => b.xp - a.xp)[0]

  // Habits
  const habits = habitStats(d.habits, d.habitLogs, from, to)
  const habitsPrev = habitStats(d.habits, d.habitLogs, prevFrom, addDays(from, -1))

  // Tasks & missions
  const tasksDone = d.tasks.filter((t) => t.status === 'completed' && inRange(dayOf(t.completed_at))).sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
  const tasksDonePrev = d.tasks.filter((t) => t.status === 'completed' && inPrev(dayOf(t.completed_at))).length
  const overdue = d.tasks.filter((t) => !['completed', 'cancelled'].includes(t.status) && t.due_date && t.due_date < to).length
  const missionsDone = d.goals.filter((g) => g.status === 'completed' && inRange(dayOf(g.completed_at)))
  const activeMissions = d.goals.filter((g) => !['completed', 'failed', 'cancelled'].includes(g.status))
    .map((g) => ({ id: g.id, title: g.title, type: g.type, deadline: g.deadline, progress: progressOf(g, d.milestones.filter((m) => m.goal_id === g.id), d.tasks.filter((t) => t.goal_id === g.id)) }))
    .sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')))
  const milestonesDone = d.milestones.filter((m) => inRange(dayOf(m.done_at)))

  // Screen time
  const screen = d.screen.filter((l) => inRange(l.date))
  const screenByDate = new Map(screen.map((l) => [l.date, l]))
  const screenDaily = dates.map((ds) => {
    const l = screenByDate.get(ds)
    const m = l ? categoryMinutes(l) : {}
    return { date: ds, label: label(ds), ...Object.fromEntries([...SCREEN_CATEGORIES, UNCATEGORIZED].map((c) => [c.id, l ? +((m[c.id] || 0) / 60).toFixed(2) : 0])) }
  })

  // Sleep
  const sleep = d.sleep.filter((l) => inRange(l.date))
  const bedMins = sleep.filter((l) => l.bedtime).map((l) => { const t = new Date(l.bedtime); let m = t.getHours() * 60 + t.getMinutes(); if (m < 12 * 60) m += 24 * 60; return m })
  const avgBed = bedMins.length ? Math.round(avg(bedMins, (x) => x)) % (24 * 60) : null

  // Budget
  const spend = d.budget.filter((l) => inRange(l.date))
  const byCat = new Map()
  for (const l of spend) { const c = l.category || 'other'; byCat.set(c, (byCat.get(c) || 0) + (Number(l.amount) || 0)) }
  const daily = spend.filter((l) => !l.exclude_daily)

  // Journal, work, achievements
  const journal = d.journal.filter((l) => inRange(l.date))
  const work = d.work.filter((l) => inRange(l.date))
  const earned = d.achievements.filter((a) => inRange(dayOf(a.earned_at))).map((a) => ({ ...ACHIEVEMENTS.find((x) => x.id === a.achievement_id), earned_at: a.earned_at })).filter((a) => a.id)

  const xpTotal = sum(xpCur, (r) => r.amount)
  return {
    from, to, len, dates,
    profile: d.profile,
    xp: { total: xpTotal, prev: sum(xpPrev, (r) => r.amount), daily: xpDaily, best: bestDay?.xp ? bestDay : null, avg: Math.round(xpTotal / len), bySource: [...bySource.entries()].map(([name, xp]) => ({ name, xp })).sort((a, b) => b.xp - a.xp) },
    habits: { ...habits, prevRate: habitsPrev.rate },
    tasks: { done: tasksDone, prev: tasksDonePrev, overdue },
    missions: { done: missionsDone, active: activeMissions, milestonesDone },
    screen: { logged: screen.length, avgTotal: avg(screen, (l) => l.total_hours), avgDoom: avg(screen, (l) => l.doom_scroll_minutes), avgFocus: avg(screen, (l) => l.focus_hours), daily: screenDaily, hasCats: screen.some((l) => l.categories && Object.keys(l.categories).length) },
    sleep: { logged: sleep.length, avgMinutes: avg(sleep, (l) => l.duration_minutes), avgScore: avg(sleep.filter((l) => l.score != null), (l) => l.score), avgBed, daily: dates.map((ds) => { const l = sleep.find((x) => x.date === ds); return { date: ds, label: label(ds), hours: l ? +(l.duration_minutes / 60).toFixed(1) : null } }) },
    budget: { total: sum(spend, (l) => l.amount), dailyAvg: sum(daily, (l) => l.amount) / len, entries: spend.length, byCategory: [...byCat.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount) },
    journal: { entries: journal.length, avgMood: avg(journal.filter((j) => j.mood != null), (j) => j.mood), daily: dates.map((ds) => { const js = journal.filter((j) => j.date === ds && j.mood != null); return { date: ds, label: label(ds), mood: js.length ? +(avg(js, (j) => j.mood)).toFixed(1) : null } }) },
    work: { days: work.length, hours: sum(work, (l) => l.total_hours_worked), focused: sum(work, (l) => l.focused_hours), deep: sum(work, (l) => l.deep_execution_hours), logs: d.workLogs.filter((l) => inRange(l.date) && l.title).slice(-12).reverse(), speaking: d.speaking.filter((l) => inRange(l.date)) },
    achievements: earned,
  }
}
