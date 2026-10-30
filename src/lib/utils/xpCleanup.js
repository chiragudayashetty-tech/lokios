// One-time history clean-up (v1): take back XP that the current rules would not have paid,
// so weekly comparisons (ghost battle, reports, momentum) run on earned XP only.
//  • critical hits — removed for good
//  • brain dump: inbox zero + item-done XP — removed for good
//  • first win of the day logged at/after 10:00 — first win now needs an early start
//  • habit chain links / full chains that fail the 2 min – 2 h rule, or were backfilled
//  • streak milestones paid again inside the same milestone window (the moving-run-start bug)
// v3 (separate flag): retired games — estimate duel, ship-day pledge, lights-out bet, fuel tank — their XP is taken back.
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustRemoveXP, fetchAllXpHistory } from '@/lib/utils/xpFallback'
import { chainState } from '@/lib/utils/habitChains'
import { FIRST_WIN_BEFORE_HOUR } from '@/lib/utils/gamification'

const KEY = (uid) => `lokios_xp_cleanup_v1_${uid}`
const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }

let running = false

export async function cleanupLegacyXP(userId) {
  if (!userId || running) return 0
  try { if (localStorage.getItem(KEY(userId))) return 0 } catch {}
  running = true
  try {
    const sb = createClient()
    const rows = await fetchAllXpHistory(sb, userId, 'source_type, source_id, amount, created_at', true)
    const remove = []

    for (const r of rows) {
      const t = r.source_type
      if (t === 'critical_hit' || t === 'inbox_zero' || t === 'brain_dump') remove.push(r)
      else if (t === 'first_win' && new Date(r.created_at).getHours() >= FIRST_WIN_BEFORE_HOUR) remove.push(r)
    }

    // Chains: re-check every paid link against that day's real log times
    const chainRows = rows.filter((r) => r.source_type === 'habit_chain' || r.source_type === 'habit_chain_full')
    if (chainRows.length) {
      const [{ data: habits }, { data: logs }] = await Promise.all([
        sb.from('habits').select('*').eq('user_id', userId),
        sb.from('habit_logs').select('*').eq('user_id', userId).gte('date', addDays(getLocalDateStr(), -400)).limit(20000),
      ])
      const states = new Map()
      const stateFor = (ds) => { if (!states.has(ds)) states.set(ds, chainState(habits || [], (logs || []).filter((l) => l.date === ds), ds)); return states.get(ds) }
      for (const r of chainRows) {
        const sid = String(r.source_id || '')
        const ds = sid.slice(-10)
        const id = sid.replace(/^chain_full_/, '').replace(/^chain_/, '').slice(0, -11)
        const createdDay = getLocalDateStr(new Date(r.created_at))
        const st = stateFor(ds)
        const ok = createdDay === ds && (r.source_type === 'habit_chain' ? st.valid.has(id) : st.fullRoots.has(id))
        if (!ok) remove.push(r)
      }
    }

    // Streak milestones: keep the first award per window, drop the repeats
    const kept = []
    for (const r of rows.filter((x) => x.source_type === 'streak_milestone')) {
      const days = Number(String(r.source_id || '').split('_')[1]) || 0
      const date = getLocalDateStr(new Date(r.created_at))
      if (kept.some((k) => k.days === days && date < addDays(k.date, days))) remove.push(r)
      else kept.push({ days, date })
    }

    let total = 0
    for (const r of remove) {
      if (!r.source_id) continue
      const ok = await robustRemoveXP(userId, r.source_type, r.source_id)
      if (ok) total += Number(r.amount) || 0
    }
    try { localStorage.setItem(KEY(userId), JSON.stringify({ at: new Date().toISOString(), removed: remove.length, xp: total })) } catch {}
    return total
  } catch (e) {
    console.warn('XP clean-up skipped:', e)
    return 0
  } finally {
    running = false
  }
}

const KEY2 = (uid) => `lokios_xp_cleanup_v3_${uid}`
const RETIRED = new Set(['estimate_duel', 'ship_day', 'ship_push', 'lights_out', 'fuel_overdraft'])

/** Removes all XP from retired games. Runs once per device. */
export async function cleanupRetiredGamesXP(userId) {
  if (!userId) return 0
  try { if (localStorage.getItem(KEY2(userId))) return 0 } catch {}
  try {
    const rows = await fetchAllXpHistory(createClient(), userId, 'source_type, source_id, amount', true)
    let total = 0
    for (const r of rows.filter((x) => RETIRED.has(x.source_type) && x.source_id)) {
      if (await robustRemoveXP(userId, r.source_type, r.source_id)) total += Number(r.amount) || 0
    }
    try { localStorage.setItem(KEY2(userId), JSON.stringify({ at: new Date().toISOString(), xp: total })) } catch {}
    return total
  } catch (e) {
    console.warn('Retired-games XP clean-up skipped:', e)
    return 0
  }
}
