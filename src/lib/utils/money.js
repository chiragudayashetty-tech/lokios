import { getSettings } from '@/lib/settings'

/** ₹2,400 — currency symbol from Settings → Money (#45), Indian digit grouping. */
export function formatMoney(n, { decimals = 0, symbol } = {}) {
  const sym = symbol ?? (getSettings().currency || '₹')
  const v = Number(n) || 0
  const s = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return `${v < 0 ? '−' : ''}${sym}${s}`
}
