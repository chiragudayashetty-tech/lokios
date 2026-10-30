// Discipline games: lights-out bet and FC fuel tank (earned play time).
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

// ── Task estimates (shown on tasks; no XP) ─────────────────────────────
export const estimateLabel = (t) => { const f = (m) => (m >= 60 ? `${+(m / 60).toFixed(1)}h` : `${m}m`); return t?.estimate_minutes ? (t.estimate_max_minutes > t.estimate_minutes ? `${f(t.estimate_minutes)}–${f(t.estimate_max_minutes)}` : f(t.estimate_minutes)) : null }

/** Last finished task that looks like this one (shared words in the title) with a real time. */
export function similarTask(task, tasks) {
  const words = (s) => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w)))
  const mine = words(task?.title)
  if (!mine.size) return null
  let best = null
  for (const t of tasks || []) {
    if (t.id === task.id || t.status !== 'completed' || !(t.actual_minutes > 0)) continue
    const shared = [...words(t.title)].filter((w) => mine.has(w)).length
    if (shared >= 2 || (shared === 1 && mine.size === 1)) if (!best || shared > best.shared || (shared === best.shared && String(t.completed_at) > String(best.t.completed_at))) best = { t, shared }
  }
  return best?.t || null
}

// ── One load for the cards ───────────────────────────────────────────────
export async function loadDiscipline(userId, today = getLocalDateStr()) {
  const sb = createClient()
  const monday = getLocalDateStr(getStartOfWeek(new Date(`${today}T12:00:00`), 1))
  const since = addDays(today, -21)
  const safe = (p) => p.then((r) => (r.error ? { data: null, missing: /relation|schema|does not exist/i.test(r.error.message) } : r)).catch(() => ({ data: null }))
  const [habits, habitLogs, tasks, work, sessions, pledges, sleep] = await Promise.all([
    safe(sb.from('habits').select('*').eq('user_id', userId)),
    safe(sb.from('habit_logs').select('habit_id, date, status').eq('user_id', userId).gte('date', monday)),
    safe(sb.from('tasks').select('*').eq('user_id', userId)),
    safe(sb.from('work_hours_logs').select('*').eq('user_id', userId).gte('date', monday)),
    safe(sb.from('fuel_sessions').select('*').eq('user_id', userId).gte('date', monday).order('created_at')),
    safe(sb.from('game_pledges').select('*').eq('user_id', userId).eq('kind', 'lights_out').gte('date', since).order('date')),
    safe(sb.from('sleep_logs').select('date, bedtime, wake_time').eq('user_id', userId).gte('date', since)),
  ])
  let pl = pledges.data || []
  const settled = pl.length ? await settleLightsOut(userId, pl, sleep.data || [], today) : []
  if (settled.length) pl = pl.map((p) => settled.find((x) => x.id === p.id) || p)
  const fuel = fuelState({ habits: habits.data || [], habitLogs: habitLogs.data || [], tasks: tasks.data || [], workDays: work.data || [], sessions: sessions.data || [] }, today)
  return {
    fuel, settled,
    pledgeToday: pl.find((p) => p.date === today) || null,
    lastPledge: [...pl].reverse().find((p) => p.status !== 'open') || null,
    pledgeHistory: pl.filter((p) => p.status !== 'open').slice(-14),
    needsMigration: !!(sessions.missing || pledges.missing),
  }
}
