// Business expenses: categories, the shared save used by the page and the Claude
// connector, and month summaries. Separate from the personal budget.
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'

export const BIZ_CATEGORIES = [
  { id: 'marketing', label: 'Marketing & ads', color: '#3987e5' },
  { id: 'software', label: 'Software & AI tools', color: '#9085e9' },
  { id: 'production', label: 'Video & production', color: '#d55181' },
  { id: 'printing', label: 'Printing & materials', color: '#c98500' },
  { id: 'travel', label: 'Travel', color: '#199e70' },
  { id: 'venue', label: 'Venue & events', color: '#d95926' },
  { id: 'equipment', label: 'Equipment', color: '#5b8def' },
  { id: 'people', label: 'Freelancers & staff', color: '#e0a03a' },
  { id: 'legal', label: 'Legal, fees & compliance', color: '#7d8597' },
  { id: 'other', label: 'Other', color: '#5b5a73' },
]
export const PAYMENT_MODES = ['upi', 'card', 'cash', 'bank']
export const bizCategory = (id) => BIZ_CATEGORIES.find((c) => c.id === id) || BIZ_CATEGORIES[BIZ_CATEGORIES.length - 1]
export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export async function fetchBusinessExpenses(userId, sinceDate = null) {
  let q = createClient().from('business_expenses').select('*').eq('user_id', userId)
  if (sinceDate) q = q.gte('date', sinceDate)
  const { data, error } = await q.order('date', { ascending: false }).order('created_at', { ascending: false })
  return { rows: data || [], error }
}

/** Shared save (page + connector). Returns { data } or { error }. */
export async function addBusinessExpense(userId, e) {
  const row = {
    user_id: userId,
    date: e.date || getLocalDateStr(),
    amount: Number(parseFloat(e.amount).toFixed(2)),
    category: BIZ_CATEGORIES.some((c) => c.id === e.category) ? e.category : 'other',
    vendor: e.vendor?.trim() || null,
    description: e.description?.trim() || null,
    payment_mode: PAYMENT_MODES.includes(e.payment_mode) ? e.payment_mode : null,
    receipt_url: e.receipt_url?.trim() || null,
  }
  if (!(row.amount > 0)) return { error: { message: 'Amount must be more than 0' } }
  const { data, error } = await createClient().from('business_expenses').insert(row).select().single()
  return error ? { error } : { data }
}

export const deleteBusinessExpense = (userId, id) => createClient().from('business_expenses').delete().eq('id', id).eq('user_id', userId)

/** Totals for one month (YYYY-MM): total, per category (sorted), count. */
export function monthSummary(rows, month) {
  const inMonth = rows.filter((r) => String(r.date).startsWith(month))
  const byCat = new Map()
  for (const r of inMonth) byCat.set(r.category, (byCat.get(r.category) || 0) + Number(r.amount || 0))
  const total = [...byCat.values()].reduce((s, v) => s + v, 0)
  return { month, total, count: inMonth.length, rows: inMonth, byCategory: [...byCat.entries()].map(([id, amount]) => ({ ...bizCategory(id), amount })).sort((a, b) => b.amount - a.amount) }
}

export const monthKey = (d = new Date()) => getLocalDateStr(d).slice(0, 7)
export const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 15); return monthKey(d) }
export const monthLabel = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export function toCsv(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Date', 'Amount', 'Category', 'Vendor', 'Description', 'Payment', 'Receipt']
  return [head.join(','), ...rows.map((r) => [r.date, r.amount, bizCategory(r.category).label, r.vendor, r.description, r.payment_mode, r.receipt_url].map(esc).join(','))].join('\n')
}
