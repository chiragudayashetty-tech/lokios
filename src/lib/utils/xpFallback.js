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

  // Step 1: Find and remove ALL previous XP entries for this source_type
  if (sourceId) {
    try {
      let allOld = []
      
      // 1a: Try finding entries matching exact source_type + source_id
      try {
        const { data: exact, error: exactErr } = await supabase.from('xp_history')
          .select('id, amount')
          .eq('user_id', userId)
          .eq('source_type', sourceType)
          .eq('source_id', sourceId)
        if (!exactErr && exact) allOld.push(...exact)
      } catch (e) {
        // source_id column might not exist
      }
      
      // 1b: Also find legacy entries with NULL source_id for same source_type
      try {
        const { data: legacy, error: legacyErr } = await supabase.from('xp_history')
          .select('id, amount')
          .eq('user_id', userId)
          .eq('source_type', sourceType)
          .is('source_id', null)
        if (!legacyErr && legacy) allOld.push(...legacy)
      } catch (e) {
        // source_id column might not exist
      }

      // Deduplicate IDs
      const uniqueIds = Array.from(new Set(allOld.map(r => r.id)))
      const recordsToDelete = allOld.filter((r, idx) => allOld.findIndex(x => x.id === r.id) === idx)
      
      if (recordsToDelete.length > 0) {
        const oldXpTotal = recordsToDelete.reduce((sum, r) => sum + (r.amount || 0), 0)
        await supabase.from('xp_history').delete().in('id', uniqueIds)

        // Deduct old XP from profile
        if (oldXpTotal > 0) {
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
  
  const { data: allHistory } = await supabase.from('xp_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (!allHistory || allHistory.length === 0) return 0

  const seen = new Map() // key: "source_type|source_id" -> kept entry
  const toDelete = []
  let totalDeduction = 0

  for (const entry of allHistory) {
    // Only dedup entries that have a source_id (sleep dates, weight dates)
    if (!entry.source_id) continue
    
    const key = `${entry.source_type}|${entry.source_id}`
    if (seen.has(key)) {
      // This is a duplicate — mark for deletion
      toDelete.push(entry.id)
      totalDeduction += entry.amount || 0
    } else {
      seen.set(key, entry)
    }
  }

  if (toDelete.length > 0) {
    // Delete duplicates in batches of 50
    for (let i = 0; i < toDelete.length; i += 50) {
      const batch = toDelete.slice(i, i + 50)
      await supabase.from('xp_history').delete().in('id', batch)
    }

    // Deduct the duplicate XP from profile
    if (totalDeduction > 0) {
      const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
      if (prof) {
        await supabase.from('profiles').update({
          total_xp: Math.max(0, (prof.total_xp || 0) - totalDeduction)
        }).eq('id', userId)
      }
    }
  }

  return toDelete.length
}

export async function robustRemoveXP(userId, sourceType, sourceId, fixedAmount = null, description = null) {
  const supabase = createClient()
  if (!userId) return false

  let totalDeduction = 0

  // Step 1: Look for matching xp_history entries for sourceType + sourceId
  if (sourceType || sourceId) {
    try {
      let query = supabase.from('xp_history').select('id, amount').eq('user_id', userId)
      if (sourceType) query = query.eq('source_type', sourceType)
      if (sourceId) query = query.eq('source_id', sourceId)

      const { data: items } = await query
      if (items && items.length > 0) {
        totalDeduction = items.reduce((sum, r) => sum + (r.amount || 0), 0)
        const ids = items.map(r => r.id)
        await supabase.from('xp_history').delete().in('id', ids)
      }
    } catch (err) {
      console.warn('Failed to query xp_history during remove:', err)
    }
  }

  // Step 2: Fallback to fixedAmount if no xp_history records were deleted
  if (totalDeduction === 0 && fixedAmount) {
    totalDeduction = Math.abs(fixedAmount)
  }

  // Step 3: Deduct totalDeduction from profiles.total_xp
  if (totalDeduction > 0) {
    try {
      const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
      if (prof) {
        const newTotal = Math.max(0, (prof.total_xp || 0) - totalDeduction)
        await supabase.from('profiles').update({ total_xp: newTotal }).eq('id', userId)
      }
    } catch (e) {
      console.error('Failed to deduct profile XP:', e)
    }
  }

  return true
}
