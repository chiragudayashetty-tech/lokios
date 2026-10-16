// Discipline games: lights-out bet, FC fuel tank (earned play time), estimate duel, ship-day pledge.
// All their XP is bonus XP (see BONUS_XP_RX) — it moves the total, never a single day's number.
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr, getStartOfWeek } from '@/lib/utils/dates'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { habitsScheduledOn } from '@/lib/utils/xpRules'

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }
const dayOf = (iso) => (iso ? getLocalDateStr(new Date(iso)) : null)
const toMin = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null }
const clockOf = (iso) => { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
// bedtimes after midnight belong to the same night: 00:30 is later than 23:30
const night = (min) => (min == null ? null : min < 12 * 60 ? min + 24 * 60 : min)

// ── Fuel tank ────────────────────────────────────────────────────────────
export const FUEL = { habit: 3, task: 10, workHour: 10, perfectDay: 30, dailyCap: 90, tankCap: 300, penaltyPerMin: 10, penaltyMin: 200, penaltyMax: 500 }
export const overdraftPenalty = (overMin) => (overMin > 0 ? Math.min(FUEL.penaltyMax, Math.max(FUEL.penaltyMin, overMin * FUEL.penaltyPerMin)) : 0)

/** Minutes earned per day this week (Mon → today) and what's left in the tank. */
export function fuelState({ habits = [], habitLogs = [], tasks = [], workDays = [], sessions = [] }, today = getLocalDateStr()) {
  const monday = getLocalDateStr(getStartOfWeek(new Date(`${today}T12:00:00`), 1))
  const days = []
  for (let d = monday; d <= today; d = addDays(d, 1)) {
    const done = habitLogs.filter((l) => l.date === d && (!l.status || l.status === 'completed'))
    const sched = habitsScheduledOn(habits.filter((h) => h.is_active !== false), d)
    const doneIds = new Set(done.map((l) => l.habit_id))
    const perfect = sched.length > 0 && sched.every((h) => doneIds.has(h.id))
    const tasksDone = tasks.filter((t) => t.status === 'completed' && dayOf(t.completed_at) === d).length
    const work = workDays.filter((w) => w.date === d).reduce((s, w) => s + (Number(w.total_hours_worked ?? w.duration_hours) || 0), 0)
    const parts = { habits: done.length * FUEL.habit, tasks: tasksDone * FUEL.task, work: Math.round(work * FUEL.workHour), perfect: perfect ? FUEL.perfectDay : 0 }
    const raw = parts.habits + parts.tasks + parts.work + parts.perfect
    days.push({ date: d, ...parts, raw, earned: Math.min(FUEL.dailyCap, raw) })
  }
  const earned = Math.min(FUEL.tankCap, days.reduce((s, x) => s + x.earned, 0))
  const week = sessions.filter((s) => s.date >= monday && s.date <= today)
  const covered = week.reduce((s, x) => s + (x.minutes - (x.overdraft || 0)), 0)
  const overdraft = week.reduce((s, x) => s + (x.overdraft || 0), 0)
  return { monday, days, today: days[days.length - 1], earned, played: covered + overdraft, overdraft, balance: Math.max(0, earned - covered), sessions: week }
}

export async function logPlay(userId, minutes, balance, note = 'FC 26') {
  const sb = createClient()
  const over = Math.max(0, minutes - balance)
  const { data, error } = await sb.from('fuel_sessions').insert({ user_id: userId, date: getLocalDateStr(), minutes, overdraft: over, note }).select().single()
  if (error) throw new Error(/relation|schema|does not exist/i.test(error.message) ? 'Run the discipline-games SQL migration first.' : error.message)
  const penalty = overdraftPenalty(over)
  if (penalty) await robustAwardXP(userId, -penalty, 'fuel_overdraft', `fuel_over_${data.id}`, `⛽ Played ${over} min beyond the fuel tank (−${penalty} XP)`, 'discipline')
  return { session: data, penalty }
}

export async function deletePlay(userId, session) {
  await createClient().from('fuel_sessions').delete().eq('id', session.id).eq('user_id', userId)
  if (session.overdraft) await robustRemoveXP(userId, 'fuel_overdraft', `fuel_over_${session.id}`)
}

// ── Lights-out bet ───────────────────────────────────────────────────────
export const STAKES = [25, 50, 100]
export const LIGHTS_GRACE_MIN = 15

export async function setLightsOut(userId, date, target, stake) {
  const { error } = await createClient().from('game_pledges').upsert({ user_id: userId, kind: 'lights_out', date, target, stake, status: 'open' }, { onConflict: 'user_id,kind,date' })
  if (error) throw new Error(/relation|schema|does not exist/i.test(error.message) ? 'Run the discipline-games SQL migration first.' : error.message)
}

/** Settle open pledges from the sleep log (the night of `date` is the sleep log dated date+1). */
export async function settleLightsOut(userId, pledges, sleepLogs, today = getLocalDateStr()) {
  const sb = createClient()
  const out = []
  for (const p of pledges.filter((x) => x.status === 'open' && x.date < today)) {
    const log = sleepLogs.find((l) => l.date === addDays(p.date, 1) && l.bedtime)
    if (!log && addDays(p.date, 1) >= today) continue // last night: wait for today's sleep log
    const actual = log ? clockOf(log.bedtime) : null
    const won = actual != null && night(toMin(actual)) <= night(toMin(p.target)) + LIGHTS_GRACE_MIN
    const status = won ? 'won' : 'lost'
    await sb.from('game_pledges').update({ status, actual }).eq('id', p.id)
    await robustAwardXP(userId, won ? p.stake : -p.stake, 'lights_out', `lights_out_${p.date}`,
      won ? `🌙 Lights out by ${p.target} (in bed ${actual}) +${p.stake} XP` : actual ? `🌙 Missed lights-out ${p.target} (in bed ${actual}) −${p.stake} XP` : `🌙 Lights-out ${p.target} not logged — stake lost (−${p.stake} XP)`, 'discipline')
    out.push({ ...p, status, actual })
  }
  return out
}

// ── Estimate duel ────────────────────────────────────────────────────────
export function duelScore(estimate, actual) {
  const e = Number(estimate), a = Number(actual)
  if (!(e > 0) || !(a > 0)) return null
  const off = Math.abs(a - e) / e
  return { off, xp: off <= 0.2 ? 25 : off <= 0.5 ? 10 : 0, verdict: off <= 0.2 ? 'Bullseye' : off <= 0.5 ? 'Close' : a > e ? 'Way over' : 'Way under' }
}

/** Award (or re-award after an edit) the duel for a completed task with both numbers. */
export async function settleDuel(userId, task) {
  if (!userId || !task || task.status !== 'completed') return null
  const s = duelScore(task.estimate_minutes, task.actual_minutes)
  await robustRemoveXP(userId, 'estimate_duel', `estimate_${task.id}`)
  if (s?.xp) await robustAwardXP(userId, s.xp, 'estimate_duel', `estimate_${task.id}`, `🎯 Estimate duel · ${s.verdict}: ${task.title} (${task.estimate_minutes}m est · ${task.actual_minutes}m real)`, 'discipline')
  return s
}

/** How your estimates usually land: median actual/estimate over the last 20 dueled tasks. */
export function calibration(tasks) {
  const rows = tasks.filter((t) => t.status === 'completed' && t.estimate_minutes > 0 && t.actual_minutes > 0)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at))).slice(0, 20)
  if (!rows.length) return null
  const ratios = rows.map((t) => t.actual_minutes / t.estimate_minutes).sort((a, b) => a - b)
  const median = ratios[Math.floor(ratios.length / 2)]
  const hits = rows.filter((t) => duelScore(t.estimate_minutes, t.actual_minutes).off <= 0.2).length
  return { n: rows.length, median: +median.toFixed(2), hitRate: Math.round((hits / rows.length) * 100), recent: rows.slice(0, 5) }
}

