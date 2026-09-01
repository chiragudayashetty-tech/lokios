'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, AlertTriangle, Zap, Swords, Flame, ChevronDown,
  ChevronUp, Lock, Check, ClipboardList, BookOpen,
  Activity, Clock, Terminal, ArrowUpRight, BarChart2,
  Smartphone, Shield, DollarSign, Moon, Brain, Repeat, X, RotateCcw,
  Calendar as CalendarIcon, MapPin, Plus, ExternalLink, Briefcase, Sun, FileText, CheckCircle2, Mic, Sparkles
} from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { RANK_CONFIG, SAGA_IMAGES, SAGA_TITLES } from '@/lib/constants'
import { getLocalDateStr, getEndOfWeek, getStartOfWeek, getDebriefSortTime } from '@/lib/utils/dates'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

const ARC_CONFIG = [
  { rank: 'I',       name: 'The Awakening',          flavor: 'The moment I stopped drifting and chose the life I wanted to build.', minLvl: 1, maxLvl: 10 },
  { rank: 'II',      name: 'The Discipline Rebuild', flavor: 'I rebuilt my mind, habits, and identity one day at a time.', minLvl: 11, maxLvl: 17 },
  { rank: 'III',     name: 'The Spark',              flavor: 'Small actions became unstoppable momentum.', minLvl: 18, maxLvl: 26 },
  { rank: 'IV',      name: 'The Architect',          flavor: 'I stopped chasing success and started designing systems, businesses, and a better future.', minLvl: 27, maxLvl: 38 },
  { rank: 'V',       name: 'The King',               flavor: 'I learned to lead myself first, then earned the trust to lead others.', minLvl: 39, maxLvl: 54 },
  { rank: 'VI',      name: 'The Empire',             flavor: 'My work grew beyond me into companies, teams, and communities that create lasting value.', minLvl: 55, maxLvl: 77 },
  { rank: 'VII',     name: 'The Legacy',             flavor: 'My greatest achievement became the people I inspired and the lives I changed.', minLvl: 78, maxLvl: 99 },
  { rank: 'VIII',    name: 'Beyond',                 flavor: 'There is no finish line. Every summit reveals a higher mountain.', minLvl: 100, maxLvl: 999 },
]

