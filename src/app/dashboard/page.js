'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, AlertTriangle, Zap, Swords, Flame, ChevronDown,
  ChevronUp, Lock, Check, ClipboardList, BookOpen,
  Activity, Clock, Terminal, ArrowUpRight, BarChart2,
  Smartphone, Shield, DollarSign, Moon, Brain, Repeat, Scale, X, RotateCcw,
  Calendar as CalendarIcon, MapPin, Plus, ExternalLink, Briefcase, Sun, FileText, CheckCircle2, Mic
} from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { RANK_CONFIG } from '@/lib/constants'
import { getLocalDateStr, getEndOfWeek, getStartOfWeek } from '@/lib/utils/dates'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

const ARC_CONFIG = [
  { rank: 'I',       name: 'The Awakening',          flavor: 'The moment I stopped drifting and chose the life I wanted to build.' },
  { rank: 'II',      name: 'The Discipline Rebuild', flavor: 'I rebuilt my mind, habits, and identity one day at a time.' },
  { rank: 'III',     name: 'The Spark',              flavor: 'Small actions became unstoppable momentum.' },
  { rank: 'IV',      name: 'The Architect',          flavor: 'I stopped chasing success and started designing systems, businesses, and a better future.' },
  { rank: 'V',       name: 'The King',               flavor: 'I learned to lead myself first, then earned the trust to lead others.' },
  { rank: 'VI',      name: 'The Empire',             flavor: 'My work grew beyond me into companies, teams, and communities that create lasting value.' },
  { rank: 'VII',     name: 'The Legacy',             flavor: 'My greatest achievement became the people I inspired and the lives I changed.' },
  { rank: 'VIII',    name: 'Beyond',                 flavor: 'There is no finish line. Every summit reveals a higher mountain.' },
]

const BATTLE_ICONS = {
  'Phone Addiction':       Smartphone,
  'Porn Consumption':      Shield,
  'Inconsistent Execution':Repeat,
  'Fear of Selling':       DollarSign,
  'Poor Sleep Discipline': Moon,
  'Overthinking':          Brain,
}

const DEFAULT_BATTLES = [
  { name: 'Phone Addiction', hp: 80, severity: 'high', notes: 'Primary discipline threat.', linked_habits: [] },
  { name: 'Porn Consumption', hp: 90, severity: 'high', notes: 'Drain on discipline and self-respect.', linked_habits: [] },
  { name: 'Inconsistent Execution', hp: 70, severity: 'high', notes: 'Starting strong, dropping off.', linked_habits: [] },
  { name: 'Fear of Selling', hp: 75, severity: 'medium', notes: 'Hesitation to pitch or ask for money.', linked_habits: [] },
  { name: 'Poor Sleep Discipline', hp: 85, severity: 'high', notes: 'Sleeping past 12 AM, waking up fatigued.', linked_habits: [] },
  { name: 'Overthinking', hp: 65, severity: 'medium', notes: 'Analyzing instead of executing.', linked_habits: [] }
]

const SEVERITY_COLORS = {
  extreme: '#FF3B3B',
  high:    'var(--danger)',
  medium:  'var(--accent-primary)',
  low:     'var(--info)',
}

const BRIEFINGS = [
  "The discipline you build in private becomes the edge you show in public.",
  "Amateurs wait for motivation. Professionals execute on schedule.",
  "Pain is temporary. Quitting lasts forever. Push through.",
  "Every action is a vote for the person you wish to become.",
  "Do not stop when you are tired. Stop when you are done.",
  "Small daily disciplines compound into massive results over time.",
  "Your mind will quit 100 times before your body does. Ignore it.",
  "Victory is reserved for those who are willing to pay its price.",
  "Focus on the next step, not the entire staircase.",
  "Comfort is the enemy of progress. Seek the friction."
]

