'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useGameState } from '@/lib/hooks/useGameState'
import { masteryTier } from '@/lib/utils/xpRules'
import WinterLoader from '@/components/ui/WinterLoader'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Plus, Check, X, Archive, Trash2, ChevronLeft, ChevronRight, AlertTriangle, ArrowUp, ArrowDown, Flame, ChevronsUp, GripVertical, RotateCcw, Crosshair, Leaf, Lock, Clock, Sparkles, CheckCircle2, Minus, PauseCircle, PlayCircle, Sun, Calendar, Edit3, Scale, TrendingDown, TrendingUp, Medal } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'

// Small medal for a habit's mastery tier (Bronze 30 → Diamond 200 completions)
function MasteryMedal({ count }) {
  const tier = masteryTier(count)
  if (!tier) return null
  return (
    <span title={`${tier.label} mastery · ${count} completions`} style={{ display: 'inline-flex', verticalAlign: '-2px', marginLeft: 6, color: tier.color, filter: `drop-shadow(0 0 6px ${tier.color}66)` }}>
      <Medal size={12} />
    </span>
  )
}

export default function DailyOps() {
  const game = useGameState()
  const masteryCount = (id) => game.model?.doneCountByHabit?.get(id) || 0
  const {
    habits = [], stoppedHabits = [], allHabits = [], monthLogs = [], todayLogs = [], loading = false, error = null,
    fetchHabits, cycleHabitState, addHabit, deleteHabit, stopHabit, resumeHabit, archiveHabit, reorderHabits, reorderHabitsByDrag, updateHabit
  } = (useOS() || {}).habits || {}

  const [draggedHabitId, setDraggedHabitId] = useState(null)
  const [dragOverHabitId, setDragOverHabitId] = useState(null)

  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()) // 0-indexed
  const [mobileSelectedDate, setMobileSelectedDate] = useState(new Date())
  const [mobileWeekStart, setMobileWeekStart] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('beyond_tatva')
  const [customCategory, setCustomCategory] = useState('')
  const [newXp, setNewXp] = useState(25)
  const [newFrequencyDays, setNewFrequencyDays] = useState([1,2,3,4,5,6,0])
  const [activeTool, setActiveTool] = useState('cycle')

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', danger: false, onConfirm: null, onCancel: null, confirmText: 'CONFIRM' })

  const { user } = useAuth()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayStr = getLocalDateStr(yesterdayDate)
  const todayStr = getLocalDateStr(new Date())

  // ── WEIGHT TRACKER & TRENDS STATE ──────────────────────────
  const [weightLogs, setWeightLogs] = useState([])
  const [weightInput, setWeightInput] = useState('')
  const [weightDate, setWeightDate] = useState(todayStr)
  const [savingWeight, setSavingWeight] = useState(false)
  const [weightRange, setWeightRange] = useState('30days') // '14days' | '30days' | 'all'
  const [weightSaveSuccess, setWeightSaveSuccess] = useState(false)
  const [showStoppedRoutines, setShowStoppedRoutines] = useState(false)

  // Fetch weight logs
  useEffect(() => {
    if (!user) return
    const fetchWeight = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('weight_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true })

        if (data && data.length > 0) {
          setWeightLogs(data)
          if (typeof window !== 'undefined') {
            localStorage.setItem(`lokios_weight_logs_${user.id}`, JSON.stringify(data))
          }
        } else if (typeof window !== 'undefined') {
          const cached = localStorage.getItem(`lokios_weight_logs_${user.id}`)
          if (cached) try { setWeightLogs(JSON.parse(cached)) } catch (e) {}
        }
      } catch (err) {
        console.error('[Weight Sync] Fetch error:', err)
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem(`lokios_weight_logs_${user.id}`)
          if (cached) try { setWeightLogs(JSON.parse(cached)) } catch (e) {}
        }
      }
    }
    fetchWeight()
  }, [user])

  const handleLogWeight = async (e) => {
    e?.preventDefault?.()
    if (!user || !weightInput) return
    const num = parseFloat(weightInput)
    if (isNaN(num) || num <= 20 || num > 300) return

    setSavingWeight(true)
    const logDate = weightDate || todayStr

    const newEntry = {
      user_id: user.id,
      date: logDate,
      weight_kg: Number(num.toFixed(2)),
      created_at: new Date().toISOString()
    }

    const updated = [...weightLogs.filter(w => w.date !== logDate), newEntry].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    setWeightLogs(updated)
    setWeightInput('')
    setSavingWeight(false)
    setWeightSaveSuccess(true)
    setTimeout(() => setWeightSaveSuccess(false), 3000)

    if (typeof window !== 'undefined') {
      localStorage.setItem(`lokios_weight_logs_${user.id}`, JSON.stringify(updated))
    }

    try {
      const supabase = createClient()
      await supabase.from('weight_logs').upsert(newEntry, { onConflict: 'user_id,date' })
    } catch (err) {
      console.error('[Weight Sync] Save error:', err)
    }
  }

  const TARGET_WEIGHT = 70

  // Weight metrics calculations
  const weightStats = useMemo(() => {
    if (!weightLogs || weightLogs.length === 0) {
      return { latest: null, prev: null, diff: 0, min: 0, max: 0, count: 0, distToTarget: null }
    }
    const sorted = [...weightLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const latest = sorted[sorted.length - 1]
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null
    const diff = prev ? Number((latest.weight_kg - prev.weight_kg).toFixed(2)) : 0
    const weights = sorted.map(s => parseFloat(s.weight_kg) || 0)
    const min = Math.min(...weights)
    const max = Math.max(...weights)
    const distToTarget = Number((latest.weight_kg - TARGET_WEIGHT).toFixed(1))
    return { latest, prev, diff, min, max, count: sorted.length, distToTarget }
  }, [weightLogs])

  const chartWeightData = useMemo(() => {
    if (!weightLogs || weightLogs.length === 0) return []
    let list = [...weightLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    if (weightRange === '14days') {
      list = list.slice(-14)
    } else if (weightRange === '30days') {
      list = list.slice(-30)
    }
    return list.map(item => ({
      date: item.date ? item.date.slice(5) : '',
      fullDate: item.date,
      weight: parseFloat(item.weight_kg)
    }))
  }, [weightLogs, weightRange])

  const weightDomain = useMemo(() => {
    if (!chartWeightData.length) return [65, 80]
    const vals = [...chartWeightData.map(d => d.weight).filter(w => !isNaN(w)), TARGET_WEIGHT]
    const min = Math.floor(Math.min(...vals) - 2)
    const max = Math.ceil(Math.max(...vals) + 2)
    return [min, max]
  }, [chartWeightData])

  // Habit Column Width automatically fitted to the longest routine title
  const habitColWidth = useMemo(() => {
    if (!habits || habits.length === 0) return 260
    let maxLen = 0
    habits.forEach(h => {
      if (h.title && h.title.length > maxLen) {
        maxLen = h.title.length
      }
    })
    return Math.max(220, Math.min(650, Math.ceil(maxLen * 8.5) + 120))
  }, [habits])

  // Edit State
  const [editingHabit, setEditingHabit] = useState(null)
  const [showEditForm, setShowEditForm] = useState(false)
  // Drag states
  const [addFormDrag, setAddFormDrag] = useState({ x: 0, y: 0 })
  const [editFormDrag, setEditFormDrag] = useState({ x: 0, y: 0 })

  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCustomCategory, setEditCustomCategory] = useState('')
  const [editXp, setEditXp] = useState(25)
  const [editFrequencyDays, setEditFrequencyDays] = useState([1,2,3,4,5,6,0])

  const DAYS_OF_WEEK = [
    { label: 'MON', value: 1 },
    { label: 'TUE', value: 2 },
    { label: 'WED', value: 3 },
    { label: 'THU', value: 4 },
    { label: 'FRI', value: 5 },
    { label: 'SAT', value: 6 },
    { label: 'SUN', value: 0 }
  ]

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  // Days in the current viewed month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = new Date()
  const todayDay = today.getDate()
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  const mobileDays = Array.from({ length: 7 }, (_, i) => mobileWeekStart + i).filter(d => d <= daysInMonth)
  const mobileDateStr = `${mobileSelectedDate.getFullYear()}-${String(mobileSelectedDate.getMonth() + 1).padStart(2, '0')}-${String(mobileSelectedDate.getDate()).padStart(2, '0')}`
  const isMobileToday = mobileDateStr === todayStr

  // Navigate months
  const prevMonth = () => {
    setMobileWeekStart(1)
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); fetchHabits(viewYear - 1, 11) }
    else { setViewMonth(viewMonth - 1); fetchHabits(viewYear, viewMonth - 1) }
  }
  const nextMonth = () => {
    setMobileWeekStart(1)
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); fetchHabits(viewYear + 1, 0) }
    else { setViewMonth(viewMonth + 1); fetchHabits(viewYear, viewMonth + 1) }
  }

  const prevWeek = () => setMobileWeekStart(prev => Math.max(1, prev - 7))
  const nextWeek = () => setMobileWeekStart(prev => Math.min(daysInMonth, prev + 7))

  const prevMobileDay = () => {
    const newDate = new Date(mobileSelectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setMobileSelectedDate(newDate)
    if (newDate.getMonth() !== viewMonth || newDate.getFullYear() !== viewYear) {
      setViewMonth(newDate.getMonth())
      setViewYear(newDate.getFullYear())
      fetchHabits(newDate.getFullYear(), newDate.getMonth())
    }
  }

  const nextMobileDay = () => {
    const newDate = new Date(mobileSelectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setMobileSelectedDate(newDate)
    if (newDate.getMonth() !== viewMonth || newDate.getFullYear() !== viewYear) {
      setViewMonth(newDate.getMonth())
      setViewYear(newDate.getFullYear())
      fetchHabits(newDate.getFullYear(), newDate.getMonth())
    }
  }

  useEffect(() => {
    if (isCurrentMonth) {
      setMobileWeekStart(Math.max(1, todayDay - today.getDay()))
    } else {
      setMobileWeekStart(1)
    }
  }, [viewMonth, viewYear, isCurrentMonth, todayDay])

  // Preserve vertical scroll position during state updates
  const lastScrollPosRef = useMemo(() => ({ top: 0 }), [])

  useEffect(() => {
    const mainEl = document.querySelector('.main-content') || window
    const handleScroll = () => {
      const currentTop = mainEl.scrollTop !== undefined ? mainEl.scrollTop : window.scrollY
      if (currentTop > 0) {
        lastScrollPosRef.top = currentTop
      }
    }
    mainEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => mainEl.removeEventListener('scroll', handleScroll)
  }, [lastScrollPosRef])

  useEffect(() => {
    if (lastScrollPosRef.top > 0) {
      const mainEl = document.querySelector('.main-content') || window
      if (mainEl.scrollTo) {
        mainEl.scrollTo({ top: lastScrollPosRef.top, behavior: 'instant' })
      }
    }
  }, [monthLogs, todayLogs, habits, lastScrollPosRef])

  // Auto-scroll grid to today
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.getElementById('quests-scroll-container')
      const todayCol = document.getElementById('today-column')
      if (container && todayCol) {
        container.scrollTo({
          left: Math.max(0, todayCol.offsetLeft - 245),
          behavior: 'smooth'
        })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [viewMonth, viewYear])

  // Build a lookup map: "habitId::YYYY-MM-DD" -> status
  const logMap = useMemo(() => {
    const m = new Map()
    monthLogs.forEach((l) => m.set(`${l.habit_id}::${l.date}`, l.status || 'completed'))
    return m
  }, [monthLogs])

  const getStatus = (habitId, day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dateObj = new Date(viewYear, viewMonth, day)
    const habit = (allHabits || habits || []).find(h => h.id === habitId)
    if (!habit) return 'none'

    // 1. Explicit user log ALWAYS takes top priority!
    const explicitStatus = logMap.get(`${habitId}::${dateStr}`)
    if (explicitStatus) return explicitStatus

    // 2. Automatically lock days prior to actual habit creation date
    const rawCreatedAt = habit.created_at || habit.created_date
    if (rawCreatedAt) {
      const parsedDate = new Date(rawCreatedAt)
      if (!isNaN(parsedDate.getTime())) {
        const createdDateStr = getLocalDateStr(parsedDate)
        if (dateStr < createdDateStr) return 'locked'
      }
    }

    // 3. Automatically lock days after habit was stopped
    let stoppedDateStr = null
    if (habit.stopped_at) {
      const p = new Date(habit.stopped_at)
      if (!isNaN(p.getTime())) stoppedDateStr = getLocalDateStr(p)
    }
    if (!stoppedDateStr && habit.description) {
      const m = habit.description.match(/\[STOPPED(?:_AT)?:([^\]]+)\]/i)
      if (m && m[1]) {
        const p = new Date(m[1].trim())
        if (!isNaN(p.getTime())) stoppedDateStr = getLocalDateStr(p)
        else if (/^\d{4}-\d{2}-\d{2}$/.test(m[1].trim())) stoppedDateStr = m[1].trim()
      }
    }
    if (!stoppedDateStr && habit.is_active === false && habit.updated_at) {
      const p = new Date(habit.updated_at)
      if (!isNaN(p.getTime())) stoppedDateStr = getLocalDateStr(p)
    }

    if (stoppedDateStr && dateStr > stoppedDateStr) {
      return 'locked'
    }

    // 4. Off-day (Rest Day) -> Return 'rest' (Leaf symbol)
    const freqDays = Array.isArray(habit.frequency_days) && habit.frequency_days.length > 0
      ? habit.frequency_days
      : [0, 1, 2, 3, 4, 5, 6]

    if (!freqDays.includes(dateObj.getDay())) return 'rest'
    
    return 'none'
  }

  const handleToggle = (habitId, day) => {
    const mainEl = document.querySelector('.main-content') || window
    const currentTop = mainEl.scrollTop !== undefined ? mainEl.scrollTop : window.scrollY
    if (currentTop > 0) lastScrollPosRef.top = currentTop

    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (activeTool === 'cycle') {
      cycleHabitState(habitId, dateStr)
    } else {
      cycleHabitState(habitId, dateStr, activeTool)
    }
  }

  const handleDelete = async (habitId) => {
    setConfirmModal({
      isOpen: true,
      title: 'DELETE ROUTINE',
      message: 'Are you sure you want to permanently delete this routine?',
      danger: true,
      confirmText: 'DELETE',
      onConfirm: async () => {
        await deleteHabit(habitId)
        setConfirmModal({ isOpen: false })
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    })
  }

  // Stats for each habit
  const getHabitStats = (habitId) => {
    let completed = 0
    let failed = 0
    const habit = habits.find(h => h.id === habitId)
    const freqDays = Array.isArray(habit?.frequency_days) && habit.frequency_days.length > 0 ? habit.frequency_days : [0,1,2,3,4,5,6]
    let goal = 0

    days.forEach((d) => {
      const dateObj = new Date(viewYear, viewMonth, d)
      if (freqDays.includes(dateObj.getDay())) {
        goal++
      }
      const status = getStatus(habitId, d)
      if (status === 'completed') completed++
      if (status === 'failed') failed++
      if ((status === 'blocked' || status === 'locked' || status === 'rest') && freqDays.includes(dateObj.getDay())) goal--
    })
    
    const left = goal - completed - failed
    const pct = goal <= 0 ? (completed > 0 ? 100 : 0) : Math.round((completed / goal) * 100)
    return { completed, failed, left: Math.max(0, left), pct, goal: Math.max(0, goal) }
  }

  const globalStats = useMemo(() => {
    let done = 0
    let total = 0
    habits.forEach((h) => {
      const freqDays = Array.isArray(h.frequency_days) && h.frequency_days.length > 0 ? h.frequency_days : [0,1,2,3,4,5,6]
      days.forEach((d) => {
        const dateObj = new Date(viewYear, viewMonth, d)
        if (freqDays.includes(dateObj.getDay())) {
          total++
        }
        const status = getStatus(h.id, d)
        if (status === 'completed') done++
        if ((status === 'blocked' || status === 'locked' || status === 'rest') && freqDays.includes(dateObj.getDay())) total--
      })
    })
    return { completed: done, goal: Math.max(0, total), pct: total <= 0 ? 0 : Math.round((done / total) * 100) }
  }, [habits, logMap, days, viewYear, viewMonth])

  // Today's completion stats (excluding rest days and locked days)
  const todayActiveHabits = habits.filter(h => {
    const s = getStatus(h.id, todayDay)
    return s !== 'rest' && s !== 'locked' && s !== 'blocked'
  })
  const todayComplete = todayActiveHabits.filter(h => todayLogs.some(l => l.habit_id === h.id && (!l.status || l.status === 'completed'))).length
  const todayFailed = todayActiveHabits.filter(h => todayLogs.some(l => l.habit_id === h.id && l.status === 'failed')).length
  const todayTotal = todayActiveHabits.length
  const todayPct = todayTotal === 0 ? 0 : Math.round((todayComplete / todayTotal) * 100)

  // Top Consistent Habits
  const topHabits = useMemo(() => {
    return [...habits]
      .map(h => ({ ...h, stats: getHabitStats(h.id) }))
      .sort((a, b) => b.stats.completed - a.stats.completed)
      .slice(0, 10)
  }, [habits, logMap, days])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await addHabit({
      title: newTitle,
      category: newCategory === 'other' ? (customCategory || 'Other') : newCategory,
      stat_category: QUEST_CATEGORIES.find(c => c.id === newCategory)?.stat_category || 'discipline',
      frequency: 'daily',
      frequency_days: newFrequencyDays,
      xp_per_completion: newXp
    })
    setNewTitle('')
    setCustomCategory('')
    setNewFrequencyDays([1,2,3,4,5,6,0])
    setShowAddForm(false)
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editTitle.trim() || !editingHabit) return
    await updateHabit(editingHabit.id, {
      title: editTitle,
      category: editCategory === 'other' ? (editCustomCategory || 'Other') : editCategory,
      stat_category: QUEST_CATEGORIES.find(c => c.id === editCategory)?.stat_category || 'discipline',
      xp_per_completion: editXp,
      frequency: 'daily',
      frequency_days: editFrequencyDays
    })
    setEditingHabit(null)
  }

  const openEditModal = (h) => {
    setEditingHabit(h)
    setEditTitle(h.title)
    const isCustom = !QUEST_CATEGORIES.some(c => c.id === h.category)
    if (isCustom) {
      setEditCategory('other')
      setEditCustomCategory(h.category)
    } else {
      setEditCategory(h.category)
      setEditCustomCategory('')
    }
    setEditXp(h.xp_per_completion || 25)
    
    // Convert old frequencies to array if missing
    let days = h.frequency_days
    if (!days || days.length === 0) {
      if (h.frequency === 'weekdays') days = [1,2,3,4,5]
      else days = [1,2,3,4,5,6,0]
    }
    setEditFrequencyDays(days)
    
    setShowEditForm(true)
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex-center h-full flex-col gap-4 text-center">
          <AlertTriangle size={48} className="text-danger mb-2" />
          <h2 className="font-display text-xl text-danger uppercase tracking-widest">SYSTEM ERROR</h2>
          <p className="font-mono text-sm text-muted max-w-md">{error}</p>
          <button type="button" onClick={() => fetchHabits()} className="btn btn-primary mt-4">RETRY CONNECTION</button>
        </div>
      </AppShell>
    )
  }

  if (loading) return (
    <AppShell>
      <WinterLoader label="Loading habits" />
    </AppShell>
  )

  // Day of week abbreviations
  const getDow = (day) => {
    const d = new Date(viewYear, viewMonth, day)
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]
  }

  return (
    <AppShell>
      <div className="page-container" style={{ maxWidth: '1600px' }}>
        <header className="page-header flex-between flex-wrap gap-4">
          <div>
            <h1 className="page-title">Daily habits</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Monthly overview. Click any cell to toggle completion.</p>
          </div>
          <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> ADD ROUTINE
          </button>
        </header>

        {/* Weight Logging Bar (Above Habit Tracker) */}
        <div className="mb-5 p-3.5 sm:p-4 rounded-xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-md flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-info/10 border border-info/30 text-info">
                <Scale size={18} />
              </div>
              <div>
                <div className="font-mono text-[9px] sm:text-[10px] text-muted uppercase tracking-wider font-bold">CURRENT WEIGHT</div>
                <div className="font-display text-base sm:text-lg text-primary font-bold">
                  {weightStats.latest ? `${weightStats.latest.weight_kg} kg` : '-- kg'}
                </div>
              </div>
            </div>

            {weightStats.prev && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-bg-tertiary border border-border-subtle font-mono text-xs">
                {weightStats.diff > 0 ? (
                  <span className="text-warning flex items-center gap-0.5 font-bold text-[11px]">
                    <TrendingUp size={12} /> +{weightStats.diff} kg
                  </span>
                ) : weightStats.diff < 0 ? (
                  <span className="text-success flex items-center gap-0.5 font-bold text-[11px]">
                    <TrendingDown size={12} /> {weightStats.diff} kg
                  </span>
                ) : (
                  <span className="text-muted text-[11px]">0.0 kg</span>
                )}
                <span className="text-[10px] text-muted ml-0.5">vs last</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber/10 border border-amber/30 text-amber font-mono text-[11px] font-bold">
              <span>TARGET: 70 kg</span>
              {weightStats.distToTarget !== null && (
                <span className="text-muted font-normal text-[10px]">
                  ({weightStats.distToTarget > 0 ? `+${weightStats.distToTarget} kg to go` : `${Math.abs(weightStats.distToTarget)} kg below`})
                </span>
              )}
            </div>
          </div>

          {/* Quick Logger Form */}
          <form onSubmit={handleLogWeight} className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={weightDate}
              onChange={(e) => setWeightDate(e.target.value)}
              className="w-auto bg-bg-tertiary border border-border-subtle text-primary text-xs font-mono px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-info"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                placeholder="70.0"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="bg-bg-tertiary border border-border-subtle text-primary text-xs font-mono px-2.5 py-1.5 rounded w-20 focus:outline-none focus:border-info font-bold"
              />
              <span className="font-mono text-xs text-muted">kg</span>
            </div>
            <button
              type="submit"
              disabled={savingWeight || !weightInput}
              className="btn btn-primary btn-sm font-mono text-xs px-3 py-1.5 disabled:opacity-50 flex items-center gap-1 font-bold"
            >
              {savingWeight ? 'SAVING...' : weightSaveSuccess ? 'SAVED ✓' : '+ LOG WEIGHT'}
            </button>
            {weightSaveSuccess && (
              <span className="text-success text-xs font-mono animate-pulse">Logged!</span>
            )}
          </form>
        </div>

        {/* Paint Tool & Column Width Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex flex-row items-center gap-2 sm:gap-3">
            <span className="font-display text-[10px] uppercase tracking-widest text-muted">PAINT MODE</span>
            <div className="flex flex-row items-center bg-tertiary border border-border-color rounded overflow-hidden">
              <button 
                type="button"
                className={`px-2.5 sm:px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-1.5 transition-colors ${activeTool === 'cycle' ? 'bg-white text-black font-bold' : 'active:bg-hover text-primary'}`}
                onClick={() => setActiveTool('cycle')}
                title="Cycle mode"
              >
                <RotateCcw size={13} /> <span className="hidden sm:inline">CYCLE</span>
              </button>
              <button 
                type="button"
                className={`px-2.5 sm:px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-1.5 transition-colors border-l border-border-color ${activeTool === 'completed' ? 'bg-success text-bg-primary font-bold' : 'active:bg-hover text-success'}`}
                onClick={() => setActiveTool('completed')}
                title="Done mode"
              >
                <Check size={13} /> <span className="hidden sm:inline">DONE</span>
              </button>
              <button 
                type="button"
                className={`px-2.5 sm:px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-1.5 transition-colors border-l border-border-color ${activeTool === 'failed' ? 'bg-danger text-white font-bold' : 'active:bg-hover text-danger'}`}
                onClick={() => setActiveTool('failed')}
                title="Fail mode"
              >
                <X size={13} /> <span className="hidden sm:inline">FAIL</span>
              </button>
              <button 
                type="button"
                className={`px-2.5 sm:px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-1.5 transition-colors border-l border-border-color ${activeTool === 'rest' ? 'bg-emerald-500 text-black font-bold' : 'active:bg-hover text-emerald-400'}`}
                onClick={() => setActiveTool('rest')}
                title="Rest Day mode (Leaf 🍃)"
              >
                <Leaf size={13} /> <span className="hidden sm:inline">REST</span>
              </button>
              <button 
                type="button"
                className={`px-2.5 sm:px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-1.5 transition-colors border-l border-border-color ${activeTool === 'none' ? 'bg-secondary text-bg-primary font-bold' : 'active:bg-hover text-muted'}`}
                onClick={() => setActiveTool('none')}
                title="Clear mode"
              >
                <Trash2 size={13} /> <span className="hidden sm:inline">CLEAR</span>
              </button>
            </div>
          </div>

        </div>

        {/* The Spreadsheet Grid */}
        <style dangerouslySetInnerHTML={{__html: `
          .col-habit { width: ${habitColWidth}px !important; min-width: ${habitColWidth}px !important; max-width: ${habitColWidth}px !important; left: 0 !important; }
          .col-xp { width: 45px !important; min-width: 45px !important; max-width: 45px !important; left: ${habitColWidth}px !important; }
          .col-stat-done { width: 55px !important; min-width: 55px !important; max-width: 55px !important; }
          .col-stat-goal { width: 55px !important; min-width: 55px !important; max-width: 55px !important; }
          .col-stat-pct { width: 65px !important; min-width: 65px !important; max-width: 65px !important; }
        `}} />
        <HudPanel className="p-0 hidden-mobile overflow-x-auto" id="quests-scroll-container" style={{ width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1100px' }}>
            <thead>
              <tr>
                <th className="sticky z-20 col-habit relative select-none" style={{ background: 'var(--bg-tertiary)', padding: 0, borderBottom: '1px solid var(--border-color)', borderRight: '2px solid var(--border-color)', borderTopLeftRadius: 'var(--radius-lg)' }}>
                  <div className="w-full flex items-center justify-between" style={{ padding: '10px 14px 10px 16px', textAlign: 'left' }}>
                    <span className="font-display text-[10px] md:text-xs uppercase tracking-widest text-primary">DAILY HABITS</span>
                  </div>
                </th>
                <th className="sticky z-20 col-xp" style={{ background: 'var(--bg-tertiary)', padding: 0, borderBottom: '1px solid var(--border-color)', borderRight: '2px solid var(--border-color)' }}>
                  <div className="w-full" style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <span className="font-mono text-[10px] text-muted">XP</span>
                  </div>
                </th>
                {days.map((d) => {
                  const isToday = isCurrentMonth && d === todayDay
                  return (
                    <th key={d} id={isToday ? 'today-column' : undefined} style={{
                      padding: '6px 2px', textAlign: 'center',
                      borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-subtle)',
                      background: isToday ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      minWidth: '36px'
                    }}>
                      <div className="font-mono text-[9px] text-muted">{getDow(d)}</div>
                      <div className={`font-mono text-xs ${isToday ? 'text-info font-bold' : 'text-secondary'}`}>{d}</div>
                    </th>
                  )
                })}
                {/* Stats columns */}
                <th className="col-stat-done" style={{ padding: '10px 6px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', borderLeft: '2px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                  <span className="font-mono text-[9px] text-success">DONE</span>
                </th>
                <th className="col-stat-goal" style={{ padding: '10px 6px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                  <span className="font-mono text-[9px] text-muted">GOAL</span>
                </th>
                <th className="col-stat-pct" style={{ padding: '10px 6px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', borderTopRightRadius: 'var(--radius-lg)' }}>
                  <span className="font-mono text-[9px] text-info">%</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {habits.map((habit, idx) => {
                const stats = getHabitStats(habit.id)
                const cat = QUEST_CATEGORIES.find(c => c.id === habit.category) || QUEST_CATEGORIES[0]
                const isDragging = draggedHabitId === habit.id
                const isDragOver = dragOverHabitId === habit.id

                return (
                  <tr 
                    key={habit.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', habit.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setDraggedHabitId(habit.id)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverHabitId !== habit.id) {
                        setDragOverHabitId(habit.id)
                      }
                    }}
                    onDragLeave={(e) => {
                      if (dragOverHabitId === habit.id) {
                        setDragOverHabitId(null)
                      }
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      const droppedId = e.dataTransfer.getData('text/plain') || draggedHabitId
                      setDraggedHabitId(null)
                      setDragOverHabitId(null)
                      if (droppedId && droppedId !== habit.id && reorderHabitsByDrag) {
                        await reorderHabitsByDrag(droppedId, habit.id)
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedHabitId(null)
                      setDragOverHabitId(null)
                    }}
                    className={`group transition-all ${
                      isDragging ? 'opacity-30 bg-amber/10' : 'hover:bg-hover'
                    } ${
                      isDragOver ? 'border-t-2 border-amber' : ''
                    }`}
                  >
                    {/* Habit Name */}
                    <td className="sticky z-10 col-habit group" style={{
                      background: isDragging ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                      padding: 0,
                      borderBottom: '1px solid var(--border-subtle)',
                      borderRight: '2px solid var(--border-color)',
                    }}>
                      <div className="w-full" style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        
                        {/* Drag Handle & Arrow Controls */}
                        <div style={{ width: '24px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="cursor-grab active:cursor-grabbing text-muted hover:text-amber" title="Drag to rearrange routine">
                          <GripVertical size={16} />
                        </div>

                        <div style={{ width: '16px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button onClick={() => reorderHabits(habit.id, 'up')} className="opacity-0 group-hover:opacity-100 text-muted hover:text-amber transition-opacity" title="Move Up"><ArrowUp size={12} /></button>
                          <button onClick={() => reorderHabits(habit.id, 'down')} className="opacity-0 group-hover:opacity-100 text-muted hover:text-amber transition-opacity" title="Move Down"><ArrowDown size={12} /></button>
                        </div>
                        
                        {/* Color Line */}
                        <div style={{ width: '4px', height: '32px', borderRadius: '999px', background: cat.color, flexShrink: 0 }} />
                        
                        {/* Text */}
                        <div style={{ flex: '1 1 0', minWidth: 0, cursor: 'pointer' }} onClick={() => openEditModal(habit)} title={habit.title}>
                          <div className="font-mono text-[10px] md:text-xs text-primary transition-colors hover:text-amber truncate">
                            {habit.title}<MasteryMedal count={masteryCount(habit.id)} />
                          </div>
                          <div className="font-mono text-[8px] md:text-[9px] text-muted uppercase hidden md:flex items-center gap-2 mt-[2px]">
                            <span className="truncate">{cat.name}</span>
                            <span className="opacity-50">|</span>
                            <div className="flex gap-[3px]">
                              {['S','M','T','W','T','F','S'].map((day, i) => (
                                <span key={i} className={(habit.frequency_days || [0,1,2,3,4,5,6]).includes(i) ? 'text-info font-bold' : 'opacity-30'}>{day}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        {/* Right Icon */}
                        <button type="button" onClick={() => handleDelete(habit.id)} className="opacity-100 md:opacity-20 group-hover:opacity-100 transition-opacity text-danger" title="Delete Routine" style={{ width: '24px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                          <Trash2 size={16} />
                        </button>
                        
                      </div>
                    </td>
                    {/* XP */}
                    <td className="sticky z-[5] col-xp" style={{
                      background: 'var(--bg-secondary)',
                      padding: 0,
                      borderBottom: '1px solid var(--border-subtle)',
                      borderRight: '2px solid var(--border-color)',
                    }}>
                      <div className="w-full" style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span className="font-mono text-[10px] text-info font-bold">{habit.xp_per_completion || 25}</span>
                      </div>
                    </td>
                    {/* Day cells */}
                    {days.map((d) => {
                      const status = getStatus(habit.id, d)
                      const isToday = isCurrentMonth && d === todayDay
                      return (
                        <td key={d}
                          onClick={() => handleToggle(habit.id, d)}
                          data-celebrate={(activeTool === 'cycle' && status !== 'completed' && status !== 'failed') || (activeTool === 'completed' && status !== 'completed') ? '' : undefined}
                          style={{
                            textAlign: 'center', padding: '0', cursor: 'pointer', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
                            background: isToday ? 'var(--accent-subtle)' : 'transparent',
                          }}
                          className="hover:bg-hover transition-colors min-w-[44px] h-[44px]"
                        >
                          <div style={{
                            width: '26px', height: '26px', margin: 'auto',
                            border: status === 'none' ? '1px solid var(--border-color)' : 'none',
                            borderRadius: '6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: status === 'completed' ? cat.color : status === 'failed' ? 'var(--danger)' : status === 'rest' ? 'rgba(16, 185, 129, 0.15)' : status === 'locked' || status === 'blocked' ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                            transition: 'all 150ms ease',
                            opacity: status !== 'none' ? 1 : 0.4,
                          }}>
                            {status === 'completed' && <Check size={12} color="#fff" strokeWidth={3} />}
                            {status === 'failed' && <X size={12} color="#fff" strokeWidth={3} />}
                            {status === 'rest' && <Leaf size={12} className="text-emerald-400 opacity-90" strokeWidth={2.5} />}
                            {(status === 'locked' || status === 'blocked') && <Lock size={11} className="text-muted/40" strokeWidth={2} />}
                          </div>
                        </td>
                      )
                    })}
                    {/* Stats cells */}
                    <td className="col-stat-done" style={{ textAlign: 'center', borderLeft: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-subtle)', padding: '6px', background: 'var(--bg-secondary)' }}>
                      <span className="font-mono text-[10px] text-success font-bold">{stats.completed}</span>
                    </td>
                    <td className="col-stat-goal" style={{ textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', padding: '6px', background: 'var(--bg-secondary)' }}>
                      <span className="font-mono text-[10px] text-muted">{stats.goal}</span>
                    </td>
                    <td className="col-stat-pct" style={{ textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', padding: '6px', background: 'var(--bg-secondary)' }}>
                      <span className={`font-mono text-xs font-bold ${stats.pct >= 80 ? 'text-success' : stats.pct >= 50 ? 'text-amber' : 'text-danger'}`}>
                        {stats.pct}%
                      </span>
                    </td>
                  </tr>
                )
              })}

              {/* Global Progress Row */}
              {habits.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--accent-primary)' }}>
                  <td className="sticky z-[5] col-habit" style={{ background: 'var(--bg-tertiary)', padding: 0, borderRight: '2px solid var(--border-color)' }}>
                    <div className="w-full" style={{ padding: '10px 12px' }}>
                      <span className="font-display text-[10px] md:text-xs uppercase tracking-widest text-amber block truncate">GLOBAL PROGRESS</span>
                    </div>
                  </td>
                  <td className="sticky z-[5] col-xp" style={{ background: 'var(--bg-tertiary)', padding: 0, borderRight: '2px solid var(--border-color)' }}>
                    <div className="w-full"></div>
                  </td>
                  {days.map((d) => {
                    const activeHabits = habits.filter(h => {
                      const s = getStatus(h.id, d)
                      return s !== 'rest' && s !== 'locked' && s !== 'blocked'
                    })
                    const dayDone = activeHabits.filter(h => getStatus(h.id, d) === 'completed').length
                    const dayPct = activeHabits.length === 0 ? 0 : Math.round((dayDone / activeHabits.length) * 100)
                    const isToday = isCurrentMonth && d === todayDay
                    return (
                      <td key={d} style={{
                        textAlign: 'center', padding: '6px 2px',
                        background: isToday ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      }}>
                        <span className={`font-mono text-[9px] font-bold ${dayPct === 100 ? 'text-success' : dayPct > 0 ? 'text-amber' : 'text-muted'}`}>
                          {dayPct > 0 ? `${dayPct}` : '·'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="col-stat-done" style={{ textAlign: 'center', borderLeft: '2px solid var(--border-color)', background: 'var(--bg-tertiary)', padding: '6px' }}>
                    <span className="font-mono text-xs text-success font-bold">{globalStats.completed}</span>
                  </td>
                  <td className="col-stat-goal" style={{ textAlign: 'center', background: 'var(--bg-tertiary)', padding: '6px' }}>
                    <span className="font-mono text-xs text-muted">{globalStats.goal - globalStats.completed}</span>
                  </td>
                  <td className="col-stat-pct" style={{ textAlign: 'center', background: 'var(--bg-tertiary)', padding: '6px' }}>
                    <span className={`font-mono text-xs font-bold ${globalStats.pct >= 80 ? 'text-success' : 'text-primary'}`}>{globalStats.pct}%</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {habits.length === 0 && (
            <div className="p-12 text-center">
              <div className="font-mono text-sm text-muted mb-4">NO ROUTINES DEPLOYED</div>
              <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-sm">ADD YOUR FIRST ROUTINE</button>
            </div>
          )}
        </HudPanel>

        {/* Mobile View: Cards for Today's Routine — first on mobile */}
        <div className="hidden-desktop flex flex-col gap-3 quests-card-list">
          <div className="flex-between mb-1 mt-2">
            <span className="font-display text-sm uppercase tracking-widest text-amber">{isMobileToday ? "TODAY'S OPERATIONS" : "OPERATIONS"}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={prevMobileDay} className="p-1 hover:text-primary text-muted transition-colors"><ChevronLeft size={16} /></button>
              <span className="font-mono text-[10px] text-muted">{mobileDateStr}</span>
              <button type="button" onClick={nextMobileDay} className="p-1 hover:text-primary text-muted transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
          {habits.map((habit) => {
            const stats = getHabitStats(habit.id)
            const cat = QUEST_CATEGORIES.find(c => c.id === habit.category) || QUEST_CATEGORIES[0]
            const todayStatus = getStatus(habit.id, mobileSelectedDate.getDate())
            return (
              <HudPanel key={habit.id} className="p-4 flex-between relative overflow-hidden">
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: cat.color }} />
                <div className="flex-col gap-1 pl-2 truncate" style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-display text-base text-primary truncate" onClick={() => openEditModal(habit)}>{habit.title}<MasteryMedal count={masteryCount(habit.id)} /></div>
                  <div className="font-mono text-[10px] text-muted uppercase truncate">{cat.name} • {stats.pct}% WIN RATE</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col gap-0.5 pr-0.5">
                    <button type="button" onClick={(e) => { e?.stopPropagation?.(); reorderHabits(habit.id, 'up') }} className="p-1 text-muted hover:text-amber transition-colors" title="Move Up"><ArrowUp size={12} /></button>
                    <button type="button" onClick={(e) => { e?.stopPropagation?.(); reorderHabits(habit.id, 'down') }} className="p-1 text-muted hover:text-amber transition-colors" title="Move Down"><ArrowDown size={12} /></button>
                  </div>
                  <span className="font-mono text-[10px] text-info font-bold">+{habit.xp_per_completion || 25} XP</span>
                  <button 
                    type="button"
                    data-celebrate={(activeTool === 'cycle' && todayStatus !== 'completed' && todayStatus !== 'failed') || (activeTool === 'completed' && todayStatus !== 'completed') ? '' : undefined}
                    onClick={(e) => { e?.stopPropagation?.(); handleToggle(habit.id, mobileSelectedDate.getDate()) }}
                    className="flex items-center justify-center transition-all active:scale-95"
                    style={{
                      width: '42px', height: '42px',
                      border: todayStatus === 'none' ? '2px solid var(--border-color)' : 'none',
                      borderRadius: '12px',
                      background: todayStatus === 'completed' ? cat.color : todayStatus === 'failed' ? 'var(--danger)' : 'var(--bg-tertiary)',
                      boxShadow: todayStatus === 'completed' || todayStatus === 'failed' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                    }}
                  >
                    {todayStatus === 'completed' && <Check size={24} color="#fff" strokeWidth={3} />}
                    {todayStatus === 'failed' && <X size={24} color="#fff" strokeWidth={3} />}
                    {todayStatus === 'rest' && <Leaf size={20} className="text-emerald-400" strokeWidth={2} />}
                    {(todayStatus === 'locked' || todayStatus === 'blocked') && <Lock size={18} className="text-muted/50" strokeWidth={2} />}
                  </button>
                </div>
              </HudPanel>
            )
          })}
          {habits.length === 0 && (
            <div className="p-8 text-center border border-border-color rounded-2xl border-dashed">
              <div className="font-mono text-sm text-muted mb-4">NO ROUTINES DEPLOYED</div>
              <button type="button" onClick={() => setShowAddForm(true)} className="btn btn-primary btn-sm w-full">ADD ROUTINE</button>
            </div>
          )}
        </div>

        {/* Month Navigation — placed after habits table on phone and desktop */}
        <div className="flex items-center justify-center my-6 quests-paint-grid">
          <HudPanel className="flex-center gap-6 p-5">
            <button onClick={prevMonth} className="btn btn-ghost p-2 hover:text-amber"><ChevronLeft size={20} /></button>
            <div className="text-center">
              <div className="font-display text-2xl uppercase tracking-widest text-primary">{MONTH_NAMES[viewMonth]}</div>
              <div className="font-mono text-xs text-muted">{viewYear}</div>
            </div>
            <button onClick={nextMonth} className="btn btn-ghost p-2 hover:text-amber"><ChevronRight size={20} /></button>
          </HudPanel>
        </div>

        {/* Progress Stats Row — placed after habits table on phone and desktop */}
        <div className="grid-2 gap-4 mb-6 quests-stats-row">
          {/* Today's Progress */}
          <HudPanel glow className="flex items-center gap-5 p-5">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-strong)" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent-primary)" strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - todayPct / 100)}`}
                  strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-lg text-primary">{todayPct}%</span>
              </div>
            </div>
            <div>
              <div className="font-display text-lg uppercase tracking-wider text-primary">TODAY</div>
              <div className="font-mono text-sm text-secondary">{todayComplete} / {todayTotal} completed</div>
            </div>
          </HudPanel>
          
          {/* Monthly Progress */}
          <HudPanel className="flex items-center gap-5 p-5">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-strong)" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--info)" strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - globalStats.pct / 100)}`}
                  strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-lg text-info">{globalStats.pct}%</span>
              </div>
            </div>
            <div>
              <div className="font-display text-lg uppercase tracking-wider text-info">MONTH TOTAL</div>
              <div className="font-mono text-sm text-secondary">{globalStats.completed} / {globalStats.goal} total</div>
            </div>
          </HudPanel>
        </div>

        {/* Top 10 Daily Habits Sidebar */}
        {topHabits.length > 0 && (
          <div className="grid-2 gap-6 mt-6 quests-sidebar">
            <HudPanel label="TOP 10 CONSISTENT ROUTINES">
              <div className="flex-col gap-2">
                {topHabits.map((h, i) => {
                  const status = getStatus(h.id, todayDay)
                  const isComplete = status === 'completed'
                  const isFailed = status === 'failed'
                  const isBlocked = status === 'blocked'
                  
                  return (
                    <div key={h.id} className={`flex items-center gap-3 p-2 hover:bg-hover transition-colors ${isBlocked ? 'opacity-50 grayscale' : ''}`}>
                      <span className="font-mono text-xs text-muted w-5 text-right">{i + 1}</span>
                      <button 
                        type="button"
                        data-celebrate={!isComplete && !isFailed ? '' : undefined}
                        onClick={(e) => { e?.stopPropagation?.(); cycleHabitState(h.id, todayStr) }}
                        className="flex items-center justify-center transition-all hover:scale-110"
                        style={{
                          width: '24px', height: '24px',
                          border: isComplete || isFailed || isBlocked ? 'none' : '1.5px solid var(--border-color)',
                          borderRadius: '4px',
                          background: isComplete ? QUEST_CATEGORIES.find(c => c.id === h.category)?.color || 'var(--success)' : isFailed ? 'var(--danger)' : 'var(--bg-tertiary)',
                        }}
                      >
                        {isComplete && <Check size={14} color="#fff" strokeWidth={3} />}
                        {isFailed && <X size={14} color="#fff" strokeWidth={3} />}
                        {isBlocked && <Leaf size={14} color="var(--warning)" strokeWidth={3} />}
                      </button>
                      <span className={`font-mono text-sm flex-1 ${isComplete ? 'text-muted line-through' : isFailed ? 'text-danger line-through' : isBlocked ? 'text-muted' : 'text-primary'}`}>
                        {h.title} {isBlocked && <span className="text-[10px] ml-2 text-success opacity-90 tracking-widest">REST</span>}
                      </span>
                      {isComplete && <span className="font-mono text-[10px] text-success">+{isBlocked ? 0 : (h.xp_per_completion || 25)} XP</span>}
                      {isFailed && <span className="font-mono text-[10px] text-danger">-{isBlocked ? 0 : Math.max(5, Math.round((h.xp_per_completion || 25) * 0.5))} XP</span>}
                      {!isComplete && !isFailed && <span className={`font-mono text-[10px] font-bold ${isBlocked ? 'text-muted' : 'text-info'}`}>+{isBlocked ? 0 : (h.xp_per_completion || 25)} XP</span>}
                    </div>
                  )
                })}
              </div>
            </HudPanel>

            <HudPanel label="STREAK & CONSISTENCY">
              <div className="flex-col gap-4">
                {habits.map(h => {
                  const stats = getHabitStats(h.id)
                  return (
                    <div key={h.id}>
                      <div className="flex-between mb-1">
                        <span className="font-mono text-xs text-primary">{h.title}</span>
                        <span className="font-mono text-[10px] text-info font-bold flex items-center gap-1">
                          <Flame size={10} /> {h.current_streak || 0}d
                        </span>
                      </div>
                      <div className="mt-2">
                        <TacticalProgress 
                          value={stats.pct} 
                          color={stats.pct >= 80 ? 'var(--success)' : stats.pct >= 50 ? 'var(--info)' : 'var(--danger)'} 
                          height={6} 
                          showValue={false} 
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </HudPanel>
          </div>
        )}

        {/* Weight Trends Graph (After Streaks) */}
        <div className="mt-6">
          <HudPanel label="WEIGHT TRENDS">
            <div className="flex flex-col gap-4">
              {/* Header Stats Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-info/10 border border-info/30 text-info">
                      <Scale size={18} />
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-muted uppercase tracking-wider font-bold">Current Weight</div>
                      <div className="font-display text-xl text-primary font-bold">
                        {weightStats.latest ? `${weightStats.latest.weight_kg} kg` : '-- kg'}
                      </div>
                    </div>
                  </div>

                  {weightStats.prev && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-bg-secondary border border-border-subtle font-mono text-xs">
                      {weightStats.diff > 0 ? (
                        <span className="text-warning flex items-center gap-0.5 font-bold">
                          <TrendingUp size={13} /> +{weightStats.diff} kg
                        </span>
                      ) : weightStats.diff < 0 ? (
                        <span className="text-success flex items-center gap-0.5 font-bold">
                          <TrendingDown size={13} /> {weightStats.diff} kg
                        </span>
                      ) : (
                        <span className="text-muted">0.00 kg</span>
                      )}
                      <span className="text-[10px] text-muted ml-1">vs last</span>
                    </div>
                  )}

                  {/* Target Badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber/10 border border-amber/30 font-mono text-xs">
                    <span className="text-amber font-bold flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber"></span>
                      TARGET: {TARGET_WEIGHT} kg
                    </span>
                    {weightStats.distToTarget !== null && (
                      <span className="text-muted text-[11px]">
                        ({weightStats.distToTarget > 0 ? `+${weightStats.distToTarget} kg to target` : weightStats.distToTarget < 0 ? `${Math.abs(weightStats.distToTarget)} kg under target` : 'GOAL REACHED! 🎯'})
                      </span>
                    )}
                  </div>

                  {weightStats.count > 0 && (
                    <div className="hidden md:flex items-center gap-3 font-mono text-[11px] text-muted pl-2 border-l border-border-subtle">
                      <span>MIN: <strong className="text-primary">{weightStats.min}</strong> kg</span>
                      <span>MAX: <strong className="text-primary">{weightStats.max}</strong> kg</span>
                      <span>LOGS: <strong className="text-info">{weightStats.count}</strong></span>
                    </div>
                  )}
                </div>

                {/* Range Selector */}
                <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-lg border border-border-subtle">
                  {[
                    { id: '14days', label: '14D' },
                    { id: '30days', label: '30D' },
                    { id: 'all', label: 'ALL' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setWeightRange(tab.id)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                        weightRange === tab.id
                          ? 'bg-info/20 text-info border border-info/40'
                          : 'text-muted hover:text-primary border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trends Graph */}
              <div className="w-full h-64 pt-2">
                {chartWeightData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartWeightData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--info)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="var(--info)" stopOpacity={0.0} />
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
                        domain={weightDomain} 
                        stroke="var(--text-muted)" 
                        fontSize={10} 
                        tickLine={false}
                        tickFormatter={(v) => `${v}k`}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            const diffFromTarget = Number((data.weight - TARGET_WEIGHT).toFixed(1))
                            return (
                              <div className="bg-bg-tertiary border border-border-color p-2.5 rounded shadow-xl font-mono text-xs">
                                <div className="text-muted text-[10px] mb-1">{data.fullDate || data.date}</div>
                                <div className="text-info font-bold flex items-center gap-1.5">
                                  <Scale size={12} /> {data.weight} kg
                                </div>
                                <div className="text-amber text-[10px] mt-1 pt-1 border-t border-border-subtle">
                                  Target: {TARGET_WEIGHT} kg ({diffFromTarget > 0 ? `+${diffFromTarget}` : diffFromTarget} kg)
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <ReferenceLine 
                        y={TARGET_WEIGHT} 
                        stroke="var(--amber, #f59e0b)" 
                        strokeDasharray="5 5" 
                        strokeWidth={1.5} 
                        label={{ 
                          value: `TARGET: ${TARGET_WEIGHT} kg`, 
                          fill: 'var(--amber, #f59e0b)', 
                          fontSize: 10, 
                          fontWeight: 'bold',
                          position: 'insideTopRight' 
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="var(--info)" 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#weightGrad)" 
                        dot={{ r: 3, fill: 'var(--info)', strokeWidth: 1, stroke: 'var(--bg-primary)' }}
                        activeDot={{ r: 5, fill: 'var(--info)', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border border-dashed border-border-subtle rounded-lg text-muted font-mono text-xs gap-2">
                    <Scale size={24} className="opacity-40" />
                    <span>NO WEIGHT LOGS RECORDED YET. LOG YOUR FIRST WEIGHT AT THE TOP.</span>
                  </div>
                )}
              </div>

              {/* Legend Info */}
              <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-2 border-t border-border-subtle/50 px-1">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 bg-info"></span> Recorded Weight
                  </span>
                  <span className="flex items-center gap-1.5 text-amber">
                    <span className="inline-block w-3 h-0.5 border-t border-dashed border-amber"></span> Target ({TARGET_WEIGHT} kg)
                  </span>
                </div>
                <span>* Weight is logged exclusively in the top header bar</span>
              </div>
            </div>
          </HudPanel>
        </div>

        {/* Shrunk Stopped Routines Panel */}
        {stoppedHabits && stoppedHabits.length > 0 && (
          <div className="mt-6 quests-stopped-routines">
            <HudPanel 
              label={`STOPPED ROUTINES (${stoppedHabits.length})`}
              action={
                <button
                  type="button"
                  onClick={() => setShowStoppedRoutines(prev => !prev)}
                  className="font-mono text-[10px] px-2.5 py-1 rounded bg-bg-secondary hover:bg-hover border border-border-subtle text-muted hover:text-primary transition-colors uppercase font-bold"
                >
                  {showStoppedRoutines ? 'COLLAPSE ▲' : `VIEW (${stoppedHabits.length}) ▼`}
                </button>
              }
            >
              {showStoppedRoutines ? (
                <div className="flex flex-col gap-2 pt-1">
                  {stoppedHabits.map((h) => {
                    const cat = QUEST_CATEGORIES.find(c => c.id === h.category) || QUEST_CATEGORIES[0]
                    return (
                      <div key={h.id} className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-secondary/70 flex items-center justify-between gap-3 hover:border-border-color transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded font-mono text-[9px] bg-danger/20 border border-danger/40 text-danger uppercase font-bold shrink-0">STOPPED</span>
                          <span className="font-display text-xs text-primary truncate">{h.title}</span>
                          <span className="hidden sm:inline font-mono text-[10px] text-muted truncate">({cat.name})</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={async () => { await resumeHabit(h.id) }}
                            className="btn btn-primary btn-sm flex items-center gap-1 text-[11px] font-mono py-1 px-2.5"
                            title="Reactivate this routine"
                          >
                            <PlayCircle size={12} /> CONTINUE
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: 'PERMANENTLY DELETE ROUTINE',
                                message: `Are you sure you want to permanently delete "${h.title}"?`,
                                danger: true,
                                confirmText: 'DELETE PERMANENTLY',
                                onConfirm: async () => {
                                  await deleteHabit(h.id);
                                  setConfirmModal({ isOpen: false });
                                },
                                onCancel: () => setConfirmModal({ isOpen: false })
                              })
                            }}
                            className="p-1 text-muted hover:text-danger rounded border border-transparent hover:border-danger/40 transition-colors"
                            title="Permanently delete routine"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between py-1 text-xs font-mono text-muted">
                  <span>{stoppedHabits.length} routine{stoppedHabits.length > 1 ? 's' : ''} paused and preserved in background.</span>
                  <button
                    type="button"
                    onClick={() => setShowStoppedRoutines(true)}
                    className="text-info hover:underline font-bold text-[11px]"
                  >
                    CONTINUE ROUTINES →
                  </button>
                </div>
              )}
            </HudPanel>
          </div>
        )}

        {/* Add Form Modal */}
        <AnimatePresence>
          {showAddForm && (
            <div className="modal-overlay">
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="w-full sm:w-auto p-4"
              >
                <HudPanel className="modal-content border-info" style={{ width: '480px', maxWidth: '100%' }}>
                  <div className="flex-between mb-4 border-b border-border-color pb-3">
                    <span className="font-display text-xl uppercase text-amber">Add Routine</span>
                    <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-danger"><X size={18} /></button>
                  </div>
                  <form onSubmit={handleAdd} className="flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">ROUTINE TITLE</label>
                      <input type="text" className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} required autoFocus placeholder="e.g. Wake up at 7AM" />
                    </div>
                    <div className="grid-2 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                        <select className="select font-mono w-full" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                          {QUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {newCategory === 'other' && (
                          <div className="mt-2">
                            <input type="text" className="input font-mono text-xs w-full" 
                              value={customCategory} 
                              onChange={e => setCustomCategory(e.target.value)}
                              placeholder="Specify category..." required />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">XP PER DAY</label>
                        <input type="number" className="input font-mono" value={newXp} onChange={e => setNewXp(e.target.value)} min="1" max="100" />
                      </div>
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">ACTIVE DAYS</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {DAYS_OF_WEEK.map(day => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setNewFrequencyDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value].sort())}
                            className={`px-2 py-1 rounded border font-mono text-xs transition-colors`}
                            style={newFrequencyDays.includes(day.value) ? { backgroundColor: 'var(--warning-subtle)', borderColor: 'var(--warning)', color: 'var(--warning)' } : { backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button type="submit" className="btn btn-primary flex-1">DEPLOY</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>ABORT</button>
                    </div>
                  </form>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* Edit Routine Modal */}
      <AnimatePresence>
        {editingHabit && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="w-full sm:w-auto p-4"
            >
              <HudPanel className="modal-content border-amber" style={{ width: '480px', maxWidth: '100%' }}>
                <div className="flex-between mb-4 border-b border-border-color pb-3">
                  <span className="font-display text-xl uppercase text-amber">Edit Routine</span>
                  <button onClick={() => setEditingHabit(null)} className="text-muted hover:text-danger"><X size={18} /></button>
                </div>
                <form onSubmit={handleEditSave} className="flex-col gap-4">
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">ROUTINE TITLE</label>
                    <input type="text" className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} required autoFocus />
                  </div>
                  <div className="grid-2 gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                      <select className="select font-mono w-full" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                        {QUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      {editCategory === 'other' && (
                        <div className="mt-2">
                          <input type="text" className="input font-mono text-xs w-full" 
                            value={editCustomCategory} 
                            onChange={e => setEditCustomCategory(e.target.value)}
                            placeholder="Specify category..." required />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">XP PER DAY</label>
                      <input type="number" className="input font-mono" value={editXp} onChange={e => setEditXp(e.target.value)} min="1" max="100" />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">ACTIVE DAYS</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => setEditFrequencyDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value].sort())}
                          className={`px-2 py-1 rounded border font-mono text-xs transition-colors`}
                          style={editFrequencyDays.includes(day.value) ? { backgroundColor: 'var(--warning-subtle)', borderColor: 'var(--warning)', color: 'var(--warning)' } : { backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setEditingHabit(null)} className="btn btn-ghost flex-1">CANCEL</button>
                      <button type="submit" className="btn btn-primary flex-1">SAVE CHANGES</button>
                    </div>
                    <button 
                      type="button" 
                      onClick={async () => {
                        await stopHabit(editingHabit.id)
                        setEditingHabit(null)
                      }} 
                      className="btn border border-warning/60 text-warning hover:bg-warning/20 transition-colors w-full flex justify-center items-center gap-2 mt-2 font-mono text-xs font-bold"
                    >
                      <PauseCircle size={16} /> STOP ROUTINE (PRESERVE DATA)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'PERMANENTLY DELETE ROUTINE',
                          message: 'Are you sure you want to permanently delete this routine? This action cannot be undone.',
                          danger: true,
                          confirmText: 'DELETE PERMANENTLY',
                          onConfirm: async () => {
                            await deleteHabit(editingHabit.id);
                            setEditingHabit(null);
                            setConfirmModal({ isOpen: false });
                          },
                          onCancel: () => setConfirmModal({ isOpen: false })
                        })
                      }} 
                      className="btn border border-danger/40 text-danger hover:bg-danger/20 transition-colors w-full flex justify-center items-center gap-2 text-xs font-mono opacity-80 hover:opacity-100"
                    >
                      <Trash2 size={14} /> PERMANENTLY DELETE
                    </button>
                  </div>
                </form>
              </HudPanel>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmModal {...confirmModal} />
      </div>
    </AppShell>
  )
}
