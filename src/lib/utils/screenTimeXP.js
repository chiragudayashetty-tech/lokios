import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'

/**
 * Calculates dynamic XP for a Screen Time / Screen Intel entry.
 * Targets:
 *  - Total Hours: target 6h (±10 XP per hour diff)
 *  - Doom Scroll: target 60m (±0.5 XP per min diff)
 *  - Focus Hours: target 3h (±15 XP per hour diff)
 *  - Streaming Hours: target 1h (±10 XP per hour diff)
 */
export function calculateScreenTimeXP(log) {
  if (!log) return { xpAmount: 0, finalReason: 'Screen Time logged' }

  const tHours = parseFloat(log.total_hours) || 0
  const fHours = parseFloat(log.focus_hours) || 0
  const dMins = parseInt(log.doom_scroll_minutes) || 0
  const sHours = parseFloat(log.streaming_hours) || 0

  let xpAmount = 0
  let reasons = []

  // 1. Total Hours: Target 6
  const totalDiff = 6 - tHours
  const totalXp = Math.round(totalDiff * 10)
  if (totalXp !== 0) {
    xpAmount += totalXp
    reasons.push(`Total Time: ${totalXp > 0 ? '+' : ''}${totalXp}`)
  }

  // 2. Doom Scroll: Target 60 mins (1 hr)
  const doomDiff = 60 - dMins
  const doomXp = Math.round(doomDiff * 0.5)
  if (doomXp !== 0) {
    xpAmount += doomXp
    reasons.push(`Doomscroll: ${doomXp > 0 ? '+' : ''}${doomXp}`)
  }

  // 3. Focus Hours: Target 3
  const focusDiff = fHours - 3
  const focusXp = Math.round(focusDiff * 15)
  if (focusXp !== 0) {
    xpAmount += focusXp
    reasons.push(`Focus: ${focusXp > 0 ? '+' : ''}${focusXp}`)
  }

  // 4. Streaming Hours: Target 1h (60 min)
  const streamingDiff = 1 - sHours
  const streamingXp = Math.round(streamingDiff * 10)
  if (streamingXp !== 0) {
    xpAmount += streamingXp
    reasons.push(`Streaming: ${streamingXp > 0 ? '+' : ''}${streamingXp}`)
  }

  const finalReason = reasons.join(' | ') || 'Screen Time logged'
  return { xpAmount, finalReason }
}

/**
 * Persistently syncs Screen Time XP into xp_history and updates profiles.total_xp.
 * Anchors the created_at timestamp to the log's date so it properly feeds Daily Momentum.
 */
export async function syncScreenTimeXP(userId, log) {
  if (!userId || !log) return { xpAmount: 0, finalReason: '' }

  const targetDate = log.date || getLocalDateStr(new Date())
  const todayStr = getLocalDateStr(new Date())
  const stableSourceId = `screen_time_${targetDate}`

  // Clean up any legacy or duplicate XP entries for this date
  await robustRemoveXP(userId, 'screen_time', stableSourceId)
  if (log.id) {
    await robustRemoveXP(userId, 'screen_time', log.id)
  }
  await robustRemoveXP(userId, 'screen_time', targetDate)

  const { xpAmount, finalReason } = calculateScreenTimeXP(log)

  if (xpAmount !== 0) {
    const isToday = targetDate === todayStr
    const createdAt = isToday ? new Date().toISOString() : `${targetDate}T12:00:00.000Z`
    await robustAwardXP(
      userId,
      xpAmount,
      'screen_time',
      stableSourceId,
      finalReason,
      'discipline',
      createdAt
    )
  }

  return { xpAmount, finalReason }
}

/**
 * Checks recent screen time logs (last 7 days) and ensures any missing screen time XP
 * is backfilled into xp_history so Daily Momentum is accurate.
 */
export async function backfillRecentScreenTimeXP(userId) {
  if (!userId) return 0
  const supabase = createClient()

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = getLocalDateStr(sevenDaysAgo)

    const [stRes, xpRes] = await Promise.all([
      supabase
        .from('screen_time_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgoStr)
        .order('date', { ascending: false }),
      supabase
        .from('xp_history')
        .select('id, source_id, source_type, created_at')
        .eq('user_id', userId)
        .eq('source_type', 'screen_time')
        .gte('created_at', `${sevenDaysAgoStr}T00:00:00.000Z`)
    ])

    const stLogs = stRes.data || []
    const xpEntries = xpRes.data || []
    if (stLogs.length === 0) return 0

    const existingXpDates = new Set()
    xpEntries.forEach(entry => {
      if (entry.source_id && entry.source_id.startsWith('screen_time_')) {
        const d = entry.source_id.replace('screen_time_', '')
        existingXpDates.add(d)
      } else if (entry.created_at) {
        const d = getLocalDateStr(new Date(entry.created_at))
        existingXpDates.add(d)
      }
    })

    let backfilledCount = 0
    for (const log of stLogs) {
      if (!log.date) continue
      if (!existingXpDates.has(log.date)) {
        await syncScreenTimeXP(userId, log)
        existingXpDates.add(log.date)
        backfilledCount++
      }
    }

    return backfilledCount
  } catch (err) {
    console.warn('Screen time XP backfill error (non-fatal):', err)
    return 0
  }
}
