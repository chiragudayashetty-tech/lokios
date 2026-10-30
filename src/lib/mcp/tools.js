// Loki OS tools for Claude. Every write goes through the same shared code the app
// uses (lib/actions/*, addBudgetExpense, robustAwardXP), so XP, streaks and
// penalties come out exactly as if the action was done in the app.
import { z } from 'zod'
import { getLocalDateStr } from '@/lib/utils/dates'
import { applyHabitStatus } from '@/lib/actions/habitStatus'
import { completeTaskAction } from '@/lib/actions/taskComplete'
import { saveSleepAction } from '@/lib/actions/sleepLog'
import { saveScreenTimeAction } from '@/lib/actions/screenTimeLog'
import { addBudgetExpense, BUDGET_CATEGORIES, isExcludedFromDaily, getCategoryById } from '@/lib/utils/budget'
import { habitsScheduledOn } from '@/lib/utils/xpRules'
import { progressOf } from '@/lib/utils/missions'
import { sleepWindow, sleepXp } from '@/lib/utils/sleep'
import { isVacationDay } from '@/lib/utils/vacation'

const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const dateArg = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM, 24h')
const out = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data })
const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }

/** Find one row by id or by (part of) its title; ambiguous or missing names list the candidates. */
function pick(rows, ref, kind) {
  const byId = rows.find((r) => r.id === ref)
  if (byId) return byId
  const q = String(ref || '').trim().toLowerCase()
  const exact = rows.filter((r) => (r.title || '').toLowerCase() === q)
  const hits = exact.length ? exact : rows.filter((r) => (r.title || '').toLowerCase().includes(q))
  if (hits.length === 1) return hits[0]
  const names = (hits.length ? hits : rows).slice(0, 15).map((r) => `${r.title} (${r.id})`)
  throw new Error(`${hits.length ? 'Several' : 'No'} ${kind}s match "${ref}". ${hits.length ? 'Which one' : 'Options'}: ${names.join('; ')}`)
}

