// Budget utilities, categories, and sync handlers
import { createClient } from '@/lib/supabase/client'
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
    description: 'Meals, coffee, snacks, dining out'
  },
  {
    id: 'groceries',
    label: 'Groceries & Essentials',
    shortLabel: 'Groceries',
    icon: 'ShoppingCart',
    color: '#10b981', // emerald
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    description: 'Supermarket, provisions, vegetables, milk'
  },
  {
    id: 'transport',
    label: 'Transport & Commute',
    shortLabel: 'Transport',
    icon: 'Car',
    color: '#06b6d4', // cyan
    bgColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
    description: 'Metro, cab, fuel, bus, auto, parking'
  },
  {
    id: 'utilities',
    label: 'Bills & Utilities',
    shortLabel: 'Bills',
    icon: 'Zap',
    color: '#8b5cf6', // purple
    bgColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    description: 'Recharge, Wi-Fi, electricity, subscriptions'
  },
  {
    id: 'shopping',
    label: 'Shopping & Gear',
    shortLabel: 'Shopping',
    icon: 'ShoppingBag',
    color: '#ec4899', // pink
    bgColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: 'rgba(236, 72, 153, 0.35)',
    description: 'Clothes, electronics, accessories, gear'
  },
  {
    id: 'entertainment',
    label: 'Entertainment & Outings',
    shortLabel: 'Fun',
    icon: 'Film',
    color: '#f97316', // orange
    bgColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
    description: 'Movies, gaming, parties, leisure'
  },
  {
    id: 'health',
    label: 'Health & Fitness',
    shortLabel: 'Health',
    icon: 'HeartPulse',
    color: '#ef4444', // red
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    description: 'Gym, supplements, medicine, doctor'
  },
  {
    id: 'learning',
    label: 'Learning & Books',
    shortLabel: 'Learning',
    icon: 'BookOpen',
    color: '#3b82f6', // blue
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    description: 'Courses, books, software tools'
  },
  {
    id: 'other',
    label: 'Other & Custom',
    shortLabel: 'Other',
    icon: 'MoreHorizontal',
    color: '#94a3b8', // slate
    bgColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    description: 'Miscellaneous or custom expenses'
  }
]

export const DEFAULT_DAILY_BUDGET = 1000

export function getCategoryById(id) {
  return BUDGET_CATEGORIES.find(c => c.id === id) || BUDGET_CATEGORIES[BUDGET_CATEGORIES.length - 1]
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
      saveLocalBudgetLogs(userId, data)
      return data
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
  
  const newEntry = {
    id: expense.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'b_' + Date.now()),
    user_id: userId,
    date: expense.date || getLocalDateStr(new Date()),
    amount: Number(parseFloat(expense.amount).toFixed(2)),
    category: expense.category || 'other',
    custom_category: expense.custom_category || null,
    description: expense.description || '',
    created_at: new Date().toISOString()
  }

  const updated = [newEntry, ...localLogs]
  saveLocalBudgetLogs(userId, updated)

  // Sync to Supabase in background
  try {
    const supabase = createClient()
    await supabase.from('budget_logs').insert(newEntry)
  } catch (e) {
    // Graceful fallback to local storage
  }

  return newEntry
}

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
