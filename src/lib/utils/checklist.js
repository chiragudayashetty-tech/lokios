// Checklist: to-dos with a deadline. No XP — tasks pay XP, missions are the long goals.
// Items can link to a task and/or a mission. Shared by the Tasks page and the Claude connector.
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'

const table = () => createClient().from('checklist_items')

export async function fetchChecklist(userId) {
  const { data, error } = await table().select('*').eq('user_id', userId).order('due_date', { ascending: true, nullsFirst: false }).order('created_at')
  return { items: data || [], error }
}

export async function addChecklistItem(userId, { title, due_date = null, task_id = null, goal_id = null }) {
  const t = String(title || '').trim()
  if (!t) return { error: { message: 'Write the item first' } }
  const { data, error } = await table().insert({ user_id: userId, title: t, due_date: due_date || null, task_id: task_id || null, goal_id: goal_id || null }).select().single()
  return error ? { error } : { data }
}

export async function updateChecklistItem(userId, id, patch) {
  const { data, error } = await table().update(patch).eq('id', id).eq('user_id', userId).select().single()
  return error ? { error } : { data }
}

export const setChecklistDone = (userId, id, done) => updateChecklistItem(userId, id, { done_at: done ? new Date().toISOString() : null })
export const deleteChecklistItem = (userId, id) => table().delete().eq('id', id).eq('user_id', userId)

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }

/** Open items in deadline buckets, done items last. */
export function groupChecklist(items, today = getLocalDateStr()) {
  const weekEnd = addDays(today, 7)
  const groups = { overdue: [], today: [], week: [], later: [], nodate: [], done: [] }
  for (const it of items) {
    if (it.done_at) groups.done.push(it)
    else if (!it.due_date) groups.nodate.push(it)
    else if (it.due_date < today) groups.overdue.push(it)
    else if (it.due_date === today) groups.today.push(it)
    else if (it.due_date <= weekEnd) groups.week.push(it)
    else groups.later.push(it)
  }
  groups.done.sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)))
  return groups
}

export const CHECKLIST_GROUPS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'later', label: 'Later' },
  { id: 'nodate', label: 'No deadline' },
  { id: 'done', label: 'Done' },
]
