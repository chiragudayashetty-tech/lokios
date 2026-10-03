// Shared milestone store (#37 / #22) — plain module so OSContext can read it too.
import { createClient } from '@/lib/supabase/client'
import { isMissingSchema } from '@/lib/utils/schema'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { emitGame } from '@/lib/utils/gamification'
import { milestoneXp, milestonesOf } from '@/lib/utils/missions'

let state = { list: [], loaded: false, missing: false, userId: null }
let loading = null
const listeners = new Set()
const publish = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)) }

export const getMilestones = () => state.list

function load(userId) {
  if (loading) return loading
  loading = createClient().from('goal_milestones').select('*').eq('user_id', userId).order('position')
    .then(({ data, error }) => publish({ list: error ? [] : data || [], loaded: true, missing: isMissingSchema(error), userId }))
    .finally(() => { loading = null })
  return loading
}

const db = () => createClient().from('goal_milestones')

export async function addMilestone(userId, goalId, { title, target_date = null }) {
  const position = milestonesOf(goalId, state.list).length
  const { data, error } = await db().insert({ user_id: userId, goal_id: goalId, title, target_date: target_date || null, position }).select().single()
  if (error) return { error }
  publish({ list: [...state.list, data] })
  return { data }
}

export async function updateMilestone(id, patch) {
  const prev = state.list
  publish({ list: prev.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const { data, error } = await db().update(patch).eq('id', id).select().single()
  if (error) { publish({ list: prev }); return { error } }
  publish({ list: state.list.map((m) => (m.id === id ? data : m)) })
  return { data }
}

export async function deleteMilestone(userId, id) {
  const prev = state.list
  publish({ list: prev.filter((m) => m.id !== id) })
  const { error } = await db().delete().eq('id', id)
  if (error) { publish({ list: prev }); return { error } }
  await robustRemoveXP(userId, 'milestone', `milestone_${id}`)
  return { ok: true }
}

/** Persist a new order for one mission's milestones. */
export async function reorderMilestones(ordered) {
  const pos = new Map(ordered.map((m, i) => [m.id, i]))
  publish({ list: state.list.map((m) => (pos.has(m.id) ? { ...m, position: pos.get(m.id) } : m)) })
  await Promise.all(ordered.map((m, i) => db().update({ position: i }).eq('id', m.id)))
}

/** Complete / reopen a milestone; pays (or revokes) milestone_<id> XP once. */
export async function setMilestoneDone(userId, goal, milestone, done) {
  const res = await updateMilestone(milestone.id, { done_at: done ? new Date().toISOString() : null })
  if (res.error) return res
  const sid = `milestone_${milestone.id}`
  if (done) {
    const xp = milestoneXp(goal, milestonesOf(goal.id, state.list).length)
    await robustAwardXP(userId, xp, 'milestone', sid, `🏁 Milestone: ${milestone.title} (${goal.title})`, 'discipline')
    emitGame('toast', { icon: 'flag', title: 'Milestone reached!', sub: `${milestone.title} · +${xp} XP`, tone: 'gold' })
  } else {
    await robustRemoveXP(userId, 'milestone', sid)
  }
  return res
}

export function subscribeMilestones(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const milestoneSnapshot = () => state

/** Load once per user (no-op when already loaded). */
export function ensureMilestones(userId) {
  if (userId && (state.userId !== userId || !state.loaded)) return load(userId)
  return Promise.resolve()
}
