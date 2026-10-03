// Budget utilities, categories, and sync handlers
import { createClient } from '@/lib/supabase/client'
import { enqueue, isOffline, getQueue, registerOfflineHandler } from '@/lib/utils/offlineQueue'
import { getLocalDateStr } from '@/lib/utils/dates'

export const BUDGET_CATEGORIES = [
  {
    id: 'food',
    label: 'Food & Dining',
    shortLabel: 'Food',
    icon: 'Utensils',
    color: '#f59e0b', // amber
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    description: 'Meals, coffee, snacks, dining out',
    defaultExcludeDaily: false
  },
  {
    id: 'groceries',
    label: 'Groceries & Essentials',
    shortLabel: 'Groceries',
    icon: 'ShoppingCart',
    color: '#10b981', // emerald
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    description: 'Supermarket, provisions, vegetables, milk',
    defaultExcludeDaily: false
  },
  {
    id: 'transport',
    label: 'Transport & Commute',
    shortLabel: 'Transport',
    icon: 'Car',
    color: '#06b6d4', // cyan
    bgColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
    description: 'Metro, cab, fuel, bus, auto, parking',
    defaultExcludeDaily: false
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions & Bills',
    shortLabel: 'Bills & Subs',
    icon: 'CreditCard',
    color: '#8b5cf6', // purple
    bgColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    description: 'Wi-Fi, mobile, electricity, OTT, gym, rent, recurring subscriptions',
    defaultExcludeDaily: true // Excluded from daily allowance by default, counted in 10K monthly bills budget
  },
  {
    id: 'shopping',
    label: 'Shopping & Gear',
    shortLabel: 'Shopping',
    icon: 'ShoppingBag',
    color: '#ec4899', // pink
    bgColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: 'rgba(236, 72, 153, 0.35)',
    description: 'Clothes, electronics, accessories, gear',
    defaultExcludeDaily: false
  },
  {
    id: 'entertainment',
    label: 'Entertainment & Outings',
    shortLabel: 'Fun',
    icon: 'Film',
    color: '#f97316', // orange
    bgColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
    description: 'Movies, gaming, parties, leisure',
    defaultExcludeDaily: false
  },
  {
    id: 'health',
    label: 'Health & Fitness',
    shortLabel: 'Health',
    icon: 'HeartPulse',
    color: '#ef4444', // red
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    description: 'Supplements, medicine, doctor, clinic',
    defaultExcludeDaily: false
  },
  {
    id: 'learning',
    label: 'Learning & Books',
    shortLabel: 'Learning',
    icon: 'BookOpen',
    color: '#3b82f6', // blue
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    description: 'Courses, books, software tools',
    defaultExcludeDaily: false
  },
  {
    id: 'other',
    label: 'Other & Custom',
    shortLabel: 'Other',
    icon: 'MoreHorizontal',
    color: '#94a3b8', // slate
    bgColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    description: 'Miscellaneous or custom expenses',
    defaultExcludeDaily: false
  }
]

export const DEFAULT_DAILY_BUDGET = 1000
export const DEFAULT_MONTHLY_BILLS_BUDGET = 10000

export function getCategoryById(id) {
  if (id === 'utilities') {
    return BUDGET_CATEGORIES.find(c => c.id === 'subscriptions') || BUDGET_CATEGORIES[3]
  }
  return BUDGET_CATEGORIES.find(c => c.id === id) || BUDGET_CATEGORIES[BUDGET_CATEGORIES.length - 1]
}

/**
 * Checks whether an expense log is excluded from the daily budget allowance.
 * True for Subscriptions & Bills unless explicitly overridden by user.
 */
export function isExcludedFromDaily(log) {
  if (!log) return false
  if (typeof log.exclude_daily === 'boolean') {
    return log.exclude_daily
  }
  const customStr = (log.custom_category || '').toLowerCase()
  const descStr = (log.description || '').toLowerCase()
  if (customStr.includes('exclude_daily') || descStr.includes('[exclude_daily]')) {
    return true
  }
  if (customStr.includes('include_daily') || descStr.includes('[include_daily]')) {
    return false
  }
  // Default: subscriptions and legacy utilities are excluded from daily budget
  if (log.category === 'subscriptions' || log.category === 'utilities') {
    return true
  }
  return false
}

