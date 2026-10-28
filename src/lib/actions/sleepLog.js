// Saving one night's sleep: the log row with its score, then sleep XP (re-scored on
// every edit, penalties escalating over bad nights in a row). Shared by the app
// (useSleep) and the Claude connector (/api/mcp).
import { createClient } from '@/lib/supabase/client'
import { isMissingSchema } from '@/lib/utils/schema'
import { sleepScore, sleepXpEscalated } from '@/lib/utils/sleep'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'

/** logs = the user's recent sleep logs (any order). Returns { data, sleepXp } or { error, missing }. */
export async function saveSleepAction({ userId, date, bedtime, wake_time, quality, logs = [] }) {
  const history = logs.filter((l) => l.date < date).sort((a, b) => b.date.localeCompare(a.date))
  const { minutes, score } = sleepScore({ bedtime, wake_time, quality }, history)
  const row = { user_id: userId, date, bedtime, wake_time, quality: Number(quality), duration_minutes: minutes, score }
  const { data, error } = await createClient().from('sleep_logs').upsert(row, { onConflict: 'user_id,date' }).select().single()
  if (error) return { error, missing: isMissingSchema(error) }
  // Sleep XP from the log itself (re-scored when the night is edited)
  const sx = sleepXpEscalated({ date, bedtime, wake_time }, logs)
  const sid = `sleep_${date}`
  await robustRemoveXP(userId, 'sleep_score', sid)
  if (sx?.xp) await robustAwardXP(userId, sx.xp, 'sleep_score', sid, `😴 Sleep ${date}: ${sx.parts.filter((p) => p.xp).map((p) => `${p.label} ${p.xp > 0 ? '+' : ''}${p.xp}`).join(' · ')}${sx.multiplier > 1 ? ` · bad night #${sx.streak}: penalty ×${sx.multiplier}` : ''}`, 'strength', `${date}T08:00:00`)
  return { data, sleepXp: sx }
}
