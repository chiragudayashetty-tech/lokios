// Completing a task: the row, its XP (difficulty minus 5 XP per overdue day),
// time-block rewards, a proof-of-work log and the next copy of a recurring task.
// Shared by the app (useTasksInternal) and the Claude connector (/api/mcp).
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { DIFFICULTY_LEVELS } from '@/lib/constants'
import { settleTaskBlocks } from '@/lib/utils/blockRewards'
import { toStatCat } from '@/lib/actions/taskStats'

/** Returns { updated, clone }; clone is the next recurring copy, if one was made. */
export async function completeTaskAction({ userId, task, proofUrl = null, completionNote = null }) {
  const supabase = createClient()
  const user = { id: userId }
  const id = task.id
  let clone = null
  const updates = { completed_at: new Date().toISOString(), status: 'completed' }
  if (proofUrl) {
    // Fetch current media_urls first
    const { data: curr } = await supabase.from('tasks').select('media_urls').eq('id', id).eq('user_id', user.id).single()
    updates.media_urls = curr?.media_urls ? [...curr.media_urls, proofUrl] : [proofUrl]
  }
  if (completionNote && completionNote.trim()) {
    const currDesc = task.description || ''
    const cleanNote = completionNote.trim()
    if (!currDesc.includes('[Completion Note]')) {
      updates.description = `${currDesc}\n\n[Completion Note]\n${cleanNote}`.trim()
    }
  }

  const { data: updated, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error

  // Auto-create Portfolio / Proof of Work Log if proof or completion note is present
  if (proofUrl || (completionNote && completionNote.trim())) {
    try {
      await supabase.from('work_logs').insert([{
        user_id: user.id,
        title: `Operation Completed: ${task.title}`,
        description: completionNote ? completionNote.trim() : (task.description || 'Completed Operation.'),
        type: 'project_work',
        date: getLocalDateStr(),
        media_urls: proofUrl ? [proofUrl] : []
      }])
    } catch (logErr) {
      console.error("Error creating work_logs entry on task completion:", logErr)
    }
  }

  // Dynamic XP Calculation based on Difficulty and Overdue Days (-5 XP per day past deadline)
  const isWeeklyGoal = task?.category === 'weekly_goal' || (task?.description || '').includes('[Weekly Goal]')
  const diffKey = (task?.difficulty || 'MEDIUM').toUpperCase()
  const difficultyData = DIFFICULTY_LEVELS[diffKey] || DIFFICULTY_LEVELS.MEDIUM
  let baseXP = isWeeklyGoal ? 25 : difficultyData.xp
  let xpAward = baseXP
  let overdueDays = 0

  // Check if overdue: -5 XP per calendar day past deadline (non-weekly tasks)
  if (!isWeeklyGoal && task?.due_date) {
    const todayStr = getLocalDateStr()
    const cleanDueDate = task.due_date.substring(0, 10)
    if (cleanDueDate < todayStr) {
      const [tY, tM, tD] = todayStr.split('-').map(Number)
      const [dY, dM, dD] = cleanDueDate.split('-').map(Number)
      const todayUtc = Date.UTC(tY, tM - 1, tD)
      const dueUtc = Date.UTC(dY, dM - 1, dD)
      overdueDays = Math.max(1, Math.round((todayUtc - dueUtc) / (1000 * 60 * 60 * 24)))
      const penaltyDeduction = overdueDays * 5
      xpAward = Math.max(0, baseXP - penaltyDeduction)
    }
  }

  const descText = overdueDays > 0 
    ? `Completed task: ${task?.title || 'Unknown'} (+${xpAward} XP, -${overdueDays * 5} Overdue Penalty)`
    : `Completed task: ${task?.title || 'Unknown'}`

  await robustAwardXP(
    user.id,
    xpAward,
    'task_complete',
    id,
    descText,
    toStatCat(task?.category)
  )

  // Time blocks for this task: mark completed, +5 XP when finished on time (#40)
  settleTaskBlocks(user.id, task).catch(() => {})

  // AUTO-CLONING ENGINE FOR RECURRING TASKS
  if (task.type === 'recurring' && task.recurrence_type && task.due_date) {
    const currentDueDate = new Date(task.due_date)
    const nextDueDate = new Date(currentDueDate)
    const recType = String(task.recurrence_type).toLowerCase()
    if (recType === 'daily') {
      nextDueDate.setDate(nextDueDate.getDate() + 1)
    } else if (recType === 'weekly' && task.recurrence_days && task.recurrence_days.length > 0) {
      let duration = 0
      if (task.description) {
        const match = task.description.match(/\[Duration:\s*(\d+)\]/i)
        if (match) duration = parseInt(match[1])
      }
      
      const anchorDate = new Date(currentDueDate)
      anchorDate.setDate(anchorDate.getDate() - duration)
      
      const currentDay = anchorDate.getDay()
      const sortedDays = [...task.recurrence_days].sort((a, b) => a - b)
      let nextDay = sortedDays.find(d => d > currentDay)
      let daysToAdd = 0
      if (nextDay !== undefined) {
        daysToAdd = nextDay - currentDay
      } else {
        daysToAdd = (7 - currentDay) + sortedDays[0]
      }
      
      nextDueDate.setTime(anchorDate.getTime())
      nextDueDate.setDate(nextDueDate.getDate() + daysToAdd + duration)
    } else {
      // Fallback if somehow it's neither but marked recurring
      nextDueDate.setDate(nextDueDate.getDate() + 7)
    }

    const cloneData = {
      user_id: user.id,
      title: task.title,
      description: task.description,
      difficulty: task.difficulty,
      type: 'recurring',
      category: task.category,
      recurrence_type: task.recurrence_type,
      recurrence_days: task.recurrence_days,
      due_date: nextDueDate.toISOString(),
      status: 'pending',
      goal_id: task.goal_id
    }

    const { data: newClone, error: cloneError } = await supabase
      .from('tasks')
      .insert([cloneData])
      .select()
      .single()

    if (!cloneError && newClone) clone = newClone
  }

  return { updated, clone }
}
