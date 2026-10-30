// Saving one day's screen time: the log row (one per date), its XP and the
// Phone Addiction battle. Shared by the Screen time page and the Claude connector.
import { createClient } from '@/lib/supabase/client'
import { calculateScreenTimeXP, syncScreenTimeXP } from '@/lib/utils/screenTimeXP'
import { isMissingSchema } from '@/lib/utils/schema'

/** Phone Addiction battle: each metric over its limit heals the enemy, under it deals damage. */
async function updatePhoneBattle(supabase, userId, { total, doom, streaming }) {
  let hpChange = 0
  hpChange += total <= 6 ? -5 : 10
  hpChange += doom <= 60 ? -5 : 10
  hpChange += streaming <= 2 ? -5 : 10
  const { data: bp } = await supabase.from('user_blueprints').select('*').eq('user_id', userId).single()
  if (!bp?.battles) return ''
  let note = ''
  let changed = false
  const battles = bp.battles.map((battle) => {
    const name = battle.name?.toLowerCase() || ''
    if (battle.status === 'defeated' || !(name.includes('phone') || name.includes('screen') || name.includes('addiction'))) return battle
    changed = true
    const oldHp = battle.hp ?? 100
    const hp = Math.max(0, Math.min(100, oldHp + hpChange))
    if (hp === 0 && oldHp > 0) note = ' · Phone war won'
    else note = hpChange < 0 ? ` · ${hpChange} enemy HP` : ` · +${hpChange} enemy heal`
    return { ...battle, hp, status: hp === 0 ? 'defeated' : battle.status }
  })
  if (changed) await supabase.from('user_blueprints').update({ battles }).eq('id', bp.id)
  return note
}

/** categories = minutes per SCREEN_CATEGORIES id. Returns { data, xp, reason, note } or { error }. */
export async function saveScreenTimeAction({ userId, date, total_hours = 0, focus_hours = 0, doom_scroll_minutes = 0, streaming_hours = 0, notes = '', categories = {}, catsMissing = false }) {
  const supabase = createClient()
  const cats = Object.fromEntries(Object.entries(categories || {}).filter(([, v]) => v > 0))
  const payload = { user_id: userId, date, total_hours, focus_hours, doom_scroll_minutes, streaming_hours, notes }
  const full = catsMissing ? payload : { ...payload, categories: Object.keys(cats).length ? cats : null }

  const { data: existing } = await supabase.from('screen_time_logs').select('id').eq('user_id', userId).eq('date', date).maybeSingle()
  const write = (row) => (existing
    ? supabase.from('screen_time_logs').update(row).eq('id', existing.id).select().single()
    : supabase.from('screen_time_logs').insert(row).select().single())
  let res = await write(full)
  if (res.error && full !== payload && isMissingSchema(res.error)) res = await write(payload)
  if (res.error) return { error: res.error }
  const savedId = res.data?.id || existing?.id

  const { xpAmount, finalReason } = calculateScreenTimeXP(payload)
  const note = await updatePhoneBattle(supabase, userId, { total: total_hours, doom: doom_scroll_minutes, streaming: streaming_hours })
  if (savedId) await syncScreenTimeXP(userId, { id: savedId, ...payload })
  return { data: res.data, xp: savedId ? xpAmount : 0, reason: finalReason, note }
}
