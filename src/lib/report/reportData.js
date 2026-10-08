// /report (#42): fetch one period (+ the previous period of equal length for deltas) and summarise it.
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { habitsScheduledOn } from '@/lib/utils/xpRules'
import { categoryMinutes, SCREEN_CATEGORIES, UNCATEGORIZED } from '@/lib/utils/screenIntel'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { progressOf } from '@/lib/utils/missions'
import { disciplineScore } from '@/lib/utils/screenTimeScore'

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

// Two reports: a one-page report card, and the long one for analysis.
export const REPORT_KINDS = [
  { id: 'card', label: 'Report card', hint: 'Short: grades per area, analysis and achievements.' },
  { id: 'full', label: 'Full report', hint: 'Long: every habit, task, mission, journal entry, sleep night, weigh-in, book, spend and review with dates.' },
]

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
  return { from, to, kind: sp.kind === 'full' ? 'full' : 'card', sections: wanted.length ? wanted : DEFAULT_SECTIONS, theme: sp.theme === 'dark' ? 'dark' : 'light', print: sp.print === '1' }
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
  const [xp, habitLogs, habits, tasks, goals, milestones, screen, sleep, budget, journal, work, workLogs, speaking, achievements, profile, weight, books, reviews] = await Promise.all([
    paged(() => sb.from('xp_history').select('amount, source_type, stat_category, created_at').eq('user_id', userId).gte('created_at', startIso(prevFrom)).lte('created_at', endIso(to)).order('created_at')),
    byDate('habit_logs', prevFrom, 'habit_id, date, status'),
    paged(() => sb.from('habits').select('*').eq('user_id', userId)),
    paged(() => sb.from('tasks').select('*').eq('user_id', userId)),
    paged(() => sb.from('goals').select('*').eq('user_id', userId)),
    paged(() => sb.from('goal_milestones').select('*').eq('user_id', userId)),
    byDate('screen_time_logs', prevFrom),
    byDate('sleep_logs', prevFrom),
    byDate('budget_logs', prevFrom),
    byDate('journal_entries', prevFrom),
    byDate('work_hours_logs', prevFrom),
    byDate('work_logs', from),
    byDate('speaking_logs', prevFrom),
    paged(() => sb.from('achievements').select('achievement_id, earned_at').eq('user_id', userId)),
    sb.from('profiles').select('full_name, username, total_xp, longest_streak').eq('id', userId).maybeSingle().then((r) => r.data),
    paged(() => sb.from('weight_logs').select('*').eq('user_id', userId).lte('date', to).order('date')),
    paged(() => sb.from('books_completed').select('*').eq('user_id', userId)),
    byDate('daily_reviews', from),
  ])
  return summarise({ from, to, prevFrom, len, xp, habitLogs, habits, tasks, goals, milestones, screen, sleep, budget, journal, work, workLogs, speaking, achievements, profile, weight, books, reviews })
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
    ...details(d, { inRange, inPrev, dates, label, habits, habitsPrev, tasksDone, tasksDonePrev, overdue, sleep, screen }),
  }
}

const clock = (iso) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toTimeString().slice(0, 5) }
const isDebrief = (l) => /^weekly debrief/i.test(l.title || '')

