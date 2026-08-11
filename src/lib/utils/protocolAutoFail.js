import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { isSpeakingRestDay } from '@/lib/utils/restDays'

export const PROTOCOL_START_DATE = '2026-08-09'

/**
 * Evaluates 3:00 AM cutoff auto-penalties for Journal and Speaking Practice.
 * Deadline: 3:00 AM of the NEXT calendar day.
 * 
 * Evaluation STRICTLY starts from PROTOCOL_START_DATE (2026-08-09).
 * Any retroactive penalties prior to start date are automatically purged and refunded.
 */
let isEvaluatingAutoFail = false

export async function evaluateProtocolAutoFail(userId) {
  if (!userId || isEvaluatingAutoFail) return false
  isEvaluatingAutoFail = true
  const supabase = createClient()

  try {
    const now = new Date()

    // 1. Determine evaluation cutoff date (latest date whose 3:00 AM cutoff has passed)
    let cutoffDate = new Date(now)
    if (now.getHours() < 3) {
      cutoffDate.setDate(cutoffDate.getDate() - 2) // 2 days ago
    } else {
      cutoffDate.setDate(cutoffDate.getDate() - 1) // yesterday
    }
    const cutoffDateStr = getLocalDateStr(cutoffDate)
    const startDateStr = PROTOCOL_START_DATE

    if (cutoffDateStr < PROTOCOL_START_DATE) {
      isEvaluatingAutoFail = false
      return true
    }

    // 2. Query ALL completed logs across speaking_logs, work_logs, and journal_entries
    const [journalRes, speakingRes, workSpeakingRes, xpHistoryRes] = await Promise.all([
      supabase.from('journal_entries').select('date').eq('user_id', userId).gte('date', startDateStr).lte('date', cutoffDateStr),
      supabase.from('speaking_logs').select('date').eq('user_id', userId).gte('date', startDateStr).lte('date', cutoffDateStr),
      supabase.from('work_logs').select('date, type, title').eq('user_id', userId).or(`type.eq.speaking_practice,title.ilike.Speaking Practice%`).gte('date', startDateStr).lte('date', cutoffDateStr),
      supabase.from('xp_history').select('id, amount, source_type, source_id, description, user_id').eq('user_id', userId)
    ])

    // ⚠️ SAFETY: If speaking_logs table doesn't exist or query errors, DO NOT issue any
    // speaking penalties - we can't verify completion. Better to skip than falsely penalize.
    const speakingQueryFailed = !!speakingRes.error
    if (speakingQueryFailed) {
      console.warn('[AutoFail] speaking_logs query failed - skipping speaking penalty evaluation:', speakingRes.error?.message)
    }

    const loggedJournalDates = new Set((journalRes.data || []).map(j => j.date))
    const loggedSpeakingDates = new Set()

    ;(speakingRes.data || []).forEach(s => { if (s.date) loggedSpeakingDates.add(s.date) })
    ;(workSpeakingRes.data || []).forEach(w => { if (w.date) loggedSpeakingDates.add(w.date) })

    // LOCAL STORAGE IS AUTHORITATIVE: Always include localStorage speaking logs
    // This covers phone-logged sessions not yet synced to Supabase
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage)
      keys.forEach(k => {
        if (k.includes('speaking') || k.includes('work')) {
          try {
            const raw = localStorage.getItem(k)
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed)) {
                parsed.forEach(item => {
                  if (item.date && (item.topic || item.drive_link || item.type === 'speaking_practice' || (item.title && item.title.toLowerCase().includes('speaking')))) {
                    loggedSpeakingDates.add(item.date)
                  }
                })
              }
            }
          } catch (e) {}
        }
      })
    }

    // 3. PURGE ALL INVALID AND DUPLICATE PENALTIES from xp_history
    const allXpEntries = xpHistoryRes.data || []
    const purgeIds = []
    const seenPenaltyDates = new Set()

    for (const item of allXpEntries) {
      const desc = (item.description || '').toLowerCase()
      const srcType = (item.source_type || '').toLowerCase()
      const srcId = (item.source_id || '').toLowerCase()

      const isProtocolEntry =
        desc.includes('3 am cutoff') ||
        desc.includes('speaking practice off-day') ||
        srcType.includes('journal_missed') ||
        srcType.includes('speaking_missed') ||
        srcType.includes('speaking_rest_day') ||
        srcId.includes('journal_missed') ||
        srcId.includes('speaking_missed') ||
        srcId.includes('speaking_rest_day')

      if (isProtocolEntry) {
        const textToSearch = `${item.description || ''} ${item.source_id || ''}`
        const dateMatch = textToSearch.match(/202\d-\d{2}-\d{2}/)
        
        if (dateMatch && dateMatch[0]) {
          const entryDateStr = dateMatch[0]

          // A. Delete any penalty dated prior to PROTOCOL_START_DATE
          if (entryDateStr < PROTOCOL_START_DATE) {
            purgeIds.push(item.id)
            continue
          }

          // B. Delete speaking penalties for dates where practice WAS ACTUALLY COMPLETED (e.g. 2026-08-10)
          if ((srcType.includes('speaking') || desc.includes('speaking')) && loggedSpeakingDates.has(entryDateStr)) {
            purgeIds.push(item.id)
            continue
          }

          // C. Delete journal penalties for dates where journal WAS ACTUALLY COMPLETED
          if ((srcType.includes('journal') || desc.includes('journal')) && loggedJournalDates.has(entryDateStr)) {
            purgeIds.push(item.id)
            continue
          }

          // D. Delete DUPLICATE penalty entries for the exact same date & type
          const penaltyKey = `${srcType}_${entryDateStr}`
          if (seenPenaltyDates.has(penaltyKey)) {
            purgeIds.push(item.id)
          } else {
            seenPenaltyDates.add(penaltyKey)
          }
        } else {
          purgeIds.push(item.id)
        }
      }
    }

    if (purgeIds.length > 0) {
      for (let i = 0; i < purgeIds.length; i += 50) {
        const batch = purgeIds.slice(i, i + 50)
        await supabase.from('xp_history').delete().in('id', batch)
      }

      // Recalculate true total_xp from remaining history entries after purging
      const { data: remaining } = await supabase
        .from('xp_history')
        .select('amount')
        .eq('user_id', userId)

      const trueTotalXp = (remaining || []).reduce((sum, r) => sum + (r.amount || 0), 0)

      await supabase
        .from('profiles')
        .update({ total_xp: Math.max(0, trueTotalXp) })
        .eq('id', userId)
    }

    // 4. Re-fetch current penalty keys to evaluate missing dates cleanly
    const { data: updatedXpHistory } = await supabase
      .from('xp_history')
      .select('source_type, source_id, description')
      .eq('user_id', userId)

    const activePenaltyKeys = new Set()
    (updatedXpHistory || []).forEach(x => {
      const text = `${x.source_type} ${x.source_id} ${x.description}`
      const match = text.match(/202\d-\d{2}-\d{2}/)
      if (match) {
        const dateStr = match[0]
        if (x.source_type?.includes('speaking') || x.description?.toLowerCase().includes('speaking')) {
          activePenaltyKeys.add(`speaking_missed_${dateStr}`)
        } else if (x.source_type?.includes('journal') || x.description?.toLowerCase().includes('journal')) {
          activePenaltyKeys.add(`journal_missed_${dateStr}`)
        }
      }
    })

    // 5. Evaluate evaluation window for truly unlogged missing dates
    const curr = new Date(startDateStr)
    const end = new Date(cutoffDateStr)

    while (curr <= end) {
      const dateStr = getLocalDateStr(curr)

      if (dateStr >= PROTOCOL_START_DATE) {
        // A. Journal Entry Check (-25 XP if unlogged past 3:00 AM)
        const journalKey = `journal_missed_${dateStr}`
        if (!loggedJournalDates.has(dateStr) && !activePenaltyKeys.has(journalKey)) {
          await robustAwardXP(
            userId,
            -25,
            'journal_missed',
            `journal_missed_${dateStr}`,
            `🚨 MISSED JOURNAL DEADLINE (3 AM Cutoff): Unlogged entry for ${dateStr}`,
            'discipline'
          )
          activePenaltyKeys.add(journalKey)
        }

        // B. Speaking Practice Check — SKIP entirely if speaking_logs table is missing/errored
        // Better to issue NO penalty than to falsely penalize a completed session
        if (!speakingQueryFailed) {
          const speakingRest = isSpeakingRestDay(dateStr)
          const speakingKey = `speaking_missed_${dateStr}`
          const restKey = `speaking_rest_day_${dateStr}`

          if (speakingRest) {
            if (!activePenaltyKeys.has(restKey) && !loggedSpeakingDates.has(dateStr)) {
              await robustAwardXP(
                userId,
                0,
                'speaking_rest_day',
                `speaking_rest_day_${dateStr}`,
                `☕ REST DAY: Speaking practice off-day (${dateStr})`,
                'discipline'
              )
              activePenaltyKeys.add(restKey)
            }
          } else if (!loggedSpeakingDates.has(dateStr) && !activePenaltyKeys.has(speakingKey)) {
            await robustAwardXP(
              userId,
              -25,
              'speaking_missed',
              `speaking_missed_${dateStr}`,
              `🚨 MISSED SPEAKING DEADLINE (3 AM Cutoff): Unlogged practice for ${dateStr}`,
              'discipline'
            )
            activePenaltyKeys.add(speakingKey)
          }
        }
      }

      curr.setDate(curr.getDate() + 1)
    }

    return true
  } catch (err) {
    console.error('Error evaluating protocol auto-fail:', err)
    return false
  } finally {
    isEvaluatingAutoFail = false
  }
}
