import { createClient } from '@/lib/supabase/client'

/**
 * Award XP with same-day deduplication.
 * 
 * For sleep/weight, sourceId = the date string (e.g. '2026-07-25').
 * If a previous XP entry exists for the same (user_id, source_type, source_id),
 * it is deleted and its amount deducted from profiles.total_xp BEFORE
 * the new entry is inserted. This ensures exactly 1 XP record per day per type.
 * 
 * We skip the award_xp RPC entirely because it both inserts into xp_history
 * AND increments profiles.total_xp, making deduplication impossible.
 */
export async function robustAwardXP(userId, amount, sourceType, sourceId, description, statCategory = 'discipline') {
  const supabase = createClient()

  // Step 1: Delete ALL previous XP entries for this exact source_type + source_id combo
  if (sourceId) {
    try {
      const { data: existing } = await supabase.from('xp_history')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
      
      if (existing && existing.length > 0) {
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

  // Step 2: Insert the single new XP entry
  try {
    const payload = {
      user_id: userId,
      amount,
      source_type: sourceType,
      source_id: sourceId || null,
      description: description || null,
    }

    // Try with stat_category first
    const { error: insertErr } = await supabase.from('xp_history').insert({
      ...payload,
      stat_category: statCategory || 'discipline'
    })

    // If stat_category column doesn't exist, retry without it
    if (insertErr && insertErr.message && insertErr.message.includes('stat_category')) {
      await supabase.from('xp_history').insert(payload)
    }
  } catch (e) {
    console.error('Failed to insert xp_history:', e)
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
    console.error('Failed to update profile total_xp:', e)
  }

  return true
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
