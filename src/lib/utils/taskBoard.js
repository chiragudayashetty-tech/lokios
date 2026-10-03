// Pure helpers for the Tasks board (#36). Columns are derived from due_date /
// status every render — never stored.

import { getLocalDateStr, getEndOfWeek } from '@/lib/utils/dates'
import { DIFFICULTY_LEVELS } from '@/lib/constants'

export const COLUMNS = [
  { id: 'today', label: 'Today', hint: 'Due today + overdue' },
  { id: 'week', label: 'This week', hint: 'Due before Sunday' },
  { id: 'later', label: 'Later', hint: 'Future or no date' },
  { id: 'done', label: 'Done', hint: 'Last 7 days' },
]

export const PRIORITIES = {
  EXTREME: { label: 'Extreme', color: 'var(--danger)', rank: 0 },
  HARD: { label: 'Hard', color: 'var(--warning)', rank: 1 },
  MEDIUM: { label: 'Medium', color: 'var(--accent-primary)', rank: 2 },
  EASY: { label: 'Easy', color: 'var(--info)', rank: 3 },
  NONE: { label: 'None', color: 'var(--text-muted)', rank: 4 },
}

export const CATEGORY_LABELS = {
  beyond_tatva: 'Beyond Tattva',
  personal_mission: 'Personal mission',
  learning: 'Learning',
  weekly_goal: 'Weekly goal',
  other: 'Other',
}

export const priorityOf = (task) => PRIORITIES[(task?.difficulty || 'MEDIUM').toUpperCase()] || PRIORITIES.MEDIUM

export function categoryLabel(task) {
  const custom = String(task?.description || '').match(/^\[Category:\s*([^\]]+)\]/)
  if (task?.category === 'other' && custom) return custom[1]
  const c = task?.category || 'other'
  return CATEGORY_LABELS[c] || c.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase())
}

export const dueOf = (task) => (task?.due_date ? String(task.due_date).slice(0, 10) : null)
export const isOpen = (task) => !['completed', 'cancelled', 'failed'].includes(task?.status)

const dayMs = 86400000
const toUtc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
export const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / dayMs)

export function shiftDay(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + n)
  return getLocalDateStr(d)
}

export const weekEndOf = (today) => getLocalDateStr(getEndOfWeek(new Date(`${today}T12:00:00`)))

/** Which column a task belongs in, or null when it isn't on the board (failed, old done). */
export function columnOf(task, today, weekEnd = weekEndOf(today)) {
  if (task.status === 'completed') {
    const doneOn = task.completed_at ? getLocalDateStr(new Date(task.completed_at)) : null
    return doneOn && daysBetween(doneOn, today) < 7 ? 'done' : null
  }
  if (!isOpen(task)) return null
  const due = dueOf(task)
  if (!due) return 'later'
  if (due <= today) return 'today'
  if (due <= weekEnd) return 'week'
  return 'later'
}

/** Board order: overdue pinned first in Today, then position, due date, priority. */
export function sortColumn(list, columnId, today) {
  const pos = (t) => (t.position == null ? Number.MAX_SAFE_INTEGER : t.position)
  return [...list].sort((a, b) => {
    if (columnId === 'done') return String(b.completed_at || '').localeCompare(String(a.completed_at || ''))
    if (columnId === 'today') {
      const ao = dueOf(a) < today, bo = dueOf(b) < today
      if (ao !== bo) return ao ? -1 : 1
    }
    if (pos(a) !== pos(b)) return pos(a) - pos(b)
    const da = dueOf(a) || '9999', db = dueOf(b) || '9999'
    if (da !== db) return da.localeCompare(db)
    return priorityOf(a).rank - priorityOf(b).rank
  })
}

/** "Today", "Tomorrow", "Fri", "Oct 12", or "2d late" (late = true). */
export function dueLabel(task, today) {
  const due = dueOf(task)
  if (!due) return null
  const diff = daysBetween(today, due)
  if (diff < 0) return { text: `${-diff}d late`, late: true }
  if (diff === 0) return { text: 'Today' }
  if (diff === 1) return { text: 'Tomorrow' }
  const d = new Date(`${due}T12:00:00`)
  if (diff < 7) return { text: d.toLocaleDateString('en-US', { weekday: 'short' }) }
  return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
}

/** XP the task pays now (base by difficulty, −5 per overdue day, same as completeTask). */
export function taskXp(task, today) {
  const isWeekly = task?.category === 'weekly_goal' || String(task?.description || '').includes('[Weekly Goal]')
  const base = isWeekly ? 25 : (DIFFICULTY_LEVELS[(task?.difficulty || 'MEDIUM').toUpperCase()] || DIFFICULTY_LEVELS.MEDIUM).xp
  const due = dueOf(task)
  if (isWeekly || !due || due >= today) return { base, net: base, late: 0 }
  const late = daysBetween(due, today)
  return { base, net: Math.max(0, base - late * 5), late }
}

export function subtaskProgress(task) {
  const list = Array.isArray(task?.subtasks) ? task.subtasks : []
  return { done: list.filter((s) => s.done).length, total: list.length }
}

export const formatMinutes = (m) => {
  if (!m) return null
  const h = Math.floor(m / 60), r = m % 60
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`
}

/**
 * The due date a task gets when dropped in a column.
 * This week = the next day this week with nothing due (else Friday / week end).
 * Later = no date (recurring tasks need one, so +7 days).
 */
export function dueForColumn(columnId, task, tasks, today) {
  if (columnId === 'today') return today
  if (columnId === 'later') return task?.type === 'recurring' ? shiftDay(today, 7) : null
  if (columnId === 'week') {
    const weekEnd = weekEndOf(today)
    const busy = new Set(tasks.filter((t) => isOpen(t) && t.id !== task?.id).map(dueOf).filter(Boolean))
    for (let d = shiftDay(today, 1); d <= weekEnd; d = shiftDay(d, 1)) if (!busy.has(d)) return d
    const friday = (() => {
      for (let d = shiftDay(today, 1); d <= weekEnd; d = shiftDay(d, 1)) if (new Date(`${d}T12:00:00`).getDay() === 5) return d
      return null
    })()
    return friday || (weekEnd > today ? weekEnd : today)
  }
  return dueOf(task)
}

export const newSubtaskId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
