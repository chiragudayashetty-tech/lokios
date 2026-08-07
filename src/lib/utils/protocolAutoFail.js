import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { isSpeakingRestDay } from '@/lib/utils/restDays'

export const PROTOCOL_START_DATE = '2026-08-07'

/**
 * Evaluates 3:00 AM cutoff auto-penalties for Journal and Speaking Practice.
 * Deadline: 3:00 AM of the NEXT calendar day.
 * 
 * Evaluation STRICTLY starts from PROTOCOL_START_DATE (2026-08-07).
 * Any retroactive penalties prior to start date are automatically purged and refunded.
 */
export async function evaluateProtocolAutoFail(userId) {
  if (!userId) return false
  const supabase = createClient()

  try {
    const now = new Date()
    const todayStr = getLocalDateStr(now)

    // 1. Purge any retroactive auto-fail penalties logged for dates before PROTOCOL_START_DATE
    const { data: pastPenalties } = await supabase
      .from('xp_history')
      .select('id, amount, source_id, source_type')
      .eq('user_id', userId)
      .in('source_type', ['journal_missed', 'speaking_missed', 'speaking_rest_day'])

    if (pastPenalties && pastPenalties.length > 0) {
      const penaltiesToPurge = pastPenalties.filter(p => {
        const parts = (p.source_id || '').split('_')
        const datePart = parts[parts.length - 1]
        return datePart && datePart < PROTOCOL_START_DATE
      })

      if (penaltiesToPurge.length > 0) {
        const purgeIds = penaltiesToPurge.map(p => p.id)
        const totalAmountToRestore = penaltiesToPurge.reduce((acc, p) => acc + (p.amount || 0), 0)

        // Purge retroactive entries
        await supabase.from('xp_history').delete().in('id', purgeIds)

        // Refund deducted XP to profile
        if (totalAmountToRestore < 0) {
          const restoreAmount = Math.abs(totalAmountToRestore)
          if (typeof window !== 'undefined' && window.navigator?.locks) {
            await window.navigator.locks.request('xp_update_lock', async () => {
              const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
              if (prof) {
                await supabase.from('profiles').update({ total_xp: (prof.total_xp || 0) + restoreAmount }).eq('id', userId)
              }
            })
          } else {
            const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
            if (prof) {
              await supabase.from('profiles').update({ total_xp: (prof.total_xp || 0) + restoreAmount }).eq('id', userId)
            }
          }
        }
      }
    }

    // 2. Determine evaluation start date (strictly starting from PROTOCOL_START_DATE)
    const startDateStr = PROTOCOL_START_DATE
    
    // Determine the latest date whose 3:00 AM cutoff has passed
    let cutoffDate = new Date(now)
    if (now.getHours() < 3) {
      cutoffDate.setDate(cutoffDate.getDate() - 2) // 2 days ago
    } else {
      cutoffDate.setDate(cutoffDate.getDate() - 1) // yesterday
    }
    const cutoffDateStr = getLocalDateStr(cutoffDate)

    // If cutoffDate is prior to PROTOCOL_START_DATE, nothing to evaluate yet!
    if (cutoffDateStr < PROTOCOL_START_DATE) return true

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

    // Loop through each date in evaluation window (strictly starting from PROTOCOL_START_DATE)
    const curr = new Date(startDateStr)
    const end = new Date(cutoffDateStr)

    while (curr <= end) {
      const dateStr = getLocalDateStr(curr)

      if (dateStr >= PROTOCOL_START_DATE) {
        // A. Journal Entry Check (-25 XP if unlogged past 3:00 AM)
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

        // B. Speaking Practice Check (Saturday Rest Day default, -25 XP if non-rest day unlogged past 3:00 AM)
        const speakingRest = isSpeakingRestDay(dateStr)
        const speakingXpKey = `speaking_missed_speaking_missed_${dateStr}`
        const restXpKey = `speaking_rest_day_speaking_rest_day_${dateStr}`

        if (speakingRest) {
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
      }

      curr.setDate(curr.getDate() + 1)
    }

    return true
  } catch (err) {
    console.error('Error evaluating protocol auto-fail:', err)
    return false
  }
}
