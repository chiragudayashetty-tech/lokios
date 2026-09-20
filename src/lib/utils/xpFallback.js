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
 * Paginated fetch helper for xp_history to bypass PostgREST's default 1,000-row limit.
 * Fetches all matching rows across multiple pages of 1,000 until exhausted.
 */
export async function fetchAllXpHistory(supabase, userId, select = '*', orderAscending = false) {
  if (!supabase || !userId) return []
  const PAGE_SIZE = 1000
  let allRows = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('xp_history')
      .select(select)
      .eq('user_id', userId)
      .order('created_at', { ascending: orderAscending })
      .range(from, to)

    if (error) {
      console.error('Error in fetchAllXpHistory:', error)
      break
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < PAGE_SIZE) {
      hasMore = false
    } else {
      from += PAGE_SIZE
    }
  }

  return allRows
}

/**
 * Clean up ONLY true duplicate entries in xp_history.
 * If multiple records exist for the same exact action/source, keep the first one and remove the duplicate copies.
 * Never deletes single entries, penalties, or valid historical logs.
 * Recalculates profiles.total_xp strictly as the sum of all unique records without any 1,000-row truncation.
 */
export async function cleanupAllDuplicateXP(userId) {
  const supabase = createClient()
  if (!userId) return { cleanedCount: 0, totalXp: 0, level: 1 }

  try {
    // 1. Fetch ALL records across all pages to prevent 1,000-row PostgREST truncation
    const allHistory = await fetchAllXpHistory(supabase, userId, '*', false)

    if (!allHistory || allHistory.length === 0) {
      return { cleanedCount: 0, totalXp: 0, level: 1 }
    }

    const seenKeys = new Set()
    const toDeleteIds = []

    for (const entry of allHistory) {
      const srcType = (entry.source_type || '').toLowerCase().trim()
      const srcId = (entry.source_id || '').trim()
      const desc = (entry.description || '').toLowerCase().trim()

      let dedupKey = null

      // 1. If entry has source_id (e.g. habit_UUID_YYYY-MM-DD, task_UUID, goal_UUID, screen_time_YYYY-MM-DD, etc.)
      if (srcId) {
        if (
          srcId.startsWith('habit_') ||
          srcId.startsWith('task_') ||
          srcId.startsWith('goal_') ||
          srcId.startsWith('screen_time_') ||
          srcId.startsWith('daily_all_') ||
          srcId.startsWith('streak_') ||
          srcId.startsWith('speaking_') ||
          srcId.startsWith('journal_') ||
          srcId.startsWith('debrief_')
        ) {
          dedupKey = srcId
        } else {
          dedupKey = `${srcType}|${srcId}`
        }
      } 
      // 2. If no source_id, check for habit routine description with date
      else if (srcType.startsWith('habit') || desc.includes('routine:')) {
        const dateStr = entry.created_at ? getLocalDateStr(new Date(entry.created_at)) : null
        if (dateStr) {
          dedupKey = `${srcType}|${desc}|${dateStr}`
        }
      }
      // 3. General entries with description and date
      else if (desc && entry.created_at) {
        const dateStr = getLocalDateStr(new Date(entry.created_at))
        dedupKey = `${srcType}|${desc}|${dateStr}`
      }

      // If this exact action key was already encountered:
      if (dedupKey) {
        if (seenKeys.has(dedupKey)) {
          // DUPLICATE ENTRY: add to delete list
          toDeleteIds.push(entry.id)
        } else {
          // FIRST TIME SEEN: keep this record!
          seenKeys.add(dedupKey)
        }
      }
    }

    // Delete ONLY the verified duplicate rows
    if (toDeleteIds.length > 0) {
      for (let i = 0; i < toDeleteIds.length; i += 50) {
        const batch = toDeleteIds.slice(i, i + 50)
        await supabase.from('xp_history').delete().in('id', batch)
      }
    }

    // Recalculate true total_xp strictly from ALL remaining unique entries via pagination
    const remaining = await fetchAllXpHistory(supabase, userId, 'amount', false)

    const trueTotalXp = (remaining || []).reduce((sum, r) => sum + (r.amount || 0), 0)
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
