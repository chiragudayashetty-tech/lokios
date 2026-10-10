// Living world: an island drawn only from data the user already logs.
// Pure — buildWorld(data, asOf) returns the island as it stood on `asOf`, which is
// what makes the timelapse work. Every object keeps a fixed spot (hashed from its id)
// so the island grows around what is already there.
import { habitsScheduledOn } from '@/lib/utils/xpRules'
import { screenBreakdown } from '@/lib/utils/screenTimeScore'
import { getLocalDateStr } from '@/lib/utils/dates'

export const TREE_STAGES = [
  { min: 0, name: 'Seed' },
  { min: 1, name: 'Sprout' },
  { min: 5, name: 'Sapling' },
  { min: 15, name: 'Tree' },
  { min: 40, name: 'Great tree' },
  { min: 100, name: 'Ancient tree' },
]
export const TASKS_PER_HOUSE = 5
const MAX_HOUSES = 48

const dayOf = (iso) => (iso ? getLocalDateStr(new Date(iso)) : null)
const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }
const isDone = (l) => !l.status || l.status === 'completed'

// Deterministic 0..1 values from a string
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
}

/**
 * A fixed spot in the unit disk, inside the band [r0, r1] and the angle range [a0, a1] (radians).
 * Tries a few hashed candidates and keeps the first that isn't on top of something already placed.
 */
function spot(id, { r0 = 0, r1 = 0.9, a0 = 0, a1 = Math.PI * 2 } = {}, taken = [], gap = 0.16) {
  const rnd = hash(String(id))
  const seed = rnd()
  let best = null
  for (let k = 0; k < 14; k++) {
    const r = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0))
    const a = a0 + rnd() * (a1 - a0)
    const c = { u: r * Math.cos(a), v: r * Math.sin(a) }
    const d = taken.reduce((m, t) => Math.min(m, Math.hypot(t.u - c.u, (t.v - c.v) * 1.6)), Infinity)
    if (!best || d > best.d) best = { ...c, d }
    if (d >= gap) break
  }
  const out = { u: best.u, v: best.v, seed }
  taken.push(out)
  return out
}

// Every object's spot is decided once from the full history, so the timelapse never shuffles things.
const layouts = new WeakMap()
function layoutOf(data) {
  if (layouts.has(data)) return layouts.get(data)
  const taken = []
  const at = new Map()
  for (const g of [...(data.goals || [])].sort((a, b) => String(a.created_at || a.id).localeCompare(String(b.created_at || b.id)))) at.set(`goal-${g.id}`, spot(`goal-${g.id}`, { r0: 0, r1: 0.5 }, taken, 0.22))
  for (const h of [...(data.habits || [])].sort((a, b) => String(a.created_at || a.id).localeCompare(String(b.created_at || b.id)))) at.set(`tree-${h.id}`, spot(`tree-${h.id}`, { r0: 0.15, r1: 0.9, a0: -Math.PI * 0.75, a1: Math.PI * 0.75 }, taken))
  const nHouses = Math.min(MAX_HOUSES, Math.floor((data.tasks || []).filter((t) => t.status === 'completed').length / TASKS_PER_HOUSE))
  for (let i = 0; i < nHouses; i++) at.set(`house-${i}`, spot(`house-${i}`, { r0: 0.2, r1: 0.9, a0: Math.PI * 0.55, a1: Math.PI * 1.45 }, taken, 0.12))
  layouts.set(data, at)
  return at
}
const placed = (data, key) => layoutOf(data).get(key) || spot(key)

export function treeStage(n) {
  let s = 0
  TREE_STAGES.forEach((t, i) => { if (n >= t.min) s = i })
  return s
}

/** The first date anything was logged — the island's birthday. */
export function worldStart(data) {
  const ds = [
    ...data.habitLogs.map((l) => l.date),
    ...data.tasks.map((t) => dayOf(t.completed_at)),
    ...data.goals.map((g) => dayOf(g.created_at)),
  ].filter(Boolean).sort()
  return ds[0] || getLocalDateStr()
}

