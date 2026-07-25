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

  // Step 1: Find and remove ALL previous XP entries for this source_type + source_id
  if (sourceId) {
    try {
      const { data: existing, error: findErr } = await supabase.from('xp_history')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
      
      if (!findErr && existing && existing.length > 0) {
        const oldXpTotal = existing.reduce((sum, r) => sum + (r.amount || 0), 0)
        const ids = existing.map(r => r.id)
        
        // Delete old records
        await supabase.from('xp_history').delete().in('id', ids)

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

  // Step 2: Insert exactly one new XP entry (skip RPC to avoid double-insert)
  const payload = {
    user_id: userId,
    amount,
    source_type: sourceType,
    source_id: sourceId || null,
    description: description || null,
  }

  // Try with stat_category first
  let { error: insertErr } = await supabase.from('xp_history').insert({
    ...payload,
    stat_category: statCategory || 'discipline'
  })

  // If stat_category column doesn't exist, retry without it
  if (insertErr && insertErr.message && insertErr.message.includes('stat_category')) {
    const { error: retry } = await supabase.from('xp_history').insert(payload)
    insertErr = retry
  }

  if (insertErr) {
    console.error('XP insert failed:', insertErr)
    return false
  }

  // Step 3: Add to profiles.total_xp
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

export async function robustRemoveXP(userId, sourceType, sourceId) {
  const supabase = createClient()
  
  const { data: items } = await supabase.from('xp_history')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)

  if (!items || items.length === 0) return true

  const totalDeduction = items.reduce((sum, r) => sum + (r.amount || 0), 0)
  const ids = items.map(r => r.id)

  await supabase.from('xp_history').delete().in('id', ids)

  if (totalDeduction > 0) {
    try {
      const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
      if (prof) {
        await supabase.from('profiles').update({
          total_xp: Math.max(0, (prof.total_xp || 0) - totalDeduction)
        }).eq('id', userId)
      }
    } catch (e) {
      console.error('Failed to deduct profile XP:', e)
    }
  }

  return true
}
