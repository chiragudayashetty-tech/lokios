// Honoring a time block (#40): when a task is completed, its calendar blocks
// are marked completed and a block finished on time pays +5 XP (block_<eventId>).

import { createClient } from '@/lib/supabase/client'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { emitGame } from '@/lib/utils/gamification'

export const BLOCK_XP = 5

export async function settleTaskBlocks(userId, task) {
  if (!userId || !task?.id) return
  const sb = createClient()
  const { data, error } = await sb.from('calendar_events').select('id, end_time, start_time, completed').eq('user_id', userId).eq('task_id', task.id)
  if (error || !data?.length) return // column missing or nothing blocked
  const now = Date.now()
  let honored = 0
  for (const ev of data) {
    if (!ev.completed) await sb.from('calendar_events').update({ completed: true }).eq('id', ev.id)
    const end = new Date(ev.end_time || ev.start_time).getTime()
    if (now <= end) {
      await robustAwardXP(userId, BLOCK_XP, 'time_block', `block_${ev.id}`, `⏱️ Honored time block — ${task.title}`, 'discipline')
      honored++
    }
  }
  if (honored) emitGame('toast', { icon: 'calendar', title: 'Block honored', sub: `${task.title} · +${BLOCK_XP * honored} XP`, tone: 'success' })
}

/** Reopening a task un-honors its blocks. */
export async function unsettleTaskBlocks(userId, taskId) {
  if (!userId || !taskId) return
  const sb = createClient()
  const { data, error } = await sb.from('calendar_events').select('id').eq('user_id', userId).eq('task_id', taskId)
  if (error || !data?.length) return
  for (const ev of data) {
    await sb.from('calendar_events').update({ completed: false }).eq('id', ev.id)
    await robustRemoveXP(userId, 'time_block', `block_${ev.id}`)
  }
}