/** Everything the long report lists row by row, plus the report card's grades and analysis. */
function details(d, { inRange, inPrev, dates, habits, habitsPrev, tasksDone, tasksDonePrev, overdue, sleep, screen }) {
  const { from, to, len } = d
  const goalTitle = new Map(d.goals.map((g) => [g.id, g.title]))

  // Tasks touched in the period: created, due or completed in it, or still open
  const taskRows = d.tasks
    .filter((t) => inRange(dayOf(t.created_at)) || inRange(dayOf(t.completed_at)) || inRange(t.due_date) || (!['completed', 'cancelled', 'failed'].includes(t.status) && dayOf(t.created_at) <= to))
    .map((t) => ({ id: t.id, title: t.title, mission: goalTitle.get(t.goal_id) || '', status: t.status || 'todo', created: dayOf(t.created_at), due: t.due_date || null, completed: t.status === 'completed' ? dayOf(t.completed_at) : null }))
    .sort((a, b) => String(a.completed || a.due || a.created || '9999').localeCompare(String(b.completed || b.due || b.created || '9999')))

  // Missions: started before the period ended and not closed before it began
  const missionRows = d.goals
    .filter((g) => (dayOf(g.created_at) || from) <= to && !(g.completed_at && dayOf(g.completed_at) < from && g.status === 'completed'))
    .map((g) => {
      const ms = d.milestones.filter((m) => m.goal_id === g.id)
      return {
        id: g.id, title: g.title, type: g.type, status: g.status, created: dayOf(g.created_at), deadline: g.deadline || null,
        completed: g.status === 'completed' ? dayOf(g.completed_at) : null,
        progress: progressOf(g, ms, d.tasks.filter((t) => t.goal_id === g.id)),
        milestones: ms.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((m) => ({ title: m.title, target: m.target_date || null, done: dayOf(m.done_at) })),
      }
    })
    .sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')))

  // Work
  const workDays = d.work.filter((l) => inRange(l.date)).sort((a, b) => a.date.localeCompare(b.date))
  const workPrevHours = sum(d.work.filter((l) => inPrev(l.date)), (l) => l.total_hours_worked)
  const logs = d.workLogs.filter((l) => inRange(l.date)).sort((a, b) => a.date.localeCompare(b.date))
  const speaking = d.speaking.filter((l) => inRange(l.date)).sort((a, b) => a.date.localeCompare(b.date))
  const speakingPrev = d.speaking.filter((l) => inPrev(l.date)).length

  // Journal, reviews
  const journal = d.journal.filter((j) => inRange(j.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_at).localeCompare(String(b.created_at)))
  const journalDays = new Set(journal.map((j) => j.date)).size
  const reviews = d.reviews.filter((r) => inRange(r.date)).sort((a, b) => a.date.localeCompare(b.date))

  // Sleep nights
  const nights = [...sleep].sort((a, b) => a.date.localeCompare(b.date)).map((l) => ({ date: l.date, bed: clock(l.bedtime), wake: clock(l.wake_time), minutes: l.duration_minutes, score: l.score }))
  const goodNights = nights.filter((n) => n.minutes >= 420 && n.minutes <= 540).length
  const sleepPrev = d.sleep.filter((l) => inPrev(l.date))

  // Weight: last weigh-in before the period is the baseline
  const wIn = d.weight.filter((w) => inRange(w.date)).sort((a, b) => a.date.localeCompare(b.date))
  const wBefore = d.weight.filter((w) => w.date < from).sort((a, b) => a.date.localeCompare(b.date)).pop()
  const wStart = wBefore || wIn[0]
  const wEnd = wIn[wIn.length - 1]
  const weight = { entries: wIn.map((w) => ({ date: w.date, kg: Number(w.weight_kg) })), start: wStart ? Number(wStart.weight_kg) : null, end: wEnd ? Number(wEnd.weight_kg) : null }
  weight.change = weight.start != null && weight.end != null ? +(weight.end - weight.start).toFixed(1) : null

  // Books, budget entries
  const books = d.books.filter((b) => inRange(String(b.date_completed || '').slice(0, 10))).sort((a, b) => String(a.date_completed).localeCompare(String(b.date_completed)))
  const spend = d.budget.filter((l) => inRange(l.date)).sort((a, b) => a.date.localeCompare(b.date) || String(a.created_at).localeCompare(String(b.created_at)))
  const spentPrev = sum(d.budget.filter((l) => inPrev(l.date)), (l) => l.amount)
  const noSpendDays = dates.filter((ds) => !spend.some((l) => l.date === ds && Number(l.amount) > 0) && spend.some((l) => l.date === ds)).length

  // Screen discipline
  const scores = screen.map((l) => disciplineScore(l)).filter((x) => x != null)
  const screenScore = scores.length ? Math.round(avg(scores, (x) => x)) : null
  const screenPrevScores = d.screen.filter((l) => inPrev(l.date)).map((l) => disciplineScore(l)).filter((x) => x != null)
  const screenPrev = screenPrevScores.length ? Math.round(avg(screenPrevScores, (x) => x)) : null

  // ── Report card grades (0–100 each)
  const workHours = sum(workDays, (l) => l.total_hours_worked)
  const missionsActive = missionRows.filter((m) => !['completed', 'failed', 'cancelled'].includes(m.status))
  const missionsLate = missionsActive.filter((m) => m.deadline && m.deadline < to).length
  const tasksDueInPeriod = d.tasks.filter((t) => inRange(t.due_date))
  const tasksDueDone = tasksDueInPeriod.filter((t) => t.status === 'completed' && dayOf(t.completed_at) <= t.due_date).length
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)
  const grades = [
    { id: 'habits', label: 'Habits', score: habits.rate, detail: habits.rate == null ? 'nothing scheduled' : `${habits.rate}% of check-ins · ${habits.perfectDays} perfect day${habits.perfectDays === 1 ? '' : 's'}` },
    { id: 'tasks', label: 'Tasks', score: tasksDone.length || tasksDueInPeriod.length ? Math.max(0, Math.min(100, (pct(tasksDueDone, tasksDueInPeriod.length) ?? 80) - overdue * 5)) : null, detail: `${tasksDone.length} done · ${tasksDueDone}/${tasksDueInPeriod.length} on time · ${overdue} overdue` },
    { id: 'missions', label: 'Missions', score: missionsActive.length || missionRows.length ? Math.max(0, Math.min(100, Math.round(avg(missionsActive.length ? missionsActive : missionRows, (m) => m.progress)) - missionsLate * 15 + missionRows.filter((m) => inRange(m.completed)).length * 20)) : null, detail: `${missionRows.filter((m) => inRange(m.completed)).length} completed · ${missionsActive.length} active · ${missionsLate} past deadline` },
    { id: 'work', label: 'Work', score: workDays.length ? Math.min(100, Math.round((workHours / len / 6) * 100)) : null, detail: `${fmt1(workHours)}h over ${workDays.length} day${workDays.length === 1 ? '' : 's'} · ${fmt1(workHours / len)}h/day` },
    { id: 'sleep', label: 'Sleep', score: nights.length ? pct(goodNights, len) : null, detail: nights.length ? `${goodNights}/${len} nights in 7–9h · avg ${fmt1(avg(nights, (n) => n.minutes) / 60)}h` : 'not logged' },
    { id: 'screen', label: 'Digital discipline', score: screenScore, detail: screenScore == null ? 'not logged' : `avg ${screenScore}/100 over ${scores.length} day${scores.length === 1 ? '' : 's'}` },
    { id: 'journal', label: 'Journal & reviews', score: pct(Math.max(journalDays, reviews.length), len), detail: `${journalDays}/${len} days journaled · ${reviews.length} daily review${reviews.length === 1 ? '' : 's'}` },
    { id: 'speaking', label: 'Speaking', score: Math.min(100, pct(speaking.length, len) ?? 0), detail: `${speaking.length} session${speaking.length === 1 ? '' : 's'}${speaking.length ? ` · avg rating ${fmt1(avg(speaking, (l) => l.rating))}` : ''}` },
  ].map((g) => ({ ...g, grade: letter(g.score) }))
  const graded = grades.filter((g) => g.score != null)
  const overall = graded.length ? Math.round(avg(graded, (g) => g.score)) : null

  // ── Analysis: plain-language findings from the numbers above
  const notes = []
  const best = [...graded].sort((a, b) => b.score - a.score)[0]
  const worst = [...graded].sort((a, b) => a.score - b.score)[0]
  if (best) notes.push({ tone: 'good', text: `Strongest area: ${best.label} (${best.grade}, ${best.detail}).` })
  if (worst && worst !== best) notes.push({ tone: 'bad', text: `Weakest area: ${worst.label} (${worst.grade}, ${worst.detail}). Fix this first.` })
  if (habits.rate != null && habitsPrev.rate != null) notes.push({ tone: habits.rate >= habitsPrev.rate ? 'good' : 'bad', text: `Habit completion ${habits.rate >= habitsPrev.rate ? 'up' : 'down'} ${Math.abs(habits.rate - habitsPrev.rate)} pts vs the previous ${len} days (${habitsPrev.rate}% → ${habits.rate}%).` })
  if (habits.rows.length > 1) { const top = habits.rows[0]; const low = habits.rows[habits.rows.length - 1]; if (top.rate !== low.rate) notes.push({ tone: 'neutral', text: `Most consistent habit: ${top.title} (${top.rate}%). Least: ${low.title} (${low.rate}%).` }) }
  if (tasksDonePrev || tasksDone.length) notes.push({ tone: tasksDone.length >= tasksDonePrev ? 'good' : 'bad', text: `${tasksDone.length} tasks completed vs ${tasksDonePrev} in the previous period.` })
  if (overdue) notes.push({ tone: 'bad', text: `${overdue} task${overdue === 1 ? ' is' : 's are'} overdue at the end of the period.` })
  if (missionsLate) notes.push({ tone: 'bad', text: `${missionsLate} active mission${missionsLate === 1 ? ' is' : 's are'} past deadline.` })
  if (workDays.length && workPrevHours) notes.push({ tone: workHours >= workPrevHours ? 'good' : 'bad', text: `Worked ${fmt1(workHours)}h vs ${fmt1(workPrevHours)}h in the previous period.` })
  if (nights.length) { const late = nights.filter((n) => n.bed && n.bed >= '01:00' && n.bed < '12:00').length; notes.push({ tone: late ? 'bad' : 'good', text: late ? `${late} night${late === 1 ? '' : 's'} in bed after 1am.` : 'Every logged night in bed before 1am.' }) }
  if (sleepPrev.length && nights.length) { const a = avg(nights, (n) => n.minutes); const b = avg(sleepPrev, (l) => l.duration_minutes); if (a != null && b != null && Math.abs(a - b) >= 15) notes.push({ tone: a > b ? 'good' : 'bad', text: `Sleep averaged ${fmt1(a / 60)}h vs ${fmt1(b / 60)}h before.` }) }
  if (screenScore != null && screenPrev != null) notes.push({ tone: screenScore >= screenPrev ? 'good' : 'bad', text: `Digital discipline ${screenScore}/100 vs ${screenPrev}/100 before.` })
  if (weight.change != null && weight.entries.length) notes.push({ tone: 'neutral', text: `Weight ${weight.change > 0 ? 'up' : weight.change < 0 ? 'down' : 'unchanged'}${weight.change ? ` ${Math.abs(weight.change)} kg` : ''} (${weight.start} → ${weight.end} kg).` })
  const spent = sum(spend, (l) => l.amount)
  if (spentPrev || spent) notes.push({ tone: spent <= spentPrev ? 'good' : 'bad', text: `Spent ₹${Math.round(spent).toLocaleString('en-IN')} vs ₹${Math.round(spentPrev).toLocaleString('en-IN')} before${noSpendDays ? ` · ${noSpendDays} no-spend day${noSpendDays === 1 ? '' : 's'}` : ''}.` })
  if (speakingPrev || speaking.length) notes.push({ tone: speaking.length >= speakingPrev ? 'good' : 'bad', text: `${speaking.length} speaking session${speaking.length === 1 ? '' : 's'} vs ${speakingPrev} before.` })
  if (books.length) notes.push({ tone: 'good', text: `Finished ${books.length} book${books.length === 1 ? '' : 's'}: ${books.map((b) => b.title).join(', ')}.` })

  return {
    card: { grades, overall, overallGrade: letter(overall), notes },
    detail: {
      tasks: taskRows, missions: missionRows,
      work: { days: workDays, logs: logs.filter((l) => !isDebrief(l)), hours: workHours },
      debriefs: logs.filter(isDebrief),
      speaking, journal, reviews, nights, weight, books, spend, noSpendDays,
    },
  }
}

const fmt1 = (n) => (n == null || Number.isNaN(n) ? '—' : (+n).toFixed(1))
export function letter(score) {
  if (score == null) return '—'
  return score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F'
}
