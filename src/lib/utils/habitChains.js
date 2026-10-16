// Habit chains (#17): "do this after…" stacking. A habit may name one
// predecessor (after_habit_id). Doing a habit after its predecessor on the same
// day pays a small bonus per link; a whole chain of 3+ habits done in order pays
// a completion bonus. Order comes from habit_logs.completed_at (or created_at).

import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { emitGame } from '@/lib/utils/gamification'

export const CHAIN_LINK_XP = 5
export const CHAIN_FULL_XP = 25
export const CHAIN_MIN_LENGTH = 3

const byId = (habits) => new Map((habits || []).map((h) => [h.id, h]))

/** The habit's predecessors, nearest first (stops on a broken / cyclic link). */
export function chainAncestors(habits, habitId) {
  const map = byId(habits)
  const out = []
  const seen = new Set([habitId])
  let cur = map.get(habitId)?.after_habit_id
  while (cur && map.has(cur) && !seen.has(cur)) {
    out.push(cur)
    seen.add(cur)
    cur = map.get(cur).after_habit_id
  }
  return out
}

/** Can `candidateId` be picked as the predecessor of `habitId` without creating a cycle? */
export function canFollow(habits, habitId, candidateId) {
  if (!candidateId) return true
  if (candidateId === habitId) return false
  return !chainAncestors(habits, candidateId).includes(habitId)
}

/** Root of the habit's chain (itself when it has no predecessor). */
export function chainRoot(habits, habitId) {
  const anc = chainAncestors(habits, habitId)
  return anc.length ? anc[anc.length - 1] : habitId
}

/**
 * Display order that keeps chains together: each successor right after its
 * predecessor. Returns [{ habit, linked }] — linked = drawn with a connector.
 */
export function orderWithChains(list, allHabits = list) {
  const inList = new Set(list.map((h) => h.id))
  const children = new Map()
  for (const h of list) {
    const p = h.after_habit_id
    if (p && inList.has(p) && canFollow(allHabits, h.id, p)) {
      if (!children.has(p)) children.set(p, [])
      children.get(p).push(h)
    }
  }
  const out = []
  const placed = new Set()
  const visit = (h, linked) => {
    if (placed.has(h.id)) return
    placed.add(h.id)
    out.push({ habit: h, linked })
    for (const c of children.get(h.id) || []) visit(c, true)
  }
  for (const h of list) {
    const p = h.after_habit_id
    const hasParentHere = p && inList.has(p) && canFollow(allHabits, h.id, p)
    if (!hasParentHere) visit(h, false)
  }
  for (const h of list) visit(h, false) // anything left (defensive)
  return out
}

const doneAt = (log) => {
  if (!log || (log.status && log.status !== 'completed')) return null
  const t = log.completed_at || log.created_at || log.updated_at
  return t ? new Date(t).getTime() : 0
}

/**
 * Chain status for one date: which links were done in order, each habit's run
 * length ("Chain ×N") and which roots completed a chain of CHAIN_MIN_LENGTH+.
 */
export function chainState(habits, logs, dateStr) {
  const map = byId(habits)
  const times = new Map()
  for (const l of logs || []) if (l.date === dateStr) { const t = doneAt(l); if (t !== null) times.set(l.habit_id, t) }

  const valid = new Set()
  const run = new Map()
  const runOf = (id, guard = new Set()) => {
    if (run.has(id)) return run.get(id)
    if (!times.has(id) || guard.has(id)) return 0
    guard.add(id)
    const p = map.get(id)?.after_habit_id
    let r = 1
    if (p && map.has(p) && times.has(p) && times.get(p) < times.get(id)) {
      valid.add(id)
      r = runOf(p, guard) + 1
    }
    run.set(id, r)
    return r
  }
  for (const h of habits || []) runOf(h.id)

  // A chain is complete when an unbroken in-order run of CHAIN_MIN_LENGTH+ habits starts at its root
  const fullRoots = new Set()
  for (const [id, r] of run) {
    if (r < CHAIN_MIN_LENGTH) continue
    const anc = chainAncestors(habits, id)
    const start = anc[r - 2]
    if (start && !map.get(start)?.after_habit_id) fullRoots.add(start)
  }
  return { valid, run, fullRoots }
}

/** Award / revoke chain bonuses for whatever changed between two log snapshots of one date. */
export async function applyChainRewards() {
  // Removed: +5 per chain link / chain-complete bonus. The app can only see the order habits
  // were ticked in, not whether they were really done back-to-back, so it was free XP.
}
