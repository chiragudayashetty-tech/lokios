'use client'

import { useState, useMemo, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Plus, Check, X, Archive, Trash2, ChevronLeft, ChevronRight, AlertTriangle, ArrowUp, ArrowDown, Flame, ChevronsUp, GripVertical, RotateCcw, Crosshair, Leaf, Scale, Moon, Clock, Sparkles, CheckCircle2, Minus } from 'lucide-react'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { getLocalDateStr } from '@/lib/utils/dates'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'

export default function DailyOps() {
  const {
    habits, monthLogs, todayLogs, loading, error,
    fetchHabits, cycleHabitState, addHabit, deleteHabit, archiveHabit, reorderHabits, reorderHabitsByDrag, updateHabit
  } = useOS().habits

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

  // Body Weight Widget State
  const [weightKg, setWeightKg] = useState('')
  const [weightLoggedToday, setWeightLoggedToday] = useState(false)
  const [weightSaving, setWeightSaving] = useState(false)
  const [weightMsg, setWeightMsg] = useState(null)

  // Habit Column Width Resizer State (Persisted in localStorage)
  const [habitColWidth, setHabitColWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lokios_habit_col_width')
      return saved ? parseInt(saved, 10) : 260
    }
    return 260
  })

  const startResizingHabitCol = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
    const startWidth = habitColWidth

    const onMove = (moveEvent) => {
      const currentX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX
      const newWidth = Math.max(160, Math.min(600, startWidth + (currentX - startX)))
      setHabitColWidth(newWidth)
      if (typeof window !== 'undefined') {
        localStorage.setItem('lokios_habit_col_width', newWidth.toString())
      }
    }

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onEnd)
  }

  // Sleep Tracker Widget State (Persisted in localStorage across tab switches)
  const [sleepTargetDate, setSleepTargetDate] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lokios_sleep_target_date') || yesterdayStr
    }
    return yesterdayStr
  })
  const [bedtime, setBedtime] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lokios_last_bedtime') || '23:30'
    }
    return '23:30'
  })
  const [wakeTime, setWakeTime] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lokios_last_waketime') || '07:00'
    }
    return '07:00'
  })
  const [sleepSaving, setSleepSaving] = useState(false)
  const [sleepMsg, setSleepMsg] = useState(null)

  // Save state choices to localStorage
  const handleSetSleepTargetDate = (dateVal) => {
    setSleepTargetDate(dateVal)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_sleep_target_date', dateVal)
  }
  const handleSetBedtime = (val) => {
    setBedtime(val)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_last_bedtime', val)
  }
  const handleSetWakeTime = (val) => {
    setWakeTime(val)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_last_waketime', val)
  }

  // Fetch today's weight log
  useEffect(() => {
    if (!user) return
    const sb = createClient()
    sb.from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayStr)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setWeightKg(String(data.weight_kg))
          setWeightLoggedToday(true)
        }
      })
  }, [user, todayStr])

  // Fetch existing sleep log when selected date changes
  useEffect(() => {
    if (!user || !sleepTargetDate) return
    const sb = createClient()
    sb.from('sleep_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', sleepTargetDate)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.bedtime) handleSetBedtime(data.bedtime)
          if (data.wake_time) handleSetWakeTime(data.wake_time)

          const [bH] = (data.bedtime || '23:00').split(':').map(Number)
          const [wH, wM] = (data.wake_time || '08:00').split(':').map(Number)
          const dur = parseFloat(data.duration_hours || 0)

          const isOptBed = bH >= 20 || bH <= 1
          const isAccBed = bH >= 20 || bH <= 2
          const isOptWake = wH < 9 || (wH === 9 && wM === 0)
          const isAccWake = wH < 10 || (wH === 10 && wM === 0)
          const isOptDur = dur >= 6.0 && dur <= 9.5
          const isAccDur = dur >= 5.5 && dur <= 10.5

          const isOpt = isOptBed && isOptWake && isOptDur
          const isAcc = isAccBed && isAccWake && isAccDur

          let logXp = -15
          let logTitle = '🚨 POOR SLEEP SCHEDULE (-15 XP)'
          let logSuccess = false

          if (isOpt) {
            logXp = 30
            logTitle = '✓ OPTIMAL SLEEP TARGET (+30 XP)'
            logSuccess = true
          } else if (isAcc) {
            logXp = 10
            logTitle = 'ACCEPTABLE SLEEP SCHEDULE (+10 XP)'
            logSuccess = true
          }

          setSleepMsg({
            success: logSuccess,
            title: logTitle,
            subtitle: `Logged for ${data.date}: ${data.bedtime} to ${data.wake_time} (${data.duration_hours}h)`,
            xp: logXp
          })
        } else {
          setSleepMsg(null)
        }
      })
  }, [user, sleepTargetDate])

  // Calculate live sleep duration
  const liveSleepDuration = useMemo(() => {
    if (!bedtime || !wakeTime) return null
    const [bH, bM] = bedtime.split(':').map(Number)
    const [wH, wM] = wakeTime.split(':').map(Number)
    let bedMins = bH * 60 + bM
    let wakeMins = wH * 60 + wM
    if (wakeMins <= bedMins) {
      wakeMins += 24 * 60
    }
    const diffMins = wakeMins - bedMins
    const hrs = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    const totalHours = parseFloat((diffMins / 60).toFixed(1))
    return { hrs, mins, totalHours, bedHour: bH }
  }, [bedtime, wakeTime])

  const handleSaveWeight = async () => {
    if (!user || !weightKg) return
    const w = parseFloat(weightKg)
    if (isNaN(w) || w <= 0) return
    setWeightSaving(true)
    const sb = createClient()

    // Delete any existing weight log for today, then insert fresh (like habits)
    await sb.from('weight_logs').delete().eq('user_id', user.id).eq('date', todayStr)
    const { error: wErr } = await sb.from('weight_logs').insert({
      user_id: user.id,
      date: todayStr,
      weight_kg: w
    })

    if (!wErr) {
      // sourceId = todayStr so robustAwardXP can deduplicate per day
      await robustAwardXP(user.id, 2, 'weight', todayStr, 'Daily Weight Logged')
      setWeightLoggedToday(true)
      setWeightMsg({ success: true, title: 'BODY WEIGHT LOGGED', subtitle: `${w} kg recorded for today`, xp: 2 })
    }
    setWeightSaving(false)
  }

  const handleSaveSleep = async () => {
    if (!user || !liveSleepDuration) return
    setSleepSaving(true)
    const sb = createClient()

    const [bH, bM] = bedtime.split(':').map(Number)
    const [wH, wM] = wakeTime.split(':').map(Number)

    // ── Sleep Schedule Evaluation Matrix ──
    // Optimal: Bedtime 8 PM - 1 AM, Wake before 9 AM, Duration 6.0h - 9.5h (+30 XP)
    // Acceptable: Bedtime 8 PM - 2 AM, Wake before 10 AM, Duration 5.5h - 10.0h (+10 XP)
    // Poor/Ruined: Bedtime past 2 AM, Wake past 10 AM, or Duration <5.5h / >10.5h (-15 XP Penalty)

    const isOptimalBedtime = bH >= 20 || bH <= 1
    const isAcceptableBedtime = bH >= 20 || bH <= 2

    const isOptimalWake = wH < 9 || (wH === 9 && wM === 0)
    const isAcceptableWake = wH < 10 || (wH === 10 && wM === 0)

    const isOptimalDuration = liveSleepDuration.totalHours >= 6.0 && liveSleepDuration.totalHours <= 9.5
    const isAcceptableDuration = liveSleepDuration.totalHours >= 5.5 && liveSleepDuration.totalHours <= 10.5

    const isOptimal = isOptimalBedtime && isOptimalWake && isOptimalDuration
    const isAcceptable = isAcceptableBedtime && isAcceptableWake && isAcceptableDuration

    let xpAmount = -15
    let statusStr = 'deprived'
    let titleText = '🚨 POOR SLEEP SCHEDULE (-15 XP)'

    if (isOptimal) {
      xpAmount = 30
      statusStr = 'healthy'
      titleText = '✓ OPTIMAL SLEEP TARGET (+30 XP)'
    } else if (isAcceptable) {
      xpAmount = 10
      statusStr = 'healthy'
      titleText = 'ACCEPTABLE SLEEP SCHEDULE (+10 XP)'
    }

    let failReasons = []
    if (!isAcceptableBedtime) failReasons.push(`Late Bedtime (${bedtime})`)
    if (!isAcceptableWake) failReasons.push(`Late Wake Up (${wakeTime})`)
    if (liveSleepDuration.totalHours > 10.5) failReasons.push(`Overslept (${liveSleepDuration.totalHours}h)`)
    if (liveSleepDuration.totalHours < 5.5) failReasons.push(`Under-slept (${liveSleepDuration.totalHours}h)`)

    // 1. Optimistic UI update
    setSleepMsg({
      success: xpAmount > 0,
      title: titleText,
      subtitle: statusStr === 'healthy' 
        ? `Bedtime: ${bedtime} · Wake: ${wakeTime} · Duration: ${liveSleepDuration.totalHours}h` 
        : `Logged: ${liveSleepDuration.totalHours}h (${failReasons.join(' · ') || 'Irregular schedule'})`,
      xp: xpAmount
    })
    setSleepSaving(false)

    // 2. Save to DB: Delete old entry for this date, then insert fresh (like habits)
    try {
      const sleepPayload = {
        user_id: user.id,
        date: sleepTargetDate,
        bedtime,
        wake_time: wakeTime,
        duration_hours: liveSleepDuration.totalHours,
        status: statusStr
      }

      // Try delete first (may fail due to RLS — that's OK)
      const { error: delErr } = await sb.from('sleep_logs').delete().eq('user_id', user.id).eq('date', sleepTargetDate)
      if (delErr) console.warn('Sleep delete warning (non-fatal):', delErr.message)

      // Insert fresh entry
      const { error: insertErr } = await sb.from('sleep_logs').insert(sleepPayload)

      if (insertErr) {
        console.error('Sleep log insert failed:', insertErr.message)
        // If insert failed (maybe duplicate row still exists), try upsert as fallback
        const { error: upsertErr } = await sb.from('sleep_logs').upsert(sleepPayload)
        if (upsertErr) console.error('Sleep log upsert fallback also failed:', upsertErr.message)
      }

      // Verify the data actually persisted
      const { data: verifyData } = await sb.from('sleep_logs').select('id').eq('user_id', user.id).eq('date', sleepTargetDate).maybeSingle()
      if (!verifyData) {
        console.error('CRITICAL: Sleep log was NOT persisted for date:', sleepTargetDate)
      }

      // Award or deduct XP (robustAwardXP handles dedup by deleting old XP for this date)
      const xpLogReason = xpAmount < 0 
        ? `🚨 Poor Sleep Schedule (${bedtime} → ${wakeTime}, ${liveSleepDuration.totalHours}h)`
        : `Sleep Logged (${liveSleepDuration.totalHours}h)`
      await robustAwardXP(user.id, xpAmount, 'sleep', sleepTargetDate, xpLogReason)

      // Notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lokios_sleep_updated'))
      }
    } catch (e) {
      console.error('Sleep save error:', e)
    }
  }

  const handleDropStaticSleepHabits = async () => {
    const sleepHabits = habits.filter(h => {
      const title = h.title?.toLowerCase() || ''
      return title.includes('sleep') || title.includes('wake') || title.includes('bedtime')
    })

    if (sleepHabits.length === 0) {
      setConfirmModal({
        isOpen: true,
        title: 'NO STATIC SLEEP HABITS',
        message: 'No active static sleep habits were found in your habit list.',
        danger: false,
        confirmText: 'OK',
        onConfirm: () => setConfirmModal({ isOpen: false }),
        onCancel: () => setConfirmModal({ isOpen: false })
      })
      return
    }

    setConfirmModal({
      isOpen: true,
      title: 'DROP STATIC SLEEP HABITS',
      message: `Found ${sleepHabits.length} old static sleep habit(s): "${sleepHabits.map(h => h.title).join('", "')}". Archive them now and rely on the new Dynamic Sleep Tracker?`,
      danger: true,
      confirmText: 'ARCHIVE HABITS',
      onConfirm: async () => {
        for (const h of sleepHabits) {
          await archiveHabit(h.id)
        }
        setConfirmModal({ isOpen: false })
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    })
  }

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
  }, [monthLogs, todayLogs, habits, weightLoggedToday, sleepMsg, lastScrollPosRef])

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
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return 'none'

    const freqDays = habit.frequency_days || [0,1,2,3,4,5,6]
    
    const explicitStatus = logMap.get(`${habitId}::${dateStr}`)
    if (explicitStatus) return explicitStatus
    
    // Automatically block days prior to habit creation date (with smart recovery for corrupted timestamps)
    let createdDateStr = null
    const rawCreatedAt = habit.created_at || habit.created_date

    if (rawCreatedAt && (rawCreatedAt.startsWith('2026-01-01') || rawCreatedAt.startsWith('2026-01-02'))) {
      const logsForHabit = monthLogs.filter(l => l.habit_id === habitId && l.date)
      if (logsForHabit.length > 0) {
        const sortedLogs = [...logsForHabit].sort((a, b) => a.date.localeCompare(b.date))
        createdDateStr = sortedLogs[0].date
      } else {
        createdDateStr = getLocalDateStr()
      }
    } else if (rawCreatedAt) {
      const parsedDate = new Date(rawCreatedAt)
      if (!isNaN(parsedDate.getTime())) {
        createdDateStr = getLocalDateStr(parsedDate)
      }
    } else {
      createdDateStr = getLocalDateStr()
    }
    
    if (createdDateStr && !isNaN(new Date(createdDateStr).getTime()) && dateStr < createdDateStr) {
      return 'blocked'
    }

    // Automatically block days not in the active days array
    if (!freqDays.includes(dateObj.getDay())) return 'blocked'
    
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
    const freqDays = habit?.frequency_days || [0,1,2,3,4,5,6]
    let goal = 0

    days.forEach((d) => {
      const dateObj = new Date(viewYear, viewMonth, d)
      if (freqDays.includes(dateObj.getDay())) {
        goal++
      }
      const status = getStatus(habitId, d)
      if (status === 'completed') completed++
      if (status === 'failed') failed++
      // Only reduce goal if it was a manual block on an otherwise active day
      if (status === 'blocked' && freqDays.includes(dateObj.getDay())) goal--
    })
    
    const left = goal - completed - failed
    const pct = goal === 0 ? 0 : Math.round((completed / goal) * 100)
    return { completed, failed, left: Math.max(0, left), pct, goal }
  }

  const globalStats = useMemo(() => {
    let done = 0
    let total = 0
    habits.forEach((h) => {
      const freqDays = h.frequency_days || [0,1,2,3,4,5,6]
      days.forEach((d) => {
        const dateObj = new Date(viewYear, viewMonth, d)
        if (freqDays.includes(dateObj.getDay())) {
          total++
        }
        const status = getStatus(h.id, d)
        if (status === 'completed') done++
        if (status === 'blocked' && freqDays.includes(dateObj.getDay())) total--
      })
    })
    return { completed: done, goal: total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [habits, logMap, days, viewYear, viewMonth])

  // Today's completion stats
  const todayComplete = habits.filter(h => todayLogs.some(l => l.habit_id === h.id && (!l.status || l.status === 'completed'))).length
  const todayFailed = habits.filter(h => todayLogs.some(l => l.habit_id === h.id && l.status === 'failed')).length
  const todayTotal = habits.length
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

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING HABIT TRACKER...</span></div></AppShell>

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
            <h1 className="page-title">DAILY OPS — HABIT TRACKER</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Monthly overview. Click any cell to toggle completion.</p>
          </div>
          <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> ADD ROUTINE
          </button>
        </header>
        {/* TOP WIDGETS: BODY WEIGHT & DYNAMIC SLEEP TRACKER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          
          {/* WIDGET 1: BODY WEIGHT ENTRY */}
          <HudPanel glow className="p-3 border-amber">
            <div className="flex items-center justify-between border-b border-border-color pb-2 mb-2.5">
              <div className="flex items-center gap-2 text-amber">
                <Scale size={15} />
                <span className="font-display text-xs uppercase tracking-widest font-bold">BODY WEIGHT LOGGING</span>
              </div>
              <span className="font-mono text-[9px] text-amber bg-amber-subtle px-2 py-0.5 border border-amber-subtle rounded-sm">
                {weightLoggedToday ? '✓ LOGGED TODAY (+2 XP)' : '+2 XP'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center bg-bg-primary border border-border-color rounded h-8 px-2.5 max-w-[180px] flex-1">
                <input 
                  type="number" 
                  step="0.1" 
                  placeholder="e.g. 74.5"
                  value={weightKg} 
                  onChange={e => setWeightKg(e.target.value)}
                  className="bg-transparent border-none outline-none font-mono text-xs text-primary w-full pr-1"
                />
                <span className="font-mono text-[10px] text-muted select-none shrink-0">kg</span>
              </div>

              <button 
                type="button" 
                onClick={handleSaveWeight}
                disabled={weightSaving || !weightKg}
                className="h-8 px-4 font-mono text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 shrink-0"
                style={{
                  background: weightLoggedToday ? 'transparent' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: '1px solid #f59e0b',
                  color: weightLoggedToday ? '#f59e0b' : '#000',
                  opacity: weightSaving || !weightKg ? 0.5 : 1,
                  cursor: weightSaving || !weightKg ? 'not-allowed' : 'pointer'
                }}
              >
                {weightSaving ? (
                  <><span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> SAVING</>  
                ) : weightLoggedToday ? (
                  <>↑ UPDATE</>
                ) : (
                  <>+ LOG WEIGHT</>
                )}
              </button>
            </div>

            {weightMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2 mt-2 rounded border bg-amber-subtle flex items-center justify-between gap-2 font-mono text-[10px]"
                style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}
              >
                <div className="flex items-center gap-2 text-amber">
                  <CheckCircle2 size={14} />
                  <span>{weightMsg.title} — {weightMsg.subtitle}</span>
                </div>
                {weightMsg.xp > 0 && (
                  <span className="px-2 py-0.5 rounded-full font-bold bg-amber text-bg-primary text-[9px] shrink-0">
                    ⚡ +{weightMsg.xp} XP
                  </span>
                )}
              </motion.div>
            )}
          </HudPanel>

          {/* WIDGET 2: DYNAMIC SLEEP TRACKER */}
          <HudPanel glow className="p-3 border-info">
            <div className="flex items-center justify-between border-b border-border-color pb-2 mb-2.5">
              <div className="flex items-center gap-2 text-info">
                <Moon size={15} />
                <span className="font-display text-xs uppercase tracking-widest font-bold">DYNAMIC SLEEP TRACKER</span>
              </div>
              <button 
                type="button"
                onClick={handleDropStaticSleepHabits}
                className="font-mono text-[8px] text-muted hover:text-danger flex items-center gap-1 uppercase shrink-0"
              >
                <Trash2 size={9} /> Drop Static Habits
              </button>
            </div>

            <div className="flex flex-col gap-2 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[8px] text-muted block mb-0.5 uppercase">SLEEP PERIOD</label>
                  <select 
                    value={sleepTargetDate} 
                    onChange={e => handleSetSleepTargetDate(e.target.value)}
                    className="select font-mono text-xs py-1 px-2 h-8 w-full bg-bg-primary border border-border-color rounded"
                  >
                    <option value={yesterdayStr}>Last Night ({yesterdayStr})</option>
                    <option value={todayStr}>Tonight ({todayStr})</option>
                  </select>
                </div>

                <div>
                  <label className="text-[8px] text-muted block mb-0.5 uppercase">BEDTIME</label>
                  <input 
                    type="time" 
                    value={bedtime} 
                    onChange={e => handleSetBedtime(e.target.value)}
                    className="input font-mono text-xs py-1 px-2 h-8 w-full bg-bg-primary border border-border-color rounded"
                  />
                </div>

                <div>
                  <label className="text-[8px] text-muted block mb-0.5 uppercase">WAKE TIME</label>
                  <input 
                    type="time" 
                    value={wakeTime} 
                    onChange={e => handleSetWakeTime(e.target.value)}
                    className="input font-mono text-xs py-1 px-2 h-8 w-full bg-bg-primary border border-border-color rounded"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border-subtle flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Clock size={12} className="text-info" />
                  <span className="text-muted">TOTAL SLEEP: <strong className="text-primary font-bold">{liveSleepDuration ? `${liveSleepDuration.hrs}h ${liveSleepDuration.mins}m` : '--'}</strong></span>
                </div>

                <button 
                  type="button" 
                  onClick={handleSaveSleep}
                  disabled={sleepSaving || !liveSleepDuration}
                  className="h-8 px-4 font-mono text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 shrink-0"
                  style={{
                    background: liveSleepDuration ? 'linear-gradient(135deg, var(--info), #0ea5e9)' : 'var(--bg-secondary)',
                    border: '1px solid var(--info)',
                    color: liveSleepDuration ? '#000' : 'var(--text-muted)',
                    opacity: sleepSaving || !liveSleepDuration ? 0.5 : 1,
                    cursor: sleepSaving || !liveSleepDuration ? 'not-allowed' : 'pointer'
                  }}
                >
                  {sleepSaving ? (
                    <><span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> SAVING</>
                  ) : (
                    <>🌙 LOG SLEEP</>
                  )}
                </button>
              </div>

              {sleepMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-2 mt-1 rounded border flex items-center justify-between gap-2 font-mono text-[10px]"
                  style={{
                    background: sleepMsg.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderColor: sleepMsg.success ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                    color: sleepMsg.success ? 'var(--success)' : 'var(--danger)'
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {sleepMsg.success ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    <span>{sleepMsg.title}: {sleepMsg.subtitle}</span>
                  </div>
                  {sleepMsg.xp !== 0 && (
                    <span className="px-2 py-0.5 rounded-full font-bold text-[9px] shrink-0" style={{ background: sleepMsg.success ? 'var(--success)' : 'var(--danger)', color: '#000' }}>
                      {sleepMsg.xp > 0 ? `+${sleepMsg.xp} XP` : `${sleepMsg.xp} XP`}
                    </span>
                  )}
                </motion.div>
              )}
            </div>
          </HudPanel>

        </div>

        {/* Top Stats Row — pushed to bottom on mobile via CSS order */}
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

        {/* Month Navigation — part of paint grid section on mobile */}
        <div className="flex items-center justify-center mb-6 quests-paint-grid">
          <HudPanel className="flex-center gap-6 p-5">
            <button onClick={prevMonth} className="btn btn-ghost p-2 hover:text-amber"><ChevronLeft size={20} /></button>
            <div className="text-center">
              <div className="font-display text-2xl uppercase tracking-widest text-primary">{MONTH_NAMES[viewMonth]}</div>
              <div className="font-mono text-xs text-muted">{viewYear}</div>
            </div>
            <button onClick={nextMonth} className="btn btn-ghost p-2 hover:text-amber"><ChevronRight size={20} /></button>
          </HudPanel>
        </div>

        {/* Paint Tool Selector */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <span className="font-display text-[10px] uppercase tracking-widest text-muted">PAINT MODE</span>
          <div className="flex flex-row items-center bg-tertiary border border-border-color rounded overflow-hidden">
            <button 
              type="button"
              className={`px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-2 transition-colors ${activeTool === 'cycle' ? 'bg-primary text-bg-primary' : 'active:bg-hover text-primary'}`}
              onClick={() => setActiveTool('cycle')}
            >
              <RotateCcw size={13} /> CYCLE
            </button>
            <button 
              type="button"
              className={`px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-2 transition-colors border-l border-border-color ${activeTool === 'completed' ? 'bg-success text-bg-primary' : 'active:bg-hover text-success'}`}
              onClick={() => setActiveTool('completed')}
            >
              <Check size={13} /> DONE
            </button>
            <button 
              type="button"
              className={`px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-2 transition-colors border-l border-border-color ${activeTool === 'failed' ? 'bg-danger text-white' : 'active:bg-hover text-danger'}`}
              onClick={() => setActiveTool('failed')}
            >
              <X size={13} /> FAIL
            </button>
            <button 
              type="button"
              className={`px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-2 transition-colors border-l border-border-color ${activeTool === 'blocked' ? 'text-bg-primary' : 'active:bg-hover'}`}
              style={activeTool === 'blocked' ? { backgroundColor: 'var(--warning)' } : { color: 'var(--warning)' }}
              onClick={() => setActiveTool('blocked')}
            >
              <Leaf size={13} /> BLOCK
            </button>
            <button 
              type="button"
              className={`px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-2 transition-colors border-l border-border-color ${activeTool === 'none' ? 'bg-secondary text-bg-primary' : 'active:bg-hover text-muted'}`}
              onClick={() => setActiveTool('none')}
            >
              <Trash2 size={13} /> CLEAR
            </button>
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
                <th className="sticky z-20 col-habit relative group select-none" style={{ background: 'var(--bg-tertiary)', padding: 0, borderBottom: '1px solid var(--border-color)', borderRight: '2px solid var(--border-color)', borderTopLeftRadius: 'var(--radius-lg)' }}>
                  <div className="w-full flex items-center justify-between" style={{ padding: '10px 14px 10px 16px', textAlign: 'left' }}>
                    <span className="font-display text-[10px] md:text-xs uppercase tracking-widest text-primary">DAILY HABITS</span>
                    <span className="font-mono text-[9px] text-muted opacity-50 font-normal">({habitColWidth}px)</span>
                  </div>
                  {/* Draggable Column Width Resizer Handle */}
                  <div
                    onMouseDown={startResizingHabitCol}
                    onTouchStart={startResizingHabitCol}
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-amber/40 active:bg-amber flex items-center justify-center transition-colors z-30"
                    title="Click & Drag to resize column width"
                    style={{ touchAction: 'none' }}
                  >
                    <div className="w-0.5 h-4 bg-muted/60 rounded group-hover:bg-amber" />
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
                            {habit.title}
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
                          style={{
                            textAlign: 'center', padding: '0', cursor: 'pointer', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
                            background: isToday ? 'var(--accent-subtle)' : 'transparent',
                          }}
                          className="hover:bg-hover transition-colors min-w-[44px] h-[44px]"
                        >
                          <div style={{
                            width: '26px', height: '26px', margin: 'auto',
                            border: status === 'none' ? '1px solid var(--border-color)' : 'none',
                            borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: status === 'completed' ? cat.color : status === 'failed' ? 'var(--danger)' : 'transparent',
                            transition: 'all 150ms ease',
                            opacity: status !== 'none' ? 1 : 0.4,
                          }}>
                            {status === 'completed' && <Check size={12} color="#fff" strokeWidth={3} />}
                            {status === 'failed' && <X size={12} color="#fff" strokeWidth={3} />}
                            {status === 'blocked' && <Minus size={12} className="text-muted opacity-50" strokeWidth={3} />}
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
                    const dayDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    const dayDone = habits.filter(h => logMap.get(`${h.id}::${dayDate}`) === 'completed').length
                    const dayPct = habits.length === 0 ? 0 : Math.round((dayDone / habits.length) * 100)
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
                  <div className="font-display text-base text-primary truncate" onClick={() => openEditModal(habit)}>{habit.title}</div>
                  <div className="font-mono text-[10px] text-muted uppercase truncate">{cat.name} • {stats.pct}% WIN RATE</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10px] text-info font-bold">+{habit.xp_per_completion || 25} XP</span>
                  <button 
                    type="button"
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
                    {todayStatus === 'blocked' && <Leaf size={20} color="var(--warning)" strokeWidth={2} />}
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
                      {isFailed && <span className="font-mono text-[10px] text-danger">{isBlocked ? 0 : -15} XP</span>}
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
              className="modal-content w-full sm:max-w-[420px] mx-4"
            >
              <div className="modal-header">
                <h3 className="font-display text-lg text-primary tracking-widest">EDIT ROUTINE</h3>
                <button onClick={() => setEditingHabit(null)} className="text-muted hover:text-primary"><X size={20} /></button>
              </div>
              <form onSubmit={handleEditSave} className="flex flex-col gap-4">
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">ROUTINE TITLE</label>
                  <input type="text" className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                  <select className="select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {QUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    <option value="other">Other</option>
                  </select>
                </div>
                {editCategory === 'other' && (
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">CUSTOM CATEGORY</label>
                    <input type="text" className="input" value={editCustomCategory} onChange={(e) => setEditCustomCategory(e.target.value)} required placeholder="e.g. Finance" />
                  </div>
                )}
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">XP REWARD / PENALTY</label>
                  <input type="number" className="input" value={editXp} onChange={(e) => setEditXp(Number(e.target.value))} required min="5" max="100" step="5" />
                  <p className="font-mono text-[10px] text-muted mt-1">XP earned when complete. Penalty for failing is -15 XP (-30 XP if missed 2+ days in a row).</p>
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
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'DELETE ROUTINE',
                        message: 'Are you sure you want to permanently delete this routine?',
                        danger: true,
                        confirmText: 'DELETE',
                        onConfirm: async () => {
                          await deleteHabit(editingHabit.id);
                          setEditingHabit(null);
                          setConfirmModal({ isOpen: false });
                        },
                        onCancel: () => setConfirmModal({ isOpen: false })
                      })
                    }} 
                    className="btn border border-danger text-danger hover:bg-danger/20 transition-colors w-full flex justify-center items-center gap-2 mt-2"
                  >
                    <Trash2 size={16} /> DELETE ROUTINE
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmModal {...confirmModal} />
      </div>
    </AppShell>
  )
}
