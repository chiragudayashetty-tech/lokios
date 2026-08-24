'use client'

import { useState, useMemo, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Plus, Check, X, Archive, Trash2, ChevronLeft, ChevronRight, AlertTriangle, ArrowUp, ArrowDown, Flame, ChevronsUp, GripVertical, RotateCcw, Crosshair, Leaf, Lock, Scale, Moon, Clock, Sparkles, CheckCircle2, Minus, PauseCircle, PlayCircle, Sun, Calendar, Edit3 } from 'lucide-react'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'

function WeightSparklineDots({ data = [] }) {
  const values = data.length >= 2 
    ? data.map(d => Number(d.weight_kg))
    : [77.8, 77.9, 77.6, 77.7, 77.4, 77.5, 77.5]

  const min = Math.min(...values) - 0.2
  const max = Math.max(...values) + 0.2
  const range = max - min || 1
  const width = 160
  const height = 40
  const paddingX = 8
  const paddingY = 8

  const points = values.map((val, idx) => {
    const x = paddingX + (idx / (values.length - 1)) * (width - 2 * paddingX)
    const y = height - paddingY - ((val - min) / range) * (height - 2 * paddingY)
    return { x, y, val }
  })

  const pathD = points.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x},${pt.y}`
    const prev = arr[idx - 1]
    const cx1 = prev.x + (pt.x - prev.x) / 2
    const cy1 = prev.y
    const cx2 = prev.x + (pt.x - prev.x) / 2
    const cy2 = pt.y
    return `${acc} C ${cx1},${cy1} ${cx2},${cy2} ${pt.x},${pt.y}`
  }, '')

  const areaD = `${pathD} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`

  return (
    <div className="relative flex flex-col items-center">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#weightAreaGrad)" />
        <path d={pathD} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((pt, i) => (
          <circle 
            key={i} 
            cx={pt.x} 
            cy={pt.y} 
            r={i === points.length - 1 ? "3.5" : "2.5"} 
            fill="#34d399" 
            stroke="#090d1a" 
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </div>
  )
}

export default function DailyOps() {
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

  // Body Weight & Belly Widget State
  const [weightKg, setWeightKg] = useState('')
  const [bellyCm, setBellyCm] = useState('')
  const [weightLoggedToday, setWeightLoggedToday] = useState(false)
  const [weightSaving, setWeightSaving] = useState(false)
  const [weightMsg, setWeightMsg] = useState(null)
  const [recentWeightLogs, setRecentWeightLogs] = useState([])
  const [weightDeltaYesterday, setWeightDeltaYesterday] = useState(null)
  const [weightDelta7Days, setWeightDelta7Days] = useState(null)

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

  const autoFitHabitCol = () => {
    if (!habits || habits.length === 0) return
    let maxLen = 0
    habits.forEach(h => {
      if (h.title && h.title.length > maxLen) {
        maxLen = h.title.length
      }
    })
    const idealWidth = Math.max(220, Math.min(650, Math.ceil(maxLen * 8.5) + 120))
    setHabitColWidth(idealWidth)
    if (typeof window !== 'undefined') {
      localStorage.setItem('lokios_habit_col_width', idealWidth.toString())
    }
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

  // ─── FETCH RECENT WEIGHT & BELLY LOGS ───
  const fetchWeightLogs = useCallback(async () => {
    if (!user) return
    const sb = createClient()
    try {
      const { data } = await sb.from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .limit(30)

      let localBellyMap = {}
      let lastSavedWeight = null
      let lastSavedBelly = null
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`lokios_belly_logs_${user.id}`) || localStorage.getItem('lokios_belly_logs_cache')
          if (raw) localBellyMap = JSON.parse(raw)
          lastSavedWeight = localStorage.getItem(`lokios_latest_weight_${user.id}`)
          lastSavedBelly = localStorage.getItem(`lokios_latest_belly_${user.id}`)
        } catch (e) {}
      }

      const parseB = (v) => {
        if (!v) return null
        if (typeof v === 'string' && v.startsWith('belly:')) {
          const n = parseFloat(v.replace('belly:', ''))
          return !isNaN(n) && n > 0 ? n : null
        }
        const n = typeof v === 'number' ? v : parseFloat(v)
        return !isNaN(n) && n > 0 ? n : null
      }

      const rawLogs = data || []
      const merged = rawLogs.map(d => ({
        ...d,
        belly_size_cm: parseB(d.belly_size_cm) ?? parseB(d.waist_cm) ?? parseB(d.notes) ?? parseB(localBellyMap[d.date]) ?? null
      }))

      // Include local-only today entry if not in DB yet
      const localTodayBelly = parseB(localBellyMap[todayStr]) ?? parseB(lastSavedBelly)
      if (!merged.some(d => d.date === todayStr) && (lastSavedWeight || localTodayBelly)) {
        merged.push({
          user_id: user.id,
          date: todayStr,
          weight_kg: lastSavedWeight ? parseFloat(lastSavedWeight) : (merged[merged.length - 1]?.weight_kg || 77.5),
          belly_size_cm: localTodayBelly
        })
      }

      if (merged.length > 0) {
        setRecentWeightLogs(merged)
        const todayEntry = merged.find(d => d.date === todayStr)
        if (todayEntry) {
          setWeightKg(String(todayEntry.weight_kg))
          if (todayEntry.belly_size_cm) setBellyCm(String(todayEntry.belly_size_cm))
          setWeightLoggedToday(true)
        } else {
          const latest = merged[merged.length - 1]
          setWeightKg(String(latest.weight_kg))
          if (latest.belly_size_cm) setBellyCm(String(latest.belly_size_cm))
          setWeightLoggedToday(false)
        }

        const yesterdayEntry = merged.find(d => d.date === yesterdayStr)
        const currentW = todayEntry ? todayEntry.weight_kg : merged[merged.length - 1].weight_kg
        if (yesterdayEntry) {
          const diff = parseFloat((currentW - yesterdayEntry.weight_kg).toFixed(1))
          setWeightDeltaYesterday(diff)
        }
        if (merged.length >= 2) {
          const weekAgoEntry = merged[Math.max(0, merged.length - 7)]
          const diff7 = parseFloat((currentW - weekAgoEntry.weight_kg).toFixed(1))
          setWeightDelta7Days(diff7)
        }
      } else {
        if (lastSavedWeight) setWeightKg(String(lastSavedWeight))
        if (localTodayBelly) setBellyCm(String(localTodayBelly))
      }
    } catch (err) {
      console.warn('Error fetching weight logs:', err)
    }
  }, [user, todayStr, yesterdayStr])

  useEffect(() => {
    fetchWeightLogs()
  }, [fetchWeightLogs])

  // Listen for weight updates
  useEffect(() => {
    const handleUpdate = () => { fetchWeightLogs() }
    window.addEventListener('lokios_weight_updated', handleUpdate)
    return () => window.removeEventListener('lokios_weight_updated', handleUpdate)
  }, [fetchWeightLogs])

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

          let logTitle = '🚨 POOR SLEEP SCHEDULE'
          let logSuccess = false
          const logXp = isOpt ? 40 : isAcc ? 20 : -30

          if (isOpt) {
            logTitle = '✓ OPTIMAL SLEEP LOGGED'
            logSuccess = true
          } else if (isAcc) {
            logTitle = '✓ SLEEP LOGGED'
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
    if (!user) return
    const rawW = parseFloat(weightKg)
    const b = bellyCm && !isNaN(parseFloat(bellyCm)) && parseFloat(bellyCm) > 0 ? parseFloat(bellyCm) : null
    const w = !isNaN(rawW) && rawW > 0 ? rawW : (recentWeightLogs[recentWeightLogs.length - 1]?.weight_kg || 77.5)

    setWeightSaving(true)
    const sb = createClient()

    // 1. Synchronously cache to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`lokios_latest_weight_${user.id}`, String(w))
        localStorage.setItem('lokios_latest_weight_cache', String(w))
        if (b !== null) {
          localStorage.setItem(`lokios_latest_belly_${user.id}`, String(b))
          localStorage.setItem('lokios_latest_belly_cache', String(b))
          const raw = localStorage.getItem(`lokios_belly_logs_${user.id}`) || localStorage.getItem('lokios_belly_logs_cache')
          const map = raw ? JSON.parse(raw) : {}
          map[todayStr] = b
          localStorage.setItem(`lokios_belly_logs_${user.id}`, JSON.stringify(map))
          localStorage.setItem('lokios_belly_logs_cache', JSON.stringify(map))
        }
      } catch (e) {}
    }

    // 2. Persist to DB
    try {
      await sb.from('weight_logs').delete().eq('user_id', user.id).eq('date', todayStr)
      const payload = {
        user_id: user.id,
        date: todayStr,
        weight_kg: w,
        belly_size_cm: b,
        waist_cm: b,
        notes: b ? `belly:${b}` : null
      }
      const { error: wErr } = await sb.from('weight_logs').insert(payload)
      if (wErr) {
        await sb.from('weight_logs').insert({
          user_id: user.id,
          date: todayStr,
          weight_kg: w,
          notes: b ? `belly:${b}` : null
        })
      }
    } catch (err) {
      console.warn('DB Save error:', err)
    }

    setWeightLoggedToday(true)
    setWeightMsg({
      success: true,
      title: 'BODY RECON LOGGED',
      subtitle: `${w} kg${b ? ` · ${b} cm waist` : ''} recorded for today`
    })
    setWeightSaving(false)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lokios_weight_updated'))
    }

    await fetchWeightLogs()
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

    let statusStr = 'deprived'
    let titleText = '🚨 POOR SLEEP SCHEDULE'

    if (isOptimal) {
      statusStr = 'healthy'
      titleText = '✓ OPTIMAL SLEEP LOGGED'
    } else if (isAcceptable) {
      statusStr = 'healthy'
      titleText = '✓ SLEEP LOGGED'
    }

    let failReasons = []
    if (!isAcceptableBedtime) failReasons.push(`Late Bedtime (${bedtime})`)
    if (!isAcceptableWake) failReasons.push(`Late Wake Up (${wakeTime})`)
    if (liveSleepDuration.totalHours > 10.5) failReasons.push(`Overslept (${liveSleepDuration.totalHours}h)`)
    if (liveSleepDuration.totalHours < 5.5) failReasons.push(`Under-slept (${liveSleepDuration.totalHours}h)`)

    // 1. Optimistic UI update
    setSleepMsg({
      success: statusStr === 'healthy',
      title: titleText,
      subtitle: statusStr === 'healthy' 
        ? `Bedtime: ${bedtime} · Wake: ${wakeTime} · Duration: ${liveSleepDuration.totalHours}h` 
        : `Logged: ${liveSleepDuration.totalHours}h (${failReasons.join(' · ') || 'Irregular schedule'})`,
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
    if (habit.stopped_at) {
      const stoppedDateStr = getLocalDateStr(new Date(habit.stopped_at))
      if (dateStr > stoppedDateStr) return 'locked'
    } else if (habit.is_active === false) {
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
      if ((status === 'blocked' || status === 'locked') && freqDays.includes(dateObj.getDay())) goal--
    })
    
    const left = goal - completed - failed
    const pct = goal <= 0 ? (completed > 0 ? 100 : 0) : Math.round((completed / goal) * 100)
    return { completed, failed, left: Math.max(0, left), pct, goal: Math.max(0, goal) }
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
        if ((status === 'blocked' || status === 'locked') && freqDays.includes(dateObj.getDay())) total--
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
        {/* ══════════════════════════════════════════════════════════════════
            TOP WIDGETS: BODY WEIGHT & DYNAMIC SLEEP TRACKER
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-6 w-full">
          
          {/* ──────────────────────────────────────────────────────────────
              WIDGET 1: BODY WEIGHT LOGGING
          ────────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 bg-[#090d1a]/95 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex flex-col justify-between relative overflow-hidden">
            
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

            {/* Header Row */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl border border-emerald-500/40 bg-emerald-950/40 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)] shrink-0">
                  <Scale size={18} />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm uppercase tracking-wider text-white">
                    <span className="hidden sm:inline">BODY WEIGHT LOGGING</span>
                    <span className="sm:hidden">BODY WEIGHT</span>
                  </h3>
                  <p className="font-mono text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                    Track your progress. Stay consistent.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-3 py-1 rounded-full border font-mono text-[10px] font-bold tracking-wider flex items-center gap-1.5 shrink-0 ${
                weightLoggedToday 
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                  : 'border-amber-500/40 bg-amber-950/30 text-amber-400'
              }`}>
                <span>{weightLoggedToday ? '✓' : '•'}</span>
                <span className="hidden sm:inline">{weightLoggedToday ? 'LOGGED TODAY' : 'DAILY LOG'}</span>
                <span className="sm:hidden">{weightLoggedToday ? 'LOGGED' : 'PENDING'}</span>
              </div>
            </div>

            {/* Middle Zone: Big Weight Input + Belly Size Input + Sparkline */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 my-auto py-2">
              
              {/* Inputs */}
              <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
                {/* Weight */}
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="77.5"
                      value={weightKg}
                      onChange={e => setWeightKg(e.target.value)}
                      onBlur={handleSaveWeight}
                      onKeyDown={e => e.key === 'Enter' && handleSaveWeight()}
                      className="font-display font-black text-3xl sm:text-4xl text-emerald-400 bg-transparent border-none outline-none w-28 sm:w-32 text-center sm:text-left tracking-tight focus:ring-1 focus:ring-emerald-500/50 rounded-lg"
                    />
                    <span className="font-mono text-sm font-bold text-slate-400 select-none">kg</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 mt-0.5">Weight</span>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-white/10 hidden sm:block" />

                {/* Belly / Waist */}
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      step="0.5"
                      placeholder="88.0"
                      value={bellyCm}
                      onChange={e => setBellyCm(e.target.value)}
                      onBlur={handleSaveWeight}
                      onKeyDown={e => e.key === 'Enter' && handleSaveWeight()}
                      className="font-display font-black text-3xl sm:text-4xl text-sky-400 bg-transparent border-none outline-none w-28 sm:w-32 text-center sm:text-left tracking-tight focus:ring-1 focus:ring-sky-500/50 rounded-lg"
                    />
                    <span className="font-mono text-sm font-bold text-sky-400 select-none">cm</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    Belly / Waist {bellyCm && !isNaN(parseFloat(bellyCm)) && <span className="text-muted">({(parseFloat(bellyCm) / 2.54).toFixed(1)}")</span>}
                  </span>
                </div>
              </div>

              {/* Sparkline Wave with Dots */}
              <div className="flex flex-col items-center sm:items-end">
                <WeightSparklineDots data={recentWeightLogs} />
                <div className="font-mono text-[10px] sm:text-[11px] text-emerald-400 font-semibold tracking-wider mt-1.5 flex items-center gap-1">
                  <span>↓</span>
                  <span>{weightDeltaYesterday !== null ? `${Math.abs(weightDeltaYesterday)} kg` : '0.3 kg'}</span>
                  <span className="text-slate-400 font-normal">vs yesterday</span>
                </div>
              </div>

            </div>

            {/* Footer Row: 7-Day Trend Badge + Update Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-300 font-mono text-[11px]">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-slate-400">Trend (7 Days)</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">
                  ↓ {weightDelta7Days !== null ? `${Math.abs(weightDelta7Days)} kg` : '0.3 kg'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveWeight}
                disabled={weightSaving}
                className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  weightLoggedToday
                    ? 'border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'border-amber-500/50 bg-amber-950/20 hover:bg-amber-900/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                }`}
              >
                {weightSaving ? (
                  <><span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> SAVING</>
                ) : (
                  <>{weightLoggedToday ? '✓ RECORDED FOR TODAY' : '↑ SAVE & LOG TODAY'}</>
                )}
              </button>
            </div>

          </div>

          {/* ──────────────────────────────────────────────────────────────
              WIDGET 2: DYNAMIC SLEEP TRACKER
          ────────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 bg-[#090d1a]/95 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex flex-col justify-between relative overflow-hidden">
            
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

            {/* Header Row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl border border-blue-500/40 bg-blue-950/40 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)] shrink-0">
                  <Moon size={18} />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm uppercase tracking-wider text-white">
                    <span className="hidden sm:inline">DYNAMIC SLEEP TRACKER</span>
                    <span className="sm:hidden">SLEEP TRACKER</span>
                  </h3>
                  <p className="font-mono text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                    Quality sleep. Peak performance.
                  </p>
                </div>
              </div>

              {/* Drop Static Habits Trash Action */}
              <button
                type="button"
                onClick={handleDropStaticSleepHabits}
                title="Drop Static Habits"
                className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.03] hover:border-rose-500/40 hover:text-rose-400 font-mono text-[10px] text-slate-400 flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={12} className="text-slate-400 group-hover:text-rose-400" />
                <span className="hidden sm:inline uppercase">DROP STATIC HABITS</span>
              </button>
            </div>

            {/* Body Stack: Inset Rows for Period, Bedtime, Wake Time */}
            <div className="space-y-2 mb-3">
              
              {/* Row 1: PERIOD */}
              <div className="rounded-xl border border-white/5 bg-black/40 px-3 py-2 flex items-center justify-between gap-3 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-blue-950/50 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Calendar size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400 block font-semibold">PERIOD</span>
                    <select
                      value={sleepTargetDate}
                      onChange={e => handleSetSleepTargetDate(e.target.value)}
                      className="bg-transparent border-none outline-none font-mono text-xs text-white font-bold cursor-pointer p-0 m-0 w-full"
                    >
                      <option value={yesterdayStr} className="bg-slate-900 text-white">Last Night ({yesterdayStr})</option>
                      <option value={todayStr} className="bg-slate-900 text-white">Tonight ({todayStr})</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: BEDTIME */}
              <div className="rounded-xl border border-white/5 bg-black/40 px-3 py-2 flex items-center justify-between gap-3 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-950/50 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Clock size={13} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400 block font-semibold">BEDTIME</span>
                    <input
                      type="time"
                      value={bedtime}
                      onChange={e => handleSetBedtime(e.target.value)}
                      className="bg-transparent border-none outline-none font-mono text-xs text-white font-bold p-0 m-0 cursor-pointer"
                    />
                  </div>
                </div>
                <Edit3 size={13} className="text-slate-500 pointer-events-none shrink-0" />
              </div>

              {/* Row 3: WAKE TIME */}
              <div className="rounded-xl border border-white/5 bg-black/40 px-3 py-2 flex items-center justify-between gap-3 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-950/50 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Sun size={13} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400 block font-semibold">WAKE TIME</span>
                    <input
                      type="time"
                      value={wakeTime}
                      onChange={e => handleSetWakeTime(e.target.value)}
                      className="bg-transparent border-none outline-none font-mono text-xs text-white font-bold p-0 m-0 cursor-pointer"
                    />
                  </div>
                </div>
                <Edit3 size={13} className="text-slate-500 pointer-events-none shrink-0" />
              </div>

            </div>

            {/* Row 4: SLEEP DURATION & LOG SLEEP BUTTON */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 px-3 py-2.5 flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-900/40 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Moon size={13} />
                </div>
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400 block font-semibold">SLEEP DURATION</span>
                  <span className="font-display font-black text-sm text-white">
                    {liveSleepDuration ? `${liveSleepDuration.hrs}h ${liveSleepDuration.mins}m` : '--'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveSleep}
                disabled={sleepSaving || !liveSleepDuration}
                className="px-3.5 py-1.5 rounded-xl border border-blue-500/40 bg-blue-600 hover:bg-blue-500 text-white font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(59,130,246,0.3)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {sleepSaving ? (
                  <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> SAVING</>
                ) : (
                  <>🌙 LOG SLEEP</>
                )}
              </button>
            </div>

            {/* Footer Alert Banner (Message only, without XP) */}
            {sleepMsg && (
              <motion.div
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-2 rounded-xl border flex items-center gap-2 font-mono text-[10px] ${
                  sleepMsg.success
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {sleepMsg.success ? <CheckCircle2 size={13} className="shrink-0 text-emerald-400" /> : <AlertTriangle size={13} className="shrink-0 text-rose-400" />}
                  <span className="truncate">{sleepMsg.title}: {sleepMsg.subtitle}</span>
                </div>
              </motion.div>
            )}

          </div>

        </div>

        {/* Paint Tool & Column Width Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex flex-row items-center gap-2 sm:gap-3">
            <span className="font-display text-[10px] uppercase tracking-widest text-muted">PAINT MODE</span>
            <div className="flex flex-row items-center bg-tertiary border border-border-color rounded overflow-hidden">
              <button 
                type="button"
                className={`px-2.5 sm:px-3 md:px-4 py-2 font-mono text-[10px] flex items-center justify-center gap-1.5 transition-colors ${activeTool === 'cycle' ? 'bg-primary text-bg-primary font-bold' : 'active:bg-hover text-primary'}`}
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

          {/* Habit Column Width Controls */}
          <div className="hidden-mobile flex items-center gap-2 bg-tertiary border border-border-color rounded-lg px-3 py-1.5">
            <span className="font-mono text-[10px] text-muted uppercase">COLUMN:</span>
            <button
              type="button"
              onClick={autoFitHabitCol}
              className="px-2 py-1 bg-amber/10 border border-amber/30 text-amber hover:bg-amber/20 rounded font-mono text-[10px] uppercase font-bold transition-colors"
              title="Automatically resize column to fit the longest routine title"
            >
              Auto-Fit
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const w = Math.max(180, habitColWidth - 30)
                  setHabitColWidth(w)
                  if (typeof window !== 'undefined') localStorage.setItem('lokios_habit_col_width', w.toString())
                }}
                className="w-6 h-6 flex-center bg-secondary border border-border-subtle rounded font-mono text-xs text-muted hover:text-primary transition-colors"
                title="Decrease Width"
              >
                -
              </button>
              <input
                type="range"
                min="180"
                max="550"
                value={habitColWidth}
                onChange={(e) => {
                  const w = parseInt(e.target.value, 10)
                  setHabitColWidth(w)
                  if (typeof window !== 'undefined') localStorage.setItem('lokios_habit_col_width', w.toString())
                }}
                className="w-20 accent-amber cursor-pointer"
                title="Drag to adjust column width"
              />
              <button
                type="button"
                onClick={() => {
                  const w = Math.min(550, habitColWidth + 30)
                  setHabitColWidth(w)
                  if (typeof window !== 'undefined') localStorage.setItem('lokios_habit_col_width', w.toString())
                }}
                className="w-6 h-6 flex-center bg-secondary border border-border-subtle rounded font-mono text-xs text-muted hover:text-primary transition-colors"
                title="Increase Width"
              >
                +
              </button>
            </div>
            <span className="font-mono text-[10px] text-amber font-bold w-12 text-right">{habitColWidth}px</span>
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
                  <div className="w-full flex items-center justify-between pr-6" style={{ padding: '10px 14px 10px 16px', textAlign: 'left' }}>
                    <span className="font-display text-[10px] md:text-xs uppercase tracking-widest text-primary">DAILY HABITS</span>
                    <span className="font-mono text-[9px] text-muted opacity-50 font-normal">({habitColWidth}px)</span>
                  </div>
                  {/* Prominent Draggable Column Width Resizer Handle */}
                  <div
                    onMouseDown={startResizingHabitCol}
                    onTouchStart={startResizingHabitCol}
                    className="absolute right-0 top-0 bottom-0 w-6 cursor-col-resize hover:bg-amber/30 active:bg-amber/50 flex items-center justify-center transition-all z-30 group/handle"
                    title="Click & Drag to resize column width"
                    style={{ touchAction: 'none' }}
                  >
                    <div className="flex gap-0.5 items-center justify-center">
                      <div className="w-0.5 h-4 bg-amber/70 rounded group-hover/handle:bg-amber group-hover/handle:h-5 transition-all" />
                      <div className="w-0.5 h-4 bg-amber/70 rounded group-hover/handle:bg-amber group-hover/handle:h-5 transition-all" />
                    </div>
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
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col gap-0.5 pr-0.5">
                    <button type="button" onClick={(e) => { e?.stopPropagation?.(); reorderHabits(habit.id, 'up') }} className="p-1 text-muted hover:text-amber transition-colors" title="Move Up"><ArrowUp size={12} /></button>
                    <button type="button" onClick={(e) => { e?.stopPropagation?.(); reorderHabits(habit.id, 'down') }} className="p-1 text-muted hover:text-amber transition-colors" title="Move Down"><ArrowDown size={12} /></button>
                  </div>
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

        {/* Stopped Routines Panel */}
        {stoppedHabits && stoppedHabits.length > 0 && (
          <div className="mt-8 quests-stopped-routines">
            <HudPanel label={`STOPPED ROUTINES (${stoppedHabits.length})`}>
              <p className="font-mono text-xs text-muted mb-4">
                These routines are currently stopped and hidden from the daily ops table. All historical log data and completion history are completely saved. Click <strong className="text-primary">CONTINUE ROUTINE</strong> anytime to reactivate tracking.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stoppedHabits.map((h) => {
                  const cat = QUEST_CATEGORIES.find(c => c.id === h.category) || QUEST_CATEGORIES[0]
                  return (
                    <div key={h.id} className="p-4 rounded border border-border-subtle bg-bg-secondary flex-between gap-3">
                      <div className="flex flex-col gap-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm text-primary truncate">{h.title}</span>
                          <span className="px-2 py-0.5 rounded font-mono text-[9px] bg-danger/20 border border-danger/40 text-danger uppercase font-bold">STOPPED</span>
                        </div>
                        <div className="font-mono text-[10px] text-muted truncate">
                          {cat.name} {h.created_at ? `• Deployed: ${h.created_at.substring(0, 10)}` : ''} {h.stopped_at ? `• Stopped: ${h.stopped_at.substring(0, 10)}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await resumeHabit(h.id)
                          }}
                          className="btn btn-primary btn-sm flex items-center gap-1 text-xs font-mono"
                          title="Reactivate this routine"
                        >
                          <PlayCircle size={14} /> CONTINUE
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
                          className="p-2 text-muted hover:text-danger rounded border border-border-subtle hover:border-danger transition-colors"
                          title="Permanently delete routine"
                        >
                          <Trash2 size={14} />
                        </button>
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