export function registerTools(server, asOwner) {
  const tool = (name, title, description, inputSchema, fn, annotations = read) =>
    server.registerTool(name, { title, description, inputSchema, annotations }, (args) => asOwner((sb, uid) => fn(args, sb, uid)).then(out))

  // ── Read ─────────────────────────────────────────────────────────────────
  tool('get_today', 'Today in Loki OS', 'Today\'s (or a given date\'s) habits with status, open and done tasks, sleep, spend and XP. Call this first to get habit and task names/ids.', { date: dateArg.optional() }, async ({ date }, sb, uid) => {
    const day = date || getLocalDateStr()
    const [habits, logs, tasks, sleep, budget, xp, profile] = await Promise.all([
      sb.from('habits').select('*').eq('user_id', uid).then((r) => must(r, 'habits')),
      sb.from('habit_logs').select('habit_id, status').eq('user_id', uid).eq('date', day).then((r) => must(r, 'habit_logs')),
      sb.from('tasks').select('id, title, status, due_date, difficulty, category, estimate_minutes, goal_id, completed_at').eq('user_id', uid).not('status', 'in', '(completed,cancelled,failed)').then((r) => must(r, 'tasks')),
      sb.from('sleep_logs').select('date, bedtime, wake_time, duration_minutes, score').eq('user_id', uid).eq('date', day).maybeSingle().then((r) => r.data || null),
      sb.from('budget_logs').select('*').eq('user_id', uid).eq('date', day).then((r) => r.data || []),
      sb.from('xp_history').select('amount, source_type, description').eq('user_id', uid).eq('occurred_on', day).then((r) => r.data || []),
      sb.from('profiles').select('total_xp, streak_days, longest_streak').eq('id', uid).maybeSingle().then((r) => r.data),
    ])
    const status = new Map(logs.map((l) => [l.habit_id, l.status || 'completed']))
    const active = habits.filter((h) => h.is_active !== false)
    const scheduled = new Set(habitsScheduledOn(active, day).map((h) => h.id))
    return {
      date: day,
      vacation_day: isVacationDay(day),
      profile,
      habits: active.map((h) => ({ id: h.id, title: h.title, scheduled: scheduled.has(h.id), status: status.get(h.id) || 'none', xp: h.xp_per_completion || 25, time_of_day: h.time_of_day || 'anytime' })),
      open_tasks: tasks.filter((t) => !t.due_date || String(t.due_date).slice(0, 10) <= addDays(day, 7)).map((t) => ({ ...t, due_date: t.due_date ? String(t.due_date).slice(0, 10) : null })),
      sleep,
      spend: { total: budget.filter((l) => !isExcludedFromDaily(l)).reduce((s, l) => s + Number(l.amount || 0), 0), entries: budget.map((l) => ({ amount: l.amount, category: l.category, description: l.description })) },
      xp_today: xp.reduce((s, r) => s + Number(r.amount || 0), 0),
      xp_events: xp,
    }
  })

  tool('get_history', 'Loki OS history', 'Rows from one area over a date range (default last 14 days): habit_logs, tasks, sleep_logs, budget_logs, journal_entries, work_logs, xp_history, goals.', {
    area: z.enum(['habit_logs', 'tasks', 'sleep_logs', 'budget_logs', 'journal_entries', 'work_logs', 'xp_history', 'goals']),
    from: dateArg.optional(), to: dateArg.optional(), limit: z.number().int().min(1).max(200).optional(),
  }, async ({ area, from, to, limit }, sb, uid) => {
    const end = to || getLocalDateStr()
    const start = from || addDays(end, -14)
    const col = { tasks: 'due_date', goals: 'created_at', xp_history: 'occurred_on' }[area] || 'date'
    let q = sb.from(area).select('*').eq('user_id', uid)
    if (area !== 'goals') q = q.gte(col, start).lte(col, area === 'tasks' ? `${end}T23:59:59` : end)
    const rows = must(await q.order(col, { ascending: false }).limit(limit || 100), area)
    return { area, from: start, to: end, count: rows.length, rows }
  })

  // ── Write ────────────────────────────────────────────────────────────────
  tool('set_habit_status', 'Set habit status', 'Mark a habit completed, failed, rest or none (clear) for a date (default today). Pays or removes XP, updates the streak and game rewards exactly like the app. Habit = id or name.', {
    habit: z.string().min(1), status: z.enum(['completed', 'failed', 'rest', 'none']), date: dateArg.optional(),
  }, async ({ habit: ref, status, date }, sb, uid) => {
    const day = date || getLocalDateStr()
    if (day > getLocalDateStr()) throw new Error('Cannot set a habit for a future date')
    const habits = must(await sb.from('habits').select('*').eq('user_id', uid), 'habits')
    const habit = pick(habits.filter((h) => h.is_active !== false), ref, 'habit')
    const monthLogs = must(await sb.from('habit_logs').select('*').eq('user_id', uid).gte('date', addDays(day, -35)).lte('date', day), 'habit_logs')
    const existingLog = monthLogs.find((l) => l.habit_id === habit.id && l.date === day)
    const currentStatus = existingLog ? existingLog.status || 'completed' : 'none'
    if (currentStatus === status) return { habit: habit.title, date: day, status, changed: false }
    const before = must(await sb.from('profiles').select('total_xp').eq('id', uid).single(), 'profile').total_xp
    await applyHabitStatus({ userId: uid, habitId: habit.id, habit, habits, monthLogs, existingLog, targetDate: day, currentStatus, nextStatus: status })
    const after = must(await sb.from('profiles').select('total_xp, streak_days').eq('id', uid).single(), 'profile')
    return { habit: habit.title, date: day, from: currentStatus, status, xp_change: (after.total_xp || 0) - (before || 0), total_xp: after.total_xp, streak_days: after.streak_days }
  }, write)

  tool('add_task', 'Add task', 'Create a task (operation). Difficulty sets its XP; due date optional; estimate in minutes optional.', {
    title: z.string().min(1).max(200), due_date: dateArg.optional(), difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXTREME']).optional(),
    category: z.string().max(40).optional().describe('e.g. beyond_tatva (default), founder, learning, fitness, personal_care, communication, other'), description: z.string().max(4000).optional(), estimate_minutes: z.number().int().min(1).max(1440).optional(),
    mission: z.string().optional().describe('Mission (goal) id or name to attach the task to'),
  }, async (a, sb, uid) => {
    let goal_id = null
    if (a.mission) goal_id = pick(must(await sb.from('goals').select('id, title').eq('user_id', uid).neq('status', 'completed'), 'goals'), a.mission, 'mission').id
    const row = { user_id: uid, title: a.title, status: 'pending', difficulty: a.difficulty || 'MEDIUM', category: a.category || 'beyond_tatva', type: 'custom', description: a.description || null, due_date: a.due_date || null, goal_id }
    if (a.estimate_minutes) row.estimate_minutes = a.estimate_minutes
    const task = must(await sb.from('tasks').insert(row).select().single(), 'add task')
    return { created: true, task: { id: task.id, title: task.title, due_date: a.due_date || null, difficulty: task.difficulty, goal_id } }
  }, write)

  tool('complete_task', 'Complete task', 'Complete a task: pays its XP (difficulty, −5 per overdue day), settles time blocks, creates the next copy of a recurring task and updates mission progress — same as the app. Task = id or name.', {
    task: z.string().min(1), note: z.string().max(2000).optional(), actual_minutes: z.number().int().min(1).max(1440).optional(),
  }, async ({ task: ref, note, actual_minutes }, sb, uid) => {
    const open = must(await sb.from('tasks').select('*').eq('user_id', uid).not('status', 'in', '(completed,cancelled)'), 'tasks')
    const task = pick(open, ref, 'task')
    const before = must(await sb.from('profiles').select('total_xp').eq('id', uid).single(), 'profile').total_xp
    const { updated, clone } = await completeTaskAction({ userId: uid, task, completionNote: note || null })
    if (actual_minutes) await sb.from('tasks').update({ actual_minutes }).eq('id', task.id).eq('user_id', uid)
    let mission = null
    if (task.goal_id) {
      const goal = must(await sb.from('goals').select('*').eq('id', task.goal_id).single(), 'goal')
      if (goal.status !== 'completed') {
        const [{ data: ms }, siblings] = await Promise.all([
          sb.from('goal_milestones').select('*').eq('user_id', uid),
          sb.from('tasks').select('*').eq('user_id', uid).eq('goal_id', task.goal_id).then((r) => must(r, 'tasks')),
        ])
        const next = Math.min(100, progressOf(goal, ms || [], siblings))
        if (next !== goal.progress) await sb.from('goals').update({ progress: next }).eq('id', goal.id).eq('user_id', uid)
        mission = { title: goal.title, progress: next }
      }
    }
    const after = must(await sb.from('profiles').select('total_xp').eq('id', uid).single(), 'profile').total_xp
    return { completed: updated.title, xp_change: (after || 0) - (before || 0), total_xp: after, next_recurring: clone ? { id: clone.id, due_date: clone.due_date } : null, mission }
  }, write)

  tool('log_sleep', 'Log sleep', 'Log the night ending on `date` (the wake-up date, default today): bedtime and wake time as HH:MM 24h, quality 1–5. Scores the night and pays or takes sleep XP like the app (re-logging a night replaces it).', {
    bedtime: hhmm, wake_time: hhmm, quality: z.number().int().min(1).max(5).default(3), date: dateArg.optional(),
  }, async ({ bedtime, wake_time, quality, date }, sb, uid) => {
    const day = date || getLocalDateStr()
    const win = sleepWindow(day, bedtime, wake_time)
    if (!win) throw new Error('Invalid bedtime or wake time')
    const logs = must(await sb.from('sleep_logs').select('*').eq('user_id', uid).gte('date', addDays(day, -30)), 'sleep_logs')
    const res = await saveSleepAction({ userId: uid, date: day, ...win, quality, logs })
    if (res.error) throw new Error(`sleep: ${res.error.message}`)
    const sx = res.sleepXp || sleepXp(win)
    return { date: day, duration_minutes: res.data.duration_minutes, score: res.data.score, xp: sx?.xp ?? 0, breakdown: sx?.parts?.map((p) => `${p.label} ${p.detail}: ${p.xp > 0 ? '+' : ''}${p.xp}`), penalty_multiplier: sx?.multiplier || 1 }
  }, write)

  tool('log_screen_time', 'Log screen time', 'Log a day\'s iPhone screen time (replaces that day\'s entry), usually read from a Screen Time screenshot the owner sends. Map apps to categories in minutes: social (Instagram, Snapchat, X, Facebook, Reddit), video (YouTube, Netflix, Hotstar, Prime), messaging (WhatsApp, Messages, Telegram), productivity (Notion, Docs, Mail, editing apps, ChatGPT/Claude), games, other. Pays or costs screen-time XP like the app. If the screenshot is "Today" and the day is not over, say so to the owner.', {
    total_hours: z.number().min(0).max(24), date: dateArg.optional().describe('The day the screenshot covers (default today)'),
    social: z.number().int().min(0).max(1440).optional(), video: z.number().int().min(0).max(1440).optional(), messaging: z.number().int().min(0).max(1440).optional(),
    productivity: z.number().int().min(0).max(1440).optional(), games: z.number().int().min(0).max(1440).optional(), other: z.number().int().min(0).max(1440).optional(),
    focus_hours: z.number().min(0).max(24).optional().describe('Default: productivity minutes / 60'),
    doom_scroll_minutes: z.number().int().min(0).max(1440).optional().describe('Default: social minutes'),
    streaming_hours: z.number().min(0).max(24).optional().describe('Default: video minutes / 60'),
    notes: z.string().max(1000).optional(),
  }, async (a, sb, uid) => {
    const day = a.date || getLocalDateStr()
    const q = (x) => Math.round(x * 4) / 4 // the Screen time form works in quarter hours
    const categories = { social: a.social || 0, video: a.video || 0, messaging: a.messaging || 0, productivity: a.productivity || 0, games: a.games || 0, other: a.other || 0 }
    const res = await saveScreenTimeAction({
      userId: uid, date: day, total_hours: q(a.total_hours),
      focus_hours: q(a.focus_hours ?? categories.productivity / 60),
      doom_scroll_minutes: a.doom_scroll_minutes ?? categories.social,
      streaming_hours: q(a.streaming_hours ?? categories.video / 60),
      notes: a.notes || '', categories,
    })
    if (res.error) throw new Error(`screen time: ${res.error.message}`)
    return { date: day, total_hours: a.total_hours, categories_minutes: categories, xp: res.xp, reason: res.reason, battle: res.note || null }
  }, write)

  tool('log_expense', 'Log expense', `Log spending in the budget (₹). Categories: ${BUDGET_CATEGORIES.map((c) => c.id).join(', ')}. Subscriptions and utilities don't count toward the daily allowance unless include_in_daily is set.`, {
    amount: z.number().positive().max(10000000), category: z.string().default('other'), description: z.string().max(500).optional(),
    date: dateArg.optional(), include_in_daily: z.boolean().optional(),
  }, async (a, sb, uid) => {
    const category = getCategoryById(a.category)?.id === a.category ? a.category : 'other'
    const entry = await addBudgetExpense(uid, {
      date: a.date || getLocalDateStr(), amount: a.amount, category,
      custom_category: category === 'other' && a.category !== 'other' ? a.category : null,
      description: a.description || '', ...(typeof a.include_in_daily === 'boolean' ? { exclude_daily: !a.include_in_daily } : {}),
    })
    return { logged: true, entry: { id: entry.id, date: entry.date, amount: entry.amount, category: entry.category, counts_toward_daily: !entry.exclude_daily } }
  }, write)

  tool('save_journal_entry', 'Save journal entry', 'Write or update the journal for a date (default today). Only the fields you pass are changed.', {
    date: dateArg.optional(), what_did_i_do: z.string().max(8000).optional(), what_did_i_learn: z.string().max(8000).optional(),
    what_went_well: z.string().max(8000).optional(), needs_improvement: z.string().max(8000).optional(), mood: z.union([z.number().int().min(1).max(5), z.string().max(30)]).optional(),
  }, async ({ date, ...fields }, sb, uid) => {
    const day = date || getLocalDateStr()
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
    const existing = (await sb.from('journal_entries').select('id').eq('user_id', uid).eq('date', day).maybeSingle()).data
    const saved = existing
      ? must(await sb.from('journal_entries').update(patch).eq('id', existing.id).eq('user_id', uid).select().single(), 'journal')
      : must(await sb.from('journal_entries').insert({ user_id: uid, date: day, ...patch }).select().single(), 'journal')
    return { saved: true, date: day, updated_existing: !!existing, journal: saved }
  }, write)

  tool('add_brain_dump', 'Add to inbox', 'Capture a thought, idea or note into the Inbox at the top of Tasks (the old brain dump).', {
    content: z.string().min(1).max(5000), type: z.enum(['note', 'idea', 'task', 'goal', 'random']).default('note'),
  }, async ({ content, type }, sb, uid) => {
    const row = must(await sb.from('brain_dump').insert({ user_id: uid, content, type }).select().single(), 'brain_dump')
    return { saved: true, id: row.id }
  }, write)
}
