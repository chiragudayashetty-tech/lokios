// Missions (#37) and the goal → milestone → task tree (#22): pure helpers.

import { XP_REWARDS } from '@/lib/constants'
import { getLocalDateStr } from '@/lib/utils/dates'

export const GOAL_TYPES = {
  main_quest: { label: 'Main', xp: XP_REWARDS.goal_complete_main },
  side_quest: { label: 'Side', xp: XP_REWARDS.goal_complete_side },
  long_term: { label: 'Long range', xp: XP_REWARDS.goal_complete_long_term },
  weekly: { label: 'Weekly', xp: XP_REWARDS.goal_complete_weekly },
}

export const COVER_COLORS = ['violet', 'blue', 'teal', 'green', 'amber', 'rose']
export const COVER_EMOJIS = ['🚀', '🎯', '📚', '💪', '🎬', '🏫', '💰', '🧠', '🌱', '🏆']

export const isActiveGoal = (g) => !['completed', 'cancelled', 'failed'].includes(g?.status)
export const typeLabel = (g) => GOAL_TYPES[g?.type]?.label || 'Mission'
export const missionXp = (g) => GOAL_TYPES[g?.type]?.xp || XP_REWARDS.goal_complete_side
export const deadlineOf = (g) => {
  const d = g?.deadline || g?.target_date || g?.due_date
  return d ? String(d).slice(0, 10) : null
}

const toUtc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
export const dayDiff = (from, to) => Math.round((toUtc(to) - toUtc(from)) / 86400000)

/** "12 days left" / "Due today" / "3 days late"; urgent under 3 days. */
export function countdown(goal, today = getLocalDateStr()) {
  const d = deadlineOf(goal)
  if (!d || !isActiveGoal(goal)) return null
  const n = dayDiff(today, d)
  if (n < 0) return { text: `${-n} day${n === -1 ? '' : 's'} late`, urgent: true, late: true, days: n }
  if (n === 0) return { text: 'Due today', urgent: true, days: 0 }
  return { text: `${n} day${n === 1 ? '' : 's'} left`, urgent: n < 3, days: n }
}

export const milestonesOf = (goalId, milestones) => (milestones || []).filter((m) => m.goal_id === goalId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at).localeCompare(String(b.created_at)))
export const tasksOf = (goalId, tasks) => (tasks || []).filter((t) => t.goal_id === goalId && t.status !== 'cancelled' && t.status !== 'failed')

/**
 * Mission progress 0–100: milestones 60% + linked tasks 40%; only tasks → 100%
 * tasks; neither → the manual progress stored on the goal.
 */
export function progressOf(goal, milestones, tasks) {
  if (!goal) return 0
  if (goal.status === 'completed') return 100
  const ms = milestonesOf(goal.id, milestones)
  const ts = tasksOf(goal.id, tasks)
  const msPct = ms.length ? ms.filter((m) => m.done_at).length / ms.length : null
  const tPct = ts.length ? ts.filter((t) => t.status === 'completed').length / ts.length : null
  if (msPct !== null && tPct !== null) return Math.round((msPct * 0.6 + tPct * 0.4) * 100)
  if (msPct !== null) return Math.round(msPct * 100)
  if (tPct !== null) return Math.round(tPct * 100)
  return Math.max(0, Math.min(100, Number(goal.progress) || 0))
}

/** XP a milestone pays: 30% of the mission's XP split across its milestones (min 10). */
export function milestoneXp(goal, milestoneCount) {
  return Math.max(10, Math.round((missionXp(goal) * 0.3) / Math.max(1, milestoneCount)))
}

export function milestoneTaskStats(milestoneId, tasks) {
  const ts = (tasks || []).filter((t) => t.milestone_id === milestoneId && t.status !== 'cancelled' && t.status !== 'failed')
  return { done: ts.filter((t) => t.status === 'completed').length, total: ts.length, tasks: ts }
}

/** First open milestone — the one the roadmap highlights. */
export const currentMilestone = (ms) => ms.find((m) => !m.done_at) || null
