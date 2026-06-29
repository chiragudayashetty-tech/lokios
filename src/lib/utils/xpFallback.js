import { createClient } from '@/lib/supabase/client'

export async function robustAwardXP(userId, amount, sourceType, sourceId, description, statCategory = 'discipline') {
  const supabase = createClient()
  
  // Try RPC first
  const { error: rpcError } = await supabase.rpc('award_xp', {
    p_user_id: userId,
    p_amount: amount,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_description: description,
    p_stat_category: statCategory,
  })

  if (!rpcError) return true

  console.warn('award_xp RPC failed, falling back to client insert', rpcError)

  // Fallback: manual insert into xp_history
  const insertPayload = {
    user_id: userId,
    amount,
    source_type: sourceType,
    source_id: sourceId,
    description,
    stat_category: statCategory
  }
  
  const { error: insertErr } = await supabase.from('xp_history').insert(insertPayload)
  
  if (insertErr && insertErr.message && insertErr.message.includes('stat_category')) {
    console.warn('stat_category missing, retrying without it')
    delete insertPayload.stat_category
    await supabase.from('xp_history').insert(insertPayload)
  } else if (insertErr) {
    console.error('Failed to insert xp_history', insertErr)
  }

  // Fallback: manual update profiles with a local Mutex to prevent read-then-write race conditions
  await navigator.locks.request('xp_update_lock', async () => {
    const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
    if (prof) {
      await supabase.from('profiles').update({ total_xp: (prof.total_xp || 0) + amount }).eq('id', userId)
    }
  })
  
  return true
}

export async function robustRemoveXP(userId, sourceType, sourceId, targetDateStr) {
  const supabase = createClient()
  let query = supabase.from('xp_history')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)

  query = query.order('created_at', { ascending: false }).limit(1)

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
