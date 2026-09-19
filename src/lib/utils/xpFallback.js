import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { calculateLevel, getRankForXp } from '@/lib/utils/xp'

/**
 * Award XP with entity-level deduplication.
 * 
 * For habits, sourceId = `habit_${habitId}_${targetDate}` (e.g. `habit_abc123_2026-08-22`).
 * If a previous XP entry exists for the same source_id (or same user_id, source_type, source_id),
 * it is deleted and its amount deducted from profiles.total_xp BEFORE
 * the new entry is inserted. This ensures exactly 1 XP record per habit per day.
 */
export async function robustAwardXP(
  userId,
  amount,
  sourceType,
  sourceId,
  description,
  statCategory = 'discipline',
  customCreatedAt = null
) {
  const supabase = createClient()
  if (!userId) return false

  // Step 1: Find and remove previous XP entries for this exact entity / action
  if (sourceId) {
    try {
      let query = supabase.from('xp_history')
        .select('id, amount')
        .eq('user_id', userId)

      // If sourceId is entity-specific (starts with habit_, task_, goal_, debrief_, daily_all_, streak_), match by source_id
      if (
        sourceId.startsWith('habit_') ||
        sourceId.startsWith('task_') ||
        sourceId.startsWith('goal_') ||
        sourceId.startsWith('debrief_') ||
        sourceId.startsWith('daily_all_') ||
        sourceId.startsWith('streak_') ||
        sourceId.startsWith('screen_time_')
      ) {
        query = query.eq('source_id', sourceId)
      } else if (sourceType) {
        query = query.eq('source_type', sourceType).eq('source_id', sourceId)
      } else {
        query = query.eq('source_id', sourceId)
      }

      const { data: exact, error: exactErr } = await query

      if (!exactErr && exact && exact.length > 0) {
        const uniqueIds = exact.map(r => r.id)
        const oldXpTotal = exact.reduce((sum, r) => sum + (r.amount || 0), 0)
        await supabase.from('xp_history').delete().in('id', uniqueIds)

        // Deduct old XP from profile before adding new amount
        if (oldXpTotal !== 0) {
          const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
          if (prof) {
            await supabase.from('profiles').update({
              total_xp: Math.max(0, (prof.total_xp || 0) - oldXpTotal)
            }).eq('id', userId)
          }
        }
      }
    } catch (err) {
      console.warn('XP cleanup failed (non-fatal):', err)
    }
  }

  // Determine created_at timestamp:
  // If customCreatedAt is provided, use it.
  // Else if sourceId contains a date (e.g. habit_<id>_YYYY-MM-DD), anchor to that date!
  let entryCreatedAt = customCreatedAt
  if (!entryCreatedAt && sourceId) {
    const match = sourceId.match(/(\d{4}-\d{2}-\d{2})/)
    if (match && match[1]) {
      const targetDateStr = match[1]
      const todayStr = getLocalDateStr(new Date())
      if (targetDateStr === todayStr) {
        entryCreatedAt = new Date().toISOString()
      } else {
        entryCreatedAt = `${targetDateStr}T12:00:00.000Z`
      }
    }
  }
  if (!entryCreatedAt) {
    entryCreatedAt = new Date().toISOString()
  }

  // Step 2: Insert into xp_history with progressive fallbacks for missing schema columns
  const fullPayload = {
    user_id: userId,
    amount,
    source_type: sourceType,
    source_id: sourceId || null,
    description: description || null,
    stat_category: statCategory || 'discipline',
    created_at: entryCreatedAt
  }

  let { error: insertErr } = await supabase.from('xp_history').insert(fullPayload)

  if (insertErr) {
    console.warn('Full payload XP insert failed, retrying without stat_category:', insertErr.message || insertErr)
    const payloadNoCat = { ...fullPayload }
    delete payloadNoCat.stat_category
    let { error: err2 } = await supabase.from('xp_history').insert(payloadNoCat)
    
    if (err2) {
      console.warn('Insert without stat_category failed, retrying minimal payload without source_id:', err2.message || err2)
      const payloadMinimal = { ...payloadNoCat }
      delete payloadMinimal.source_id
      let { error: err3 } = await supabase.from('xp_history').insert(payloadMinimal)
      if (err3) {
        console.error('All xp_history insert fallbacks failed:', err3.message || err3)
      }
    }
  }

  // Step 3: ALWAYS update profiles.total_xp so XP is NEVER lost!
  try {
    const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
    if (prof) {
      await supabase.from('profiles').update({
        total_xp: Math.max(0, (prof.total_xp || 0) + amount)
      }).eq('id', userId)
    }
  } catch (e) {
    console.error('Profile XP update failed:', e)
  }

  return true
}

