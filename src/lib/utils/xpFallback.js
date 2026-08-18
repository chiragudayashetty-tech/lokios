import { createClient } from '@/lib/supabase/client'

/**
 * Award XP with same-day deduplication.
 * 
 * For sleep/weight, sourceId = the date string (e.g. '2026-07-25').
 * If a previous XP entry exists for the same (user_id, source_type, source_id),
 * it is deleted and its amount deducted from profiles.total_xp BEFORE
 * the new entry is inserted. This ensures exactly 1 XP record per day per type.
 */
export async function robustAwardXP(userId, amount, sourceType, sourceId, description, statCategory = 'discipline') {
  const supabase = createClient()

  // Step 1: Find and remove previous XP entries ONLY for exact matching (source_type AND source_id)
  if (sourceId) {
    try {
      const { data: exact, error: exactErr } = await supabase.from('xp_history')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)

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

  // Step 2: Insert into xp_history with progressive fallbacks for missing schema columns
  const fullPayload = {
    user_id: userId,
    amount,
    source_type: sourceType,
    source_id: sourceId || null,
    description: description || null,
    stat_category: statCategory || 'discipline'
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
        total_xp: (prof.total_xp || 0) + amount
      }).eq('id', userId)
    }
  } catch (e) {
    console.error('Profile XP update failed:', e)
  }

  return true
}

/**
 * Clean up ALL duplicate XP entries for sleep and weight across all dates.
 * Keeps only the latest entry per (source_type, source_id) combo.
 */
export async function cleanupAllDuplicateXP(userId) {
  const supabase = createClient()
  if (!userId) return 0

  const { data: allHistory } = await supabase
    .from('xp_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!allHistory || allHistory.length === 0) return 0

  const PROTOCOL_START_DATE = '2026-08-09'
  const seenKeys = new Set()
  const toDeleteIds = []

  for (const entry of allHistory) {
    const desc = (entry.description || '').toLowerCase()
    const srcType = (entry.source_type || '').toLowerCase()
    const srcId = (entry.source_id || '').toLowerCase()

    // 1. Purge deprecated non-XP sources (speaking, journal, weight, sleep)
    const isDeprecatedSource =
      srcType === 'speaking_practice' ||
      srcType === 'journal_entry' ||
      srcType === 'journal_missed' ||
      srcType === 'speaking_missed' ||
      srcType === 'speaking_rest_day' ||
      srcType === 'weight_log' ||
      srcType === 'weight' ||
      srcType === 'weight_milestone' ||
      srcType === 'weight_target' ||
      srcType === 'weight_maintain' ||
      srcType === 'sleep' ||
      srcType === 'weekly_review' ||
      desc.includes('speaking practice') ||
      desc.includes('journal entry') ||
      desc.includes('daily sleep') ||
      desc.includes('daily weight') ||
      desc.includes('weekly review')

    if (isDeprecatedSource) {
      toDeleteIds.push(entry.id)
      continue
    }

    let key = null

    if (entry.source_id) {
      key = `${entry.source_type}|${entry.source_id}`
    } else if (entry.description) {
      const dateStr = entry.created_at ? entry.created_at.substring(0, 10) : ''
      const cleanDesc = entry.description.trim().toLowerCase()
      key = `${entry.source_type}|${cleanDesc}|${dateStr}`
    }

    if (key) {
      if (seenKeys.has(key)) {
        toDeleteIds.push(entry.id)
      } else {
        seenKeys.add(key)
      }
    }
  }

  if (toDeleteIds.length > 0) {
    for (let i = 0; i < toDeleteIds.length; i += 50) {
      const batch = toDeleteIds.slice(i, i + 50)
      await supabase.from('xp_history').delete().in('id', batch)
    }

    // Recalculate true total_xp from remaining unique history entries
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

  return toDeleteIds.length
}

export async function robustRemoveXP(userId, sourceType, sourceId, fixedAmount = null, description = null) {
  const supabase = createClient()
  if (!userId) return false

  let deductionAmount = 0
  let prevDesc = ''
  let prevStatCat = 'discipline'

  // Step 1: Look for matching xp_history entries for sourceType + sourceId to find granted XP & details
  if (sourceType || sourceId) {
    try {
      let query = supabase.from('xp_history').select('id, amount, description, stat_category').eq('user_id', userId)
      if (sourceType) query = query.eq('source_type', sourceType)
      if (sourceId) query = query.eq('source_id', sourceId)

      const { data: items } = await query
      if (items && items.length > 0) {
        // Calculate net positive XP granted for this source
        const positiveItems = items.filter(r => (r.amount || 0) > 0)
        if (positiveItems.length > 0) {
          deductionAmount = positiveItems.reduce((sum, r) => sum + r.amount, 0)
          prevDesc = positiveItems[0].description || ''
          prevStatCat = positiveItems[0].stat_category || 'discipline'
        }
      }
    } catch (err) {
      console.warn('Failed to query xp_history during remove:', err)
    }
  }

  // Step 2: Fallback to fixedAmount if no previous positive xp_history record was found
  if (deductionAmount === 0 && fixedAmount) {
    deductionAmount = Math.abs(fixedAmount)
  }

  // Step 3: Record negative XP deduction in xp_history for complete minute-to-minute audit log
  if (deductionAmount > 0) {
    const finalNegativeAmount = -Math.abs(deductionAmount)
    const logDesc = description || (prevDesc ? `↩ Action Reversed: ${prevDesc}` : `↩ Action Reversed: ${sourceType || 'XP Deduction'}`)

    try {
      const deductionPayload = {
        user_id: userId,
        amount: finalNegativeAmount,
        source_type: sourceType ? `${sourceType}_reversed` : 'xp_deduction',
        source_id: sourceId || null,
        description: logDesc,
        stat_category: prevStatCat,
        created_at: new Date().toISOString()
      }

      const { error: insertErr } = await supabase.from('xp_history').insert(deductionPayload)

      if (insertErr) {
        console.warn('Full deduction payload insert failed, retrying minimal payload:', insertErr.message || insertErr)
        const minimalPayload = {
          user_id: userId,
          amount: finalNegativeAmount,
          source_type: sourceType ? `${sourceType}_reversed` : 'xp_deduction',
          description: logDesc,
          created_at: new Date().toISOString()
        }
        await supabase.from('xp_history').insert(minimalPayload)
      }
    } catch (logErr) {
      console.error('Failed to log XP deduction entry:', logErr)
    }

    // Step 4: Update profiles.total_xp subtractively so total XP reflects net balance
    try {
      const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
      if (prof) {
        const newTotal = Math.max(0, (prof.total_xp || 0) + finalNegativeAmount)
        await supabase.from('profiles').update({ total_xp: newTotal }).eq('id', userId)
      }
    } catch (e) {
      console.error('Failed to update profile total_xp during deduction:', e)
    }
  }

  return true
}
