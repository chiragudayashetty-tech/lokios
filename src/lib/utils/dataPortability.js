// Settings → Data (#45): paginated export (JSON / CSV), validated import, delete-all.
// Tables are listed parents-first; import runs in this order and delete in reverse.
import { createClient } from '@/lib/supabase/client'
import { isMissingSchema } from '@/lib/utils/schema'
import { fetchAllXpHistory } from '@/lib/utils/xpFallback'

export const DATA_TABLES = [
  'goals', 'goal_milestones', 'habits', 'habit_logs', 'tasks', 'calendar_events',
  'journal_entries', 'daily_reviews', 'brain_dump', 'work_logs', 'work_hours_logs',
  'projects', 'portfolio_items', 'books_completed', 'speaking_logs', 'content_logs',
  'screen_time_logs', 'sleep_logs', 'weight_logs', 'budget_logs', 'subscriptions',
  'savings_goals', 'savings_entries', 'skills', 'character_stats', 'user_blueprints',
  'achievements', 'xp_history',
]
// Never exported: secrets live on the profile; token hashes are useless elsewhere.
const PROFILE_SECRET = /token|secret|google_/i
const PAGE = 1000
export const EXPORT_FORMAT = 'chiragos-export'

async function fetchAll(sb, table, userId) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select('*').eq('user_id', userId).range(from, from + PAGE - 1)
    if (error) return { rows, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return { rows }
  }
}

/** Every table the user owns, paged 1000 rows at a time. Missing tables are skipped. */
export async function exportAll(userId, onProgress) {
  const sb = createClient()
  const tables = {}
  const skipped = []
  for (const [i, t] of DATA_TABLES.entries()) {
    onProgress?.({ table: t, done: i, total: DATA_TABLES.length })
    const { rows, error } = await fetchAll(sb, t, userId)
    if (error) { skipped.push(t); continue }
    tables[t] = rows
  }
  const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
  const safeProfile = profile ? Object.fromEntries(Object.entries(profile).filter(([k]) => !PROFILE_SECRET.test(k))) : null
  return { format: EXPORT_FORMAT, version: 1, exported_at: new Date().toISOString(), profile: safeProfile, tables, skipped }
}

export async function exportTable(userId, table) {
  const { rows, error } = await fetchAll(createClient(), table, userId)
  if (error) throw error
  return rows
}