export function getLocalBudgetLogs(userId) {
  if (typeof window === 'undefined' || !userId) return []
  try {
    const raw = localStorage.getItem(`lokios_budget_logs_${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export function saveLocalBudgetLogs(userId, logs) {
  if (typeof window === 'undefined' || !userId) return
  try {
    localStorage.setItem(`lokios_budget_logs_${userId}`, JSON.stringify(logs))
  } catch (e) {}
}

export function getLocalDailyBudget(userId) {
  if (typeof window === 'undefined' || !userId) return DEFAULT_DAILY_BUDGET
  try {
    const val = localStorage.getItem(`lokios_daily_budget_limit_${userId}`)
    const parsed = parseFloat(val)
    return !isNaN(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_BUDGET
  } catch (e) {
    return DEFAULT_DAILY_BUDGET
  }
}

export function saveLocalDailyBudget(userId, amount) {
  if (typeof window === 'undefined' || !userId) return
  try {
    localStorage.setItem(`lokios_daily_budget_limit_${userId}`, String(amount))
  } catch (e) {}
}

export function getLocalMonthlyBillsBudget(userId) {
  if (typeof window === 'undefined' || !userId) return DEFAULT_MONTHLY_BILLS_BUDGET
  try {
    const val = localStorage.getItem(`lokios_monthly_bills_budget_${userId}`)
    const parsed = parseFloat(val)
    return !isNaN(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_BILLS_BUDGET
  } catch (e) {
    return DEFAULT_MONTHLY_BILLS_BUDGET
  }
}

export function saveLocalMonthlyBillsBudget(userId, amount) {
  if (typeof window === 'undefined' || !userId) return
  try {
    localStorage.setItem(`lokios_monthly_bills_budget_${userId}`, String(amount))
  } catch (e) {}
}

// Fetch all budget logs from Supabase with local fallback
export async function fetchBudgetLogs(userId) {
  const localLogs = getLocalBudgetLogs(userId)
  if (!userId) return localLogs

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('budget_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return localLogs
    }

    if (data && data.length > 0) {
      // Entries made offline aren't on the server yet: keep them in the list
      const pending = getQueue().filter(op => op.type === 'budget').map(op => op.entry).filter(e => !data.some(d => d.id === e.id))
      const merged = [...pending, ...data]
      saveLocalBudgetLogs(userId, merged)
      return merged
    }

    return localLogs
  } catch (err) {
    return localLogs
  }
}

// Add an expense
export async function addBudgetExpense(userId, expense) {
  if (!userId) return null
  const localLogs = getLocalBudgetLogs(userId)
  
  const isExcluded = typeof expense.exclude_daily === 'boolean'
    ? expense.exclude_daily
    : (expense.category === 'subscriptions' || expense.category === 'utilities')

  const newEntry = {
    id: expense.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'b_' + Date.now()),
    user_id: userId,
    date: expense.date || getLocalDateStr(new Date()),
    amount: Number(parseFloat(expense.amount).toFixed(2)),
    category: expense.category || 'other',
    custom_category: expense.custom_category || null,
    description: expense.description || '',
    exclude_daily: isExcluded,
    created_at: new Date().toISOString()
  }

  const updated = [newEntry, ...localLogs]
  saveLocalBudgetLogs(userId, updated)

  if (isOffline()) {
    enqueue({ type: 'budget', key: `budget_${newEntry.id}`, entry: newEntry })
    return newEntry
  }

  // Sync to Supabase in background with schema fallback
  try {
    const supabase = createClient()
    const { error: insertErr } = await supabase.from('budget_logs').insert(newEntry)
    if (insertErr) {
      // If remote table doesn't have exclude_daily column yet, fallback to inserting without it
      const fallbackEntry = { ...newEntry }
      delete fallbackEntry.exclude_daily
      if (isExcluded) {
        fallbackEntry.description = fallbackEntry.description 
          ? `${fallbackEntry.description} [EXCLUDE_DAILY]` 
          : '[EXCLUDE_DAILY]'
      } else {
        fallbackEntry.description = fallbackEntry.description 
          ? `${fallbackEntry.description} [INCLUDE_DAILY]` 
          : '[INCLUDE_DAILY]'
      }
      await supabase.from('budget_logs').insert(fallbackEntry)
    }
  } catch (e) {
    // Network failure: keep it locally and retry when back online
    enqueue({ type: 'budget', key: `budget_${newEntry.id}`, entry: newEntry })
  }

  return newEntry
}

/** Replay a queued expense (same schema fallback as addBudgetExpense). */
async function replayBudgetEntry({ entry }) {
  const supabase = createClient()
  const { error } = await supabase.from('budget_logs').upsert(entry, { onConflict: 'id' })
  if (error) {
    const fallback = { ...entry, description: `${entry.description || ''} ${entry.exclude_daily ? '[EXCLUDE_DAILY]' : '[INCLUDE_DAILY]'}`.trim() }
    delete fallback.exclude_daily
    const { error: err2 } = await supabase.from('budget_logs').upsert(fallback, { onConflict: 'id' })
    if (err2) throw err2
  }
}
if (typeof window !== 'undefined') registerOfflineHandler('budget', replayBudgetEntry)

// Delete an expense
export async function deleteBudgetExpense(userId, id) {
  if (!userId || !id) return
  const localLogs = getLocalBudgetLogs(userId)
  const updated = localLogs.filter(l => l.id !== id)
  saveLocalBudgetLogs(userId, updated)

  try {
    const supabase = createClient()
    await supabase.from('budget_logs').delete().eq('id', id).eq('user_id', userId)
  } catch (e) {}
}