const BATTLE_ICONS = {
  'Phone Addiction':       Smartphone,
  'Porn Consumption':      Shield,
  'Inconsistent Execution':Repeat,
  'Fear of Selling':       DollarSign,
  'Poor Sleep Discipline': Moon,
}

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
  const [sagaRosterOpen, setSagaRosterOpen] = useState(false)
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
  const [latestDebrief, setLatestDebrief] = useState(null)
  const [todayScreenTime, setTodayScreenTime] = useState(null)
  const [addictionData, setAddictionData] = useState(null)
  const [expandedWidget, setExpandedWidget] = useState(null) // 'addiction'

  // ── EOD Recon Checklist Widget States ──
  const [eodWorkData, setEodWorkData] = useState({ logged: false, hours: 0 })
  const [eodSpeakingData, setEodSpeakingData] = useState({ logged: false, detail: '' })
  const [eodQuickLogModal, setEodQuickLogModal] = useState(null) // 'work' | 'journal' | 'screen' | 'speaking'
  const [eodJournalLogged, setEodJournalLogged] = useState(false)

  // Quick form states
  const [eodScreenForm, setEodScreenForm] = useState({ total_hours: '4', doomscroll_minutes: '30', streaming_hours: '0.5' })
  const [eodJournalForm, setEodJournalForm] = useState({ mood: 'good', content: '' })
  const [eodWorkForm, setEodWorkForm] = useState({ hours: '2', work_type: 'deep_work', notes: '' })
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
        if (parsed.eodSpeakingData) setEodSpeakingData(parsed.eodSpeakingData)
        if (parsed.todayScreenTime) setTodayScreenTime(parsed.todayScreenTime)
        if (parsed.latestDebrief) setLatestDebrief(parsed.latestDebrief)
        if (parsed.eodJournalLogged !== undefined) setEodJournalLogged(parsed.eodJournalLogged)
      }
      const rawHist = localStorage.getItem(`lokios_debrief_history_${user.id}`)
      if (rawHist) {
        const parsedHist = JSON.parse(rawHist)
        if (Array.isArray(parsedHist) && parsedHist.length > 0) {
          parsedHist.sort((a, b) => {
            const timeA = getDebriefSortTime(a)
            const timeB = getDebriefSortTime(b)
            if (timeA !== timeB) return timeB - timeA
            return (b.created_at || '').localeCompare(a.created_at || '')
          })
          setLatestDebrief(parsedHist[0])
        }
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
        .limit(20)

      let localDebriefs = []
      if (typeof window !== 'undefined') {
        try {
          const rawHist = localStorage.getItem(`lokios_debrief_history_${user.id}`)
          if (rawHist) {
            const parsed = JSON.parse(rawHist)
            if (Array.isArray(parsed)) localDebriefs = parsed
          }
        } catch (e) {}
      }

      const combinedDebriefs = new Map()
      localDebriefs.forEach(d => combinedDebriefs.set(d.title || d.id, d))
      ;(debriefLogs || []).forEach(d => combinedDebriefs.set(d.title || d.id, d))

      const allDebriefList = Array.from(combinedDebriefs.values())
      if (allDebriefList.length > 0) {
        allDebriefList.sort((a, b) => {
          const timeA = getDebriefSortTime(a)
          const timeB = getDebriefSortTime(b)
          if (timeA !== timeB) return timeB - timeA
          return (b.created_at || '').localeCompare(a.created_at || '')
        })
        setLatestDebrief(allDebriefList[0])
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

      // ── Digital Addiction Widget ──
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
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

      // Check work_hours_logs first (primary work logging table)
      const { data: workHoursLogRows } = await sb
        .from('work_hours_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .limit(1)

      let workLogged = false
      let workHours = 0
      if (workHoursLogRows && workHoursLogRows.length > 0) {
        workLogged = true
        workHours = workHoursLogRows[0].hours || workHoursLogRows[0].duration_hours || 0
      } else {
        // Fallback: check work_logs but EXCLUDE speaking_practice entries
        const { data: directWorkLogs } = await sb
          .from('work_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', todayStr)
          .neq('type', 'speaking_practice')
          .limit(1)
        if (directWorkLogs && directWorkLogs.length > 0) {
          workLogged = true
          workHours = directWorkLogs[0].total_hours_worked || directWorkLogs[0].duration_hours || 0
        }
      }
      setEodWorkData({ logged: workLogged, hours: workHours })

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
        const localData = typeof window !== 'undefined' ? localStorage.getItem(`lokios_speaking_logs_${user.id}`) : null
        if (localData) {
          try {
            const parsed = JSON.parse(localData)
            const found = parsed.find(p => p.date === todayStr)
            if (found) setEodSpeakingData({ logged: true, detail: `Topic: ${found.topic}` })
            else setEodSpeakingData({ logged: false, detail: '' })
          } catch (e) {
            setEodSpeakingData({ logged: false, detail: '' })
          }
        } else {
          setEodSpeakingData({ logged: false, detail: '' })
        }
      }

      try {
        const cacheKey = `lokios_dashboard_recon_${user.id}_${todayStr}`
        localStorage.setItem(cacheKey, JSON.stringify({
          eodWorkData: { logged: workLogged, hours: workHours },
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
  const screenIntelLoggedToday = !!todayScreenTime && todayScreenTime.date === todayStr

  const eodItems = [
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
  const isEodAllDone = eodCompletedCount === eodItems.length
  const longestStreak = profile?.longest_streak ?? 0

  const currentLevel                                           = calculateLevel(totalXp)
  const { current: xpInLevel, required: xpForNextLevel, percentage: levelPct } = xpToNextLevel(totalXp)
  const xpNeeded     = Math.max(0, xpForNextLevel - xpInLevel)
  const currentRank  = getRankForXp(totalXp)
  const currentRankConfig = RANK_CONFIG[currentRank.code] || RANK_CONFIG['I']
  const arcColor     = currentRankConfig?.color || '#9CA3AF'
  const sagaAccentColor = currentRankConfig?.color || '#f97316'
  const momentumStateColor = dailyMomentum?.color || 'var(--warning)'
  const currentArc   = ARC_CONFIG.find(a => a.rank === currentRank.code) || ARC_CONFIG[0]
  const currentArcIndex = ARC_CONFIG.findIndex(a => a.rank === currentRank.code)
  const nextArc      = ARC_CONFIG[currentArcIndex + 1] || null

  const minSagaXp = currentRankConfig.minXp || 0
  const maxSagaXp = currentRankConfig.maxXp || 4999
  const currentXpInSaga = Math.max(0, totalXp - minSagaXp)
  const totalXpInSaga = Math.max(1, maxSagaXp - minSagaXp + 1)
  const sagaProgressPct = Math.min(100, Math.max(0, Math.round((currentXpInSaga / totalXpInSaga) * 100)))

  const currentSagaImage = SAGA_IMAGES[currentRank.code] || SAGA_IMAGES['I'] || '/sagas/awakening.png'

  const splitTitle = useMemo(() => {
    const rawName = currentArc?.name || 'The Spark'
    if (rawName === 'The Discipline Rebuild') return { primary: 'THE DISCIPLINE', secondary: 'REBUILD' }
    const parts = rawName.split(' ')
    if (parts.length === 1) return { primary: 'SAGA', secondary: parts[0].toUpperCase() }
    return { primary: parts.slice(0, -1).join(' ').toUpperCase(), secondary: parts[parts.length - 1].toUpperCase() }
  }, [currentArc?.name])

  const SAGA_DISCIPLINE_QUOTES = useMemo(() => [
    currentArc?.flavor || "I rebuilt my mind, habits, and identity one day at a time.",
    "Discipline is choosing between what you want now and what you want most.",
    "Small actions compounded daily become unstoppable momentum.",
    "Stop chasing motivation. Build ironclad routines and relentless consistency.",
    "You do not rise to the level of your goals. You fall to the level of your systems.",
    "The pain of discipline is far less than the pain of regret.",
    "Master self-command before seeking command over anything else.",
    "Every day you don't execute is a day you concede ground."
  ], [currentArc?.flavor])

  const [quoteIndex, setQuoteIndex] = useState(0)

  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % SAGA_DISCIPLINE_QUOTES.length)
    }, 10000)
    return () => clearInterval(quoteInterval)
  }, [SAGA_DISCIPLINE_QUOTES.length])

  const handleNextQuote = () => {
    setQuoteIndex(prev => (prev + 1) % SAGA_DISCIPLINE_QUOTES.length)
  }

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
  // Check if Weekly Debrief has been completed for the current week or within the last 7 days
  const isDebriefDoneThisWeek = useMemo(() => {
    if (!latestDebrief) return false
    const now = new Date()
    const debriefDateStr = latestDebrief.date || (latestDebrief.created_at ? getLocalDateStr(new Date(latestDebrief.created_at)) : '')
    if (!debriefDateStr) return false

    const dayOfWeek = now.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const sunday = new Date(now)
    sunday.setDate(now.getDate() - dayOfWeek)
    sunday.setHours(0, 0, 0, 0)
    const currentCycleStartStr = getLocalDateStr(sunday)

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    const sevenDaysAgoStr = getLocalDateStr(sevenDaysAgo)

    return debriefDateStr >= currentCycleStartStr || debriefDateStr >= sevenDaysAgoStr
  }, [latestDebrief])

  // Parse Next Week Priorities from the latest debrief
  const nextWeekPriorities = useMemo(() => {
    if (!latestDebrief?.description) return null
    const text = latestDebrief.description
    const marker = '### Priorities for Next Week'
    const idx = text.indexOf(marker)
    if (idx !== -1) {
      let section = text.substring(idx + marker.length).trim()
      const nextHeaderIdx = section.indexOf('### ')
      if (nextHeaderIdx !== -1) section = section.substring(0, nextHeaderIdx).trim()
      if (section) return section
    }

    // Fallback markers for alternative formats
    const lower = text.toLowerCase()
    const fallbackMarkers = [
      'priorities for next week',
      'next week priorities',
      'weekly priorities',
      'priorities'
    ]
    for (const m of fallbackMarkers) {
      const fIdx = lower.indexOf(m)
      if (fIdx !== -1) {
        let section = text.substring(fIdx + m.length).replace(/^[:#\s\n]+/, '').trim()
        const nextH = section.indexOf('### ')
        if (nextH !== -1) section = section.substring(0, nextH).trim()
        if (section) return section
      }
    }
    return null
  }, [latestDebrief])

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
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const fourteenDaysAgoStr = getLocalDateStr(fourteenDaysAgo)

      sourceList = tasks.filter(t => 
        t.category === 'weekly_goal' && 
        t.status !== 'cancelled' &&
        (!t.due_date || t.due_date >= fourteenDaysAgoStr || !t.created_at || t.created_at >= fourteenDaysAgoStr)
      ).slice(0, 3)
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
            COMMAND CENTER SAGA HERO CARD (TEXT AT LEFT, 1:1 IMAGE AT RIGHT)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mb-6 rounded-3xl border border-white/10 bg-[#0c0f18] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden transition-all">
          
          <div className="flex flex-col-reverse lg:flex-row items-center justify-between gap-6 p-4 sm:p-6 lg:p-8">
            
            {/* ── LEFT SIDE (DESKTOP): INTELLIGENCE & PROGRESSION (TEXT AT LEFT) ── */}
            <div className="flex-1 w-full min-w-0 flex flex-col justify-between space-y-4 sm:space-y-5">
              
              {/* Header: SAGA Title */}
              <div>
                <span className="font-mono text-xs uppercase tracking-[0.25em] font-bold text-indigo-400 block mb-1">
                  SAGA {currentRank.code}
                </span>
                <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-[0.15em] uppercase leading-tight">
                  {splitTitle.primary}
                </h1>
                <h2 
                  className="font-display font-black text-xl sm:text-3xl tracking-[0.2em] uppercase leading-none mt-1"
                  style={{ color: sagaAccentColor }}
                >
                  {splitTitle.secondary}
                </h2>
              </div>

              {/* Dynamic Rotating Motivational Quote Inset Pod */}
              <div 
                onClick={handleNextQuote}
                title="Click to cycle next mindset quote"
                className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 flex items-center gap-4 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105"
                  style={{ 
                    backgroundColor: `${sagaAccentColor}15`, 
                    borderColor: `${sagaAccentColor}40`, 
                    color: sagaAccentColor,
                    boxShadow: `0 0 16px ${sagaAccentColor}25`
                  }}
                >
                  <Sparkles size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                    "{SAGA_DISCIPLINE_QUOTES[quoteIndex % SAGA_DISCIPLINE_QUOTES.length]}"
                  </p>
                </div>
              </div>

              {/* Progress to Next Saga Pod */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between font-mono text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                  <span>PROGRESS TO NEXT SAGA</span>
                  <span>{sagaProgressPct}%</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Huge Percentage & Bar */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span 
                        className="font-display font-black text-3xl sm:text-4xl leading-none"
                        style={{ color: sagaAccentColor }}
                      >
                        {sagaProgressPct}%
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-400">
                        {currentXpInSaga.toLocaleString()} / {totalXpInSaga.toLocaleString()} XP
                      </span>
                    </div>

                    {/* Glowing Progress Track */}
                    <div className="w-full h-3 rounded-full bg-slate-950 border border-white/10 p-[1.5px] relative overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full transition-all duration-500 shadow-lg"
                        style={{ 
                          width: `${Math.max(4, Math.min(100, sagaProgressPct))}%`,
                          backgroundColor: sagaAccentColor,
                          boxShadow: `0 0 12px ${sagaAccentColor}`
                        }}
                      />
                    </div>
                  </div>

                  {/* Right: Next Saga Inset Capsule */}
                  {nextArc && (
                    <div className="p-3 rounded-xl border border-white/10 bg-black/50 flex items-center gap-3 shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                        <Target size={16} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-purple-400 font-bold block">
                          NEXT SAGA
                        </span>
                        <span className="font-display font-bold text-xs text-white uppercase truncate block">
                          SAGA {nextArc.rank} • {nextArc.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Footer Subtitle & Roster Toggle */}
              <div className="flex items-center justify-between pt-1 text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                <span className="truncate">KEEP BUILDING. YOUR NEXT BREAKTHROUGH IS CLOSER THAN YOU THINK.</span>
                <button
                  type="button"
                  onClick={() => setSagaRosterOpen(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all shrink-0 ml-3"
                >
                  <span>{sagaRosterOpen ? 'HIDE ROSTER' : 'VIEW ALL SAGAS'}</span>
                  {sagaRosterOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

            </div>

            {/* ── RIGHT SIDE (DESKTOP): 1:1 SQUARE ARTWORK (IMAGE AT RIGHT) ── */}
            <div className="w-full sm:w-[320px] md:w-[360px] lg:w-[380px] shrink-0 flex justify-center">
              <div 
                className="rounded-3xl overflow-hidden relative border border-white/15 bg-slate-950 shadow-[0_0_35px_rgba(0,0,0,0.8)] group"
                style={{ width: '100%', maxWidth: '380px', aspectRatio: '1 / 1' }}
              >
                {/* Background 1:1 Artwork Image */}
                <img 
                  src={currentSagaImage} 
                  alt={currentArc.name} 
                  className="w-full h-full object-cover aspect-square transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => { e.currentTarget.src = '/sagas/Awakening.png' }}
                />

                {/* Cyber subtle border ring */}
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none" />
              </div>
            </div>

          </div>

          {/* ── EXPANDABLE 8-SAGA LOCKED/UNLOCKED ROSTER ── */}
          <AnimatePresence>
            {sagaRosterOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-white/10 p-4 sm:p-6 bg-black/60"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                      SAGA PROGRESSION ROSTER
                    </h3>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 uppercase font-bold">
                    CURRENT LEVEL: LV.{currentLevel}
                  </span>
                </div>

                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                    gap: '12px', 
                    width: '100%' 
                  }}
                >
                  {ARC_CONFIG.map((saga) => {
                    const isCurrent = saga.rank === currentRank.code
                    const isUnlocked = currentLevel >= saga.minLvl
                    const isCompleted = currentLevel > saga.maxLvl
                    const sagaImg = SAGA_IMAGES[saga.rank] || '/sagas/the-spark.png'

                    return (
                      <div 
                        key={saga.rank}
                        className={`rounded-2xl border p-2.5 flex flex-col items-center text-center transition-all ${
                          isCurrent
                            ? 'bg-indigo-950/40 border-indigo-400/80 shadow-[0_0_18px_rgba(129,140,248,0.35)] ring-1 ring-indigo-400/40'
                            : isUnlocked
                            ? 'bg-black/40 border-white/10 hover:border-white/20'
                            : 'bg-black/60 border-white/5 opacity-50'
                        }`}
                      >
                        {/* 1:1 Square Thumbnail */}
                        <div className="w-full aspect-square rounded-xl overflow-hidden relative mb-2 bg-slate-950 border border-white/10">
                          <img 
                            src={sagaImg} 
                            alt={saga.name} 
                            className={`w-full h-full object-cover aspect-square transition-all ${
                              !isUnlocked ? 'grayscale contrast-125 brightness-50' : ''
                            }`}
                            onError={(e) => { e.currentTarget.src = '/sagas/the-spark.png' }}
                          />

                          {/* Lock / Active Badges */}
                          {isCurrent ? (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-indigo-500 text-black font-mono text-[8px] font-black uppercase shadow-md">
                              ACTIVE
                            </div>
                          ) : !isUnlocked ? (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-slate-300">
                              <Lock size={16} className="text-slate-400 mb-0.5" />
                              <span className="font-mono text-[8px] font-bold text-slate-300">LV.{saga.minLvl}+</span>
                            </div>
                          ) : isCompleted ? (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-emerald-500/90 text-black font-mono text-[8px] font-black uppercase shadow-md">
                              ✓ DONE
                            </div>
                          ) : null}
                        </div>

                        {/* Title & Level Range */}
                        <div className="w-full min-w-0">
                          <div className="font-mono text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                            SAGA {saga.rank}
                          </div>
                          <div className="font-display font-bold text-[11px] text-white uppercase tracking-tight truncate">
                            {saga.name}
                          </div>
                          <div className="font-mono text-[9px] text-slate-400 mt-0.5">
                            LV.{saga.minLvl} - {saga.maxLvl === 999 ? '∞' : saga.maxLvl}
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
            DAILY PROTOCOL STATUS // ICON-ONLY SQUARES (GREY WHEN NOT COMPLETED)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative mb-5 rounded-2xl border border-white/10 bg-[#090d1a]/95 backdrop-blur-2xl p-2.5 sm:p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', 
              gap: '8px', 
              width: '100%' 
            }}
          >
            {eodItems.map((item) => {
              const ItemIcon = item.icon
              const displayLabel = item.key === 'work' ? 'Work' : item.key === 'journal' ? 'Journal' : item.key === 'screen' ? 'Screen Intel' : item.key === 'speaking' ? 'Speaking' : item.label
              return (
                <Link 
                  key={item.key} 
                  href={item.path}
                  title={`${displayLabel}: ${item.isDone ? '✓ Logged' : 'Open'}`}
                  className="block group"
                >
                  <div 
                    className={`aspect-square text-center transition-all duration-200 flex flex-col justify-center items-center rounded-xl border relative group-hover:scale-[1.03] ${
                      item.isDone 
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.18)]' 
                        : 'bg-white/[0.02] border-white/5 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Status Pip Dot */}
                    <div 
                      className={`absolute top-1.5 right-1.5 rounded-full ${
                        item.isDone 
                          ? 'w-2 h-2 bg-emerald-400 shadow-[0_0_6px_#34d399]' 
                          : 'w-1.5 h-1.5 bg-zinc-700'
                      }`}
                    />

                    {/* Logo / Icon Only (Grey when not completed, Emerald when completed) */}
                    <ItemIcon 
                      size={22} 
                      style={{ color: item.isDone ? '#34d399' : '#71717a' }}
                      className="transition-transform group-hover:scale-110" 
                    />
                  </div>
                </Link>
              )
            })}

            {/* DEBRIEF BOX (EXTREME RIGHT - ICON ONLY) */}
            <Link 
              href="/journal?tab=weekly" 
              title={`Debrief: ${isDebriefDoneThisWeek ? '✓ Done' : new Date().getDay() === 0 ? 'Due Today' : 'Due Sunday'}`}
              className="block group"
            >
              <div 
                className={`aspect-square text-center transition-all duration-200 flex flex-col justify-center items-center rounded-xl border relative group-hover:scale-[1.03] ${
                  isDebriefDoneThisWeek
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.18)]'
                    : new Date().getDay() === 0 
                    ? 'bg-amber-950/25 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.12)]' 
                    : 'bg-white/[0.02] border-white/5 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 hover:bg-white/[0.05]'
                }`}
              >
                {/* Status Pip Dot */}
                <div 
                  className={`absolute top-1.5 right-1.5 rounded-full ${
                    isDebriefDoneThisWeek 
                      ? 'w-2 h-2 bg-emerald-400 shadow-[0_0_6px_#34d399]' 
                      : new Date().getDay() === 0 
                      ? 'w-2 h-2 bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse'
                      : 'w-1.5 h-1.5 bg-zinc-700'
                  }`}
                />

                {/* Logo / Icon Only */}
                {isDebriefDoneThisWeek ? (
                  <CheckCircle2 size={22} style={{ color: '#34d399' }} className="transition-transform group-hover:scale-110" />
                ) : (
                  <ClipboardList 
                    size={22} 
                    style={{ color: new Date().getDay() === 0 ? '#f59e0b' : '#71717a' }} 
                    className="transition-transform group-hover:scale-110" 
                  />
                )}
              </div>
            </Link>
          </div>
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
                  <div className="font-mono text-[8px] text-muted uppercase">-10 to +10</div>
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
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.4rem', color: (dailyMomentum?.todayNet ?? xpToday) > 0 ? 'var(--success)' : (dailyMomentum?.todayNet ?? xpToday) < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {dailyMomentum?.todayNet >= 0 ? '+' : ''}{dailyMomentum?.todayNet ?? xpToday}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">TODAY</div>
                </div>
                <div>
                  <div className="font-display font-bold tracking-tighter leading-none" style={{ fontSize: '1.4rem', color: (dailyMomentum?.threeDayNet ?? xpThisWeek) > 0 ? 'var(--success)' : (dailyMomentum?.threeDayNet ?? xpThisWeek) < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {dailyMomentum?.threeDayNet >= 0 ? '+' : ''}{dailyMomentum?.threeDayNet ?? xpThisWeek}
                  </div>
                  <div className="font-mono text-[8px] text-muted uppercase mt-1">3-DAY NET</div>
                </div>
              </div>
            </div>

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
