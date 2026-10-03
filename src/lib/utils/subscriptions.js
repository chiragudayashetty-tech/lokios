// Subscription autopilot (#25): on the billing date the charge is logged to
// budget_logs automatically (excluded from the daily allowance, counted in the
// monthly bills limit). Each charge has a deterministic id + a [SUB:id:date]
// marker, so it is logged exactly once even with several devices.

import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { isMissingSchema } from '@/lib/utils/schema'
import { emitGame } from '@/lib/utils/gamification'
import { formatMoney } from '@/lib/utils/money'

export const CYCLES = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }

/** Next charge date after `dateStr` for a cycle (monthly keeps the billing day, clamped to month length). */
export function advanceDate(dateStr, cycle, billingDay) {
  const d = new Date(`${dateStr}T12:00:00`)
  if (cycle === 'weekly') { d.setDate(d.getDate() + 7); return getLocalDateStr(d) }
  if (cycle === 'yearly') { d.setFullYear(d.getFullYear() + 1); return getLocalDateStr(d) }
  const day = billingDay || d.getDate()
  const y = d.getFullYear(), m = d.getMonth() + 1
  const last = new Date(y, m + 1, 0).getDate()
  return getLocalDateStr(new Date(y, m, Math.min(day, last), 12))
}

/** Monthly-equivalent cost of a subscription. */
export function monthlyCost(sub) {
  const a = Number(sub.amount) || 0
  if (sub.cycle === 'weekly') return (a * 52) / 12
  if (sub.cycle === 'yearly') return a / 12
  return a
}

export const chargeMarker = (subId, date) => `[SUB:${subId}:${date}]`

/** Deterministic uuid for one charge so a second device's insert conflicts instead of duplicating. */
export function chargeId(subId, date) {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  const s = `${subId}:${date}`
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 ^ s.charCodeAt(s.length - 1 - i), 2246822519) >>> 0
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + subId.replace(/-/g, '')).slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/**
 * Log every due charge (catching up on missed cycles) and advance next_charge_date.
 * Returns the list of logged charges. Silently does nothing before the migration.
 */
export async function runSubscriptionAutopilot(userId, today = getLocalDateStr()) {
  if (!userId) return []
  const sb = createClient()
  const { data: subs, error } = await sb.from('subscriptions').select('*').eq('user_id', userId).eq('active', true).lte('next_charge_date', today)
  if (error || !subs?.length) return []
  const logged = []
  for (const sub of subs) {
    let next = sub.next_charge_date
    let guard = 0
    while (next <= today && guard++ < 60) {
      const marker = chargeMarker(sub.id, next)
      const { data: existing } = await sb.from('budget_logs').select('id').eq('user_id', userId).like('description', `%${marker}%`).limit(1)
      if (!existing?.length) {
        const row = {
          id: chargeId(sub.id, next),
          user_id: userId,
          date: next,
          amount: Number(sub.amount),
          category: sub.category || 'subscriptions',
          description: `${sub.name} ${marker}`,
          exclude_daily: true,
          created_at: new Date().toISOString(),
        }
        let { error: insErr } = await sb.from('budget_logs').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
        if (insErr && isMissingSchema(insErr)) {
          const fallback = { ...row, description: `${row.description} [EXCLUDE_DAILY]` }
          delete fallback.exclude_daily
          ;({ error: insErr } = await sb.from('budget_logs').upsert(fallback, { onConflict: 'id', ignoreDuplicates: true }))
        }
        if (!insErr) logged.push({ sub, date: next })
      }
      next = advanceDate(next, sub.cycle, sub.billing_day)
    }
    await sb.from('subscriptions').update({ next_charge_date: next }).eq('id', sub.id)
  }
  for (const { sub } of logged.slice(-3)) {
    emitGame('toast', { icon: 'wallet', title: `${sub.name} ${formatMoney(sub.amount)} logged`, sub: 'Subscription autopilot · counted in monthly bills', tone: 'accent' })
  }
  return logged
}

/** Run the autopilot at most once per day per device. */
export async function runSubscriptionAutopilotDaily(userId) {
  const today = getLocalDateStr()
  const key = `lokios_subs_autopilot_${userId}`
  try { if (localStorage.getItem(key) === today) return [] } catch {}
  const res = await runSubscriptionAutopilot(userId, today)
  try { localStorage.setItem(key, today) } catch {}
  return res
}
