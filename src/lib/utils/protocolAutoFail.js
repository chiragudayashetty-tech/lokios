import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { isSpeakingRestDay } from '@/lib/utils/restDays'

/**
 * Evaluates 3:00 AM cutoff auto-penalties for Journal and Speaking Practice.
 * Deadline: 3:00 AM of the NEXT calendar day.
 * 
 * If current time is past 3:00 AM on day D+1, and day D is unlogged and not a Rest Day,
 * a -25 XP penalty is automatically deducted and logged in xp_history.
 */
export async function evaluateProtocolAutoFail(userId) {
  if (!userId) return false
  const supabase = createClient()

  try {
    const now = new Date()
    const todayStr = getLocalDateStr(now)
    
    // Determine the latest date whose 3:00 AM cutoff has passed
    // If current time is < 3:00 AM, yesterday's deadline has not expired yet.
    let cutoffDate = new Date(now)
    if (now.getHours() < 3) {
      cutoffDate.setDate(cutoffDate.getDate() - 2) // 2 days ago
    } else {
      cutoffDate.setDate(cutoffDate.getDate() - 1) // yesterday
    }

    const cutoffDateStr = getLocalDateStr(cutoffDate)

    // Calculate start date (14 days ago or last reset)
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 14)
    const startDateStr = getLocalDateStr(startDate)

    // Fetch existing logs and xp_history entries in range
    const [journalRes, speakingRes, xpHistoryRes] = await Promise.all([
      supabase.from('journal_entries').select('date').eq('user_id', userId).gte('date', startDateStr).lte('date', cutoffDateStr),
      supabase.from('speaking_logs').select('date').eq('user_id', userId).gte('date', startDateStr).lte('date', cutoffDateStr),
      supabase.from('xp_history').select('source_type, source_id').eq('user_id', userId).gte('created_at', startDateStr)
    ])

    const loggedJournalDates = new Set((journalRes.data || []).map(j => j.date))
    const loggedSpeakingDates = new Set((speakingRes.data || []).map(s => s.date))
    
    const loggedXpMap = new Set((xpHistoryRes.data || []).map(x => `${x.source_type}_${x.source_id}`))

    // Local Storage cache fallbacks if Supabase table is empty or offline
    if (typeof window !== 'undefined') {
      const localSpeaking = localStorage.getItem(`lokios_speaking_logs_${userId}`)
      if (localSpeaking) {
        try {
          const parsed = JSON.parse(localSpeaking)
          parsed.forEach(s => { if (s.date) loggedSpeakingDates.add(s.date) })
        } catch (e) {}
      }
    }

    // Loop through each date in evaluation window
    const curr = new Date(startDate)
    const end = new Date(cutoffDate)

    while (curr <= end) {
      const dateStr = getLocalDateStr(curr)

      // 1. Journal Entry Check (-25 XP if unlogged past 3:00 AM)
      const journalXpKey = `journal_missed_journal_missed_${dateStr}`
      if (!loggedJournalDates.has(dateStr) && !loggedXpMap.has(journalXpKey)) {
        await robustAwardXP(
          userId,
          -25,
          'journal_missed',
          `journal_missed_${dateStr}`,
          `🚨 MISSED JOURNAL DEADLINE (3 AM Cutoff): Unlogged entry for ${dateStr}`,
          'discipline'
        )
        loggedXpMap.add(journalXpKey)
      }

      // 2. Speaking Practice Check (Saturday Rest Day default, -25 XP if non-rest day unlogged past 3:00 AM)
      const speakingRest = isSpeakingRestDay(dateStr)
      const speakingXpKey = `speaking_missed_speaking_missed_${dateStr}`
      const restXpKey = `speaking_rest_day_speaking_rest_day_${dateStr}`

      if (speakingRest) {
        // Log Rest Day timeline event once (0 XP) so it shows in XP timeline
        if (!loggedXpMap.has(restXpKey) && !loggedSpeakingDates.has(dateStr)) {
          await robustAwardXP(
            userId,
            0,
            'speaking_rest_day',
            `speaking_rest_day_${dateStr}`,
            `☕ REST DAY: Speaking practice off-day (${dateStr})`,
            'discipline'
          )
          loggedXpMap.add(restXpKey)
        }
      } else if (!loggedSpeakingDates.has(dateStr) && !loggedXpMap.has(speakingXpKey)) {
        await robustAwardXP(
          userId,
          -25,
          'speaking_missed',
          `speaking_missed_${dateStr}`,
          `🚨 MISSED SPEAKING DEADLINE (3 AM Cutoff): Unlogged practice for ${dateStr}`,
          'discipline'
        )
        loggedXpMap.add(speakingXpKey)
      }

      curr.setDate(curr.getDate() + 1)
    }

    return true
  } catch (err) {
    console.error('Error evaluating protocol auto-fail:', err)
    return false
  }
}