// ── Ship-day pledge ──────────────────────────────────────────────────────
export const SHIP = { push: 25, onTime: 100, onTimeAfterPush: 40 }

/** Patch fields + penalty when a mission's deadline moves later. Returns extra fields for the update. */
export async function onDeadlineChange(userId, goal, nextDeadline) {
  const prev = goal?.deadline ? String(goal.deadline).slice(0, 10) : null
  const next = nextDeadline ? String(nextDeadline).slice(0, 10) : null
  if (!prev || !next || next <= prev) return {}
  const pushes = (goal.deadline_pushes || 0) + 1
  await robustAwardXP(userId, -SHIP.push, 'ship_push', `ship_push_${goal.id}_${pushes}`, `📦 Ship date pushed (${pushes}×): ${goal.title} ${prev} → ${next} (−${SHIP.push} XP)`, 'discipline')
  return { deadline_pushes: pushes, original_deadline: goal.original_deadline || prev }
}

export async function onMissionShipped(userId, goal) {
  const due = goal?.deadline ? String(goal.deadline).slice(0, 10) : null
  if (!due || getLocalDateStr() > due) return 0
  const xp = goal.deadline_pushes ? SHIP.onTimeAfterPush : SHIP.onTime
  await robustAwardXP(userId, xp, 'ship_day', `ship_${goal.id}`, `📦 Shipped on the pledged day${goal.deadline_pushes ? ` (after ${goal.deadline_pushes} push${goal.deadline_pushes === 1 ? '' : 'es'})` : ''}: ${goal.title}`, 'discipline')
  return xp
}
export const onMissionUnshipped = (userId, goal) => robustRemoveXP(userId, 'ship_day', `ship_${goal.id}`)

