'use client'

import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr } from '@/lib/utils/dates'
import {
  BUDGET_CATEGORIES,
  DEFAULT_DAILY_BUDGET,
  DEFAULT_MONTHLY_BILLS_BUDGET,
  getCategoryById,
  isExcludedFromDaily,
  getLocalBudgetLogs,
  saveLocalBudgetLogs,
  getLocalDailyBudget,
  saveLocalDailyBudget,
  getLocalMonthlyBillsBudget,
  saveLocalMonthlyBillsBudget,
  fetchBudgetLogs,
  addBudgetExpense,
  deleteBudgetExpense
} from '@/lib/utils/budget'
import {
  Wallet, Plus, Trash2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, DollarSign, Calendar, AlertCircle, CheckCircle2,
  PieChart as PieIcon, BarChart3, Utensils, ShoppingCart, Car, Zap, CreditCard,
  ShoppingBag, Film, HeartPulse, BookOpen, MoreHorizontal, Edit2
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  CartesianGrid, ReferenceLine, PieChart, Pie, Cell, Legend
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

// Map category icons
const CATEGORY_ICONS = {
  Utensils,
  ShoppingCart,
  Car,
  Zap,
  CreditCard,
  ShoppingBag,
  Film,
  HeartPulse,
  BookOpen,
  MoreHorizontal
}

export default function BudgetPage() {
  const { user } = useAuth()
  const todayStr = useMemo(() => getLocalDateStr(new Date()), [])

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  
  // Daily budget limit
  const [dailyBudget, setDailyBudget] = useState(DEFAULT_DAILY_BUDGET)
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [newBudgetValue, setNewBudgetValue] = useState(String(DEFAULT_DAILY_BUDGET))

  // Monthly Bills & Subscriptions limit (default 10K)
  const [monthlyBillsBudget, setMonthlyBillsBudget] = useState(DEFAULT_MONTHLY_BILLS_BUDGET)
  const [isEditingBillsBudget, setIsEditingBillsBudget] = useState(false)
  const [newBillsBudgetValue, setNewBillsBudgetValue] = useState(String(DEFAULT_MONTHLY_BILLS_BUDGET))

  // Expense form state
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [includeInDaily, setIncludeInDaily] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successNotice, setSuccessNotice] = useState(false)

  // Chart range state: '7d' | '14d' | '30d' | 'month'
  const [chartRange, setChartRange] = useState('14d')

  // 5 days ago cutoff string (inclusive of today: 5 calendar days)
  const fiveDaysAgoStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 4)
    return getLocalDateStr(d)
  }, [])

  // Recent history view mode: '5days' | 'calendar' | 'all'
  const [historyMode, setHistoryMode] = useState('5days')
  const [historyCalendarDate, setHistoryCalendarDate] = useState(todayStr)

  // Filtered recent logs for bottom table
  const displayedRecentLogs = useMemo(() => {
    if (historyMode === '5days') {
      return logs.filter(l => l.date >= fiveDaysAgoStr && l.date <= todayStr)
    } else if (historyMode === 'calendar') {
      return logs.filter(l => l.date === historyCalendarDate)
    }
    return logs
  }, [logs, historyMode, fiveDaysAgoStr, todayStr, historyCalendarDate])

  const displayedRecentTotal = useMemo(() => {
    return displayedRecentLogs.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [displayedRecentLogs])

  const displayedRecentDailyTotal = useMemo(() => {
    return displayedRecentLogs.filter(l => !isExcludedFromDaily(l)).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [displayedRecentLogs])

  const displayedRecentBillsTotal = useMemo(() => {
    return displayedRecentLogs.filter(l => isExcludedFromDaily(l)).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [displayedRecentLogs])

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  })

  // Load initial data
  useEffect(() => {
    if (!user) return
    const initialBudget = getLocalDailyBudget(user.id)
    setDailyBudget(initialBudget)
    setNewBudgetValue(String(initialBudget))

    const initialBillsBudget = getLocalMonthlyBillsBudget(user.id)
    setMonthlyBillsBudget(initialBillsBudget)
    setNewBillsBudgetValue(String(initialBillsBudget))

    const cached = getLocalBudgetLogs(user.id)
    if (cached && cached.length > 0) {
      setLogs(cached)
      setLoading(false)
    }

    fetchBudgetLogs(user.id).then(fetchedLogs => {
      setLogs(fetchedLogs)
      setLoading(false)
    })
  }, [user])

  // Save daily budget limit
  const handleSaveBudgetLimit = () => {
    const parsed = parseFloat(newBudgetValue)
    if (!isNaN(parsed) && parsed > 0 && user) {
      setDailyBudget(parsed)
      saveLocalDailyBudget(user.id, parsed)
      setIsEditingBudget(false)
    }
  }

  // Save monthly bills limit
  const handleSaveBillsBudgetLimit = () => {
    const parsed = parseFloat(newBillsBudgetValue)
    if (!isNaN(parsed) && parsed > 0 && user) {
      setMonthlyBillsBudget(parsed)
      saveLocalMonthlyBillsBudget(user.id, parsed)
      setIsEditingBillsBudget(false)
    }
  }

  // Handle category change: defaults subscriptions to NOT in daily allowance
  const handleCategorySelect = (catId) => {
    setCategory(catId)
    if (catId === 'subscriptions' || catId === 'utilities') {
      setIncludeInDaily(false)
    } else {
      setIncludeInDaily(true)
    }
  }

  // Handle Log Expense
  const handleAddExpense = async (e) => {
    e?.preventDefault?.()
    if (!user || !amount) return
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return

    setIsSubmitting(true)
    const expenseData = {
      date: selectedDate,
      amount: numAmount,
      category,
      custom_category: category === 'other' && customCategory.trim() ? customCategory.trim() : null,
      description: description.trim(),
      exclude_daily: !includeInDaily
    }

    const created = await addBudgetExpense(user.id, expenseData)
    if (created) {
      setLogs(prev => [created, ...prev])
      setAmount('')
      setDescription('')
      setCustomCategory('')
      setIncludeInDaily(category !== 'subscriptions' && category !== 'utilities')
      setSuccessNotice(true)
      setTimeout(() => setSuccessNotice(false), 2500)
    }
    setIsSubmitting(false)
  }

  // Handle Delete Expense
  const handleDeleteExpense = (id, desc) => {
    setConfirmModal({
      isOpen: true,
      title: 'DELETE EXPENSE ENTRY',
      message: `Delete expense "${desc || 'this entry'}"? This will permanently remove it from your budget log.`,
      onConfirm: async () => {
        await deleteBudgetExpense(user.id, id)
        setLogs(prev => prev.filter(item => item.id !== id))
        setConfirmModal({ isOpen: false })
      }
    })
  }

  // Date Navigation
  const shiftDate = (offsetDays) => {
    const cur = new Date(selectedDate)
    cur.setDate(cur.getDate() + offsetDays)
    setSelectedDate(getLocalDateStr(cur))
  }

  // Filter logs for selected date
  const selectedDateLogs = useMemo(() => {
    return logs.filter(l => l.date === selectedDate)
  }, [logs, selectedDate])

  const selectedDateTotal = useMemo(() => {
    return selectedDateLogs.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [selectedDateLogs])

  const selectedDateDailyTotal = useMemo(() => {
    return selectedDateLogs.filter(l => !isExcludedFromDaily(l)).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [selectedDateLogs])

  const selectedDateBillsTotal = useMemo(() => {
    return selectedDateLogs.filter(l => isExcludedFromDaily(l)).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [selectedDateLogs])

  // Today stats (Daily allowance vs Bills)
  const todayLogs = useMemo(() => {
    return logs.filter(l => l.date === todayStr)
  }, [logs, todayStr])

  const todayDailyLogs = useMemo(() => {
    return todayLogs.filter(l => !isExcludedFromDaily(l))
  }, [todayLogs])

  const todayTotal = useMemo(() => {
    return todayDailyLogs.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [todayDailyLogs])

  const todayBillsLogs = useMemo(() => {
    return todayLogs.filter(l => isExcludedFromDaily(l))
  }, [todayLogs])

  const todayBillsTotal = useMemo(() => {
    return todayBillsLogs.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [todayBillsLogs])

  const todayRemaining = dailyBudget - todayTotal
  const todayProgressPct = Math.min(100, Math.round((todayTotal / dailyBudget) * 100))

  // This month totals
  const currentMonth = todayStr.substring(0, 7)

  const monthLogs = useMemo(() => {
    return logs.filter(l => l.date && l.date.startsWith(currentMonth))
  }, [logs, currentMonth])

  // Total month spending (all expenses)
  const monthTotal = useMemo(() => {
    return monthLogs.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [monthLogs])

  // Monthly Subscriptions & Bills logs (separate 10K limit)
  const monthBillsLogs = useMemo(() => {
    return monthLogs.filter(l => isExcludedFromDaily(l) || l.category === 'subscriptions' || l.category === 'utilities')
  }, [monthLogs])

  const monthBillsTotal = useMemo(() => {
    return monthBillsLogs.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [monthBillsLogs])

  const monthBillsRemaining = monthlyBillsBudget - monthBillsTotal
  const monthBillsProgressPct = Math.min(100, Math.round((monthBillsTotal / monthlyBillsBudget) * 100))

  // Monthly daily allowance total
  const monthDailyTotal = useMemo(() => {
    return monthLogs.filter(l => !isExcludedFromDaily(l)).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [monthLogs])

  // Generate range days for trend chart
  const trendChartData = useMemo(() => {
    let daysCount = 14
    if (chartRange === '7d') daysCount = 7
    if (chartRange === '30d') daysCount = 30
    if (chartRange === 'month') {
      const today = new Date()
      daysCount = today.getDate()
    }

    const result = []
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = getLocalDateStr(d)
      const dayLogs = logs.filter(l => l.date === dateStr)
      // Daily allowance strictly compares against daily target
      const dailySpend = dayLogs.filter(l => !isExcludedFromDaily(l)).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
      const billsSpend = dayLogs.filter(l => isExcludedFromDaily(l)).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
      const totalSpend = dailySpend + billsSpend

      result.push({
        date: dateStr.substring(5).replace('-', '/'),
        fullDate: dateStr,
        amount: dailySpend,
        billsAmount: billsSpend,
        totalAmount: totalSpend,
        target: dailyBudget,
        isOver: dailySpend > dailyBudget,
        count: dayLogs.length
      })
    }
    return result
  }, [logs, chartRange, dailyBudget])

  // Category breakdown data for chart range
  const categoryBreakdown = useMemo(() => {
    const dateLimit = new Date()
    let daysCount = 14
    if (chartRange === '7d') daysCount = 7
    if (chartRange === '30d') daysCount = 30
    if (chartRange === 'month') daysCount = new Date().getDate()

    dateLimit.setDate(dateLimit.getDate() - daysCount)
    const limitStr = getLocalDateStr(dateLimit)

    const filteredLogs = logs.filter(l => l.date >= limitStr)
    const totalsByCategory = {}

    filteredLogs.forEach(log => {
      // Legacy 'utilities' logs belong to the same Subscriptions & Bills bucket
      const catKey = log.category === 'utilities' ? 'subscriptions' : (log.category || 'other')
      if (!totalsByCategory[catKey]) {
        totalsByCategory[catKey] = {
          id: catKey,
          amount: 0,
          count: 0
        }
      }
      totalsByCategory[catKey].amount += parseFloat(log.amount) || 0
      totalsByCategory[catKey].count += 1
    })

    const grandTotal = Object.values(totalsByCategory).reduce((sum, item) => sum + item.amount, 0)

    const list = Object.values(totalsByCategory).map(item => {
      const catDef = getCategoryById(item.id)
      const pct = grandTotal > 0 ? Math.round((item.amount / grandTotal) * 100) : 0
      return {
        name: catDef.label,
        shortName: catDef.shortLabel,
        value: Number(item.amount.toFixed(2)),
        color: catDef.color,
        count: item.count,
        pct
      }
    }).sort((a, b) => b.value - a.value)

    return { list, grandTotal }
  }, [logs, chartRange])

  return (
    <AppShell>
      <div className="page-container max-w-[1400px] pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Wallet size={24} />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-white tracking-wide flex items-center gap-2">
                  DAILY BUDGET PROTOCOL
                </h1>
                <p className="font-mono text-xs text-muted">
                  Tactical daily expense tracking, spending limit control & category trends.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Date Switcher */}
          <div className="flex items-center gap-2 bg-bg-secondary p-1.5 rounded-xl border border-border-subtle self-start sm:self-auto">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-primary transition-colors"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-mono text-xs text-primary px-2 py-1 outline-none text-center"
            />
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-primary transition-colors"
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="font-mono text-[10px] uppercase font-bold px-2 py-1 rounded bg-info/20 text-info border border-info/40 ml-1"
              >
                TODAY
              </button>
            )}
          </div>
        </div>

        {/* Main 2-Column Section: Quick Logger + Day Overview (Top of Page) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Quick Expense Logger (5 cols) */}
          <div className="lg:col-span-5">
            <HudPanel
              label="LOG DAILY BUDGET & EXPENSE"
              action={
                <div className="font-mono text-[10px] text-muted flex items-center gap-1.5">
                  <span>TARGET:</span>
                  <strong className="text-emerald-400 font-bold">₹{dailyBudget.toLocaleString('en-IN')}</strong>
                  <span className="text-slate-500">/ day</span>
                </div>
              }
            >
              <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
                {/* Amount input & Quick increment buttons */}
                <div>
                  <label className="font-mono text-[11px] text-muted uppercase tracking-wider block mb-1.5">
                    Amount (₹) <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted text-base">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-bg-tertiary border border-border-subtle focus:border-emerald-500/80 rounded-xl pl-8 pr-4 py-2.5 font-display text-lg text-white font-bold placeholder:text-muted/40 outline-none transition-colors"
                    />
                  </div>
                  {/* Quick Chips */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[50, 100, 200, 500, 1000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          const cur = parseFloat(amount) || 0
                          setAmount(String(cur + val))
                        }}
                        className="font-mono text-[10px] px-2 py-1 rounded bg-bg-secondary hover:bg-hover border border-border-subtle text-muted hover:text-primary transition-all active:scale-95"
                      >
                        +{val}
                      </button>
                    ))}
                    {amount && (
                      <button
                        type="button"
                        onClick={() => setAmount('')}
                        className="font-mono text-[10px] px-2 py-1 rounded bg-bg-secondary hover:bg-danger/20 text-muted hover:text-danger transition-all ml-auto"
                      >
                        CLEAR
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Selection Grid */}
                <div>
                  <label className="font-mono text-[11px] text-muted uppercase tracking-wider block mb-1.5">
                    Category <span className="text-danger">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {BUDGET_CATEGORIES.map(cat => {
                      const IconComp = CATEGORY_ICONS[cat.icon] || MoreHorizontal
                      const isSelected = category === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategorySelect(cat.id)}
                          className={`p-2 rounded-xl border text-left flex flex-col items-start gap-1 transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                              : 'border-border-subtle bg-bg-secondary/60 hover:border-border-color hover:bg-bg-secondary'
                          }`}
                        >
                          <div
                            className="p-1.5 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: isSelected ? cat.color : `${cat.color}20`,
                              color: isSelected ? '#ffffff' : cat.color
                            }}
                          >
                            <IconComp size={14} />
                          </div>
                          <span className={`font-mono text-[10px] font-semibold truncate w-full ${
                            isSelected ? 'text-white' : 'text-slate-300'
                          }`}>
                            {cat.shortLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* If 'other' category is chosen, allow custom category name */}
                {category === 'other' && (
                  <div>
                    <label className="font-mono text-[11px] text-muted uppercase tracking-wider block mb-1">
                      Custom Category Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Subscriptions, Hardware, Gift"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-bg-tertiary border border-border-subtle focus:border-info rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                    />
                  </div>
                )}

                {/* Description / Note */}
                <div>
                  <label className="font-mono text-[11px] text-muted uppercase tracking-wider block mb-1">
                    Note / Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lunch at bistro, Wi-Fi bill, gym fee"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-bg-tertiary border border-border-subtle focus:border-info rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>

                {/* Daily Allowance Inclusion Toggle */}
                <div className="p-3 rounded-xl border border-border-subtle bg-bg-secondary/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-xs font-semibold text-white flex items-center gap-1.5">
                        <CreditCard size={13} className={category === 'subscriptions' || category === 'utilities' ? 'text-purple-400' : 'text-emerald-400'} />
                        Daily Budget Allowance
                      </span>
                      <span className="font-mono text-[10px] text-muted truncate">
                        {includeInDaily 
                          ? `Counts against today's ₹${dailyBudget.toLocaleString('en-IN')} allowance` 
                          : `Excluded from daily allowance (tracked in ₹${monthlyBillsBudget.toLocaleString('en-IN')}/mo Bills limit)`}
                      </span>
                    </div>

                    {/* Interactive Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => setIncludeInDaily(prev => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        includeInDaily ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={includeInDaily}
                      title={includeInDaily ? "Click to exclude from daily allowance" : "Click to count in daily allowance"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          includeInDaily ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[9px] font-mono">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                      includeInDaily 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      {includeInDaily ? '✓ COUNT IN DAILY ALLOWANCE: YES' : '★ EXCLUDED FROM DAILY ALLOWANCE (BILLS & SUBS)'}
                    </span>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting || !amount}
                  className="btn btn-primary w-full py-2.5 font-mono text-xs uppercase font-bold flex items-center justify-center gap-2 mt-1 disabled:opacity-50"
                >
                  <Plus size={16} />
                  {isSubmitting ? 'LOGGING...' : successNotice ? 'EXPENSE RECORDED ✓' : 'LOG EXPENSE'}
                </button>
                {successNotice && (
                  <div className="font-mono text-xs text-emerald-400 text-center animate-pulse">
                    ✓ Logged successfully to budget ledger!
                  </div>
                )}
              </form>
            </HudPanel>
          </div>

          {/* Day Breakdown & Transactions (7 cols) */}
          <div className="lg:col-span-7">
            <HudPanel
              label={`EXPENSES FOR ${selectedDate === todayStr ? 'TODAY' : selectedDate} (${selectedDateLogs.length})`}
              action={
                <div className="flex items-center gap-2 font-mono text-xs flex-wrap justify-end">
                  <span className="text-muted">
                    DAILY: <strong className="text-emerald-400 font-bold">₹{selectedDateDailyTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
                  </span>
                  {selectedDateBillsTotal > 0 && (
                    <>
                      <span className="text-border-subtle">•</span>
                      <span className="text-muted">
                        BILLS: <strong className="text-purple-400 font-bold">₹{selectedDateBillsTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
                      </span>
                    </>
                  )}
                  <span className="text-border-subtle">•</span>
                  <span className="text-muted">
                    TOTAL: <strong className="text-white font-bold">₹{selectedDateTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
                  </span>
                </div>
              }
            >
              {selectedDateLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted font-mono text-xs gap-2 border border-dashed border-border-subtle rounded-xl">
                  <Wallet size={28} className="opacity-40" />
                  <span>NO EXPENSES LOGGED FOR THIS DATE YET.</span>
                  <span className="text-[10px] text-slate-500">Log an expense using the form on the left.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {selectedDateLogs.map((item) => {
                    const catDef = getCategoryById(item.category)
                    const IconComp = CATEGORY_ICONS[catDef.icon] || MoreHorizontal
                    const displayName = item.custom_category || catDef.label
                    const isBills = isExcludedFromDaily(item)

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-border-subtle bg-bg-secondary/70 hover:border-border-color transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${catDef.color}20`,
                              color: catDef.color
                            }}
                          >
                            <IconComp size={16} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-display text-sm text-white font-semibold truncate">
                                {displayName}
                              </span>
                              <span
                                className="font-mono text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase"
                                style={{
                                  backgroundColor: `${catDef.color}25`,
                                  color: catDef.color
                                }}
                              >
                                {catDef.shortLabel}
                              </span>
                              {isBills ? (
                                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  BILLS (NO DAILY)
                                </span>
                              ) : (
                                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                  DAILY
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <span className="font-mono text-[11px] text-muted truncate">
                                {item.description.replace(/\s*\[(?:EXCLUDE|INCLUDE)_DAILY\]\s*/g, '')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="font-mono text-sm font-bold text-white text-right">
                            ₹{parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(item.id, item.description || displayName)}
                            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Delete expense"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </HudPanel>
          </div>
        </div>

        {/* 5 KPI Top Cards (Daily Allowance + Monthly Bills + Month Total) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
          {/* Card 1: Today's Daily Allowance Spend */}
          <div className="dashboard-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted font-mono text-[10px] uppercase tracking-wider mb-2">
              <span>TODAY'S DAILY SPEND</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                todayRemaining >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {todayRemaining >= 0 ? 'ON TARGET' : 'OVER BUDGET'}
              </span>
            </div>
            <div className="font-display text-2xl font-bold text-white mb-2">
              ₹{todayTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div>
              <div className="flex items-center justify-between font-mono text-[10px] text-muted mb-1">
                <span>USAGE</span>
                <span className={todayProgressPct > 100 ? 'text-rose-400 font-bold' : 'text-primary'}>
                  {todayProgressPct}%
                </span>
              </div>
              <TacticalProgress
                value={todayProgressPct}
                color={todayProgressPct > 100 ? 'var(--danger)' : todayProgressPct >= 80 ? 'var(--warning)' : 'var(--success)'}
                height={5}
                showValue={false}
              />
            </div>
          </div>

          {/* Card 2: Daily Target Limit */}
          <div className="dashboard-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted font-mono text-[10px] uppercase tracking-wider mb-2">
              <span>DAILY TARGET</span>
              <button
                type="button"
                onClick={() => setIsEditingBudget(prev => !prev)}
                className="text-info hover:text-white flex items-center gap-1 font-mono text-[9px]"
              >
                <Edit2 size={10} /> {isEditingBudget ? 'CANCEL' : 'EDIT'}
              </button>
            </div>
            {isEditingBudget ? (
              <div className="flex items-center gap-2 mt-1 mb-2">
                <span className="text-muted font-mono text-sm">₹</span>
                <input
                  type="number"
                  value={newBudgetValue}
                  onChange={(e) => setNewBudgetValue(e.target.value)}
                  className="bg-bg-tertiary border border-info px-2 py-1 rounded text-white font-mono text-sm w-24"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveBudgetLimit}
                  className="btn btn-primary btn-sm py-1 px-2 text-xs font-mono"
                >
                  SAVE
                </button>
              </div>
            ) : (
              <div className="font-display text-2xl font-bold text-emerald-400 mb-2">
                ₹{dailyBudget.toLocaleString('en-IN')}
              </div>
            )}
            <div className="font-mono text-[10px] text-muted">
              Target allowance per day (excluding bills)
            </div>
          </div>

          {/* Card 3: Remaining Today */}
          <div className="dashboard-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted font-mono text-[10px] uppercase tracking-wider mb-2">
              <span>REMAINING TODAY</span>
              {todayRemaining >= 0 ? (
                <ArrowDownRight size={14} className="text-emerald-400" />
              ) : (
                <ArrowUpRight size={14} className="text-rose-400" />
              )}
            </div>
            <div className={`font-display text-2xl font-bold mb-2 ${
              todayRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {todayRemaining >= 0
                ? `₹${todayRemaining.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                : `-₹${Math.abs(todayRemaining).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            </div>
            <div className="font-mono text-[10px] text-muted">
              {todayRemaining >= 0 ? 'Available within target' : 'Exceeded daily threshold'}
            </div>
          </div>

          {/* Card 4: Monthly Bills & Subscriptions (Dedicated 10K Limit) */}
          <div className="dashboard-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted font-mono text-[10px] uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1">
                <CreditCard size={11} className="text-purple-400" />
                <span>BILLS & SUBS (MO)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  monthBillsRemaining >= 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {monthBillsRemaining >= 0 ? 'ON TRACK' : 'OVER LIMIT'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingBillsBudget(prev => !prev)}
                  className="text-info hover:text-white flex items-center gap-1 font-mono text-[9px]"
                  title="Edit monthly bills budget limit"
                >
                  <Edit2 size={10} /> {isEditingBillsBudget ? 'CANCEL' : 'EDIT'}
                </button>
              </div>
            </div>

            {isEditingBillsBudget ? (
              <div className="flex items-center gap-2 mt-1 mb-2">
                <span className="text-muted font-mono text-sm">₹</span>
                <input
                  type="number"
                  value={newBillsBudgetValue}
                  onChange={(e) => setNewBillsBudgetValue(e.target.value)}
                  className="bg-bg-tertiary border border-purple-500 px-2 py-1 rounded text-white font-mono text-sm w-24"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveBillsBudgetLimit}
                  className="btn btn-primary btn-sm py-1 px-2 text-xs font-mono"
                >
                  SAVE
                </button>
              </div>
            ) : (
              <div className="font-display text-2xl font-bold text-purple-300 mb-2">
                ₹{monthBillsTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                <span className="text-xs text-muted font-mono font-normal ml-1">/ ₹{monthlyBillsBudget.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between font-mono text-[10px] text-muted mb-1">
                <span>{monthBillsProgressPct}% OF MONTHLY LIMIT</span>
                <span className={monthBillsRemaining >= 0 ? 'text-purple-400 font-bold' : 'text-rose-400 font-bold'}>
                  {monthBillsRemaining >= 0 ? `₹${monthBillsRemaining.toLocaleString('en-IN')} LEFT` : `₹${Math.abs(monthBillsRemaining).toLocaleString('en-IN')} OVER`}
                </span>
              </div>
              <TacticalProgress
                value={monthBillsProgressPct}
                color={monthBillsProgressPct > 100 ? 'var(--danger)' : monthBillsProgressPct >= 80 ? 'var(--warning)' : '#a855f7'}
                height={5}
                showValue={false}
              />
            </div>
          </div>

          {/* Card 5: This Month Total (All cumulative) */}
          <div className="dashboard-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted font-mono text-[10px] uppercase tracking-wider mb-2">
              <span>THIS MONTH (ALL)</span>
              <Calendar size={14} className="text-cyan-400" />
            </div>
            <div className="font-display text-2xl font-bold text-white mb-2">
              ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="font-mono text-[10px] text-muted truncate">
              Daily: ₹{monthDailyTotal.toLocaleString('en-IN')} • Bills: ₹{monthBillsTotal.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            GRAPHS SECTION (Trends Graph + Category Breakdown)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Trends Over Time Graph (7 cols) */}
          <div className="lg:col-span-7">
            <HudPanel
              label="SPENDING TRENDS VS DAILY TARGET"
              action={
                <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-lg border border-border-subtle">
                  {[
                    { id: '7d', label: '7D' },
                    { id: '14d', label: '14D' },
                    { id: '30d', label: '30D' },
                    { id: 'month', label: 'THIS MO' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setChartRange(tab.id)}
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
                        chartRange === tab.id
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'text-muted hover:text-white border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="w-full h-64 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="budgetSpendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--text-muted)"
                      fontSize={10}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <ReferenceLine
                      y={dailyBudget}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: `TARGET ₹${dailyBudget}`,
                        fill: '#f59e0b',
                        fontSize: 9,
                        position: 'insideTopRight'
                      }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-bg-tertiary border border-border-color p-2.5 rounded shadow-xl font-mono text-xs">
                              <div className="text-muted text-[10px] mb-1">{data.fullDate}</div>
                              <div className="text-white font-bold flex items-center gap-1.5">
                                <Wallet size={12} className="text-emerald-400" />
                                Daily Spent: ₹{data.amount.toLocaleString()}
                              </div>
                              {data.billsAmount > 0 && (
                                <div className="text-purple-300 font-semibold flex items-center gap-1.5 mt-0.5 text-[11px]">
                                  <CreditCard size={11} className="text-purple-400" />
                                  Bills & Subs: ₹{data.billsAmount.toLocaleString()}
                                </div>
                              )}
                              <div className="text-[10px] text-muted mt-1">
                                Target: ₹{data.target} • {data.isOver ? (
                                  <span className="text-rose-400 font-bold">Over Target</span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">Within Target</span>
                                )}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#budgetSpendGrad)"
                      dot={{ r: 3, fill: '#10b981', strokeWidth: 1, stroke: 'var(--bg-primary)' }}
                      activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </HudPanel>
          </div>

          {/* Category Distribution Breakdown (5 cols) */}
          <div className="lg:col-span-5">
            <HudPanel
              label="CATEGORY DISTRIBUTION"
              action={
                <span className="font-mono text-[10px] text-muted">
                  TOTAL: ₹{categoryBreakdown.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              }
            >
              {categoryBreakdown.list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-muted font-mono text-xs gap-1 border border-dashed border-border-subtle rounded-xl">
                  <PieIcon size={24} className="opacity-40" />
                  <span>NO EXPENSES IN SELECTED TIMEFRAME</span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Category Donut Chart */}
                  <div className="w-full h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryBreakdown.list}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {categoryBreakdown.list.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload
                              return (
                                <div className="bg-bg-tertiary border border-border-color p-2 rounded shadow-xl font-mono text-xs">
                                  <div className="font-bold" style={{ color: d.color }}>{d.name}</div>
                                  <div className="text-white mt-0.5">₹{d.value.toLocaleString()} ({d.pct}%)</div>
                                  <div className="text-muted text-[10px]">{d.count} transactions</div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top Categories Bars */}
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {categoryBreakdown.list.map((cat) => (
                      <div key={cat.name} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-primary truncate">{cat.name}</span>
                          </span>
                          <span className="text-muted shrink-0 text-right">
                            <strong className="text-white font-bold">₹{cat.value.toLocaleString()}</strong> ({cat.pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-bg-tertiary rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${cat.pct}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </HudPanel>
          </div>
        </div>

        {/* Recent Filtered Logs History Table */}
        <div className="mt-6">
          <HudPanel
            label={
              historyMode === '5days'
                ? `RECENT LOGGED EXPENSES (LAST 5 DAYS • ${displayedRecentLogs.length} ENTRIES)`
                : historyMode === 'calendar'
                ? `LOGGED EXPENSES ON ${historyCalendarDate} (${displayedRecentLogs.length} ENTRIES)`
                : `ALL LOGGED EXPENSES (${displayedRecentLogs.length} TOTAL)`
            }
            action={
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mode Selector Tabs: Last 5 Days / All */}
                <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-lg border border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setHistoryMode('5days')}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold transition-all ${
                      historyMode === '5days'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'text-muted hover:text-white border border-transparent'
                    }`}
                  >
                    LAST 5 DAYS
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryMode('all')}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold transition-all ${
                      historyMode === 'all'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'text-muted hover:text-white border border-transparent'
                    }`}
                  >
                    ALL TIME
                  </button>
                </div>

                {/* Calendar Jump Date Picker */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${
                  historyMode === 'calendar'
                    ? 'bg-info/15 border-info text-info'
                    : 'bg-bg-secondary border-border-subtle text-muted hover:text-primary'
                }`}>
                  <Calendar size={13} className={historyMode === 'calendar' ? 'text-info' : 'text-muted'} />
                  <span className="font-mono text-[10px] font-bold uppercase hidden sm:inline">JUMP TO DATE:</span>
                  <input
                    type="date"
                    value={historyCalendarDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setHistoryCalendarDate(e.target.value)
                        setHistoryMode('calendar')
                      }
                    }}
                    className="bg-transparent font-mono text-xs text-white outline-none cursor-pointer"
                    title="Navigate older expenses via calendar"
                  />
                  {historyMode === 'calendar' && (
                    <button
                      type="button"
                      onClick={() => setHistoryMode('5days')}
                      className="ml-1 text-[10px] font-mono text-rose-400 hover:text-white px-1"
                      title="Reset to Last 5 Days"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            }
          >
            {/* Filter Context Notice & Total Spent */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle/60 text-xs font-mono">
              <span className="text-muted text-[11px]">
                {historyMode === '5days' && `Showing transactions between ${fiveDaysAgoStr} and ${todayStr}. Use calendar to navigate older dates.`}
                {historyMode === 'calendar' && `Showing filtered transactions for single date: ${historyCalendarDate}.`}
                {historyMode === 'all' && `Showing all recorded expense logs across complete timeline.`}
              </span>
              <span className="font-bold text-white shrink-0">
                TOTAL: <strong className="text-emerald-400">₹{displayedRecentTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
                {displayedRecentBillsTotal > 0 && (
                  <span className="text-muted text-[11px] font-normal ml-1.5 hidden sm:inline">
                    (Daily: ₹{displayedRecentDailyTotal.toLocaleString('en-IN')} • Bills: ₹{displayedRecentBillsTotal.toLocaleString('en-IN')})
                  </span>
                )}
              </span>
            </div>

            {displayedRecentLogs.length === 0 ? (
              <div className="py-8 text-center text-muted font-mono text-xs flex flex-col items-center gap-2">
                <Wallet size={24} className="opacity-40" />
                <span>
                  {historyMode === 'calendar'
                    ? `No expense entries found for ${historyCalendarDate}.`
                    : historyMode === '5days'
                    ? `No expenses logged in the last 5 days (${fiveDaysAgoStr} to ${todayStr}).`
                    : 'No expense entries logged yet.'}
                </span>
                {historyMode === 'calendar' && (
                  <button
                    type="button"
                    onClick={() => setHistoryMode('5days')}
                    className="btn btn-secondary btn-sm py-1 px-3 text-[10px] font-mono mt-1"
                  >
                    RETURN TO LAST 5 DAYS
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-muted text-[10px] uppercase tracking-wider">
                      <th className="pb-2.5 font-semibold">DATE</th>
                      <th className="pb-2.5 font-semibold">CATEGORY</th>
                      <th className="pb-2.5 font-semibold">NOTE</th>
                      <th className="pb-2.5 font-semibold text-right">AMOUNT</th>
                      <th className="pb-2.5 font-semibold text-center w-12">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {displayedRecentLogs.map((log) => {
                      const catDef = getCategoryById(log.category)
                      const IconComp = CATEGORY_ICONS[catDef.icon] || MoreHorizontal
                      const isBills = isExcludedFromDaily(log)

                      return (
                        <tr key={log.id} className="hover:bg-hover/40 transition-colors">
                          <td className="py-2.5 text-muted whitespace-nowrap">
                            {log.date === todayStr ? (
                              <span className="text-emerald-400 font-bold">TODAY ({log.date})</span>
                            ) : (
                              log.date
                            )}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold"
                                style={{
                                  backgroundColor: `${catDef.color}20`,
                                  color: catDef.color
                                }}
                              >
                                <IconComp size={11} />
                                {log.custom_category || catDef.label}
                              </span>
                              {isBills ? (
                                <span className="font-mono text-[8px] px-1 py-0.5 rounded font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  BILLS
                                </span>
                              ) : (
                                <span className="font-mono text-[8px] px-1 py-0.5 rounded font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                  DAILY
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 text-primary max-w-xs truncate">
                            {log.description ? log.description.replace(/\s*\[(?:EXCLUDE|INCLUDE)_DAILY\]\s*/g, '') : '—'}
                          </td>
                          <td className="py-2.5 text-right font-bold text-white whitespace-nowrap">
                            ₹{parseFloat(log.amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(log.id, log.description || catDef.label)}
                              className="p-1 rounded text-muted hover:text-danger transition-colors"
                              title="Delete entry"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </HudPanel>
        </div>

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText="DELETE PERMANENTLY"
          danger={true}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal({ isOpen: false })}
        />
      </div>
    </AppShell>
  )
}