export function buildWorld(data, asOf, now = new Date()) {
  const { habits = [], habitLogs = [], tasks = [], goals = [], screenLogs = [] } = data
  const today = getLocalDateStr(now)
  const start = worldStart(data)
  const age = Math.max(1, Math.round((new Date(`${asOf}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000) + 1)

  const logs = habitLogs.filter((l) => l.date <= asOf)
  const doneLogs = logs.filter(isDone)
  const weekAgo = addDays(asOf, -6)

  // ── Trees: one per habit, growing with every completion; dry after a week untouched
  const trees = habits
    .map((h) => {
      const mine = doneLogs.filter((l) => l.habit_id === h.id)
      if (!mine.length && (h.created_at && dayOf(h.created_at) > asOf)) return null
      const last = mine.reduce((m, l) => (l.date > m ? l.date : m), '')
      const stopped = h.is_active === false && (!h.stopped_at || dayOf(h.stopped_at) <= asOf)
      const p = placed(data, `tree-${h.id}`)
      return {
        kind: 'tree', id: h.id, name: h.title, count: mine.length, stage: treeStage(mine.length),
        dry: !stopped && mine.length > 0 && last < weekAgo, stump: stopped,
        bloom: mine.some((l) => l.date === asOf), lastDone: last || null, ...p,
      }
    })
    .filter(Boolean)

  // ── Village: a house for every TASKS_PER_HOUSE tasks completed
  const doneTasks = tasks.filter((t) => t.status === 'completed' && dayOf(t.completed_at) && dayOf(t.completed_at) <= asOf)
    .sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at)))
  const houses = []
  for (let i = 0; i < Math.min(MAX_HOUSES, Math.floor(doneTasks.length / TASKS_PER_HOUSE)); i++) {
    const batch = doneTasks.slice(i * TASKS_PER_HOUSE, (i + 1) * TASKS_PER_HOUSE)
    houses.push({ kind: 'house', id: `house-${i}`, name: `House ${i + 1}`, built: dayOf(batch[batch.length - 1].completed_at), tasks: batch.map((t) => t.title), ...placed(data, `house-${i}`) })
  }
  const nextHouse = TASKS_PER_HOUSE - (doneTasks.length % TASKS_PER_HOUSE)

  // ── Landmarks: finished missions stand tall; active ones are under construction
  const goalTasks = (gid) => tasks.filter((t) => t.goal_id === gid)
  const landmarks = goals
    .filter((g) => dayOf(g.created_at) ? dayOf(g.created_at) <= asOf : true)
    .filter((g) => !['cancelled'].includes(g.status))
    .map((g) => {
      const done = g.status === 'completed' && dayOf(g.completed_at) && dayOf(g.completed_at) <= asOf
      const failed = g.status === 'failed'
      const gt = goalTasks(g.id)
      const gtDone = gt.filter((t) => t.status === 'completed' && dayOf(t.completed_at) <= asOf).length
      const progress = done ? 100 : gt.length ? Math.round((gtDone / gt.length) * 100) : Math.min(99, Number(g.progress) || 0)
      return {
        kind: done ? 'landmark' : failed ? 'ruin' : 'site', id: g.id, name: g.title, progress, deadline: g.deadline || null,
        late: !done && g.deadline && g.deadline < asOf, completed: done ? dayOf(g.completed_at) : null,
        ...placed(data, `goal-${g.id}`),
      }
    })

  // ── Weather for asOf: habit share that day, fog from leisure screen time over limits
  const sched = habitsScheduledOn(habits.filter((h) => h.is_active !== false && (!h.created_at || dayOf(h.created_at) <= asOf)), asOf)
  const dayDone = new Set(doneLogs.filter((l) => l.date === asOf).map((l) => l.habit_id))
  const dayFailed = logs.filter((l) => l.date === asOf && l.status === 'failed').length
  const share = sched.length ? sched.filter((h) => dayDone.has(h.id)).length / sched.length : null
  const isToday = asOf === today
  const hour = isToday ? now.getHours() : 13
  const screen = screenLogs.find((l) => l.date === asOf)
  const over = screen ? screenBreakdown(screen).leisure.reduce((s, l) => s + (l.over || 0), 0) : 0
  let weather = 'clear'
  if (share != null) weather = dayFailed >= 2 || (share < 0.35 && !(isToday && hour < 20)) ? 'rain' : share < 0.7 ? 'cloudy' : 'clear'
  if (share == null && isToday) weather = 'clear'

  // ── Streak boats: one per full week of the current streak
  const doneKey = new Set(doneLogs.map((l) => `${l.habit_id}|${l.date}`))
  const activeHabits = habits.filter((h) => h.is_active !== false)
  let streak = 0
  for (let d = asOf; d >= start && streak <= 400; d = addDays(d, -1)) {
    const s = habitsScheduledOn(activeHabits, d)
    if (!s.length) continue
    const ok = s.filter((h) => doneKey.has(`${h.id}|${d}`)).length / s.length >= 0.5
    if (ok) streak++
    else if (d === asOf && isToday) continue // today isn't over yet
    else break
  }

  const size = Math.min(1, 0.55 + age / 200 + (trees.length + houses.length + landmarks.length) / 120)
  return {
    asOf, start, age, size, isToday, hour,
    night: hour < 6 || hour >= 19, dusk: hour >= 17 && hour < 19,
    weather, fog: over > 0, fogMinutes: Math.round(over), share, streak, boats: Math.min(6, Math.floor(streak / 7)),
    trees, houses, landmarks, nextHouse,
    stats: {
      trees: trees.filter((t) => t.count > 0).length, ancient: trees.filter((t) => t.stage >= 4).length, dry: trees.filter((t) => t.dry).length,
      houses: houses.length, tasks: doneTasks.length, landmarks: landmarks.filter((l) => l.kind === 'landmark').length,
      sites: landmarks.filter((l) => l.kind === 'site').length, checkins: doneLogs.length,
    },
  }
}

/** Short lines describing what changed between two days, for the timelapse caption. */
export function worldDiff(prev, cur) {
  const out = []
  const grown = cur.trees.filter((t) => { const p = prev.trees.find((x) => x.id === t.id); return t.stage > (p?.stage ?? 0) })
  grown.forEach((t) => out.push(`${t.name} grew into a ${TREE_STAGES[t.stage].name.toLowerCase()}`))
  if (cur.houses.length > prev.houses.length) out.push(`${cur.houses.length - prev.houses.length} new house${cur.houses.length - prev.houses.length > 1 ? 's' : ''} in the village`)
  cur.landmarks.filter((l) => l.kind === 'landmark' && !prev.landmarks.some((p) => p.id === l.id && p.kind === 'landmark')).forEach((l) => out.push(`${l.name} completed — landmark raised`))
  return out
}