export default function MissionControl() {
  const { user } = useAuth()

  const { 
    profile: { profile } = {},
    goals:   { mainQuest, sideQuests, longTermGoals } = {},
    habits:  { todayLogs = [], habits = [] } = {},
    tasks:   { tasks = [], addTask, completeTask, undoCompleteTask, fetchTasks } = {},
    journal: { entries = [] } = {},
    calendar: { events = [] } = {},
    xp: { dailyMomentum } = {},
    completeOperation,
    failOperation,
    undoFailOperation
  } = useOS() || {}

  const todayStr = getLocalDateStr()

  // Today's Calendar Events & Scheduled Due Tasks
  const todayCalendarEvents = useMemo(() => {
    return (events || []).filter(e => {
      const eDate = e.event_date || e.date || (e.start_time ? e.start_time.split('T')[0] : '')
      return eDate === todayStr
    })
  }, [events, todayStr])

  const todayTasksScheduled = useMemo(() => {
    return (tasks || []).filter(t => t.due_date === todayStr && t.status !== 'cancelled')
  }, [tasks, todayStr])

  const weeklyGoalTasks = (tasks || []).filter(t => t.category === 'weekly_goal' && t.status !== 'cancelled')

  const [currentTime, setCurrentTime] = useState(new Date())
  const [xpToday, setXpToday]         = useState(0)
  const [xpThisWeek, setXpThisWeek]   = useState(0)
  const [weeklyWinRate, setWeeklyWinRate] = useState(0)
  const [arcExpanded, setArcExpanded] = useState(false)
  const [momentumExpanded, setMomentumExpanded] = useState(false)
  const [priorityStatusMap, setPriorityStatusMap] = useState({})
  const [completedEventIds, setCompletedEventIds] = useState(new Set())

  const toggleEventCompleted = (id) => {
    setCompletedEventIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  
  // New metrics states
  const [xpTrajectory, setXpTrajectory] = useState([])
  const [weightData, setWeightData] = useState(null)
  const [latestDebrief, setLatestDebrief] = useState(null)
  const [todayScreenTime, setTodayScreenTime] = useState(null)
  const [sleepData, setSleepData] = useState(null)
  const [addictionData, setAddictionData] = useState(null)
  const [expandedWidget, setExpandedWidget] = useState(null) // 'sleep' | 'addiction'

  // ── EOD Recon Checklist Widget States ──
  const [eodWorkData, setEodWorkData] = useState({ logged: false, hours: 0 })
  const [eodWellnessData, setEodWellnessData] = useState({ logged: false, detail: '' })
  const [eodSpeakingData, setEodSpeakingData] = useState({ logged: false, detail: '' })
  const [eodQuickLogModal, setEodQuickLogModal] = useState(null) // 'wellness' | 'work' | 'journal' | 'screen' | 'speaking'
  const [eodJournalLogged, setEodJournalLogged] = useState(false)

  // Quick form states
  const [eodScreenForm, setEodScreenForm] = useState({ total_hours: '4', doomscroll_minutes: '30', streaming_hours: '0.5' })
  const [eodJournalForm, setEodJournalForm] = useState({ mood: 'good', content: '' })
  const [eodWorkForm, setEodWorkForm] = useState({ hours: '2', work_type: 'deep_work', notes: '' })
  const [eodWellnessForm, setEodWellnessForm] = useState({ type: 'sleep', sleep_hours: '8', bedtime: '23:00', wake_time: '07:00', weight_kg: '' })
  const [eodSpeakingForm, setEodSpeakingForm] = useState({ topic: '', drive_link: '', notes: '' })

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // Instant cache loader from localStorage for zero-delay initial widget status
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return
    const todayStr = getLocalDateStr(new Date())
    const cacheKey = `lokios_dashboard_recon_${user.id}_${todayStr}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed.eodWorkData) setEodWorkData(parsed.eodWorkData)
        if (parsed.eodWellnessData) setEodWellnessData(parsed.eodWellnessData)
        if (parsed.eodSpeakingData) setEodSpeakingData(parsed.eodSpeakingData)
        if (parsed.todayScreenTime) setTodayScreenTime(parsed.todayScreenTime)
        if (parsed.latestDebrief) setLatestDebrief(parsed.latestDebrief)
        if (parsed.eodJournalLogged !== undefined) setEodJournalLogged(parsed.eodJournalLogged)
      }
    } catch (e) {
      console.warn('Recon cache read error:', e)
    }
  }, [user])

  useEffect(() => {
    async function fetchMetrics() {
      if (!user) return
      const sb = createClient()
      
      const todayStr = getLocalDateStr(new Date())
      
      const currentMonday = new Date()
      const day = currentMonday.getDay()
      const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1)
      currentMonday.setDate(diff)
      const currentMondayStr = getLocalDateStr(currentMonday)
      
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      const thirtyDaysAgoStr = getLocalDateStr(thirtyDaysAgo)

      // 1. Fetch XP Data (Last 30 Days)
      const { data: xpData } = await sb
        .from('xp_history')
        .select('amount, created_at')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgoStr)

      // Fetch today's screen time log
      const { data: stLogs } = await sb
        .from('screen_time_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .limit(1)

      if (stLogs && stLogs.length > 0) {
        setTodayScreenTime(stLogs[0])
      }

      // 1c. Fetch Latest Weekly Debrief (Work Log)
      const { data: debriefLogs } = await sb
        .from('work_logs')
        .select('*')
        .eq('user_id', user.id)
        .ilike('title', 'Weekly Debrief%')
        .order('created_at', { ascending: false })
        .limit(1)

      if (debriefLogs && debriefLogs.length > 0) {
        setLatestDebrief(debriefLogs[0])
      }
        
      if (xpData) {
        // Today & This Week (NET XP including penalties)
        setXpThisWeek(xpData.filter(r => {
          const rDateStr = getLocalDateStr(new Date(r.created_at))
          return rDateStr >= currentMondayStr
        }).reduce((s, r) => s + r.amount, 0))

        setXpToday(xpData.filter(r => {
          const rDateStr = getLocalDateStr(new Date(r.created_at))
          return rDateStr === todayStr
        }).reduce((s, r) => s + r.amount, 0))
        
        // 30-Day Trajectory Graph (includes both gains and penalties mapped to local dates)
        const xpByDate = {}
        xpData.forEach(r => {
          const dateStr = getLocalDateStr(new Date(r.created_at))
          xpByDate[dateStr] = (xpByDate[dateStr] || 0) + r.amount
        })

        const graphData = []
        for (let i = 29; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dStr = getLocalDateStr(d)
          graphData.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            xp: xpByDate[dStr] || 0
          })
        }
        setXpTrajectory(graphData)
      }

      // 2. Fetch ALL Habit Logs (for Ghost Score, Win Rate, Graveyard)
      const { data: allHabitLogs } = await sb
        .from('habit_logs')
        .select('date, status, habit_id')
        .eq('user_id', user.id)
        .order('date', { ascending: true })

      const { data: allHabitsData } = await sb
        .from('habits')
        .select('id, title')
        .eq('user_id', user.id)

      if (allHabitLogs) {
        // Weekly Win Rate (This week from Monday)
        const recentLogs = allHabitLogs.filter(l => l.date >= currentMondayStr)
        const uniqueDaysWithCompletion = new Set(
          recentLogs.filter(log => log.status === 'completed').map(log => log.date)
        ).size
        
        // Calculate days elapsed in the current week so far (Monday = 1 day elapsed)
        let daysElapsed = new Date().getDay()
        if (daysElapsed === 0) daysElapsed = 7 // Sunday is the 7th day
        
        setWeeklyWinRate(Math.round((uniqueDaysWithCompletion / daysElapsed) * 100))
      }

      // ── Weight Tracking (Body Recon Widget) ──
      const { data: wConfig } = await sb.from('weight_config').select('*').eq('user_id', user.id).maybeSingle()
      if (wConfig) {
        const { data: latestLog } = await sb.from('weight_logs').select('weight_kg, date').eq('user_id', user.id).order('date', { ascending: false }).limit(1).maybeSingle()
        const { data: todayLog } = await sb.from('weight_logs').select('id').eq('user_id', user.id).eq('date', todayStr).maybeSingle()
        if (latestLog) {
          const lost = (wConfig.starting_weight - latestLog.weight_kg).toFixed(1)
          const range = wConfig.starting_weight - wConfig.target_weight
          const pct = range > 0 ? Math.min(100, Math.max(0, Math.round((parseFloat(lost) / range) * 100))) : 0
          setWeightData({
            current: parseFloat(latestLog.weight_kg),
            target: parseFloat(wConfig.target_weight),
            start: parseFloat(wConfig.starting_weight),
            lost: parseFloat(lost),
            progressPct: pct,
            loggedToday: !!todayLog
          })
        }
      }

      // ── Sleep Sentinel Widget ──
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { data: sleepLogs } = await sb.from('sleep_logs')
        .select('*').eq('user_id', user.id)
        .gte('date', getLocalDateStr(sevenDaysAgo))
        .order('date', { ascending: false })

      if (sleepLogs && sleepLogs.length > 0) {
        const last = sleepLogs[0]
        const isLogHealthy = (l) => {
          if (l.status === 'healthy') return true
          const [bH] = (l.bedtime || '23:00').split(':').map(Number)
          const [wH, wM] = (l.wake_time || '08:00').split(':').map(Number)
          const dur = parseFloat(l.duration_hours || 0)
          return (bH >= 20 || bH <= 2) && (wH < 10 || (wH === 10 && wM === 0)) && (dur >= 5.5 && dur <= 10.5)
        }

        const healthy = sleepLogs.filter(isLogHealthy).length
        const total = sleepLogs.length
        const streak = (() => { let s = 0; for (const l of sleepLogs) { if (isLogHealthy(l)) s++; else break; } return s })()

        // Check criteria for latest log
        const [bH] = (last.bedtime || '23:00').split(':').map(Number)
        const [wH, wM] = (last.wake_time || '08:00').split(':').map(Number)
        const dur = parseFloat(last.duration_hours || 0)

        const isBedtimeOk = bH >= 20 || bH <= 2
        const isWakeOk = wH < 10 || (wH === 10 && wM === 0)
        const isDurationOk = dur >= 5.5 && dur <= 10.5
        const isStreakOk = streak >= 3
        const isComplianceOk = (healthy / total) >= 0.7

        // Threat score: 0 = no threat, 100 = critical
        let threat = 0
        if (!isBedtimeOk) threat += 20
        if (!isWakeOk) threat += 20
        if (!isDurationOk) threat += 20
        if (streak === 0) threat += 20
        else if (!isStreakOk) threat += 10
        if ((healthy / total) < 0.5) threat += 20
        else if (!isComplianceOk) threat += 10

        threat = Math.min(100, Math.max(0, threat))
        setSleepData({ last, healthy, streak, threat, total, isBedtimeOk, isWakeOk, isDurationOk, isStreakOk, isComplianceOk })
      } else {
        setSleepData({ last: null, healthy: 0, streak: 0, threat: 50, total: 0, isBedtimeOk: false, isWakeOk: false, isDurationOk: false, isStreakOk: false, isComplianceOk: false })
      }

      // ── Digital Addiction Widget ──
      const sevenDaysAgoStr = getLocalDateStr(sevenDaysAgo)
      const { data: stHistory } = await sb.from('screen_time_logs')
        .select('*').eq('user_id', user.id)
        .gte('date', sevenDaysAgoStr)
        .order('date', { ascending: false })

      if (stHistory && stHistory.length > 0) {
        const getDoom = (l) => parseInt(l.doom_scroll_minutes ?? l.doomscroll_minutes) || 0
        const avgScreenNum = stHistory.reduce((s, l) => s + (parseFloat(l.total_hours) || 0), 0) / stHistory.length
        const avgScreen = avgScreenNum.toFixed(1)
        const avgDoom = Math.round(stHistory.reduce((s, l) => s + getDoom(l), 0) / stHistory.length)
        const avgStreamingNum = stHistory.reduce((s, l) => s + (parseFloat(l.streaming_hours) || 0), 0) / stHistory.length
        const avgStreaming = avgStreamingNum.toFixed(1)
        const todaySt = stHistory.find(l => l.date === todayStr)
        // Clean day definition: Screen Time < 6h, Doomscroll < 60m, Streaming < 1h
        const daysClean = stHistory.filter(l => (parseFloat(l.total_hours) || 0) < 6 && getDoom(l) < 60 && (parseFloat(l.streaming_hours) || 0) < 1).length

        // Addiction / Threat Score (0 to 100). Higher = worse.
        let addScore = 0
        // Factor 1: 7d avg screen time (target < 6h)
        if (avgScreenNum > 10) addScore += 35
        else if (avgScreenNum > 8) addScore += 25
        else if (avgScreenNum >= 6) addScore += 15

        // Factor 2: 7d avg doomscroll (target < 60m)
        if (avgDoom > 120) addScore += 35
        else if (avgDoom > 90) addScore += 25
        else if (avgDoom >= 60) addScore += 15

        // Factor 3: Today's screen time (target < 6h)
        if (!todaySt) addScore += 15
        else if ((parseFloat(todaySt.total_hours) || 0) > 8) addScore += 25
        else if ((parseFloat(todaySt.total_hours) || 0) >= 6) addScore += 15

        // Factor 4: Clean days in last 7 (target >= 5)
        if (daysClean < 3) addScore += 20
        else if (daysClean < 5) addScore += 10

        // Factor 5: Streaming avg (target < 1h)
        if (avgStreamingNum >= 1) addScore += 10

        addScore = Math.min(100, Math.max(0, addScore))
        setAddictionData({ avgScreen, avgDoom, avgStreaming, daysClean, addScore, todaySt, total: stHistory.length })
      } else {
        setAddictionData({ avgScreen: '—', avgDoom: 0, avgStreaming: '0', daysClean: 0, addScore: 50, todaySt: null, total: 0 })
      }

      // ── EOD Recon Checklist Data Fetching ──
      const { data: workLogRows } = await sb
        .from('work_hours_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .limit(1)

      let workLogged = false
      let workHours = 0
      if (workLogRows && workLogRows.length > 0) {
        workLogged = true
        workHours = workLogRows[0].hours || workLogRows[0].duration_hours || 0
      } else {
        const { data: fallbackWork } = await sb
          .from('work_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', todayStr)
          .limit(1)
        if (fallbackWork && fallbackWork.length > 0) {
          workLogged = true
          workHours = fallbackWork[0].hours || fallbackWork[0].duration_hours || 1
        }
      }
      setEodWorkData({ logged: workLogged, hours: workHours })

      const { data: todaySleepLog } = await sb
        .from('sleep_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle()

      const { data: todayWeightLog } = await sb
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle()

      const habitCompletedToday = (todayLogs || []).some(l => l.date === todayStr && l.status === 'completed')

      const wellnessLogged = !!todaySleepLog || !!todayWeightLog || habitCompletedToday
      let wellnessDetail = ''
      if (todaySleepLog) wellnessDetail = `Sleep: ${todaySleepLog.duration_hours || 8}h`
      else if (todayWeightLog) wellnessDetail = `Weight: ${todayWeightLog.weight_kg}kg`
      else if (habitCompletedToday) wellnessDetail = `Routine Logged`

      setEodWellnessData({ logged: wellnessLogged, detail: wellnessDetail })

      // Fetch Today Speaking Practice Log
      const { data: todaySpeakingLog } = await sb
        .from('speaking_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle()

      if (todaySpeakingLog) {
        setEodSpeakingData({ logged: true, detail: `Topic: ${todaySpeakingLog.topic}` })
      } else {
        const localData = localStorage.getItem(`lokios_speaking_logs_${user.id}`)
        if (localData) {
          const parsed = JSON.parse(localData)
          const found = parsed.find(p => p.date === todayStr)
          if (found) setEodSpeakingData({ logged: true, detail: `Topic: ${found.topic}` })
        }
      }

      try {
        const cacheKey = `lokios_dashboard_recon_${user.id}_${todayStr}`
        localStorage.setItem(cacheKey, JSON.stringify({
          eodWorkData: { logged: workLogged, hours: workHours },
          eodWellnessData: { logged: wellnessLogged, detail: wellnessDetail },
          eodSpeakingData: todaySpeakingLog ? { logged: true, detail: `Topic: ${todaySpeakingLog.topic}` } : { logged: false, detail: '' },
          todayScreenTime: stLogs && stLogs.length > 0 ? stLogs[0] : null,
          latestDebrief: debriefLogs && debriefLogs.length > 0 ? debriefLogs[0] : null,
          eodJournalLogged: (entries || []).some(e => e.date === todayStr)
        }))
      } catch (e) {}
    }
    fetchMetrics()

    const handleBattlesUpdated = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setBattles(e.detail)
      }
    }
    window.addEventListener('lokios_battles_updated', handleBattlesUpdated)
    return () => window.removeEventListener('lokios_battles_updated', handleBattlesUpdated)
  }, [user, todayLogs])

  // ── Quick Log Submit Handlers for EOD Recon ──
  const submitEodScreen = async (e) => {
    e.preventDefault()
    if (!user) return
    const payload = {
      user_id: user.id,
      date: todayStr,
      total_hours: parseFloat(eodScreenForm.total_hours) || 0,
      doom_scroll_minutes: parseInt(eodScreenForm.doomscroll_minutes) || 0,
      streaming_hours: parseFloat(eodScreenForm.streaming_hours) || 0
    }
    // Optimistic UI updates (0ms delay)
    setTodayScreenTime(payload)
    setEodQuickLogModal(null)

    // Background DB sync
    const sb = createClient()
    const { data } = await sb.from('screen_time_logs').insert(payload).select().single()
    if (data) setTodayScreenTime(data)
  }

  const submitEodJournal = async (e) => {
    e.preventDefault()
    if (!user || !eodJournalForm.content.trim()) return
    const payload = {
      user_id: user.id,
      date: todayStr,
      mood: eodJournalForm.mood,
      content: eodJournalForm.content
    }
    // Optimistic UI updates (0ms delay)
    setEodJournalLogged(true)
    setEodQuickLogModal(null)

    // Background DB sync
    const sb = createClient()
    await sb.from('journal_entries').insert(payload)
  }

  const submitEodWork = async (e) => {
    e.preventDefault()
    if (!user) return
    const hrs = parseFloat(eodWorkForm.hours) || 0
    const payload = {
      user_id: user.id,
      date: todayStr,
      hours: hrs,
      duration_hours: hrs,
      work_type: eodWorkForm.work_type,
      notes: eodWorkForm.notes
    }
    // Optimistic UI updates (0ms delay)
    setEodWorkData({ logged: true, hours: hrs })
    setEodQuickLogModal(null)

    // Background DB sync
    const sb = createClient()
    const { error } = await sb.from('work_hours_logs').insert(payload)
    if (error) {
      await sb.from('work_logs').insert({ user_id: user.id, title: 'Work Session', description: eodWorkForm.notes, duration_hours: hrs })
    }
  }

  const submitEodWellness = async (e) => {
    e.preventDefault()
    if (!user) return
    const isSleep = eodWellnessForm.type === 'sleep'
    const detail = isSleep 
      ? `Sleep: ${parseFloat(eodWellnessForm.sleep_hours) || 8}h`
      : `Weight: ${parseFloat(eodWellnessForm.weight_kg) || 75}kg`

    // Optimistic UI updates (0ms delay)
    setEodWellnessData({ logged: true, detail })
    setEodQuickLogModal(null)

    // Background DB sync
    const sb = createClient()
    if (isSleep) {
      const payload = {
        user_id: user.id,
        date: todayStr,
        duration_hours: parseFloat(eodWellnessForm.sleep_hours) || 8,
        bedtime: eodWellnessForm.bedtime,
        wake_time: eodWellnessForm.wake_time,
        status: 'healthy'
      }
      await sb.from('sleep_logs').insert(payload)
    } else {
      const payload = {
        user_id: user.id,
        date: todayStr,
        weight_kg: parseFloat(eodWellnessForm.weight_kg) || 75
      }
      await sb.from('weight_logs').insert(payload)
    }
  }

  const submitEodSpeaking = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!user) return

    let formattedLink = eodSpeakingForm.drive_link.trim()
    if (formattedLink && !formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
      formattedLink = `https://${formattedLink}`
    }

    const topicName = eodSpeakingForm.topic.trim() || 'Daily Speaking Practice'

    const payload = {
      user_id: user.id,
      date: todayStr,
      topic: topicName,
      drive_link: formattedLink,
      notes: eodSpeakingForm.notes.trim(),
      prep_duration_minutes: 10,
      rating: 5,
      created_at: new Date().toISOString()
    }
    // Optimistic UI updates (0ms delay)
    setEodSpeakingData({ logged: true, detail: `Topic: ${topicName}` })
    setEodQuickLogModal(null)

    // Save to local storage first for 100% phone reliability
    const localData = localStorage.getItem(`lokios_speaking_logs_${user.id}`)
    const parsed = localData ? JSON.parse(localData) : []
    const updatedLocal = [payload, ...parsed.filter(p => p.date !== todayStr)]
    localStorage.setItem(`lokios_speaking_logs_${user.id}`, JSON.stringify(updatedLocal))

    // Background DB sync to dual tables (speaking_logs AND work_logs for 100% cross-device sync)
    const sb = createClient()
    try {
      await sb.from('speaking_logs').insert(payload)
    } catch (spErr) {
      console.warn('speaking_logs insert error:', spErr)
    }

    try {
      await sb.from('work_logs').insert({
        user_id: user.id,
        date: todayStr,
        title: `Speaking Practice: ${topicName}`,
        description: eodSpeakingForm.notes.trim() || topicName,
        type: 'speaking_practice',
        media_urls: formattedLink ? [formattedLink] : [],
        duration_hours: 0.25,
        created_at: new Date().toISOString()
      })
    } catch (wlErr) {
      console.warn('work_logs insert error:', wlErr)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const totalXp       = profile?.total_xp       || 0
  const currentStreak = profile?.current_streak ?? profile?.streak_days ?? 0

  const journalLoggedToday = (entries || []).some(e => e.date === todayStr) || eodJournalLogged
  const screenIntelLoggedToday = !!todayScreenTime

  const eodItems = [
    {
      key: 'wellness',
      label: 'Morning Wellness',
      subtitle: 'Sleep, weight recon, or morning habits',
      isDone: eodWellnessData.logged,
      detail: eodWellnessData.detail || (eodWellnessData.logged ? 'Logged' : 'Missing log for today'),
      path: '/quests',
      icon: Flame,
      color: '#f97316'
    },
    {
      key: 'work',
      label: 'Work Session',
      subtitle: 'Work hours & tasks completed',
      isDone: eodWorkData.logged,
      detail: eodWorkData.logged ? `${eodWorkData.hours} hrs logged` : 'No work hours logged today',
      path: '/work',
      icon: Briefcase,
      color: '#A78BFA'
    },
    {
      key: 'journal',
      label: 'Journal Entry',
      subtitle: 'Daily reflection & emotional debrief',
      isDone: journalLoggedToday,
      detail: journalLoggedToday ? 'Daily entry written' : 'No journal entry written today',
      path: '/journal',
      icon: BookOpen,
      color: '#60A5FA'
    },
    {
      key: 'screen',
      label: 'Screen Intel',
      subtitle: 'Digital discipline & screen time',
      isDone: screenIntelLoggedToday,
      detail: screenIntelLoggedToday ? `${todayScreenTime.total_hours || 0} hrs logged` : 'Screen intel missing for today',
      path: '/screen-time',
      icon: Smartphone,
      color: '#22c55e'
    },
    {
      key: 'speaking',
      label: 'Speaking Practice',
      subtitle: '30-day camera challenge & video proof',
      isDone: eodSpeakingData.logged,
      detail: eodSpeakingData.detail || (eodSpeakingData.logged ? 'Video proof logged' : 'No speaking practice today'),
      path: '/speaking',
      icon: Mic,
      color: '#EAB308'
    }
  ]

  const eodCompletedCount = eodItems.filter(i => i.isDone).length
  const isEodAllDone = eodCompletedCount === 5
  const longestStreak = profile?.longest_streak ?? 0

  const currentLevel                                           = calculateLevel(totalXp)
  const { current: xpInLevel, required: xpForNextLevel, percentage: levelPct } = xpToNextLevel(totalXp)
  const xpNeeded     = Math.max(0, xpForNextLevel - xpInLevel)
  const currentRank  = getRankForXp(totalXp)
  const arcColor     = RANK_CONFIG[currentRank.code]?.color || '#9CA3AF'
  const momentumStateColor = dailyMomentum?.color || 'var(--warning)'
  const currentArc   = ARC_CONFIG.find(a => a.rank === currentRank.code) || ARC_CONFIG[0]

  const hoursLeft = +(24 - currentTime.getHours() - currentTime.getMinutes() / 60).toFixed(1)
  const dayPct    = Math.round(((currentTime.getHours() * 60 + currentTime.getMinutes()) / 1440) * 100)
  const dayUrgency = dayPct > 80 ? 'danger' : dayPct > 60 ? 'warning' : 'ok'

  const flameColor = currentStreak >= 30 ? '#F59E0B' : currentStreak >= 7 ? '#f97316' : '#ef4444'

  // todayStr is defined at the top of component

  // ── Dynamic Daily Ops Momentum Engine (-10 to +10) ────────────────────────
  // 1. Habits Performance (Completed vs Failed Today)
  const habitsCompletedToday = (todayLogs || []).filter(l => l.date === todayStr && l.status === 'completed').length
  const habitsFailedToday    = (todayLogs || []).filter(l => l.date === todayStr && l.status === 'failed').length
  const habitComponent       = (habitsCompletedToday * 1.5) - (habitsFailedToday * 1.5)

  // 2. Operations / Tasks (Completed Today vs Overdue / Procrastinated)
  const tasksCompletedToday  = (tasks || []).filter(t => t.status === 'completed' && t.completed_at?.startsWith(todayStr)).length
  const tasksOverdue         = (tasks || []).filter(t => t.status === 'pending' && t.due_date && t.due_date < todayStr).length
  const opsComponent         = (tasksCompletedToday * 1.0) - (tasksOverdue * 1.0)

  // 3. Missions / Goals (Completed vs Stalled / Overdue)
  const missionsCompleted    = (sideQuests || []).filter(g => g.status === 'completed').length
  const missionsStalled      = (sideQuests || []).filter(g => g.status !== 'completed' && g.deadline && g.deadline < todayStr).length
  const missionsComponent    = (missionsCompleted * 2.0) - (missionsStalled * 1.5)

  // 4. Streak & Weekly Win Rate Inertia
  const streakComponent      = currentStreak >= 14 ? 3.0 : currentStreak >= 7 ? 2.0 : currentStreak >= 1 ? 1.0 : 0.0
  const winRateComponent     = weeklyWinRate >= 80 ? 3.0 : weeklyWinRate >= 60 ? 1.5 : weeklyWinRate >= 40 ? 0.0 : -3.0

  const rawMomentum          = habitComponent + opsComponent + missionsComponent + streakComponent + winRateComponent
  const momentumScore        = Math.max(-10, Math.min(10, parseFloat(rawMomentum.toFixed(1))))
  const momentumColor        = dailyMomentum?.color || (momentumScore >= 5 ? 'var(--success)' : momentumScore >= 0 ? 'var(--warning)' : 'var(--danger)')
  const momentumText         = momentumScore >= 5 ? 'SURGING' : momentumScore >= 0 ? 'STEADY' : 'DECLINING'
  // Check if Weekly Debrief has been completed for the current week starting Monday
  const isDebriefDoneThisWeek = useMemo(() => {
    if (!latestDebrief) return false
    const startOfWeekStr = getLocalDateStr(getStartOfWeek(new Date()))
    const debriefDate = latestDebrief.date || (latestDebrief.created_at ? getLocalDateStr(new Date(latestDebrief.created_at)) : '')
    return debriefDate >= startOfWeekStr
  }, [latestDebrief])

  // Parse Next Week Priorities from latest Weekly Debrief log
  const nextWeekPriorities = (function() {
    if (!latestDebrief?.description) return null
    const text = latestDebrief.description
    const marker = '### Priorities for Next Week'
    const idx = text.indexOf(marker)
    if (idx === -1) return null
    let section = text.substring(idx + marker.length).trim()
    const nextHeaderIdx = section.indexOf('### ')
    if (nextHeaderIdx !== -1) section = section.substring(0, nextHeaderIdx).trim()
    return section
  })()

  // Split raw debrief priorities string into up to 3 separate priority tasks
  const parsedPriorities = useMemo(() => {
    if (!nextWeekPriorities) return []
    const rawItems = nextWeekPriorities
      .split(/(?=\b\d+[\.\)])|\n+/)
      .map(s => s.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean)
    if (rawItems.length === 0 && nextWeekPriorities.trim()) {
      return [{ id: 'p1', title: nextWeekPriorities.trim().replace(/^[-*•]\s*(\[[ xXvV✓✕]\])?\s*/, '').replace(/^[xXvV✓✕]\s+/, '').trim(), status: 'pending' }]
    }
    return rawItems.slice(0, 3).map((rawTitle, idx) => {
      let status = 'pending'
      let title = rawTitle
      if (rawTitle.includes('[DONE]')) {
        status = 'completed'
        title = rawTitle.replace('[DONE]', '').trim()
      } else if (rawTitle.includes('[FAILED]')) {
        status = 'failed'
        title = rawTitle.replace('[FAILED]', '').trim()
      }
      title = title
        .replace(/^[-*•]\s*(\[[ xXvV✓✕]\])?\s*/, '')
        .replace(/^[xXvV✓✕]\s+/, '')
        .replace(/^[-*•]\s*/, '')
        .trim()
      return {
        id: `p-${idx + 1}`,
        title,
        status
      }
    })
  }, [nextWeekPriorities])

  // Combined list of Weekly Priorities mapped directly to DB tasks
  const debriefPriorityList = useMemo(() => {
    let sourceList = []

    if (parsedPriorities && parsedPriorities.length > 0) {
      sourceList = parsedPriorities
    } else {
      sourceList = tasks.filter(t => t.category === 'weekly_goal' && t.status !== 'cancelled').slice(0, 3)
    }

    return sourceList.map((item, idx) => {
      let itemTitle = ''
      if (typeof item === 'string') {
        itemTitle = item.trim()
      } else if (item && typeof item === 'object') {
        if (typeof item.title === 'string') itemTitle = item.title.trim()
        else if (item.title && typeof item.title === 'object' && typeof item.title.title === 'string') itemTitle = item.title.title.trim()
        else if (typeof item.name === 'string') itemTitle = item.name.trim()
      }
      if (!itemTitle || itemTitle === '[object Object]') {
        itemTitle = `Priority Goal #${idx + 1}`
      }

      itemTitle = itemTitle
        .replace(/^[-*•]\s*(\[[ xXvV✓✕]\])?\s*/, '')
        .replace(/^[xXvV✓✕]\s+/, '')
        .replace(/^[-*•]\s*/, '')
        .trim()

      // Match ALL tasks in tasks array matching this title or category
      const matchingTasks = tasks.filter(t => 
        (item.id && t.id === item.id) ||
        (t.category === 'weekly_goal' && t.title && t.title.trim().toLowerCase() === itemTitle.toLowerCase()) ||
        (t.description && t.description.includes('[Weekly Goal]') && t.title && t.title.trim().toLowerCase() === itemTitle.toLowerCase())
      )

      const completedTask = matchingTasks.find(t => t.status === 'completed')
      const failedTask = matchingTasks.find(t => t.status === 'failed' || t.status === 'cancelled')
      const activeTask = completedTask || failedTask || matchingTasks[0]

      const keyId = activeTask ? activeTask.id : `debrief_p_${idx}_${itemTitle.slice(0, 8)}`
      const localOverride = priorityStatusMap[keyId] || priorityStatusMap[itemTitle]
      const effectiveStatus = localOverride || (item.status !== 'pending' ? item.status : (activeTask ? activeTask.status : 'pending'))

      return {
        id: keyId,
        taskId: activeTask ? activeTask.id : null,
        matchingTaskIds: matchingTasks.map(t => t.id),
        title: itemTitle,
        status: effectiveStatus,
        category: 'weekly_goal'
      }
    })
  }, [parsedPriorities, tasks, priorityStatusMap])

  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24)
  const briefing = BRIEFINGS[dayOfYear % BRIEFINGS.length]

  const lastJournalDate = entries?.[0]?.date
  const journalDoneToday = lastJournalDate === todayStr

  let deadlineDays = null
  let deadlineUrgency = 'ok'
  if (mainQuest?.deadline) {
    const msDiff = new Date(mainQuest.deadline) - new Date()
    deadlineDays = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)))
    deadlineUrgency = deadlineDays <= 3 ? 'danger' : deadlineDays <= 7 ? 'warning' : 'ok'
  }



  // Helper for Tooltip in Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value
      return (
        <div className="p-2 bg-bg-primary/95 border border-border-color rounded shadow-xl backdrop-blur-md font-mono text-[10px] pointer-events-none">
          <p className="text-muted text-[9px] mb-0.5">{label}</p>
          <p className="font-bold" style={{ color: val >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {val >= 0 ? `+${val}` : val} XP
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <AppShell>
      <div className="page-container relative max-w-[1600px] pb-2 lg:pb-10">

        <style dangerouslySetInnerHTML={{ __html: `
          :root { --arc-color: ${arcColor}; }
          .arc-glow { box-shadow: 0 0 30px ${arcColor}15, 0 0 60px ${arcColor}05; }
          .bento-grid {
            display: grid; grid-template-columns: 1fr; gap: 12px;
          }
          .dashboard-card {
            padding: 16px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
          }
          @media (min-width: 1024px) {
            .bento-grid { grid-template-columns: repeat(12, 1fr); gap: 16px; }
            .col-8 { grid-column: span 8; }
            .col-4 { grid-column: span 4; }
            .dashboard-card { padding: 20px; }
          }
        ` }} />

        {/* ══════════════════════════════════════════════════════════════════
            ARC HERO HEADER & DROPDOWN
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative z-50 mb-4 lg:mb-5">
          <motion.header
            className="arc-glow relative overflow-hidden"
          style={{
            padding: '20px 24px',
            background: `linear-gradient(130deg, #111111 0%, #0a0a0a 60%, ${arcColor}0a 100%)`,
            borderLeft: `3px solid ${arcColor}`,
            borderTop: `1px solid ${arcColor}22`,
            borderRight: `1px solid ${arcColor}0a`,
            borderBottom: `1px solid ${arcColor}0a`,
          }}
          layout
        >
          <div style={{
            position: 'absolute', top: '-40%', right: '-5%',
            width: '300px', height: '300px', borderRadius: '50%',
            background: arcColor, opacity: 0.05, filter: 'blur(60px)',
            pointerEvents: 'none',
          }} />

          <div className="flex flex-wrap items-center gap-4 relative z-10">
            <div
              className="flex flex-col items-center justify-center shrink-0"
              style={{
                width: '56px', height: '56px',
                border: `2px solid ${arcColor}`,
                background: `${arcColor}12`,
              }}
            >
              <span style={{ fontSize: '22px', lineHeight: 1 }}>{currentRank.icon}</span>
              <span className="font-mono tracking-widest mt-0.5" style={{ fontSize: '8px', color: arcColor }}>
                SAGA {currentRank.code}
              </span>
            </div>

            <div className="flex-1 min-w-[140px]">
              <button
                onClick={() => setArcExpanded(v => !v)}
                className="flex items-center gap-2 mb-1 group text-left"
              >
                <h1 className="font-display font-bold tracking-tight text-primary" style={{ fontSize: 'clamp(1.2rem, 3.5vw, 1.8rem)' }}>
                  {currentArc.name.toUpperCase()}
                </h1>
                {arcExpanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
              </button>
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2.5">
                LV.{currentLevel} · <span className="text-primary font-bold">{totalXp.toLocaleString()} XP</span> · <span style={{ color: momentumStateColor }}>{dailyMomentum?.state || 'STEADY'}</span>
              </p>
              <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-2.5">{dailyMomentum?.message || 'Positive or neutral execution. Keep moving.'}</p>
              <div>
                <div className="flex justify-between font-mono text-[8px] text-muted mb-1">
                  <span>LV.{currentLevel}</span>
                  <span style={{ color: arcColor }}>{xpInLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP</span>
                  <span>LV.{currentLevel + 1}</span>
                </div>
                <div style={{ height: '2px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                  <motion.div
                    style={{ height: '100%', background: momentumStateColor, opacity: dailyMomentum?.accentIntensity || 0.5 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${levelPct}%` }}
                    transition={{ duration: 1.4, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 hidden sm:block">
              <div className="font-display font-bold text-primary tracking-tighter" style={{ fontSize: '1.6rem' }}>
                {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="font-mono text-[8px] text-muted uppercase tracking-widest mt-0.5">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </motion.header>

        {/* ══════════════════════════════════════════════════════════════════
            ARC ROADMAP (expandable)
        ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {arcExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-0 right-0 z-50"
              style={{ top: '100%', marginTop: '8px', transformOrigin: 'top' }}
            >
              <div className="dashboard-card shadow-2xl" style={{ border: `1px solid ${arcColor}50`, background: 'rgba(4, 5, 7, 0.95)', backdropFilter: 'blur(16px)' }}>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: arcColor }}>
                    CHARACTER ARC ROADMAP
                  </span>
                  <button onClick={() => setArcExpanded(false)} className="font-mono text-[8px] text-muted hover:text-primary">
                    COLLAPSE ↑
                  </button>
                </div>

                <div className="relative mt-2 mb-2 pl-2">
                  <div className="absolute left-[17px] top-4 bottom-4 w-px" style={{ background: 'var(--border-color)' }} />
                  <div className="flex flex-col gap-2">
                    {ARC_CONFIG.map((arc) => {
                      const rd       = RANK_CONFIG[arc.rank]
                      if (!rd) return null
                      const isCleared = totalXp > rd.maxXp && rd.maxXp < 9000000
                      const isCurrent = currentRank.code === arc.rank
                      const isLocked  = totalXp < rd.minXp
                      const needed    = isLocked ? (rd.minXp - totalXp).toLocaleString() : null

                      return (
                        <div
                          key={arc.rank}
                          className="relative flex flex-row items-center gap-5 py-4"
                          style={{ opacity: isCurrent ? 1 : isCleared ? 0.5 : 0.25 }}
                        >
                          <div
                            className="flex items-center justify-center shrink-0 bg-black z-10"
                            style={{
                              width: '18px', height: '18px',
                              border: `2px solid ${isCurrent ? rd.color : isCleared ? '#22c55e' : 'var(--border-color)'}`,
                              background: isCurrent ? `${rd.color}15` : 'var(--bg-primary)',
                              boxShadow: isCurrent ? `0 0 10px ${rd.color}50` : 'none',
                            }}
                          >
                            {isCleared && <Check size={10} color="#22c55e" strokeWidth={3} />}
                            {isCurrent && (
                              <motion.div
                                className="rounded-full"
                                style={{ width: 6, height: 6, background: rd.color }}
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ repeat: Infinity, duration: 1.4 }}
                              />
                            )}
                            {isLocked && <Lock size={8} color="var(--text-muted)" />}
                          </div>
                          <div className="flex flex-col min-w-0 gap-1">
                            <span className="font-display font-bold text-base md:text-lg leading-tight tracking-wide" style={{ color: isCurrent ? rd.color : 'var(--text-primary)' }}>
                              {arc.name.toUpperCase()}
                            </span>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm" style={{ background: `${rd.color}15`, color: rd.color }}>
                                SAGA {arc.rank}
                              </span>
                              {isCurrent && (
                                <motion.span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: rd.color }}
                                  animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                  ● ACTIVE
                                </motion.span>
                              )}
                              {isLocked && <span className="font-mono text-[9px] text-muted tracking-widest">🔒 {needed} XP</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TOP STRIP — TODAY'S OPERATIONS & SCHEDULE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mb-5 p-3.5 sm:p-4 rounded-xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5 pb-3 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-amber animate-pulse shrink-0" style={{ boxShadow: '0 0 10px var(--amber)' }} />
              <span className="font-mono text-xs uppercase tracking-widest text-amber font-bold truncate">
                TODAY'S OPERATIONS & SCHEDULE
              </span>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-amber/15 border border-amber/40 text-amber font-bold shrink-0">
                {todayTasksScheduled.filter(t => t.status === 'completed').length + Array.from(completedEventIds).length} / {todayCalendarEvents.length + todayTasksScheduled.length} DONE
              </span>
            </div>

            <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase font-bold shrink-0">
              <Link
                href="/tasks"
                className="px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border-color text-muted hover:text-amber transition-colors flex items-center gap-1"
              >
                <span>Ops Hub</span>
                <ExternalLink size={10} />
              </Link>
              <Link
                href="/calendar"
                className="px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border-color text-amber hover:text-amber-hover transition-colors flex items-center gap-1"
              >
                <span>Calendar</span>
                <ExternalLink size={10} />
              </Link>
            </div>
          </div>

          {/* Content Items Grid */}
          {todayCalendarEvents.length === 0 && todayTasksScheduled.length === 0 ? (
            <div className="p-4 text-center rounded-lg bg-black/20 border border-dashed border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <p className="font-mono text-xs text-muted">No scheduled operations or calendar events for today.</p>
              <Link href="/tasks" className="btn btn-secondary btn-xs font-mono text-[10px] inline-flex items-center gap-1">
                <Plus size={11} /> DEPLOY OPERATION
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {/* Scheduled Operations / Tasks */}
              {todayTasksScheduled.map(task => {
                const isDone = task.status === 'completed'
                const titleText = typeof task.title === 'string' ? task.title : (task.title?.title || task.title?.name || 'Operation')
                const isLongTitle = titleText.length > 35

                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-xl border transition-all flex items-start sm:items-center justify-between gap-3 ${
                      isDone 
                        ? 'bg-success/5 border-success/30' 
                        : 'bg-black/50 border-white/10 hover:border-amber/40'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      {/* Checkbox button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isDone) undoCompleteTask(task.id)
                          else completeTask(task.id)
                        }}
                        title={isDone ? "Mark as Pending" : "Mark as Completed"}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all mt-0.5 sm:mt-0 ${
                          isDone 
                            ? 'bg-success text-black border border-success' 
                            : 'border border-amber/60 hover:bg-amber/20 text-amber'
                        }`}
                      >
                        {isDone ? <Check size={14} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-amber/80" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div 
                          className={`font-mono font-bold leading-snug break-words whitespace-normal ${
                            isLongTitle ? 'text-[11px]' : 'text-xs'
                          } ${isDone ? 'text-muted line-through opacity-60' : 'text-primary'}`}
                        >
                          {titleText}
                        </div>
                        <div className="font-mono text-[9px] text-muted uppercase tracking-wider flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-amber font-semibold">{task.category ? task.category.replace('_', ' ') : 'OPERATION'}</span>
                          {task.difficulty && <span className="text-secondary">• {task.difficulty}</span>}
                          {(() => {
                            const cleanDueDate = task.due_date ? task.due_date.substring(0, 10) : null
                            const isOverdue = !isDone && cleanDueDate && cleanDueDate < todayStr && task.category !== 'weekly_goal'
                            if (!isOverdue) return null
                            const [tY, tM, tD] = todayStr.split('-').map(Number)
                            const [dY, dM, dD] = cleanDueDate.split('-').map(Number)
                            const daysOverdue = Math.max(1, Math.round((Date.UTC(tY, tM - 1, tD) - Date.UTC(dY, dM - 1, dD)) / (1000 * 60 * 60 * 24)))
                            return (
                              <span className="text-danger font-bold bg-danger/15 px-1.5 py-0.5 rounded border border-danger/30">
                                ⚠ {daysOverdue}d overdue (-{daysOverdue * 5} XP)
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Action button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isDone) undoCompleteTask(task.id)
                        else completeTask(task.id)
                      }}
                      className={`font-mono text-[9px] font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-wider shrink-0 transition-all whitespace-nowrap self-center ${
                        isDone 
                          ? 'bg-success/20 text-success border border-success/40 hover:bg-success/30' 
                          : 'bg-amber/20 text-amber hover:bg-amber/30 border border-amber/40'
                      }`}
                    >
                      {isDone ? '✓ DONE' : 'MARK DONE'}
                    </button>
                  </div>
                )
              })}

              {/* Calendar Events */}
              {todayCalendarEvents.map((evt, idx) => {
                const evtId = evt.id || `evt-${idx}`
                const isAttended = completedEventIds.has(evtId)
                const titleText = evt.title || evt.summary || 'Calendar Event'
                const isLongTitle = titleText.length > 35

                return (
                  <div
                    key={evtId}
                    className={`p-3 rounded-xl border transition-all flex items-start sm:items-center justify-between gap-3 ${
                      isAttended 
                        ? 'bg-cyan/5 border-cyan/30' 
                        : 'bg-black/50 border-white/10 hover:border-cyan/40'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleEventCompleted(evtId)}
                        title={isAttended ? "Mark as Pending" : "Mark as Completed"}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all mt-0.5 sm:mt-0 ${
                          isAttended 
                            ? 'bg-cyan text-black border border-cyan' 
                            : 'border border-cyan/60 hover:bg-cyan/20 text-cyan'
                        }`}
                      >
                        {isAttended ? <Check size={14} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-cyan/80 animate-pulse" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div 
                          className={`font-mono font-bold leading-snug break-words whitespace-normal ${
                            isLongTitle ? 'text-[11px]' : 'text-xs'
                          } ${isAttended ? 'text-muted line-through opacity-60' : 'text-primary'}`}
                        >
                          {titleText}
                        </div>
                        <div className="font-mono text-[9px] text-muted flex items-center gap-1.5 mt-1 flex-wrap">
                          <Clock size={10} className="text-cyan shrink-0" />
                          <span>{evt.start_time ? (evt.start_time.includes('T') ? evt.start_time.split('T')[1].slice(0, 5) : evt.start_time) : 'All Day'}</span>
                          {evt.location && <span className="break-words">· {evt.location}</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleEventCompleted(evtId)}
                      className={`font-mono text-[9px] font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-wider shrink-0 transition-all whitespace-nowrap self-center ${
                        isAttended 
                          ? 'bg-cyan/20 text-cyan border border-cyan/40 hover:bg-cyan/30' 
                          : 'bg-cyan/20 text-cyan hover:bg-cyan/30 border border-cyan/40'
                      }`}
                    >
                      {isAttended ? '✓ DONE' : 'MARK DONE'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            DAILY PROTOCOL STATUS // COMPACT SQUARE 3x2 GRID
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-5">
          {eodItems.map((item) => {
            const ItemIcon = item.icon
            const displayLabel = item.key === 'wellness' ? 'WELLNESS' : item.key === 'work' ? 'WORK' : item.key === 'journal' ? 'JOURNAL' : item.key === 'screen' ? 'SCREEN INTEL' : item.key === 'speaking' ? 'SPEAKING' : item.label.toUpperCase()
            return (
              <Link 
                key={item.key} 
                href={item.path}
                className="block group"
              >
                <div 
                  className={`p-2.5 sm:p-3 aspect-square text-center transition-all duration-200 flex flex-col justify-center items-center rounded-xl border relative ${
                    item.isDone 
                      ? 'bg-bg-tertiary border-border-color hover:border-primary hover:bg-bg-secondary' 
                      : 'bg-bg-tertiary border-border-color hover:border-amber hover:bg-bg-secondary'
                  }`}
                >
                  <ItemIcon 
                    size={18} 
                    className="mb-1.5 transition-transform group-hover:scale-110" 
                    style={{ color: item.isDone ? 'var(--success)' : 'var(--text-muted)' }} 
                  />
                  <div className="font-mono text-[9px] sm:text-[11px] uppercase tracking-wider text-muted group-hover:text-primary font-bold truncate max-w-full">
                    {displayLabel}
                  </div>
                  <div 
                    className="font-mono text-[9px] sm:text-[10px] mt-1 font-bold flex items-center justify-center gap-1"
                    style={{ color: item.isDone ? 'var(--success)' : 'var(--warning)' }}
                  >
                    {item.isDone ? '✓ LOGGED' : '→ OPEN'}
                  </div>
                </div>
              </Link>
            )
          })}

          {/* DEBRIEF BOX */}
          <Link href="/journal?tab=weekly" className="block group">
            <div 
              className={`p-2.5 sm:p-3 aspect-square text-center transition-all duration-200 flex flex-col justify-center items-center rounded-xl border ${
                isDebriefDoneThisWeek
                  ? 'bg-success/15 border-success text-success shadow-lg'
                  : new Date().getDay() === 0 
                  ? 'bg-warning/15 border-warning hover:border-amber text-warning' 
                  : 'bg-bg-tertiary border-border-color hover:border-primary hover:bg-bg-secondary'
              }`}
            >
              {isDebriefDoneThisWeek ? (
                <CheckCircle2 size={18} className="mb-1.5 text-success transition-transform group-hover:scale-110" />
              ) : (
                <ClipboardList 
                  size={18} 
                  className="mb-1.5 transition-transform group-hover:scale-110" 
                  style={{ color: new Date().getDay() === 0 ? 'var(--warning)' : 'var(--text-muted)' }} 
                />
              )}
              <div className="font-mono text-[9px] sm:text-[11px] uppercase tracking-wider text-muted group-hover:text-primary font-bold truncate max-w-full">
                DEBRIEF
              </div>
              <div 
                className={`font-mono text-[9px] sm:text-[10px] mt-1 font-bold ${
                  isDebriefDoneThisWeek ? 'text-success' : new Date().getDay() === 0 ? 'text-warning' : 'text-muted'
                }`}
              >
                {isDebriefDoneThisWeek ? 'DONE' : new Date().getDay() === 0 ? 'DUE TODAY' : 'DUE SUN'}
              </div>
            </div>
          </Link>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MAIN BENTO GRID
        ══════════════════════════════════════════════════════════════════ */}
        <div className="bento-grid">

          {/* LEFT (8 cols) */}
          <div className="col-8 flex flex-col gap-3 lg:gap-4">

            {/* ACTIVE OBJECTIVE & COUNTDOWN */}
            {mainQuest ? (
              <div
                className="relative overflow-hidden dashboard-card"
                style={{
                  background: 'linear-gradient(135deg, #111111, #0a0a0a)',
                  border: '1px solid var(--info-subtle)',
                  borderLeft: '3px solid var(--info)',
                }}
              >
                <div className="absolute top-0 right-0 pointer-events-none" style={{
                  width: '200px', height: '200px', borderRadius: '50%',
                  background: 'var(--info)', opacity: 0.05, filter: 'blur(50px)',
                  transform: 'translate(30%, -30%)',
                }} />
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <Target size={10} color="var(--info)" />
                  <span className="font-mono text-[8px] uppercase tracking-widest text-info">Active Objective</span>
                  <span className="ml-auto font-mono text-[8px] text-info animate-pulse">● EXECUTING</span>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between gap-4 relative z-10">
                  <div className="flex-1">
                    <h2 className="font-display font-bold text-primary leading-tight mb-2"
                      style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)' }}>
                      {mainQuest.title}
                    </h2>
                    {mainQuest.description && (
                      <p className="font-mono text-[10px] text-muted mb-4 line-clamp-2">{mainQuest.description}</p>
                    )}
                    <TacticalProgress value={mainQuest.progress} max={100} showValue color="var(--info)" />
                  </div>

                  {/* OPERATION DEADLINE COUNTDOWN */}
                  {deadlineDays !== null && (
                    <div className="shrink-0 flex flex-col items-center justify-center p-3 border border-border-color bg-bg-primary min-w-[100px] sm:min-w-[120px]">
                      <Clock size={14} className="mb-1" style={{
                        color: deadlineUrgency === 'danger' ? 'var(--danger)' : deadlineUrgency === 'warning' ? 'var(--warning)' : 'var(--info)'
                      }} />
                      <div className="font-display font-bold" style={{
                        fontSize: '2rem', lineHeight: 1,
                        color: deadlineUrgency === 'danger' ? 'var(--danger)' : deadlineUrgency === 'warning' ? 'var(--warning)' : 'var(--text-primary)'
                      }}>
                        {deadlineDays}
                      </div>
                      <div className="font-mono text-[8px] text-muted uppercase mt-1">Days Left</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="dashboard-card border-dashed text-center">
                <AlertTriangle size={20} className="text-muted mx-auto mb-2" />
                <p className="font-mono text-[10px] text-muted mb-3">No active directives</p>
                <Link href="/goals" className="btn btn-primary btn-sm" style={{ fontSize: '10px', padding: '4px 12px' }}>ASSIGN MISSION</Link>
              </div>
            )}



            {/* NEXT WEEK PRIORITIES // WEEKLY DEBRIEF WIDGET */}
            <div className="dashboard-card border-info-subtle" style={{ borderLeft: '3px solid var(--info)' }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList size={12} color="var(--info)" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-info">Next Week Priorities // Weekly Debrief</span>
                </div>
                <Link href="/journal" className="font-mono text-[9px] text-muted hover:text-info flex items-center gap-1">
                  DEBRIEF <ArrowUpRight size={10} />
                </Link>
              </div>

              {debriefPriorityList.length > 0 ? (
                <div className="space-y-2">
                  {debriefPriorityList.map((gt) => {
                    const isDone = gt.status === 'completed'
                    const isFailed = gt.status === 'failed' || gt.status === 'cancelled'

                    const updateDebriefWorkLog = async (priorityTitle, newTag) => {
                      if (!latestDebrief?.id || !user) return
                      const sb = createClient()
                      const currentDesc = latestDebrief.description || ''
                      const cleanTarget = priorityTitle.replace('[DONE]', '').replace('[FAILED]', '').trim().toLowerCase()

                      const lines = currentDesc.split('\n')
                      const updatedLines = lines.map(line => {
                        const cleanLine = line.replace('[DONE]', '').replace('[FAILED]', '').trim()
                        if (cleanLine.toLowerCase().includes(cleanTarget)) {
                          return newTag ? `${cleanLine} ${newTag}` : cleanLine
                        }
                        return line
                      })

                      const newDesc = updatedLines.join('\n')
                      await sb.from('work_logs').update({ description: newDesc }).eq('id', latestDebrief.id)
                      setLatestDebrief(prev => prev ? { ...prev, description: newDesc } : null)
                    }

                    const handleMarkDone = async () => {
                      const goalTitleText = typeof gt.title === 'string' ? gt.title : (gt.title?.title || gt.title?.name || 'Priority Goal')
                      const stableSourceId = `debrief_p_${goalTitleText.trim().toLowerCase().replace(/\s+/g, '_')}`
                      setPriorityStatusMap(prev => ({ ...prev, [gt.id]: 'completed', [goalTitleText]: 'completed' }))
                      let targetIds = gt.matchingTaskIds && gt.matchingTaskIds.length > 0 ? [...gt.matchingTaskIds] : []

                      if (targetIds.length === 0 && user) {
                        const endOfWeekStr = getLocalDateStr(getEndOfWeek(new Date()))
                        const res = await addTask({
                          title: goalTitleText,
                          type: 'custom',
                          category: 'weekly_goal',
                          due_date: endOfWeekStr,
                          status: 'pending',
                          description: '[Weekly Goal] Priority for Next Week'
                        })
                        if (res?.data?.id) targetIds.push(res.data.id)
                        if (fetchTasks) await fetchTasks()
                      }

                      for (const tid of targetIds) {
                        const updates = { completed_at: new Date().toISOString(), status: 'completed' }
                        await createClient().from('tasks').update(updates).eq('id', tid).eq('user_id', user.id)
                      }

                      await updateDebriefWorkLog(goalTitleText, '[DONE]')
                      await robustAwardXP(user.id, 25, 'task_complete', stableSourceId, `Completed Priority Goal: ${goalTitleText}`, 'discipline')

                      await profile.fetchProfile()
                      if (fetchTasks) await fetchTasks()
                    }

                    const handleMarkFailed = async () => {
                      const goalTitleText = typeof gt.title === 'string' ? gt.title : (gt.title?.title || gt.title?.name || 'Priority Goal')
                      const stableSourceId = `debrief_p_${goalTitleText.trim().toLowerCase().replace(/\s+/g, '_')}`
                      setPriorityStatusMap(prev => ({ ...prev, [gt.id]: 'failed', [goalTitleText]: 'failed' }))
                      let targetIds = gt.matchingTaskIds && gt.matchingTaskIds.length > 0 ? [...gt.matchingTaskIds] : []

                      if (targetIds.length === 0 && user) {
                        const endOfWeekStr = getLocalDateStr(getEndOfWeek(new Date()))
                        const res = await addTask({
                          title: goalTitleText,
                          type: 'custom',
                          category: 'weekly_goal',
                          due_date: endOfWeekStr,
                          status: 'pending',
                          description: '[Weekly Goal] Priority for Next Week'
                        })
                        if (res?.data?.id) targetIds.push(res.data.id)
                        if (fetchTasks) await fetchTasks()
                      }

                      for (const tid of targetIds) {
                        const updates = { completed_at: new Date().toISOString(), status: 'failed' }
                        await createClient().from('tasks').update(updates).eq('id', tid).eq('user_id', user.id)
                      }

                      await updateDebriefWorkLog(goalTitleText, '[FAILED]')
                      await robustAwardXP(user.id, -25, 'task_failed', stableSourceId, `Failed Priority Goal: ${goalTitleText}`, 'discipline')

                      await profile.fetchProfile()
                      if (fetchTasks) await fetchTasks()
                    }

                    const handleReopen = async () => {
                      const stableSourceId = `debrief_p_${gt.title.trim().toLowerCase().replace(/\s+/g, '_')}`
                      setPriorityStatusMap(prev => ({ ...prev, [gt.id]: 'pending', [gt.title]: 'pending' }))
                      const targetIds = gt.matchingTaskIds && gt.matchingTaskIds.length > 0 ? gt.matchingTaskIds : (gt.taskId ? [gt.taskId] : [])
                      for (const tid of targetIds) {
                        const updates = { completed_at: null, status: 'pending' }
                        await createClient().from('tasks').update(updates).eq('id', tid).eq('user_id', user.id)
                      }
                      await updateDebriefWorkLog(gt.title, '')
                      await robustRemoveXP(user.id, 'task_complete', stableSourceId)
                      await robustRemoveXP(user.id, 'task_failed', stableSourceId)
                      await profile.fetchProfile()
                      if (fetchTasks) await fetchTasks()
                    }

                    const goalTitleText = typeof gt.title === 'string' ? gt.title : (gt.title?.title || gt.title?.name || 'Priority Goal')
                    const isLongTitle = goalTitleText.length > 35

                    return (
                      <div key={gt.id} className={`flex items-start sm:items-center justify-between gap-2.5 p-2.5 rounded bg-bg-primary border transition-all w-full max-w-full overflow-hidden ${
                        isDone ? 'border-success/40 bg-success/5' : isFailed ? 'border-danger/40 bg-danger/5' : 'border-border-color'
                      }`}>
                        <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0 mt-0.5 sm:mt-0">
                            {isDone || isFailed ? (
                              <button
                                type="button"
                                onClick={handleReopen}
                                title="Re-open Priority Goal"
                                className="w-6 h-6 rounded flex items-center justify-center border border-border-color hover:border-info text-info bg-bg-tertiary transition-all shrink-0"
                              >
                                <RotateCcw size={12} />
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={handleMarkDone}
                                  title="Mark Completed (+25 XP)"
                                  className="w-6 h-6 rounded flex items-center justify-center border border-success/60 hover:bg-success text-success hover:text-bg-primary transition-all shrink-0"
                                >
                                  <Check size={13} strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleMarkFailed}
                                  title="Mark Failed (-25 XP)"
                                  className="w-6 h-6 rounded flex items-center justify-center border border-danger/60 hover:bg-danger text-danger hover:text-white transition-all shrink-0"
                                >
                                  <X size={13} strokeWidth={2.5} />
                                </button>
                              </>
                            )}
                          </div>
                          <span className={`font-mono leading-snug break-words whitespace-normal flex-1 min-w-0 transition-all ${
                            isLongTitle ? 'text-[11px]' : 'text-xs'
                          } ${
                            isDone 
                              ? 'text-success line-through decoration-success font-medium opacity-90' 
                              : isFailed 
                              ? 'text-danger line-through decoration-danger font-medium opacity-90' 
                              : 'text-primary font-medium'
                          }`}>
                            {goalTitleText}
                          </span>
                        </div>
                        {isDone ? (
                          <span className="font-mono text-[9px] text-success font-bold shrink-0 px-1.5 py-0.5 rounded bg-success/10 border border-success/30 whitespace-nowrap self-center">DONE (+25 XP)</span>
                        ) : isFailed ? (
                          <span className="font-mono text-[9px] text-danger font-bold shrink-0 px-1.5 py-0.5 rounded bg-danger/10 border border-danger/30 whitespace-nowrap self-center">FAILED (-25 XP)</span>
                        ) : (
                          <span className="font-mono text-[9px] text-amber shrink-0 font-semibold whitespace-nowrap self-center">+25 XP</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 text-center rounded-sm bg-bg-primary border border-dashed border-border-color">
                  <p className="font-mono text-[10px] text-muted mb-2">No priorities logged for this cycle.</p>
                  <Link href="/journal" className="btn btn-secondary btn-sm font-mono text-[9px]">
                    INITIALIZE WEEKLY DEBRIEF
                  </Link>
                </div>
              )}
            </div>

            {/* 30-DAY XP TRAJECTORY GRAPH */}
            <div className="dashboard-card" style={{ paddingBottom: '8px' }}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={10} color={arcColor} />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">30-Day Project Trajectory (XP)</span>
              </div>
              <div style={{ width: '100%', height: '140px' }}>
                <ResponsiveContainer>
                  <AreaChart data={xpTrajectory} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={arcColor} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={arcColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="xp" stroke={arcColor} fillOpacity={1} fill="url(#colorXp)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* DAILY CLASSIFIED BRIEFING */}
            <div className="dashboard-card">
              <div className="flex items-center gap-2 mb-2">
                <Terminal size={10} color="var(--text-muted)" />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Daily Briefing // Intelligence</span>
              </div>
              <p className="font-display text-primary" style={{ fontSize: '1.2rem', lineHeight: 1.3 }}>
                "{briefing}"
              </p>
            </div>

          </div>

          {/* RIGHT SIDEBAR (4 cols) */}
          <div className="col-4 flex flex-col gap-3 lg:gap-4">

            {/* MOMENTUM & STREAK */}
            <div 
              className="dashboard-card cursor-pointer hover:border-primary transition-colors" 
              onClick={() => setMomentumExpanded(!momentumExpanded)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Activity size={10} color={momentumColor} />
                  <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Momentum Engine</span>
                </div>
                <span className="font-mono text-[8px] font-bold" style={{ color: momentumColor }}>
                  {dailyMomentum?.state || momentumText}
                </span>
              </div>
              
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="font-display font-bold tracking-tighter" style={{ fontSize: '2.8rem', color: momentumColor, lineHeight: 1 }}>
                    {momentumScore > 0 ? '+' : ''}{momentumScore}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase">{dailyMomentum?.todayNet >= 0 ? '+' : ''}{dailyMomentum?.todayNet ?? 0} XP TODAY</div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 mb-1.5">
                    <Flame size={10} color={flameColor} />
                    <span className="font-mono font-bold text-primary" style={{ fontSize: '1rem' }}>{currentStreak} <span className="text-[8px] text-muted font-normal">days</span></span>
                  </div>
                  <div className="font-mono font-bold text-primary" style={{ fontSize: '1rem' }}>{weeklyWinRate}% <span className="text-[8px] text-muted font-normal">win rate</span></div>
                </div>
              </div>

              {/* Score bar */}
              <div style={{ height: '2px', background: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${((momentumScore + 10) / 20) * 100}%`, background: momentumColor, transition: 'width 1s ease' }} />
              </div>

              {/* Momentum Breakdown */}
              <AnimatePresence>
                {momentumExpanded && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 overflow-hidden"
                    style={{ borderTop: '1px solid var(--border-color)' }}
                  >
                    <div className="flex flex-col gap-2 font-mono text-[9px] text-muted tracking-widest">
                      <div className="flex justify-between">
                        <span>HABITS TODAY ({habitsCompletedToday}/{habitsCompletedToday + habitsFailedToday})</span> 
                        <span className="font-bold" style={{ color: habitComponent > 0 ? 'var(--success)' : habitComponent < 0 ? 'var(--danger)' : 'inherit' }}>{habitComponent > 0 ? '+' : ''}{habitComponent.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>OPERATIONS ({tasksCompletedToday} done / {tasksOverdue} overdue)</span> 
                        <span className="font-bold" style={{ color: opsComponent > 0 ? 'var(--success)' : opsComponent < 0 ? 'var(--danger)' : 'inherit' }}>{opsComponent > 0 ? '+' : ''}{opsComponent.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MISSIONS ({missionsCompleted} done / {missionsStalled} stalled)</span> 
                        <span className="font-bold" style={{ color: missionsComponent > 0 ? 'var(--success)' : missionsComponent < 0 ? 'var(--danger)' : 'inherit' }}>{missionsComponent > 0 ? '+' : ''}{missionsComponent.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>STREAK INERTIA ({currentStreak}d)</span> 
                        <span className="font-bold" style={{ color: streakComponent > 0 ? 'var(--success)' : 'inherit' }}>{streakComponent > 0 ? '+' : ''}{streakComponent.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>WEEKLY WIN RATE ({weeklyWinRate}%)</span> 
                        <span className="font-bold" style={{ color: winRateComponent > 0 ? 'var(--success)' : winRateComponent < 0 ? 'var(--danger)' : 'inherit' }}>{winRateComponent > 0 ? '+' : ''}{winRateComponent.toFixed(1)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* XP STAT CARD */}
            <div className="dashboard-card" style={{ borderLeft: `3px solid ${arcColor}`, borderTop: `1px solid ${arcColor}20`, borderRight: `1px solid ${arcColor}20`, borderBottom: `1px solid ${arcColor}20` }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Zap size={10} style={{ color: arcColor }} />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">XP Matrix</span>
              </div>
              <div className="grid grid-cols-3 gap-y-3 gap-x-2">
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none text-info" style={{ fontSize: '1.4rem' }}>
                    {xpNeeded >= 1000 ? `${(xpNeeded / 1000).toFixed(1)}k` : xpNeeded}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TO LV.{currentLevel + 1}</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.4rem', color: xpToday > 0 ? 'var(--success)' : xpToday < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {dailyMomentum?.todayNet >= 0 ? '+' : ''}{dailyMomentum?.todayNet ?? xpToday}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TODAY</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.4rem', color: xpThisWeek > 0 ? 'var(--success)' : xpThisWeek < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {dailyMomentum?.threeDayNet >= 0 ? '+' : ''}{dailyMomentum?.threeDayNet ?? xpThisWeek}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">3-DAY NET</div>
                </div>
              </div>
            </div>

            {/* BODY RECON WIDGET */}
            {weightData && (
              <Link href="/quests">
                <div className="dashboard-card hover:border-amber transition-colors cursor-pointer" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Scale size={10} color="var(--accent-primary)" />
                    <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Body Recon</span>
                    {weightData.loggedToday && <span className="ml-auto font-mono text-[8px] text-success">✓ LOGGED</span>}
                  </div>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>
                        {weightData.current}
                        <span className="font-mono text-[9px] text-muted ml-1">kg</span>
                      </div>
                      <div className="font-mono text-[8px] text-muted uppercase mt-1">
                        {weightData.lost > 0 ? `▼ ${weightData.lost} kg lost` : 'Current'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[10px] font-bold" style={{ color: 'var(--accent-primary)' }}>
                        → {weightData.target} kg
                      </div>
                      <div className="font-mono text-[8px] text-muted mt-0.5">{weightData.progressPct}%</div>
                    </div>
                  </div>
                  <div style={{ height: '3px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${weightData.progressPct}%`, background: weightData.progressPct >= 100 ? 'var(--success)' : 'var(--accent-primary)', transition: 'width 1s ease' }} />
                  </div>
                </div>
              </Link>
            )}

            {/* ── SLEEP SENTINEL WIDGET ── */}
            {sleepData !== null && (
              <div
                className="dashboard-card cursor-pointer transition-colors hover:border-primary"
                style={{ borderLeft: `3px solid ${sleepData.threat >= 60 ? 'var(--danger)' : sleepData.threat >= 30 ? 'var(--warning)' : 'var(--success)'}` }}
                onClick={() => setExpandedWidget(expandedWidget === 'sleep' ? null : 'sleep')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Moon size={10} style={{ color: sleepData.threat >= 60 ? 'var(--danger)' : sleepData.threat >= 30 ? 'var(--warning)' : 'var(--success)' }} />
                    <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Sleep Sentinel</span>
                  </div>
                  <span className="font-mono text-[8px] font-bold" style={{ color: sleepData.threat >= 60 ? 'var(--danger)' : sleepData.threat >= 30 ? 'var(--warning)' : 'var(--success)' }}>
                    {sleepData.threat >= 60 ? '⚠ THREAT' : sleepData.threat >= 30 ? 'MONITOR' : '✓ STABLE'}
                  </span>
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.8rem', color: sleepData.threat >= 60 ? 'var(--danger)' : sleepData.threat >= 30 ? 'var(--warning)' : 'var(--success)' }}>
                      {sleepData.threat}
                      <span className="font-mono text-[9px] text-muted ml-1">/ 100</span>
                    </div>
                    <div className="font-mono text-[8px] text-muted uppercase mt-1">Threat Score</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] font-bold text-primary">{sleepData.streak}d <span className="text-muted font-normal">streak</span></div>
                    <div className="font-mono text-[8px] text-muted mt-0.5">{sleepData.healthy}/{sleepData.total} healthy</div>
                  </div>
                </div>

                {/* Threat bar */}
                <div style={{ height: '3px', background: 'var(--bg-primary)', overflow: 'hidden', marginBottom: '8px' }}>
                  <motion.div
                    style={{ height: '100%', background: sleepData.threat >= 60 ? 'var(--danger)' : sleepData.threat >= 30 ? 'var(--warning)' : 'var(--success)' }}
                    initial={{ width: 0 }} animate={{ width: `${sleepData.threat}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>

                {/* Last night pill */}
                {sleepData.last && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[8px] text-muted">Last night:</span>
                    <span className="font-mono text-[8px] font-bold" style={{ color: sleepData.last.status === 'healthy' ? 'var(--success)' : 'var(--danger)' }}>
                      {sleepData.last.bedtime || '?'} → {sleepData.last.wake_time || '?'}
                    </span>
                    <span className="font-mono text-[8px] font-bold" style={{ color: sleepData.last.status === 'healthy' ? 'var(--success)' : 'var(--danger)' }}>
                      {sleepData.last.duration_hours ? `${sleepData.last.duration_hours}h` : ''}
                    </span>
                    <span className="ml-auto font-mono text-[8px] px-1.5 py-0.5" style={{ background: sleepData.last.status === 'healthy' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: sleepData.last.status === 'healthy' ? 'var(--success)' : 'var(--danger)' }}>
                      {sleepData.last.status === 'healthy' ? '✓ CLEAN' : '✗ MISSED'}
                    </span>
                  </div>
                )}

                <AnimatePresence>
                  {expandedWidget === 'sleep' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                      <div className="flex flex-col gap-1.5 font-mono text-[9px]">
                        <div className="text-muted uppercase tracking-widest mb-1">INTEL BREAKDOWN</div>
                        {[
                          { label: `Target: Sleep before 12 AM ${sleepData.last?.bedtime ? `(${sleepData.last.bedtime})` : ''}`, ok: sleepData.isBedtimeOk },
                          { label: `Target: Wake before 9 AM ${sleepData.last?.wake_time ? `(${sleepData.last.wake_time})` : ''}`, ok: sleepData.isWakeOk },
                          { label: `Target: Duration 6–10h ${sleepData.last?.duration_hours ? `(${sleepData.last.duration_hours}h)` : ''}`, ok: sleepData.isDurationOk },
                          { label: `Clean streak: ${sleepData.streak} night(s) (target ≥3)`, ok: sleepData.isStreakOk },
                          { label: `7-day compliance: ${sleepData.healthy}/${sleepData.total} healthy (target ≥70%)`, ok: sleepData.isComplianceOk },
                        ].map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span style={{ color: f.ok ? 'var(--success)' : 'var(--danger)' }}>{f.ok ? '✓' : '✗'}</span>
                            <span className="text-secondary">{f.label}</span>
                          </div>
                        ))}
                        <div className="mt-2 pt-2" style={{ borderTop: '1px dashed var(--border-color)' }}>
                          <div className="text-muted">Tonight's directive: In bed by 23:45 · Up by 08:30</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── DIGITAL ADDICTION WIDGET ── */}
            {addictionData !== null && (
              <div
                className="dashboard-card cursor-pointer transition-colors hover:border-primary"
                style={{ borderLeft: `3px solid ${addictionData.addScore >= 55 ? 'var(--danger)' : addictionData.addScore >= 30 ? 'var(--warning)' : 'var(--success)'}` }}
                onClick={() => setExpandedWidget(expandedWidget === 'addiction' ? null : 'addiction')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Smartphone size={10} style={{ color: addictionData.addScore >= 55 ? 'var(--danger)' : addictionData.addScore >= 30 ? 'var(--warning)' : 'var(--success)' }} />
                    <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Digital Addiction</span>
                  </div>
                  <span className="font-mono text-[8px] font-bold" style={{ color: addictionData.addScore >= 55 ? 'var(--danger)' : addictionData.addScore >= 30 ? 'var(--warning)' : 'var(--success)' }}>
                    {addictionData.addScore >= 55 ? '⚠ HOOKED' : addictionData.addScore >= 30 ? 'DRIFTING' : '✓ CLEAN'}
                  </span>
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.8rem', color: addictionData.addScore >= 55 ? 'var(--danger)' : addictionData.addScore >= 30 ? 'var(--warning)' : 'var(--success)' }}>
                      {addictionData.addScore}
                      <span className="font-mono text-[9px] text-muted ml-1">/ 100</span>
                    </div>
                    <div className="font-mono text-[8px] text-muted uppercase mt-1">Addiction Score</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] font-bold text-primary">{addictionData.avgScreen}h <span className="text-muted font-normal">avg/day</span></div>
                    <div className="font-mono text-[8px] text-muted mt-0.5">{addictionData.daysClean}d clean (7d)</div>
                  </div>
                </div>

                {/* Addiction bar */}
                <div style={{ height: '3px', background: 'var(--bg-primary)', overflow: 'hidden', marginBottom: '8px' }}>
                  <motion.div
                    style={{ height: '100%', background: addictionData.addScore >= 55 ? 'var(--danger)' : addictionData.addScore >= 30 ? 'var(--warning)' : 'var(--success)' }}
                    initial={{ width: 0 }} animate={{ width: `${addictionData.addScore}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>

                {/* Doomscroll meter */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[8px] text-muted">Doomscroll 7d avg:</span>
                  <span className="font-mono text-[9px] font-bold" style={{ color: addictionData.avgDoom > 60 ? 'var(--danger)' : addictionData.avgDoom > 30 ? 'var(--warning)' : 'var(--success)' }}>
                    {addictionData.avgDoom}m
                  </span>
                  {addictionData.todaySt && (
                    <span className="ml-auto font-mono text-[8px] px-1.5 py-0.5" style={{ background: (parseFloat(addictionData.todaySt.total_hours) || 0) <= 4 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: (parseFloat(addictionData.todaySt.total_hours) || 0) <= 4 ? 'var(--success)' : 'var(--danger)' }}>
                      Today: {addictionData.todaySt.total_hours || '?'}h
                    </span>
                  )}
                </div>

                <AnimatePresence>
                  {expandedWidget === 'addiction' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                      <div className="flex flex-col gap-1.5 font-mono text-[9px]">
                        <div className="text-muted uppercase tracking-widest mb-1">INTEL BREAKDOWN</div>
                        {[
                          { label: `7-day avg screen time: ${addictionData.avgScreen}h (target ≤4h)`, ok: parseFloat(addictionData.avgScreen) <= 4 },
                          { label: `7-day avg doomscroll: ${addictionData.avgDoom}m (target ≤30m)`, ok: addictionData.avgDoom <= 30 },
                          { label: `Today logged: ${addictionData.todaySt ? addictionData.todaySt.total_hours + 'h' : 'not logged'}`, ok: !!addictionData.todaySt && (parseFloat(addictionData.todaySt.total_hours) || 0) <= 4 },
                          { label: `Clean days in last 7: ${addictionData.daysClean} (target ≥5)`, ok: addictionData.daysClean >= 5 },
                          { label: `Streaming avg: ${addictionData.avgStreaming || '0'}h (target ≤2h)`, ok: parseFloat(addictionData.avgStreaming || 0) <= 2 },
                        ].map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span style={{ color: f.ok ? 'var(--success)' : 'var(--danger)' }}>{f.ok ? '✓' : '✗'}</span>
                            <span className="text-secondary">{f.label}</span>
                          </div>
                        ))}
                        <div className="mt-2 pt-2" style={{ borderTop: '1px dashed var(--border-color)' }}>
                          <div className="text-muted">Today's directive: ≤4h screen · ≤30m doom · ≤2h streaming</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* DAY PRESSURE CLOCK */}
            <div className="dashboard-card">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted">Time Remaining</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0" style={{ width: '48px', height: '48px' }}>
                  <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="24" cy="24" r="20" fill="none" stroke="var(--bg-primary)" strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" fill="none"
                      stroke={dayUrgency === 'danger' ? 'var(--danger)' : dayUrgency === 'warning' ? 'var(--warning)' : arcColor}
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - dayPct / 100)}`}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono font-bold text-primary" style={{ fontSize: '8px' }}>{dayPct}%</span>
                  </div>
                </div>
                <div>
                  <div className="font-display font-bold text-primary" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                    {hoursLeft}<span className="font-mono text-xs text-muted">h</span>
                  </div>
                  <div className="font-mono text-[8px] mt-1.5" style={{
                    color: dayUrgency === 'danger' ? 'var(--danger)' : dayUrgency === 'warning' ? 'var(--warning)' : 'var(--text-muted)'
                  }}>
                    {dayUrgency === 'danger' ? '⚠ EXECUTE NOW' : dayUrgency === 'warning' ? 'WINDOW CLOSING' : 'TIME ON SIDE'}
                  </div>
                </div>
              </div>
            </div>





          </div>
        </div>
      </div>


      {/* QUICK LOG MODAL FOR EOD RECON */}
      <AnimatePresence>
        {eodQuickLogModal && (
          <div className="modal-overlay" onClick={() => setEodQuickLogModal(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md p-5 bg-bg-secondary border border-border-color rounded-xl shadow-2xl relative m-4"
            >
              <button 
                onClick={() => setEodQuickLogModal(null)}
                className="absolute top-4 right-4 text-muted hover:text-primary"
              >
                <X size={18} />
              </button>

              {/* SCREEN INTEL QUICK LOG */}
              {eodQuickLogModal === 'screen' && (
                <form onSubmit={submitEodScreen} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-success border-b border-white/10 pb-3">
                    <Smartphone size={18} />
                    <span className="font-mono text-sm uppercase tracking-widest font-bold text-primary">
                      QUICK LOG // SCREEN INTEL
                    </span>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">TOTAL SCREEN TIME (HOURS)</label>
                    <input type="number" step="0.1" required className="input w-full font-mono text-xs" value={eodScreenForm.total_hours} onChange={e => setEodScreenForm({...eodScreenForm, total_hours: e.target.value})} placeholder="e.g. 4.5" />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">DOOMSCROLL TIME (MINUTES)</label>
                    <input type="number" required className="input w-full font-mono text-xs" value={eodScreenForm.doomscroll_minutes} onChange={e => setEodScreenForm({...eodScreenForm, doomscroll_minutes: e.target.value})} placeholder="e.g. 30" />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">STREAMING / VIDEO TIME (HOURS)</label>
                    <input type="number" step="0.1" required className="input w-full font-mono text-xs" value={eodScreenForm.streaming_hours} onChange={e => setEodScreenForm({...eodScreenForm, streaming_hours: e.target.value})} placeholder="e.g. 1.0" />
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" className="btn btn-ghost btn-sm font-mono text-xs" onClick={() => setEodQuickLogModal(null)}>CANCEL</button>
                    <button type="submit" className="btn btn-primary btn-sm font-mono text-xs font-bold">+ SAVE SCREEN INTEL</button>
                  </div>
                </form>
              )}

              {/* JOURNAL QUICK LOG */}
              {eodQuickLogModal === 'journal' && (
                <form onSubmit={submitEodJournal} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-info border-b border-white/10 pb-3">
                    <BookOpen size={18} />
                    <span className="font-mono text-sm uppercase tracking-widest font-bold text-primary">
                      QUICK LOG // DAILY JOURNAL
                    </span>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">TODAY'S MOOD</label>
                    <select className="select w-full font-mono text-xs" value={eodJournalForm.mood} onChange={e => setEodJournalForm({...eodJournalForm, mood: e.target.value})}>
                      <option value="great">🟢 GREAT</option>
                      <option value="good">🟡 GOOD</option>
                      <option value="okay">🟠 OKAY</option>
                      <option value="bad">🔴 BAD</option>
                      <option value="terrible">⚫ TERRIBLE</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">DAILY REFLECTION / NOTES</label>
                    <textarea rows={4} required className="textarea w-full font-mono text-xs" value={eodJournalForm.content} onChange={e => setEodJournalForm({...eodJournalForm, content: e.target.value})} placeholder="What did you build, accomplish, or learn today?" />
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" className="btn btn-ghost btn-sm font-mono text-xs" onClick={() => setEodQuickLogModal(null)}>CANCEL</button>
                    <button type="submit" className="btn btn-primary btn-sm font-mono text-xs font-bold">+ SAVE JOURNAL ENTRY</button>
                  </div>
                </form>
              )}

              {/* WORK QUICK LOG */}
              {eodQuickLogModal === 'work' && (
                <form onSubmit={submitEodWork} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-purple-400 border-b border-white/10 pb-3">
                    <Briefcase size={18} />
                    <span className="font-mono text-sm uppercase tracking-widest font-bold text-primary">
                      QUICK LOG // WORK SESSION
                    </span>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">HOURS WORKED TODAY</label>
                    <input type="number" step="0.5" required className="input w-full font-mono text-xs" value={eodWorkForm.hours} onChange={e => setEodWorkForm({...eodWorkForm, hours: e.target.value})} placeholder="e.g. 4.0" />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">WORK TYPE / CATEGORY</label>
                    <select className="select w-full font-mono text-xs" value={eodWorkForm.work_type} onChange={e => setEodWorkForm({...eodWorkForm, work_type: e.target.value})}>
                      <option value="deep_work">Deep Work / Engineering</option>
                      <option value="client_work">Client Work / Business</option>
                      <option value="learning">Learning / Research</option>
                      <option value="planning">Strategy & Planning</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">WORK NOTES (OPTIONAL)</label>
                    <textarea rows={3} className="textarea w-full font-mono text-xs" value={eodWorkForm.notes} onChange={e => setEodWorkForm({...eodWorkForm, notes: e.target.value})} placeholder="Key tasks accomplished in this session..." />
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" className="btn btn-ghost btn-sm font-mono text-xs" onClick={() => setEodQuickLogModal(null)}>CANCEL</button>
                    <button type="submit" className="btn btn-primary btn-sm font-mono text-xs font-bold">+ SAVE WORK LOG</button>
                  </div>
                </form>
              )}

              {/* MORNING WELLNESS QUICK LOG */}
              {eodQuickLogModal === 'wellness' && (
                <form onSubmit={submitEodWellness} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-amber border-b border-white/10 pb-3">
                    <Flame size={18} />
                    <span className="font-mono text-sm uppercase tracking-widest font-bold text-primary">
                      QUICK LOG // MORNING WELLNESS
                    </span>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">WELLNESS METRIC TYPE</label>
                    <div className="flex gap-2 mb-2">
                      <button type="button" className={`btn btn-xs flex-1 font-mono ${eodWellnessForm.type === 'sleep' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEodWellnessForm({...eodWellnessForm, type: 'sleep'})}>😴 Sleep Log</button>
                      <button type="button" className={`btn btn-xs flex-1 font-mono ${eodWellnessForm.type === 'weight' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEodWellnessForm({...eodWellnessForm, type: 'weight'})}>⚖️ Weight Log</button>
                    </div>
                  </div>

                  {eodWellnessForm.type === 'sleep' ? (
                    <>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">SLEEP DURATION (HOURS)</label>
                        <input type="number" step="0.5" required className="input w-full font-mono text-xs" value={eodWellnessForm.sleep_hours} onChange={e => setEodWellnessForm({...eodWellnessForm, sleep_hours: e.target.value})} placeholder="e.g. 7.5" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-mono text-xs text-muted mb-1 block">BEDTIME</label>
                          <input type="time" className="input w-full font-mono text-xs" value={eodWellnessForm.bedtime} onChange={e => setEodWellnessForm({...eodWellnessForm, bedtime: e.target.value})} />
                        </div>
                        <div>
                          <label className="font-mono text-xs text-muted mb-1 block">WAKE TIME</label>
                          <input type="time" className="input w-full font-mono text-xs" value={eodWellnessForm.wake_time} onChange={e => setEodWellnessForm({...eodWellnessForm, wake_time: e.target.value})} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">BODY WEIGHT (KG)</label>
                      <input type="number" step="0.1" required className="input w-full font-mono text-xs" value={eodWellnessForm.weight_kg} onChange={e => setEodWellnessForm({...eodWellnessForm, weight_kg: e.target.value})} placeholder="e.g. 75.0" />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" className="btn btn-ghost btn-sm font-mono text-xs" onClick={() => setEodQuickLogModal(null)}>CANCEL</button>
                    <button type="submit" className="btn btn-primary btn-sm font-mono text-xs font-bold">+ SAVE WELLNESS LOG</button>
                  </div>
                </form>
              )}

              {/* SPEAKING PRACTICE QUICK LOG */}
              {eodQuickLogModal === 'speaking' && (
                <form onSubmit={submitEodSpeaking} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-amber border-b border-white/10 pb-3">
                    <Mic size={18} />
                    <span className="font-mono text-sm uppercase tracking-widest font-bold text-primary">
                      QUICK LOG // SPEAKING PRACTICE
                    </span>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">TOPIC / TITLE</label>
                    <input type="text" required className="input w-full font-mono text-xs" value={eodSpeakingForm.topic} onChange={e => setEodSpeakingForm({...eodSpeakingForm, topic: e.target.value})} placeholder="e.g. Explain quantum computing..." />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">GOOGLE DRIVE / VIDEO URL (OPTIONAL)</label>
                    <input type="text" className="input w-full font-mono text-xs" value={eodSpeakingForm.drive_link} onChange={e => setEodSpeakingForm({...eodSpeakingForm, drive_link: e.target.value})} placeholder="https://drive.google.com/file/d/..." />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted mb-1 block">SPEAKING NOTES (OPTIONAL)</label>
                    <textarea rows={3} className="textarea w-full font-mono text-xs" value={eodSpeakingForm.notes} onChange={e => setEodSpeakingForm({...eodSpeakingForm, notes: e.target.value})} placeholder="Key takeaways from this speech..." />
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" className="btn btn-ghost btn-sm font-mono text-xs" onClick={() => setEodQuickLogModal(null)}>CANCEL</button>
                    <button type="submit" className="btn btn-primary btn-sm font-mono text-xs font-bold">+ SAVE SPEAKING LOG</button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