// ── One load for the cards ───────────────────────────────────────────────
export async function loadDiscipline(userId, today = getLocalDateStr()) {
  const sb = createClient()
  const monday = getLocalDateStr(getStartOfWeek(new Date(`${today}T12:00:00`), 1))
  const since = addDays(today, -21)
  const safe = (p) => p.then((r) => (r.error ? { data: null, missing: /relation|schema|does not exist/i.test(r.error.message) } : r)).catch(() => ({ data: null }))
  const [habits, habitLogs, tasks, work, sessions, pledges, sleep, goals] = await Promise.all([
    safe(sb.from('habits').select('*').eq('user_id', userId)),
    safe(sb.from('habit_logs').select('habit_id, date, status').eq('user_id', userId).gte('date', monday)),
    safe(sb.from('tasks').select('id, title, status, completed_at, estimate_minutes, actual_minutes').eq('user_id', userId)),
    safe(sb.from('work_hours_logs').select('*').eq('user_id', userId).gte('date', monday)),
    safe(sb.from('fuel_sessions').select('*').eq('user_id', userId).gte('date', monday).order('created_at')),
    safe(sb.from('game_pledges').select('*').eq('user_id', userId).eq('kind', 'lights_out').gte('date', since).order('date')),
    safe(sb.from('sleep_logs').select('date, bedtime, wake_time').eq('user_id', userId).gte('date', since)),
    safe(sb.from('goals').select('*').eq('user_id', userId)),
  ])
  let pl = pledges.data || []
  const settled = pl.length ? await settleLightsOut(userId, pl, sleep.data || [], today) : []
  if (settled.length) pl = pl.map((p) => settled.find((x) => x.id === p.id) || p)
  const fuel = fuelState({ habits: habits.data || [], habitLogs: habitLogs.data || [], tasks: tasks.data || [], workDays: work.data || [], sessions: sessions.data || [] }, today)
  const ships = (goals.data || []).filter((g) => g.deadline && !['completed', 'failed', 'cancelled'].includes(g.status))
    .map((g) => ({ id: g.id, title: g.title, deadline: String(g.deadline).slice(0, 10), pushes: g.deadline_pushes || 0, original: g.original_deadline }))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
  return {
    fuel, ships, settled,
    pledgeToday: pl.find((p) => p.date === today) || null,
    lastPledge: [...pl].reverse().find((p) => p.status !== 'open') || null,
    pledgeHistory: pl.filter((p) => p.status !== 'open').slice(-14),
    calibration: calibration(tasks.data || []),
    needsMigration: !!(sessions.missing || pledges.missing),
  }
}
