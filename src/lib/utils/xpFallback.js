import { createClient } from '@/lib/supabase/client'

export async function robustAwardXP(userId, amount, sourceType, sourceId, description, statCategory = 'discipline') {
  const supabase = createClient()

  // Clean up and replace any existing XP record for this specific date/source_id (e.g. overriding sleep or weight for same day)
  if (sourceId) {
    try {
      const { data: existing } = await supabase.from('xp_history')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
      
      if (existing && existing.length > 0) {
        const oldXpSum = existing.reduce((sum, item) => sum + (item.amount || 0), 0)
        const ids = existing.map(item => item.id)
        
        // Delete old XP records from xp_history
        await supabase.from('xp_history').delete().in('id', ids)

        // Deduct old XP from profile total_xp to avoid double-counting
        if (oldXpSum > 0) {
          const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
          if (prof) {
            await supabase.from('profiles').update({ total_xp: Math.max(0, (prof.total_xp || 0) - oldXpSum) }).eq('id', userId)
          }
        }
      }
    } catch (err) {
      console.warn('Failed to clean up old XP entry for override:', err)
    }
  }
  
  // Try RPC first
  const { error: rpcError } = await supabase.rpc('award_xp', {
    p_user_id: userId,
    p_amount: amount,
    p_source_type: sourceType,
    p_source_id: sourceId || null,
    p_description: description || null,
    p_stat_category: statCategory || 'discipline',
  })

  if (!rpcError) return true

  console.warn('award_xp RPC failed, falling back to client insert', rpcError)

  // Fallback: manual insert into xp_history
  try {
    const insertPayload = {
      user_id: userId,
      amount,
      source_type: sourceType,
      source_id: sourceId || null,
      description: description || null,
      stat_category: statCategory || 'discipline'
    }
    
    const { error: insertErr } = await supabase.from('xp_history').insert(insertPayload)
    if (insertErr && insertErr.message && insertErr.message.includes('stat_category')) {
      delete insertPayload.stat_category
      await supabase.from('xp_history').insert(insertPayload)
    }
  } catch (e) {
    console.error('Failed to insert xp_history', e)
  }

  // Fallback: manual update profiles without blocking navigator.locks deadlock on iOS
  try {
    const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
    if (prof) {
      await supabase.from('profiles').update({ total_xp: (prof.total_xp || 0) + amount }).eq('id', userId)
    }
  } catch (e) {
    console.error('Failed to update profile total_xp', e)
  }
  
  return true
}

export async function robustRemoveXP(userId, sourceType, sourceId, targetDateStr) {
  const supabase = createClient()
  let query = supabase.from('xp_history')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)

  const { data: historyItems } = await query

  if (!historyItems || historyItems.length === 0) return true

  let totalDeduction = 0
  for (const item of historyItems) {
    totalDeduction += item.amount
    await supabase.from('xp_history').delete().eq('id', item.id)
  }

  // Deduct from profile
  if (totalDeduction !== 0) {
    await navigator.locks.request('xp_update_lock', async () => {
      const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
      if (prof) {
        await supabase.from('profiles').update({ total_xp: Math.max(0, (prof.total_xp || 0) - totalDeduction) }).eq('id', userId)
      }
    })
  }

  return true
}