/**
 * Remove an action's XP cleanly by deleting the original entry rather than polluting the timeline with duplicate reversal rows.
 */
export async function robustRemoveXP(userId, sourceType, sourceId, fixedAmount = null, description = null) {
  const supabase = createClient()
  if (!userId) return false

  let deductionAmount = 0
  let matchedIds = []

  // Step 1: Look for matching xp_history entries for sourceId or sourceType
  if (sourceId || sourceType) {
    try {
      let query = supabase.from('xp_history').select('id, amount, description, stat_category').eq('user_id', userId)
      if (sourceId) {
        query = query.eq('source_id', sourceId)
      } else if (sourceType) {
        query = query.eq('source_type', sourceType)
      }

      const { data: items } = await query
      if (items && items.length > 0) {
        matchedIds = items.map(r => r.id)
        deductionAmount = items.reduce((sum, r) => sum + (r.amount || 0), 0)
      }
    } catch (err) {
      console.warn('Failed to query xp_history during remove:', err)
    }
  }

  // Step 2: If previous matching entries exist, delete them and adjust profile total_xp!
  if (matchedIds.length > 0) {
    try {
      await supabase.from('xp_history').delete().in('id', matchedIds)
      if (deductionAmount !== 0) {
        const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
        if (prof) {
          await supabase.from('profiles').update({
            total_xp: Math.max(0, (prof.total_xp || 0) - deductionAmount)
          }).eq('id', userId)
        }
      }
      return true
    } catch (delErr) {
      console.error('Failed to delete xp_history entries during remove:', delErr)
    }
  }

  // Step 3: Fallback if no prior record was found to delete, and fixedAmount provided
  if (deductionAmount === 0 && fixedAmount) {
    const finalNegativeAmount = -Math.abs(fixedAmount)
    const logDesc = description || `↩ Action Reversed: ${sourceType || 'XP Deduction'}`

    try {
      await supabase.from('xp_history').insert({
        user_id: userId,
        amount: finalNegativeAmount,
        source_type: sourceType ? `${sourceType}_reversed` : 'xp_deduction',
        source_id: sourceId || null,
        description: logDesc,
        created_at: new Date().toISOString()
      })
      const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
      if (prof) {
        await supabase.from('profiles').update({ total_xp: Math.max(0, (prof.total_xp || 0) + finalNegativeAmount) }).eq('id', userId)
      }
    } catch (e) {
      console.error('Failed to update profile total_xp during deduction:', e)
    }
  }

  return true
}

/**
 * Clean up ALL true duplicate entries across habits, tasks, and daily records.
 * Keeps exactly 1 valid record per unique activity/day without fabricating or altering XP.
 * Recalculates the profile's honest ground-truth total_xp and actual mathematical level.
 */