function csvCell(v) {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(rows) {
  if (!rows.length) return ''
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Check an export file before anything is written. Returns { ok, errors, summary, data }.
 * Only known tables, arrays of objects, at most 50k rows per table.
 */
export function validateImport(json) {
  const errors = []
  let data = json
  if (typeof json === 'string') {
    try { data = JSON.parse(json) } catch { return { ok: false, errors: ['Not valid JSON.'] } }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['Expected a ChiragOS export object.'] }
  if (data.format !== EXPORT_FORMAT) errors.push('This file is not a ChiragOS export (missing "format").')
  if (data.version !== 1) errors.push(`Unsupported export version: ${data.version ?? 'none'}.`)
  if (!data.tables || typeof data.tables !== 'object') errors.push('No "tables" section.')
  const summary = []
  for (const [t, rows] of Object.entries(data.tables || {})) {
    if (!DATA_TABLES.includes(t)) { errors.push(`Unknown table "${t}".`); continue }
    if (!Array.isArray(rows)) { errors.push(`"${t}" must be a list.`); continue }
    if (rows.length > 50000) { errors.push(`"${t}" has more than 50,000 rows.`); continue }
    const bad = rows.findIndex((r) => !r || typeof r !== 'object' || Array.isArray(r))
    if (bad !== -1) { errors.push(`"${t}" row ${bad + 1} is not an object.`); continue }
    if (rows.length) summary.push({ table: t, rows: rows.length })
  }
  return { ok: errors.length === 0, errors, summary, data }
}

/** Upsert validated rows (matched on each table's primary key) (owner forced to the signed-in user), then re-total XP if the ledger came along. */
export async function importAll(userId, data, onProgress) {
  const sb = createClient()
  const results = []
  for (const [i, t] of DATA_TABLES.entries()) {
    const rows = data.tables?.[t]
    if (!rows?.length) continue
    onProgress?.({ table: t, done: i, total: DATA_TABLES.length })
    let written = 0
    let error = null
    for (let k = 0; k < rows.length; k += 500) {
      const chunk = rows.slice(k, k + 500).map((r) => ({ ...r, user_id: userId }))
      // Default conflict target = the table's primary key (id, or user_id + achievement_id for achievements)
      const res = await sb.from(t).upsert(chunk)
      if (res.error) { error = isMissingSchema(res.error) ? 'table not in this database' : res.error.message; break }
      written += chunk.length
    }
    results.push({ table: t, written, error })
  }
  if (data.tables?.xp_history?.length) {
    const ledger = await fetchAllXpHistory(sb, userId, 'amount', true)
    const total = (ledger || []).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    await sb.from('profiles').update({ total_xp: Math.max(0, total) }).eq('id', userId)
  }
  return results
}

/** Delete every row the user owns (children first) and zero the XP total. The account itself stays. */
export async function deleteAll(userId, onProgress) {
  const sb = createClient()
  const results = []
  const order = [...DATA_TABLES].reverse()
  for (const [i, t] of order.entries()) {
    onProgress?.({ table: t, done: i, total: order.length })
    const { error } = await sb.from(t).delete().eq('user_id', userId)
    results.push({ table: t, error: error && !isMissingSchema(error) ? error.message : null })
  }
  await sb.from('profiles').update({ total_xp: 0 }).eq('id', userId)
  return results
}

const day = (iso) => (iso ? String(iso).slice(0, 10) : '')

/**
 * Analysis export: a ZIP with one CSV per table (habit check-ins carry the habit name,
 * milestones carry the mission title) plus daily_summary.csv — one row per day with
 * XP, habits, tasks, screen time, sleep, spend, mood and weight side by side.
 */
export async function exportAnalysisZip(userId, onProgress) {
  const { makeZip } = await import('@/lib/utils/zip')
  const data = await exportAll(userId, onProgress)
  const t = data.tables
  const habitName = new Map((t.habits || []).map((h) => [h.id, h.title]))
  const goalName = new Map((t.goals || []).map((g) => [g.id, g.title]))
  if (t.habit_logs) t.habit_logs = t.habit_logs.map((l) => ({ habit_title: habitName.get(l.habit_id) || '', ...l }))
  if (t.goal_milestones) t.goal_milestones = t.goal_milestones.map((m) => ({ mission_title: goalName.get(m.goal_id) || '', ...m }))
  if (t.tasks) t.tasks = t.tasks.map((x) => ({ ...x, mission_title: goalName.get(x.goal_id) || '' }))

  // Daily summary
  const days = new Map()
  const row = (d) => { if (!d) return null; if (!days.has(d)) days.set(d, { date: d, xp_net: 0, xp_gained: 0, xp_lost: 0, habits_done: 0, habits_failed: 0, tasks_done: 0, screen_hours: '', productive_min: '', social_min: '', youtube_min: '', entertainment_min: '', sleep_hours: '', sleep_score: '', spent: 0, journal_entries: 0, mood: '', weight_kg: '', work_hours: '' }); return days.get(d) }
  for (const r of t.xp_history || []) { const x = row(day(r.created_at)); if (!x) continue; const a = Number(r.amount) || 0; x.xp_net += a; if (a > 0) x.xp_gained += a; else x.xp_lost += a }
  for (const l of t.habit_logs || []) { const x = row(l.date); if (!x) continue; if (!l.status || l.status === 'completed') x.habits_done++; else if (l.status === 'failed') x.habits_failed++ }
  for (const k of t.tasks || []) { if (k.status === 'completed') { const x = row(day(k.completed_at)); if (x) x.tasks_done++ } }
  for (const s of t.screen_time_logs || []) { const x = row(s.date); if (!x) continue; const c = s.categories || {}; x.screen_hours = s.total_hours ?? ''; x.productive_min = c.productivity ?? (s.focus_hours != null ? Math.round(s.focus_hours * 60) : ''); x.social_min = c.social ?? s.doom_scroll_minutes ?? ''; x.youtube_min = c.video ?? ''; x.entertainment_min = c.games ?? (s.streaming_hours != null ? Math.round(s.streaming_hours * 60) : '') }
  for (const s of t.sleep_logs || []) { const x = row(s.date); if (!x) continue; x.sleep_hours = s.duration_minutes != null ? +(s.duration_minutes / 60).toFixed(2) : ''; x.sleep_score = s.score ?? '' }
  for (const b of t.budget_logs || []) { const x = row(b.date); if (x) x.spent += Number(b.amount) || 0 }
  const moods = new Map()
  for (const j of t.journal_entries || []) { const x = row(j.date); if (!x) continue; x.journal_entries++; if (j.mood != null) { const m = moods.get(j.date) || []; m.push(Number(j.mood)); moods.set(j.date, m) } }
  for (const [d, m] of moods) row(d).mood = +(m.reduce((a, b) => a + b, 0) / m.length).toFixed(1)
  for (const w of t.weight_logs || []) { const x = row(w.date); if (x) x.weight_kg = w.weight_kg }
  for (const w of t.work_hours_logs || []) { const x = row(w.date); if (x) x.work_hours = w.total_hours_worked ?? '' }
  const summary = [...days.values()].sort((a, b) => a.date.localeCompare(b.date))

  const files = [
    { name: 'README.txt', text: `ChiragOS data export — ${data.exported_at}\n\ndaily_summary.csv: one row per day (XP, habits, tasks, screen time, sleep, spend, mood, weight, work hours).\nEvery other file is one table, one row per record. Dates are YYYY-MM-DD; timestamps are UTC ISO.\nScreen-time minutes: productive / social / youtube / entertainment.\n` },
    { name: 'daily_summary.csv', text: toCsv(summary) },
    ...Object.entries(t).filter(([, rows]) => rows.length).map(([name, rows]) => ({ name: `${name}.csv`, text: toCsv(rows) })),
  ]
  if (data.profile) files.push({ name: 'profile.csv', text: toCsv([data.profile]) })
  const blob = makeZip(files)
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `chiragos-data-${new Date().toISOString().slice(0, 10)}.zip` })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return { files: files.length, days: summary.length }
}
