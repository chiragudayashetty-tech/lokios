// Calendar time blocks (#40): pure helpers for the week grid.

import { getLocalDateStr } from '@/lib/utils/dates'

export const DAY_START_HOUR = 6
export const DAY_END_HOUR = 24
export const SLOT_MIN = 30
export const HOUR_PX = 48 // 30-minute slot = 24px

export const CATEGORIES = [
  { id: 'work', label: 'Work', color: '#6fa8ff' },
  { id: 'personal', label: 'Personal', color: '#ff7ac6' },
  { id: 'health', label: 'Health', color: '#3ddc97' },
  { id: 'learning', label: 'Learning', color: '#ffb547' },
  { id: 'other', label: 'Other', color: '#9b8cff' },
]
export const categoryOf = (ev) => CATEGORIES.find((c) => c.id === ev?.category) || (ev?.task_id ? CATEGORIES[0] : CATEGORIES[4])

/** Guess a category for a task block from the task's category. */
export function categoryForTask(task) {
  const c = String(task?.category || '').toLowerCase()
  if (c === 'learning') return 'learning'
  if (c === 'personal_mission' || c === 'personal') return 'personal'
  if (c === 'fitness' || c === 'health' || c === 'strength') return 'health'
  return 'work'
}

export const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes()
export const snap = (min, step = SLOT_MIN / 2) => Math.round(min / step) * step

/** Date at a day + minutes after midnight. */
export function atMinutes(dateStr, minutes) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setMinutes(minutes)
  return d
}

export const durationMin = (ev) => Math.max(SLOT_MIN / 2, Math.round((new Date(ev.end_time || ev.start_time) - new Date(ev.start_time)) / 60000) || 60)

/** Pixel box for an event inside its day column (clamped to the visible hours). */
export function blockBox(ev) {
  const s = new Date(ev.start_time)
  const e = ev.end_time ? new Date(ev.end_time) : new Date(s.getTime() + 60 * 60000)
  const top = Math.max(0, minutesOfDay(s) - DAY_START_HOUR * 60)
  let endMin = minutesOfDay(e) - DAY_START_HOUR * 60
  if (getLocalDateStr(e) !== getLocalDateStr(s)) endMin = (DAY_END_HOUR - DAY_START_HOUR) * 60
  const height = Math.max(SLOT_MIN / 2, endMin - top)
  return { top: (top / 60) * HOUR_PX, height: (height / 60) * HOUR_PX }
}

/** Side-by-side lanes for overlapping events in one day: Map id → { lane, lanes }. */
export function layoutLanes(events) {
  const sorted = [...events].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  const out = new Map()
  let cluster = []
  let clusterEnd = 0
  const flush = () => {
    const lanes = []
    for (const ev of cluster) {
      const s = new Date(ev.start_time).getTime()
      let lane = lanes.findIndex((end) => end <= s)
      if (lane < 0) { lane = lanes.length; lanes.push(0) }
      lanes[lane] = new Date(ev.end_time || ev.start_time).getTime() || s + 3600000
      out.set(ev.id, { lane, lanes: 0 })
    }
    for (const ev of cluster) out.get(ev.id).lanes = lanes.length
    cluster = []
  }
  for (const ev of sorted) {
    const s = new Date(ev.start_time).getTime()
    const e = new Date(ev.end_time || ev.start_time).getTime() || s + 3600000
    if (cluster.length && s >= clusterEnd) flush()
    cluster.push(ev)
    clusterEnd = Math.max(clusterEnd, e)
  }
  if (cluster.length) flush()
  return out
}

/**
 * Next empty window of `minutes` from `from` (rounded up to the next slot),
 * inside visible hours, avoiding `events`. Looks up to 14 days ahead.
 */
export function nextFreeSlot(events, minutes, from = new Date(), ignoreId = null) {
  const busy = events.filter((e) => e.id !== ignoreId).map((e) => [new Date(e.start_time).getTime(), new Date(e.end_time || e.start_time).getTime()])
  const step = SLOT_MIN * 60000
  let t = Math.ceil(from.getTime() / step) * step
  const limit = from.getTime() + 14 * 86400000
  while (t < limit) {
    const d = new Date(t)
    const m = minutesOfDay(d)
    if (m < DAY_START_HOUR * 60) { d.setHours(DAY_START_HOUR, 0, 0, 0); t = d.getTime(); continue }
    if (m + minutes > DAY_END_HOUR * 60) { d.setDate(d.getDate() + 1); d.setHours(DAY_START_HOUR, 0, 0, 0); t = d.getTime(); continue }
    const end = t + minutes * 60000
    const clash = busy.find(([s, e]) => s < end && e > t)
    if (!clash) return { start: new Date(t), end: new Date(end) }
    t = Math.ceil(clash[1] / step) * step
  }
  return null
}

export const toLocalInput = (d) => {
  const x = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}