export async function cleanupAllDuplicateXP(userId) {
  const supabase = createClient()
  if (!userId) return { cleanedCount: 0, totalXp: 0, level: 1 }

  try {
    const [historyRes, habitLogsRes, habitsRes] = await Promise.all([
      supabase.from('xp_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10000),
      supabase.from('habit_logs').select('id, habit_id, date, status').eq('user_id', userId).order('date', { ascending: false }).limit(10000),
      supabase.from('habits').select('id, title, xp_per_completion').eq('user_id', userId)
    ])

    const allHistory = historyRes.data || []
    if (allHistory.length === 0) return { cleanedCount: 0, totalXp: 0, level: 1 }

    const realHabitLogs = habitLogsRes.data || []
    const allHabits = habitsRes.data || []

    // Fast lookup maps for habits
    const realHabitMap = new Map()
    const logIdToHabitDate = new Map()
    realHabitLogs.forEach(l => {
      realHabitMap.set(`${l.habit_id}_${l.date}`, l.status || 'completed')
      if (l.id) logIdToHabitDate.set(l.id, `${l.habit_id}_${l.date}`)
    })

    const habitTitleToId = new Map()
    allHabits.forEach(h => {
      if (h.title) habitTitleToId.set(h.title.trim().toLowerCase(), h.id)
    })

    // Sets to track seen unique keys
    const seenHabitDays = new Set()
    const seenScreenTimeDates = new Set()
    const seenDailyAllDates = new Set()
    const seenTaskIds = new Set()
    const seenGoalIds = new Set()
    const seenStreakMilestones = new Set()
    const seenGeneralKeys = new Set()

    const toDeleteIds = []

    for (const entry of allHistory) {
      const desc = (entry.description || '').toLowerCase()
      const srcType = (entry.source_type || '').toLowerCase()
      const srcId = (entry.source_id || '')

      // 1. Purge action reversal markers that pollute history
      if (srcType.endsWith('_reversed') || desc.includes('action reversed')) {
        toDeleteIds.push(entry.id)
        continue
      }

      // 2. Any protocol auto-fail penalties prior to protocol start date ('2026-08-09')
      const isProtocolPenalty =
        srcType.includes('journal_missed') ||
        srcType.includes('speaking_missed') ||
        srcType.includes('speaking_rest_day') ||
        desc.includes('3 am cutoff') ||
        desc.includes('speaking practice off-day')

      if (isProtocolPenalty) {
        const textToSearch = `${entry.description || ''} ${entry.source_id || ''}`
        const dateMatch = textToSearch.match(/202\d-\d{2}-\d{2}/)
        if (dateMatch && dateMatch[0]) {
          if (dateMatch[0] < '2026-08-09') {
            toDeleteIds.push(entry.id)
            continue
          }
        }
      }

      // 3. Screen Time deduplication (KEEP 1 per date, purge duplicate saves)
      const isScreenTimeEntry =
        srcType === 'screen_time' ||
        srcId.startsWith('screen_time_') ||
        desc.includes('screen time') ||
        desc.includes('screen intel')

      if (isScreenTimeEntry) {
        let dateStr = null
        const dateMatch = `${srcId} ${entry.description || ''}`.match(/202\d-\d{2}-\d{2}/)
        if (dateMatch) dateStr = dateMatch[0]
        else if (entry.created_at) dateStr = getLocalDateStr(new Date(entry.created_at))

        if (dateStr) {
          if (seenScreenTimeDates.has(dateStr)) {
            toDeleteIds.push(entry.id)
          } else {
            seenScreenTimeDates.add(dateStr)
          }
          continue
        }
      }

      // 4. 100% Daily All Habits Bonus (KEEP 1 per date)
      if (srcType === 'daily_all_complete' || srcId.startsWith('daily_all_')) {
        let dateStr = null
        const dateMatch = `${srcId} ${entry.description || ''}`.match(/202\d-\d{2}-\d{2}/)
        if (dateMatch) dateStr = dateMatch[0]
        else if (entry.created_at) dateStr = getLocalDateStr(new Date(entry.created_at))

        if (dateStr) {
          if (seenDailyAllDates.has(dateStr)) {
            toDeleteIds.push(entry.id)
          } else {
            seenDailyAllDates.add(dateStr)
          }
          continue
        }
      }

      // 5. Streak Milestones (KEEP 1 per milestone)
      if (srcType === 'streak_milestone' || srcId.startsWith('streak_')) {
        const mKey = srcId || desc
        if (seenStreakMilestones.has(mKey)) {
          toDeleteIds.push(entry.id)
        } else {
          seenStreakMilestones.add(mKey)
        }
        continue
      }

      // 6. Habit XP deduplication against habit_logs ground truth
      const isHabitEntry =
        srcType.startsWith('habit_') ||
        srcId.startsWith('habit_') ||
        desc.includes('routine:') ||
        desc.includes('missed routine') ||
        desc.includes('failed routine') ||
        desc.includes('completed routine')

      if (isHabitEntry) {
        let habitId = null
        let dateStr = null

        if (srcId.startsWith('habit_')) {
          const parts = srcId.split('_')
          if (parts.length >= 3) {
            dateStr = parts[parts.length - 1]
            habitId = parts.slice(1, parts.length - 1).join('_')
          }
        }

        if (!habitId && logIdToHabitDate.has(srcId)) {
          const pair = logIdToHabitDate.get(srcId).split('_')
          habitId = pair[0]
          dateStr = pair[1]
        }

        if (!dateStr && entry.created_at) {
          dateStr = getLocalDateStr(new Date(entry.created_at))
        }

        if (!habitId) {
          for (const [title, hId] of habitTitleToId.entries()) {
            if (desc.includes(title)) {
              habitId = hId
              break
            }
          }
        }

        if (habitId && dateStr) {
          const habitDateKey = `${habitId}_${dateStr}`
          const realStatus = realHabitMap.get(habitDateKey)

          if (realStatus === 'none' || realStatus === 'blocked') {
            toDeleteIds.push(entry.id)
          } else if (realStatus === 'completed' || (!realStatus && entry.amount > 0)) {
            if (!seenHabitDays.has(habitDateKey) && entry.amount > 0) {
              seenHabitDays.add(habitDateKey)
            } else {
              toDeleteIds.push(entry.id)
            }
          } else if (realStatus === 'failed' || (!realStatus && entry.amount < 0)) {
            if (!seenHabitDays.has(habitDateKey) && entry.amount < 0) {
              seenHabitDays.add(habitDateKey)
            } else {
              toDeleteIds.push(entry.id)
            }
          }
          continue
        }
      }

      // 7. Task deduplication (KEEP 1 per task ID)
      if (srcType === 'task_complete' || srcType === 'task_failed') {
        const rawTaskId = srcId.replace(/^task_/, '')
        if (rawTaskId) {
          if (seenTaskIds.has(rawTaskId)) {
            toDeleteIds.push(entry.id)
          } else {
            seenTaskIds.add(rawTaskId)
          }
          continue
        }
      }

      // 8. Goal deduplication (KEEP 1 per goal ID)
      if (srcType === 'goal_complete' || srcType === 'goal_failed') {
        const rawGoalId = srcId.replace(/^goal_/, '')
        if (rawGoalId) {
          if (seenGoalIds.has(rawGoalId)) {
            toDeleteIds.push(entry.id)
          } else {
            seenGoalIds.add(rawGoalId)
          }
          continue
        }
      }

      // 9. General composite key deduplication
      let key = null
      if (entry.source_id) {
        key = `${entry.source_type}|${entry.source_id}`
      }

      if (key) {
        if (seenGeneralKeys.has(key)) {
          toDeleteIds.push(entry.id)
        } else {
          seenGeneralKeys.add(key)
        }
      }
    }

    // Delete verified duplicate IDs
    if (toDeleteIds.length > 0) {
      for (let i = 0; i < toDeleteIds.length; i += 50) {
        const batch = toDeleteIds.slice(i, i + 50)
        await supabase.from('xp_history').delete().in('id', batch)
      }
    }

    // Recalculate true total_xp from remaining unique history entries
    const { data: finalHistory } = await supabase
      .from('xp_history')
      .select('amount')
      .eq('user_id', userId)

    const trueTotalXp = (finalHistory || []).reduce((sum, r) => sum + (r.amount || 0), 0)
    const safeXp = Math.max(0, trueTotalXp)
    const newLevel = calculateLevel(safeXp)
    const newRank = getRankForXp(safeXp).code

    try {
      await supabase
        .from('profiles')
        .update({
          total_xp: safeXp,
          current_level: newLevel,
          current_rank: newRank
        })
        .eq('id', userId)
    } catch (profErr) {
      await supabase
        .from('profiles')
        .update({ total_xp: safeXp })
        .eq('id', userId)
    }

    return {
      cleanedCount: toDeleteIds.length,
      totalXp: safeXp,
      level: newLevel
    }
  } catch (err) {
    console.error('Error during cleanupAllDuplicateXP:', err)
    return { cleanedCount: 0, totalXp: 0, level: 1 }
  }
}
