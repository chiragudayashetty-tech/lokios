'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, AlertTriangle, Zap, Swords, Flame, ChevronDown,
  ChevronUp, Lock, Check, ClipboardList, BookOpen,
  Activity, Clock, Terminal, ArrowUpRight, BarChart2,
  Smartphone, Shield, DollarSign, Moon, Brain, Repeat, X, RotateCcw,
  Calendar as CalendarIcon, MapPin, Plus, ExternalLink, Briefcase, Sun, FileText, CheckCircle2, Mic, Sparkles,
  ChevronLeft, ChevronRight, Play, Pause, Circle
} from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useOS } from '@/lib/context/OSContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { syncScreenTimeXP } from '@/lib/utils/screenTimeXP'
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

  const os = useOS() || {}
  const profileHook = os.profile || {}
  const profile = profileHook.profile || null
  const goalsObj = os.goals || {}
  const mainQuest = goalsObj.mainQuest || null
  const sideQuests = goalsObj.sideQuests || []
  const longTermGoals = goalsObj.longTermGoals || []
  const habitsObj = os.habits || {}
  const todayLogs = habitsObj.todayLogs || []
  const habits = habitsObj.habits || []
  const tasksObj = os.tasks || {}
  const tasks = tasksObj.tasks || []
  const addTask = tasksObj.addTask
  const completeTask = tasksObj.completeTask
  const undoCompleteTask = tasksObj.undoCompleteTask
  const fetchTasks = tasksObj.fetchTasks
  const journalObj = os.journal || {}
  const entries = journalObj.entries || []
  const calendarObj = os.calendar || {}
  const events = calendarObj.events || []
  const xpObj = os.xp || {}
  const dailyMomentum = xpObj.dailyMomentum || null
  const completeOperation = os.completeOperation
  const failOperation = os.failOperation
  const undoFailOperation = os.undoFailOperation

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
  const [activeArtworkIndex, setActiveArtworkIndex] = useState(null)
  const [isAutoCycling, setIsAutoCycling] = useState(true)

  // Load persistent priority statuses from localStorage immediately on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return
    try {
      const saved = localStorage.getItem(`lokios_priority_status_${user.id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          setPriorityStatusMap(parsed)
        }
      }
    } catch (e) {}
  }, [user])

  const updatePriorityStatus = (entries) => {
    setPriorityStatusMap(prev => {
      const next = { ...prev, ...entries }
      if (typeof window !== 'undefined' && user) {
        try {
          localStorage.setItem(`lokios_priority_status_${user.id}`, JSON.stringify(next))
        } catch (e) {}
      }
      return next
    })
  }

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
  const latestDebriefRef = useRef(null)
  useEffect(() => {
    latestDebriefRef.current = latestDebrief
  }, [latestDebrief])
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
            return (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')
          })
          setLatestDebrief(parsedHist[0])
        }
      }
    } catch (e) {
      console.warn('Recon cache read error:', e)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
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
        .gte('created_at', `${thirtyDaysAgoStr}T00:00:00.000Z`)
        .order('created_at', { ascending: false })
        .limit(5000)

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

      // 1c. Fetch Latest Weekly Debrief (Work Log) from Supabase
      const { data: debriefLogs } = await sb
        .from('work_logs')
        .select('*')
        .eq('user_id', user.id)
        .ilike('title', 'Weekly Debrief%')
        .order('created_at', { ascending: false })
        .limit(30)

      if (debriefLogs && debriefLogs.length > 0) {
        // Group by title / cycle to deduplicate any duplicate entries across devices
        const debriefMap = new Map()
        debriefLogs.forEach(d => {
          const key = d.title ? d.title.trim().toLowerCase() : (d.date || d.id)
          const existing = debriefMap.get(key)
          if (!existing) {
            debriefMap.set(key, d)
          } else {
            const timeExisting = new Date(existing.updated_at || existing.created_at || 0).getTime()
            const timeNew = new Date(d.updated_at || d.created_at || 0).getTime()
            if (timeNew > timeExisting) {
              debriefMap.set(key, d)
            }
          }
        })

        const sortedDebriefs = Array.from(debriefMap.values()).sort((a, b) => {
          const timeA = getDebriefSortTime(a)
          const timeB = getDebriefSortTime(b)
          if (timeA !== timeB) return timeB - timeA
          return (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')
        })

        if (sortedDebriefs.length > 0) {
          setLatestDebrief(sortedDebriefs[0])
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`lokios_debrief_history_${user.id}`, JSON.stringify(sortedDebriefs))
              const cacheKey = `lokios_dashboard_recon_${user.id}_${todayStr}`
              const existingCache = localStorage.getItem(cacheKey)
              const parsed = existingCache ? JSON.parse(existingCache) : {}
              parsed.latestDebrief = sortedDebriefs[0]
              localStorage.setItem(cacheKey, JSON.stringify(parsed))
            } catch (errCache) {}
          }
        }
      } else if (typeof window !== 'undefined') {
        try {
          const rawHist = localStorage.getItem(`lokios_debrief_history_${user.id}`)
          if (rawHist) {
            const parsed = JSON.parse(rawHist)
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsed.sort((a, b) => {
                const timeA = getDebriefSortTime(a)
                const timeB = getDebriefSortTime(b)
                if (timeA !== timeB) return timeB - timeA
                return (b.created_at || '').localeCompare(a.created_at || '')
              })
              setLatestDebrief(parsed[0])
            }
          }
        } catch (err) {}
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
        .order('date', { ascending: false })
        .limit(5000)

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
        workHours = Number(workHoursLogRows[0].total_hours_worked) || Number(workHoursLogRows[0].hours) || Number(workHoursLogRows[0].duration_hours) || 0
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
          workHours = Number(directWorkLogs[0].total_hours_worked) || Number(directWorkLogs[0].duration_hours) || Number(directWorkLogs[0].hours) || 0
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

    const sb = createClient()
    const channel = sb
      .channel(`dashboard_realtime_sync_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs', filter: `user_id=eq.${user.id}` }, () => {
        fetchMetrics()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_hours_logs', filter: `user_id=eq.${user.id}` }, () => {
        fetchMetrics()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, () => {
        fetchMetrics()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_time_logs', filter: `user_id=eq.${user.id}` }, () => {
        fetchMetrics()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xp_history', filter: `user_id=eq.${user.id}` }, () => {
        fetchMetrics()
      })
      .subscribe()

    const handleResume = () => {
      if (document.visibilityState === 'visible') fetchMetrics()
    }
    window.addEventListener('focus', handleResume)
    document.addEventListener('visibilitychange', handleResume)

    return () => {
      if (channel && sb?.removeChannel) {
        sb.removeChannel(channel)
      }
      window.removeEventListener('focus', handleResume)
      document.removeEventListener('visibilitychange', handleResume)
    }
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

    // Background DB sync with upsert and dynamic XP calculation
    const sb = createClient()
    const { data } = await sb.from('screen_time_logs')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single()
    const saved = data || payload
    setTodayScreenTime(saved)
    await syncScreenTimeXP(user.id, saved)
    await profileHook?.fetchProfile?.()
    fetchMetrics()
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
    const cleanNotes = (eodWorkForm.notes || '').trim()

    // Optimistic UI updates (0ms delay)
    setEodWorkData({ logged: true, hours: hrs })
    setEodQuickLogModal(null)

    if (typeof window !== 'undefined') {
      const cacheKey = `lokios_dashboard_recon_${user.id}_${todayStr}`
      try {
        const cached = localStorage.getItem(cacheKey)
        const parsed = cached ? JSON.parse(cached) : {}
        parsed.eodWorkData = { logged: true, hours: hrs }
        localStorage.setItem(cacheKey, JSON.stringify(parsed))
      } catch (errCache) {}
    }

    // Background DB sync
    try {
      const sb = createClient()
      const cleanWorkHoursData = {
        user_id: user.id,
        date: todayStr,
        total_hours_worked: hrs,
        focused_hours: hrs,
        beyond_tatva_hours: 0,
        unfocused_hours: 0,
        deep_execution_hours: 0,
        notes: cleanNotes,
        updated_at: new Date().toISOString()
      }

      await sb.from('work_hours_logs').upsert(cleanWorkHoursData, { onConflict: 'user_id,date' })

      const cleanWorkLogData = {
        user_id: user.id,
        date: todayStr,
        title: eodWorkForm.work_type ? `Work Session (${eodWorkForm.work_type})` : 'Work Session',
        type: 'project_work',
        description: cleanNotes,
        duration_hours: hrs,
        total_hours_worked: hrs,
        focused_hours: hrs,
        notes: cleanNotes,
        updated_at: new Date().toISOString()
      }

      const { data: existingWorkLog } = await sb
        .from('work_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .limit(1)

      if (existingWorkLog && existingWorkLog.length > 0) {
        await sb.from('work_logs').update(cleanWorkLogData).eq('id', existingWorkLog[0].id)
      } else {
        await sb.from('work_logs').insert(cleanWorkLogData)
      }
    } catch (err) {
      console.error('submitEodWork error:', err)
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

  const currentSagaImage = SAGA_IMAGES[currentRank.code] || SAGA_IMAGES['I'] || '/sagas/Awakening.png'

  // Active artwork & saga display (auto-cycling or user selected)
  const displayedSagaIndex = activeArtworkIndex !== null ? activeArtworkIndex : (currentArcIndex >= 0 ? currentArcIndex : 0)
  const displayedArc = ARC_CONFIG[displayedSagaIndex] || currentArc
  const displayedRankConfig = RANK_CONFIG[displayedArc.rank] || RANK_CONFIG['I']
  const displayedSagaImage = SAGA_IMAGES[displayedArc.rank] || SAGA_IMAGES['I'] || '/sagas/Awakening.png'
  const displayedSagaColor = displayedRankConfig?.color || sagaAccentColor

  // Auto-cycle artwork every 10 seconds if enabled
  useEffect(() => {
    if (!isAutoCycling) return
    const interval = setInterval(() => {
      setActiveArtworkIndex(prev => {
        const base = prev === null ? (currentArcIndex >= 0 ? currentArcIndex : 0) : prev
        return (base + 1) % ARC_CONFIG.length
      })
    }, 10000)
    return () => clearInterval(interval)
  }, [isAutoCycling, currentArcIndex])

  // Time of day atmosphere engine
  const timeAtmosphere = useMemo(() => {
    const h = currentTime.getHours()
    if (h >= 5 && h < 11) {
      return {
        label: 'Dawn Protocol',
        timeDesc: 'Morning clarity & disciplined momentum',
        accent: '#f59e0b',
        glow: 'rgba(245, 158, 11, 0.22)',
        icon: Sun
      }
    } else if (h >= 11 && h < 17) {
      return {
        label: 'Peak Focus',
        timeDesc: 'Deep work execution & relentless progress',
        accent: '#22d3ee',
        glow: 'rgba(34, 211, 238, 0.22)',
        icon: Zap
      }
    } else if (h >= 17 && h < 21) {
      return {
        label: 'Twilight Consolidation',
        timeDesc: 'Close active loops & review debriefs',
        accent: '#a855f7',
        glow: 'rgba(168, 85, 247, 0.22)',
        icon: Sparkles
      }
    } else {
      return {
        label: 'Night Protocol',
        timeDesc: 'Reflect, recharge & prepare tomorrow',
        accent: '#818cf8',
        glow: 'rgba(129, 140, 248, 0.22)',
        icon: Moon
      }
    }
  }, [currentTime])

  const splitTitle = useMemo(() => {
    const rawName = displayedArc?.name || 'The Spark'
    if (rawName === 'The Discipline Rebuild') return { primary: 'THE DISCIPLINE', secondary: 'REBUILD' }
    const parts = rawName.split(' ')
    if (parts.length === 1) return { primary: 'SAGA', secondary: parts[0].toUpperCase() }
    return { primary: parts.slice(0, -1).join(' ').toUpperCase(), secondary: parts[parts.length - 1].toUpperCase() }
  }, [displayedArc?.name])

  const SAGA_DISCIPLINE_QUOTES = useMemo(() => [
    displayedArc?.flavor || "I rebuilt my mind, habits, and identity one day at a time.",
    "Discipline is choosing between what you want now and what you want most.",
    "Small actions compounded daily become unstoppable momentum.",
    "Stop chasing motivation. Build ironclad routines and relentless consistency.",
    "You do not rise to the level of your goals. You fall to the level of your systems.",
    "The pain of discipline is far less than the pain of regret.",
    "Master self-command before seeking command over anything else.",
    "Every day you don't execute is a day you concede ground."
  ], [displayedArc?.flavor])

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

  // 5. Digital Discipline / Screen Intel Component (-2.0 to +2.0)
  let screenComponent = 0
  if (todayScreenTime) {
    const stHours = parseFloat(todayScreenTime.total_hours) || 0
    const stDoom = parseInt(todayScreenTime.doom_scroll_minutes) || 0
    if (stHours <= 4 && stDoom <= 30) {
      screenComponent = 2.0
    } else if (stHours <= 6 && stDoom <= 60) {
      screenComponent = 1.5
    } else if (stHours > 8 || stDoom > 120) {
      screenComponent = -2.0
    } else if (stHours > 6.5 || stDoom > 80) {
      screenComponent = -1.5
    }
  }

  const rawMomentum          = habitComponent + opsComponent + missionsComponent + streakComponent + winRateComponent + screenComponent
  const momentumScore        = Math.max(-10, Math.min(10, parseFloat(rawMomentum.toFixed(1))))
  const momentumColor        = dailyMomentum?.color || (momentumScore >= 5 ? 'var(--success)' : momentumScore >= 0 ? 'var(--warning)' : 'var(--danger)')
  const momentumText         = momentumScore >= 5 ? 'SURGING' : momentumScore >= 0 ? 'STEADY' : 'DECLINING'
  // Check if Weekly Debrief has been completed for the current week or within the last 7 days
  const isDebriefDoneThisWeek = useMemo(() => {
    if (!latestDebrief) return false
    const now = new Date()
    const sortTime = getDebriefSortTime(latestDebrief)
    const titleDateStr = sortTime ? getLocalDateStr(new Date(sortTime)) : ''
    const debriefDateStr = latestDebrief.date || (latestDebrief.created_at ? getLocalDateStr(new Date(latestDebrief.created_at)) : '')
    const effectiveDateStr = titleDateStr || debriefDateStr
    if (!effectiveDateStr) return false

    const dayOfWeek = now.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const sunday = new Date(now)
    sunday.setDate(now.getDate() - dayOfWeek)
    sunday.setHours(0, 0, 0, 0)
    const currentCycleStartStr = getLocalDateStr(sunday)

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    const sevenDaysAgoStr = getLocalDateStr(sevenDaysAgo)

    return effectiveDateStr >= currentCycleStartStr || effectiveDateStr >= sevenDaysAgoStr
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
      const stableSourceId = `debrief_p_${itemTitle.trim().toLowerCase().replace(/\s+/g, '_')}`
      const localOverride = priorityStatusMap[keyId] || priorityStatusMap[itemTitle] || priorityStatusMap[stableSourceId]
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
            OPAL DYNAMIC ATMOSPHERIC HERO CANVAS (CHANGING IMAGERY & MOOD)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mb-6 rounded-3xl border border-white/10 bg-[#0a0d18]/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden transition-all relative">
          
          {/* Subtle Ambient Radial Aura behind Hero */}
          <div 
            className="absolute top-0 right-0 w-[450px] h-[450px] rounded-full pointer-events-none transition-all duration-1000"
            style={{
              background: `radial-gradient(circle, ${displayedSagaColor}25, transparent 70%)`,
              transform: 'translate(20%, -20%)',
              filter: 'blur(60px)'
            }}
          />

          <div className="relative z-10 flex flex-col-reverse lg:flex-row items-center justify-between gap-6 p-4 sm:p-6 lg:p-8">
            
            {/* ── LEFT SIDE (DESKTOP): INTELLIGENCE & PROGRESSION ── */}
            <div className="flex-1 w-full min-w-0 flex flex-col justify-between space-y-4 sm:space-y-5">
              
              {/* Top Time-of-Day Atmosphere Pill */}
              <div className="flex flex-wrap items-center gap-2">
                <div 
                  className="px-3 py-1 rounded-full border text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                  style={{
                    backgroundColor: `${timeAtmosphere.accent}15`,
                    borderColor: `${timeAtmosphere.accent}35`,
                    color: timeAtmosphere.accent,
                    boxShadow: `0 0 14px ${timeAtmosphere.glow}`
                  }}
                >
                  <timeAtmosphere.icon size={13} />
                  <span>{timeAtmosphere.label}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">
                  {timeAtmosphere.timeDesc}
                </span>

                {/* Auto-cycle toggle pill */}
                <button
                  type="button"
                  onClick={() => setIsAutoCycling(prev => !prev)}
                  title={isAutoCycling ? "Auto-cycling imagery every 10s (Click to pause)" : "Auto-cycle paused (Click to resume)"}
                  className="ml-auto px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  {isAutoCycling ? <Pause size={10} className="text-cyan-400" /> : <Play size={10} className="text-slate-400" />}
                  <span>{isAutoCycling ? 'Auto' : 'Paused'}</span>
                </button>
              </div>

              {/* Header: SAGA Title & Switcher */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs uppercase tracking-[0.25em] font-bold text-indigo-400">
                    SAGA {displayedArc.rank}
                  </span>
                  {displayedSagaIndex !== currentArcIndex && (
                    <button
                      type="button"
                      onClick={() => setActiveArtworkIndex(currentArcIndex)}
                      className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-mono text-[8px] uppercase tracking-wider hover:bg-indigo-500/30 transition-all"
                    >
                      Return to LV.{currentLevel} Saga ({currentRank.code})
                    </button>
                  )}
                </div>
                <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-[0.12em] uppercase leading-tight">
                  {splitTitle.primary}
                </h1>
                <h2 
                  className="font-display font-black text-xl sm:text-3xl tracking-[0.18em] uppercase leading-none mt-1 transition-colors duration-500"
                  style={{ color: displayedSagaColor }}
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
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105"
                  style={{ 
                    backgroundColor: `${displayedSagaColor}15`, 
                    borderColor: `${displayedSagaColor}40`, 
                    color: displayedSagaColor,
                    boxShadow: `0 0 16px ${displayedSagaColor}25`
                  }}
                >
                  <Sparkles size={20} />
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
                    <div className="w-full h-2.5 rounded-full bg-slate-950 border border-white/10 p-[1px] relative overflow-hidden">
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
                      <div className="w-8 h-8 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                        <Target size={15} />
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

              {/* Bottom Quick Saga Switcher Dots & Roster Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {/* 8 Saga Quick Dot Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-1">
                  {ARC_CONFIG.map((s, idx) => {
                    const isSelected = idx === displayedSagaIndex
                    const isUserCurrent = s.rank === currentRank.code
                    return (
                      <button
                        key={s.rank}
                        type="button"
                        onClick={() => {
                          setActiveArtworkIndex(idx)
                          setIsAutoCycling(false)
                        }}
                        title={`Saga ${s.rank}: ${s.name}`}
                        className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase transition-all ${
                          isSelected
                            ? 'bg-white text-black shadow-md shadow-white/20 scale-105'
                            : isUserCurrent
                            ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-400/40'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {s.rank}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setSagaRosterOpen(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 ml-auto"
                >
                  <span>{sagaRosterOpen ? 'HIDE ROSTER' : 'VIEW ALL SAGAS'}</span>
                  {sagaRosterOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

            </div>

            {/* ── RIGHT SIDE (DESKTOP): 1:1 SQUARE ARTWORK WITH SMOOTH CROSSFADE ── */}
            <div className="w-full sm:w-[320px] md:w-[360px] lg:w-[380px] shrink-0 flex flex-col items-center">
              <div 
                onClick={() => {
                  setActiveArtworkIndex(prev => {
                    const base = prev === null ? (currentArcIndex >= 0 ? currentArcIndex : 0) : prev
                    return (base + 1) % ARC_CONFIG.length
                  })
                }}
                title="Click image to cycle next artwork"
                className="rounded-3xl overflow-hidden relative border border-white/15 bg-slate-950 shadow-[0_0_40px_rgba(0,0,0,0.85)] group cursor-pointer w-full max-w-[380px] aspect-square"
              >
                {/* Crossfading Dynamic Image */}
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={displayedSagaImage}
                    src={displayedSagaImage} 
                    alt={displayedArc.name} 
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.03 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    className="w-full h-full object-cover aspect-square transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => { e.currentTarget.src = '/sagas/Awakening.png' }}
                  />
                </AnimatePresence>

                {/* Subtle cyber border & caption overlay on hover */}
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none" />
                <div className="absolute bottom-2 inset-x-2 py-1 px-2.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-between text-[9px] font-mono text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>{displayedArc.name}</span>
                  <span className="text-indigo-300">Tap to cycle ↻</span>
                </div>
              </div>

              {/* Prev / Next Chevrons below image */}
              <div className="flex items-center justify-center gap-3 mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveArtworkIndex(prev => {
                      const base = prev === null ? (currentArcIndex >= 0 ? currentArcIndex : 0) : prev
                      return (base - 1 + ARC_CONFIG.length) % ARC_CONFIG.length
                    })
                    setIsAutoCycling(false)
                  }}
                  className="w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 transition-all active:scale-95"
                  title="Previous Saga Artwork"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  {displayedSagaIndex + 1} / {ARC_CONFIG.length}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setActiveArtworkIndex(prev => {
                      const base = prev === null ? (currentArcIndex >= 0 ? currentArcIndex : 0) : prev
                      return (base + 1) % ARC_CONFIG.length
                    })
                    setIsAutoCycling(false)
                  }}
                  className="w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 transition-all active:scale-95"
                  title="Next Saga Artwork"
                >
                  <ChevronRight size={16} />
                </button>
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
                  {ARC_CONFIG.map((saga, sIdx) => {
                    const isCurrent = saga.rank === currentRank.code
                    const isSelected = sIdx === displayedSagaIndex
                    const isUnlocked = currentLevel >= saga.minLvl
                    const isCompleted = currentLevel > saga.maxLvl
                    const sagaImg = SAGA_IMAGES[saga.rank] || '/sagas/the-spark.png'

                    return (
                      <div 
                        key={saga.rank}
                        onClick={() => {
                          setActiveArtworkIndex(sIdx)
                          setIsAutoCycling(false)
                        }}
                        className={`rounded-2xl border p-2.5 flex flex-col items-center text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-950/50 border-indigo-400 shadow-[0_0_20px_rgba(129,140,248,0.4)] ring-2 ring-indigo-400/50'
                            : isCurrent
                            ? 'bg-indigo-950/30 border-indigo-400/50'
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
            DAILY PROTOCOL STATUS FLOATING DECK (INSTANT MODAL LAUNCH)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mb-6 rounded-3xl border border-white/10 bg-[#090d1a]/85 backdrop-blur-2xl p-3.5 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-white font-bold">
                DAILY PROTOCOLS ({eodCompletedCount} / {eodItems.length + (isDebriefDoneThisWeek ? 1 : 0)} LOGGED)
              </span>
            </div>
            <span className="font-mono text-[9px] text-slate-400 uppercase font-semibold">
              TAP PILL TO QUICK LOG
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {eodItems.map((item) => {
              const ItemIcon = item.icon
              const displayLabel = item.key === 'work' ? 'Work Session' : item.key === 'journal' ? 'Daily Journal' : item.key === 'screen' ? 'Screen Intel' : item.key === 'speaking' ? 'Speaking Challenge' : item.label

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setEodQuickLogModal(item.key)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between group relative overflow-hidden active:scale-95 ${
                    item.isDone
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-slate-300 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                      <ItemIcon size={16} style={{ color: item.isDone ? '#34d399' : 'currentColor' }} />
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[8px] font-bold uppercase tracking-wider ${
                      item.isDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-slate-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isDone ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-500'}`} />
                      <span>{item.isDone ? 'DONE' : '+ LOG'}</span>
                    </div>
                  </div>

                  <div>
                    <div className="font-display font-bold text-xs uppercase tracking-wide truncate text-white">
                      {displayLabel}
                    </div>
                    <div className="font-mono text-[9px] text-slate-400 truncate mt-0.5">
                      {item.detail}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* 5th Pill: Weekly Debrief */}
            <Link
              href="/journal?tab=weekly"
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between group relative overflow-hidden active:scale-95 ${
                isDebriefDoneThisWeek
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : new Date().getDay() === 0
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-slate-300 hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDebriefDoneThisWeek ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                  {isDebriefDoneThisWeek ? <CheckCircle2 size={16} className="text-emerald-400" /> : <ClipboardList size={16} className={new Date().getDay() === 0 ? 'text-amber-400' : 'text-slate-400'} />}
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[8px] font-bold uppercase tracking-wider ${
                  isDebriefDoneThisWeek ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : new Date().getDay() === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-white/5 text-slate-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isDebriefDoneThisWeek ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : new Date().getDay() === 0 ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span>{isDebriefDoneThisWeek ? 'DONE' : new Date().getDay() === 0 ? 'DUE TODAY' : 'DUE SUN'}</span>
                </div>
              </div>

              <div>
                <div className="font-display font-bold text-xs uppercase tracking-wide truncate text-white">
                  Weekly Debrief
                </div>
                <div className="font-mono text-[9px] text-slate-400 truncate mt-0.5">
                  {isDebriefDoneThisWeek ? 'Cycle completed' : new Date().getDay() === 0 ? 'Sunday debrief due' : 'Reflection cycle'}
                </div>
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
                className="relative overflow-hidden dashboard-card p-5 sm:p-6"
                style={{
                  borderLeft: '4px solid var(--info)',
                }}
              >
                <div className="absolute top-0 right-0 pointer-events-none" style={{
                  width: '240px', height: '240px', borderRadius: '50%',
                  background: 'var(--info)', opacity: 0.07, filter: 'blur(50px)',
                  transform: 'translate(30%, -30%)',
                }} />
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <Target size={14} color="var(--info)" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-info font-bold">Active Objective</span>
                  <span className="ml-auto font-mono text-[8px] text-info animate-pulse px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">● EXECUTING</span>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between gap-4 relative z-10">
                  <div className="flex-1">
                    <h2 className="font-display font-bold text-white leading-tight mb-2"
                      style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)' }}>
                      {mainQuest.title}
                    </h2>
                    {mainQuest.description && (
                      <p className="font-mono text-[10px] text-slate-400 mb-4 line-clamp-2">{mainQuest.description}</p>
                    )}
                    <TacticalProgress value={mainQuest.progress} max={100} showValue color="var(--info)" />
                  </div>

                  {/* OPERATION DEADLINE COUNTDOWN */}
                  {deadlineDays !== null && (
                    <div className="shrink-0 flex flex-col items-center justify-center p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] min-w-[100px] sm:min-w-[120px]">
                      <Clock size={16} className="mb-1" style={{
                        color: deadlineUrgency === 'danger' ? 'var(--danger)' : deadlineUrgency === 'warning' ? 'var(--warning)' : 'var(--info)'
                      }} />
                      <div className="font-display font-bold" style={{
                        fontSize: '2rem', lineHeight: 1,
                        color: deadlineUrgency === 'danger' ? 'var(--danger)' : deadlineUrgency === 'warning' ? 'var(--warning)' : '#ffffff'
                      }}>
                        {deadlineDays}
                      </div>
                      <div className="font-mono text-[8px] text-slate-400 uppercase mt-1">Days Left</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="dashboard-card border-dashed text-center p-6">
                <AlertTriangle size={24} className="text-slate-500 mx-auto mb-2" />
                <p className="font-mono text-[11px] text-slate-400 mb-3">No active directives</p>
                <Link href="/goals" className="btn btn-primary btn-sm rounded-xl font-mono text-[10px] px-4 py-2">ASSIGN MISSION</Link>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TODAY'S OPERATIONS & SCHEDULE
            ══════════════════════════════════════════════════════════════════ */}
            <div className="dashboard-card p-5 sm:p-6" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={14} className="text-amber-400" />
                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                    Today's Operations & Schedule
                  </span>
                  <span className="px-2 py-0.5 rounded-full font-mono text-[8px] font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {todayCalendarEvents.length + todayTasksScheduled.length} {todayCalendarEvents.length + todayTasksScheduled.length === 1 ? 'Item' : 'Items'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/tasks"
                    className="font-mono text-[9px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Tasks</span>
                    <ArrowUpRight size={10} />
                  </Link>
                  <span className="text-slate-600 text-xs">·</span>
                  <Link
                    href="/calendar"
                    className="font-mono text-[9px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Calendar</span>
                    <ArrowUpRight size={10} />
                  </Link>
                </div>
              </div>

              {todayCalendarEvents.length === 0 && todayTasksScheduled.length === 0 ? (
                <div className="p-5 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10">
                  <p className="font-mono text-[11px] text-slate-400 mb-2.5">No scheduled operations or calendar events for today.</p>
                  <div className="flex items-center justify-center gap-2">
                    <Link href="/tasks" className="btn btn-secondary btn-sm font-mono text-[9px] rounded-xl">
                      + ADD TASK
                    </Link>
                    <Link href="/calendar" className="btn btn-secondary btn-sm font-mono text-[9px] rounded-xl">
                      + ADD EVENT
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Calendar Events First */}
                  {todayCalendarEvents.map((evt, idx) => (
                    <div
                      key={evt.id || idx}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 transition-all hover:border-cyan-500/50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee] shrink-0" />
                        <div className="min-w-0">
                          <span className="font-display font-semibold text-xs text-white truncate block">
                            {evt.title}
                          </span>
                          {evt.description && (
                            <span className="font-mono text-[9px] text-slate-400 truncate block">
                              {evt.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {evt.start_time && (
                          <span className="font-mono text-[10px] text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                            {evt.start_time.includes('T') ? evt.start_time.split('T')[1].slice(0, 5) : evt.start_time}
                          </span>
                        )}
                        <span className="font-mono text-[8px] font-bold text-cyan-400 uppercase tracking-wider bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/30">
                          EVENT
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Scheduled Tasks */}
                  {todayTasksScheduled.map(task => {
                    const isDone = task.status === 'completed'
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                          isDone
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-400'
                            : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={async () => {
                              if (isDone) {
                                if (undoCompleteTask) await undoCompleteTask(task.id)
                              } else {
                                if (completeTask) await completeTask(task.id)
                              }
                              if (fetchTasks) await fetchTasks()
                              if (profileHook?.fetchProfile) await profileHook.fetchProfile()
                            }}
                            className={`w-6 h-6 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                              isDone
                                ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                : 'border border-white/20 hover:border-emerald-400 hover:bg-emerald-500/10 text-transparent hover:text-emerald-400'
                            }`}
                            title={isDone ? 'Undo complete' : 'Mark complete'}
                          >
                            <Check size={13} strokeWidth={3} className={isDone ? 'opacity-100' : 'opacity-0 hover:opacity-100'} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <span className={`font-mono text-xs leading-snug break-words whitespace-normal block ${
                              isDone ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}>
                              {task.title}
                            </span>
                            {task.description && (
                              <span className="font-mono text-[9px] text-slate-500 truncate block mt-0.5">
                                {task.description}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {task.due_time && (
                            <span className="font-mono text-[9px] text-slate-400">
                              {task.due_time}
                            </span>
                          )}
                          {isDone ? (
                            <span className="font-mono text-[8px] font-bold text-emerald-300 uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                              DONE
                            </span>
                          ) : (
                            <span className="font-mono text-[8px] font-bold text-amber-300 uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40">
                              +25 XP
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>



            {/* NEXT WEEK PRIORITIES // WEEKLY DEBRIEF WIDGET */}
            <div className="dashboard-card p-5 sm:p-6" style={{ borderLeft: '4px solid var(--info)' }}>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} color="var(--info)" />
                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-info font-bold">Next Week Priorities // Weekly Debrief</span>
                </div>
                <Link href="/journal" className="font-mono text-[9px] text-slate-400 hover:text-info flex items-center gap-1 transition-colors">
                  <span>DEBRIEF</span>
                  <ArrowUpRight size={10} />
                </Link>
              </div>

              {debriefPriorityList.length > 0 ? (
                (() => {
                  const updateDebriefWorkLog = async (priorityTitle, newTag) => {
                    if (!user) return
                    const sb = createClient()
                    const curDebrief = latestDebriefRef.current || latestDebrief
                    if (!curDebrief?.id) return

                    const cleanTarget = priorityTitle
                      .replace(/\[DONE\]|\[FAILED\]/gi, '')
                      .replace(/^[-*•]\s*(\[[ xXvV✓✕]\])?\s*/, '')
                      .replace(/^\d+[\.\)]\s*/, '')
                      .trim()
                      .toLowerCase()

                    if (!cleanTarget) return

                    // Fetch fresh description from Supabase to prevent race conditions across rapid clicks
                    let currentDesc = curDebrief.description || ''
                    try {
                      const { data: fresh } = await sb.from('work_logs').select('description').eq('id', curDebrief.id).single()
                      if (fresh?.description) {
                        currentDesc = fresh.description
                      }
                    } catch (err) {}

                    const lines = currentDesc.split('\n')
                    let matched = false
                    const updatedLines = lines.map(line => {
                      const cleanLine = line
                        .replace(/\[DONE\]|\[FAILED\]/gi, '')
                        .replace(/^[-*•]\s*(\[[ xXvV✓✕]\])?\s*/, '')
                        .replace(/^\d+[\.\)]\s*/, '')
                        .trim()
                        .toLowerCase()

                      if (!matched && (cleanLine === cleanTarget || cleanLine.includes(cleanTarget) || cleanTarget.includes(cleanLine))) {
                        matched = true
                        const prefixMatch = line.match(/^(\s*\d+[\.\)]\s*|\s*[-*•]\s*)?/)?.[0] || ''
                        const pureLine = line
                          .replace(/\[DONE\]|\[FAILED\]/gi, '')
                          .replace(/^(\s*\d+[\.\)]\s*|\s*[-*•]\s*)?/, '')
                          .trim()
                        return newTag ? `${prefixMatch}${pureLine} ${newTag}` : `${prefixMatch}${pureLine}`
                      }
                      return line
                    })

                    const newDesc = updatedLines.join('\n')
                    const nowIso = new Date().toISOString()
                    await sb.from('work_logs').update({ description: newDesc, updated_at: nowIso }).eq('id', curDebrief.id)
                    const updatedObj = { ...curDebrief, description: newDesc, updated_at: nowIso }
                    latestDebriefRef.current = updatedObj
                    setLatestDebrief(updatedObj)

                    if (typeof window !== 'undefined') {
                      try {
                        const rawHist = localStorage.getItem(`lokios_debrief_history_${user.id}`)
                        if (rawHist) {
                          const parsed = JSON.parse(rawHist)
                          const next = parsed.map(p => (p.id === curDebrief.id || p.title === curDebrief.title) ? updatedObj : p)
                          localStorage.setItem(`lokios_debrief_history_${user.id}`, JSON.stringify(next))
                        }
                        const todayStr = getLocalDateStr(new Date())
                        const cacheKey = `lokios_dashboard_recon_${user.id}_${todayStr}`
                        const reconCache = localStorage.getItem(cacheKey)
                        const parsedRecon = reconCache ? JSON.parse(reconCache) : {}
                        parsedRecon.latestDebrief = updatedObj
                        localStorage.setItem(cacheKey, JSON.stringify(parsedRecon))
                      } catch (e) {}
                    }
                  }

                  return (
                    <div className="space-y-2">
                      {debriefPriorityList.map((gt) => {
                        const isDone = gt.status === 'completed'
                        const isFailed = gt.status === 'failed' || gt.status === 'cancelled'

                        const goalTitleText = typeof gt.title === 'string' ? gt.title : (gt.title?.title || gt.title?.name || 'Priority Goal')
                        const isLongTitle = goalTitleText.length > 35
                        const stableSourceId = `debrief_p_${goalTitleText.trim().toLowerCase().replace(/\s+/g, '_')}`

                        const handleMarkDone = async () => {
                          updatePriorityStatus({ [gt.id]: 'completed', [goalTitleText]: 'completed', [stableSourceId]: 'completed' })
                          let targetIds = gt.matchingTaskIds && gt.matchingTaskIds.length > 0 ? [...gt.matchingTaskIds] : []

                          if (targetIds.length === 0 && user) {
                            const endOfWeekStr = getLocalDateStr(getEndOfWeek(new Date()))
                            const res = await addTask({
                              title: goalTitleText,
                              type: 'custom',
                              category: 'weekly_goal',
                              due_date: endOfWeekStr,
                              status: 'completed',
                              completed_at: new Date().toISOString(),
                              description: '[Weekly Goal] Priority for Next Week'
                            })
                            if (res?.data?.id) targetIds.push(res.data.id)
                          }

                          for (const tid of targetIds) {
                            const updates = { completed_at: new Date().toISOString(), status: 'completed' }
                            await createClient().from('tasks').update(updates).eq('id', tid).eq('user_id', user.id)
                          }

                          await updateDebriefWorkLog(goalTitleText, '[DONE]')
                          await robustAwardXP(user.id, 25, 'task_complete', stableSourceId, `Completed Priority Goal: ${goalTitleText}`, 'discipline')

                          if (fetchTasks) await fetchTasks()
                          await profileHook?.fetchProfile?.()
                        }

                        const handleMarkFailed = async () => {
                          updatePriorityStatus({ [gt.id]: 'failed', [goalTitleText]: 'failed', [stableSourceId]: 'failed' })
                          let targetIds = gt.matchingTaskIds && gt.matchingTaskIds.length > 0 ? [...gt.matchingTaskIds] : []

                          if (targetIds.length === 0 && user) {
                            const endOfWeekStr = getLocalDateStr(getEndOfWeek(new Date()))
                            const res = await addTask({
                              title: goalTitleText,
                              type: 'custom',
                              category: 'weekly_goal',
                              due_date: endOfWeekStr,
                              status: 'failed',
                              completed_at: new Date().toISOString(),
                              description: '[Weekly Goal] Priority for Next Week'
                            })
                            if (res?.data?.id) targetIds.push(res.data.id)
                          }

                          for (const tid of targetIds) {
                            const updates = { completed_at: new Date().toISOString(), status: 'failed' }
                            await createClient().from('tasks').update(updates).eq('id', tid).eq('user_id', user.id)
                          }

                          await updateDebriefWorkLog(goalTitleText, '[FAILED]')
                          await robustAwardXP(user.id, -25, 'task_failed', stableSourceId, `Failed Priority Goal: ${goalTitleText}`, 'discipline')

                          if (fetchTasks) await fetchTasks()
                          await profileHook?.fetchProfile?.()
                        }

                        const handleReopen = async () => {
                          updatePriorityStatus({ [gt.id]: 'pending', [goalTitleText]: 'pending', [stableSourceId]: 'pending', [gt.title]: 'pending' })
                          const targetIds = gt.matchingTaskIds && gt.matchingTaskIds.length > 0 ? gt.matchingTaskIds : (gt.taskId ? [gt.taskId] : [])
                          for (const tid of targetIds) {
                            const updates = { completed_at: null, status: 'pending' }
                            await createClient().from('tasks').update(updates).eq('id', tid).eq('user_id', user.id)
                          }
                          await updateDebriefWorkLog(goalTitleText, '')
                          await robustRemoveXP(user.id, 'task_complete', stableSourceId)
                          await robustRemoveXP(user.id, 'task_failed', stableSourceId)
                          if (fetchTasks) await fetchTasks()
                          await profileHook?.fetchProfile?.()
                        }

                        return (
                          <div key={gt.id} className={`flex items-start sm:items-center justify-between gap-3 p-3 rounded-2xl border transition-all w-full max-w-full overflow-hidden ${
                            isDone ? 'border-emerald-500/30 bg-emerald-950/20' : isFailed ? 'border-rose-500/30 bg-rose-950/20' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                          }`}>
                            <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                              {/* Action Buttons */}
                              <div className="flex items-center gap-1.5 shrink-0 mt-0.5 sm:mt-0">
                                {isDone || isFailed ? (
                                  <button
                                    type="button"
                                    onClick={handleReopen}
                                    title="Re-open Priority Goal"
                                    className="w-7 h-7 rounded-xl flex items-center justify-center border border-white/10 hover:border-cyan-400 text-cyan-400 bg-white/5 transition-all shrink-0 active:scale-95"
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={handleMarkDone}
                                      title="Mark Completed (+25 XP)"
                                      className="w-7 h-7 rounded-xl flex items-center justify-center border border-emerald-500/40 hover:bg-emerald-500 text-emerald-400 hover:text-black transition-all shrink-0 active:scale-95"
                                    >
                                      <Check size={14} strokeWidth={2.5} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleMarkFailed}
                                      title="Mark Failed (-25 XP)"
                                      className="w-7 h-7 rounded-xl flex items-center justify-center border border-rose-500/40 hover:bg-rose-500 text-rose-400 hover:text-white transition-all shrink-0 active:scale-95"
                                    >
                                      <X size={14} strokeWidth={2.5} />
                                    </button>
                                  </>
                                )}
                              </div>
                              <span className={`font-mono leading-snug break-words whitespace-normal flex-1 min-w-0 transition-all ${
                                isLongTitle ? 'text-[11px]' : 'text-xs'
                              } ${
                                isDone 
                                  ? 'text-emerald-400/80 line-through decoration-emerald-500 font-medium' 
                                  : isFailed 
                                  ? 'text-rose-400/80 line-through decoration-rose-500 font-medium' 
                                  : 'text-slate-200 font-medium'
                              }`}>
                                {goalTitleText}
                              </span>
                            </div>
                            {isDone ? (
                              <span className="font-mono text-[8px] font-bold text-emerald-300 uppercase shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 whitespace-nowrap self-center">DONE (+25 XP)</span>
                            ) : isFailed ? (
                              <span className="font-mono text-[8px] font-bold text-rose-300 uppercase shrink-0 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 whitespace-nowrap self-center">FAILED (-25 XP)</span>
                            ) : (
                              <span className="font-mono text-[8px] font-bold text-amber-300 uppercase shrink-0 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 whitespace-nowrap self-center">+25 XP</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
              ) : (
                <div className="p-5 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10">
                  <p className="font-mono text-[11px] text-slate-400 mb-2.5">No priorities logged for this cycle.</p>
                  <Link href="/journal" className="btn btn-secondary btn-sm font-mono text-[9px] rounded-xl">
                    INITIALIZE WEEKLY DEBRIEF
                  </Link>
                </div>
              )}
            </div>

            {/* 30-DAY XP TRAJECTORY GRAPH */}
            <div className="dashboard-card p-5 sm:p-6" style={{ borderLeft: `4px solid ${arcColor}` }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 size={14} style={{ color: arcColor }} />
                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-300 font-bold">30-Day Project Trajectory (XP)</span>
                </div>
                <span className="font-mono text-[8px] text-slate-500 uppercase">XP Velocity</span>
              </div>
              <div style={{ width: '100%', height: '140px' }}>
                <ResponsiveContainer>
                  <AreaChart data={xpTrajectory} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={arcColor} stopOpacity={0.35}/>
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
            <div className="dashboard-card p-5 sm:p-6 relative overflow-hidden" style={{ borderLeft: '4px solid rgba(168, 85, 247, 0.6)' }}>
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles size={14} className="text-purple-400" />
                <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-purple-300 font-bold">Daily Briefing // Mindset</span>
              </div>
              <p className="font-display text-white text-base sm:text-lg leading-snug italic font-medium">
                "{briefing}"
              </p>
            </div>

          </div>

          {/* RIGHT SIDEBAR (4 cols) */}
          <div className="col-4 flex flex-col gap-3 lg:gap-4">

            {/* OPAL CIRCULAR MOMENTUM FOCUS RING */}
            <div className="dashboard-card relative overflow-hidden flex flex-col items-center text-center p-5 sm:p-6" style={{ borderTop: `1px solid ${momentumColor}30` }}>
              {/* Luminous atmospheric aura glow behind ring */}
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-none filter blur-3xl opacity-20 transition-all duration-700"
                style={{ background: momentumColor }}
              />

              <div className="flex items-center justify-between w-full mb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <Activity size={14} style={{ color: momentumColor }} />
                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-300 font-bold">
                    Momentum Focus
                  </span>
                </div>
                <span 
                  className="px-2.5 py-0.5 rounded-full font-mono text-[8px] font-black uppercase tracking-wider border shadow-sm"
                  style={{
                    color: momentumColor,
                    borderColor: `${momentumColor}40`,
                    background: `${momentumColor}15`
                  }}
                >
                  {dailyMomentum?.state || momentumText}
                </span>
              </div>

              {/* Signature Opal SVG Circular Gauge */}
              <div className="relative w-44 h-44 flex items-center justify-center my-1">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Background Track Ring */}
                  <circle
                    cx="88"
                    cy="88"
                    r="68"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.06)"
                    strokeWidth="9"
                    strokeLinecap="round"
                  />
                  {/* Glowing Active Arc */}
                  <circle
                    cx="88"
                    cy="88"
                    r="68"
                    fill="none"
                    stroke={momentumColor}
                    strokeWidth="9"
                    strokeDasharray={2 * Math.PI * 68}
                    strokeDashoffset={2 * Math.PI * 68 * (1 - Math.max(0.06, Math.min(1, ((momentumScore + 10) / 20))))}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      filter: `drop-shadow(0 0 8px ${momentumColor}80)`
                    }}
                  />
                </svg>

                {/* Ring Center Metrics */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">
                    Momentum
                  </span>
                  <div 
                    className="font-display font-black tracking-tight leading-none"
                    style={{ fontSize: '2.5rem', color: momentumColor }}
                  >
                    {momentumScore > 0 ? '+' : ''}{momentumScore}
                  </div>
                  <span className="font-mono text-[8px] text-slate-500 uppercase mt-1">
                    -10 to +10 range
                  </span>
                </div>
              </div>

              {/* Status Pills: Streak & Win Rate */}
              <div className="grid grid-cols-2 gap-2 w-full mt-3.5 relative z-10">
                <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-white/[0.03] border border-white/10">
                  <Flame size={14} color={flameColor} className="animate-pulse" />
                  <span className="font-mono font-bold text-white text-xs">
                    {currentStreak} <span className="text-[9px] text-slate-400 font-normal">days streak</span>
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-white/[0.03] border border-white/10">
                  <Zap size={13} className="text-cyan-400" />
                  <span className="font-mono font-bold text-white text-xs">
                    {weeklyWinRate}% <span className="text-[9px] text-slate-400 font-normal">win rate</span>
                  </span>
                </div>
              </div>

              {/* Interactive Breakdown Accordion Toggle */}
              <button
                type="button"
                onClick={() => setMomentumExpanded(!momentumExpanded)}
                className="w-full mt-3 py-2 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 flex items-center justify-between text-slate-400 hover:text-white transition-all text-[9px] font-mono uppercase tracking-wider active:scale-95"
              >
                <span>{momentumExpanded ? 'Hide Factors' : 'View Breakdown Factors'}</span>
                <ChevronDown size={12} className={`transition-transform duration-300 ${momentumExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Momentum Breakdown */}
              <AnimatePresence>
                {momentumExpanded && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full mt-3 pt-3 overflow-hidden border-t border-white/10"
                  >
                    <div className="flex flex-col gap-2 font-mono text-[9px] text-slate-400 tracking-wider">
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span>Habits Today ({habitsCompletedToday}/{habitsCompletedToday + habitsFailedToday})</span> 
                        <span className="font-bold" style={{ color: habitComponent > 0 ? '#34d399' : habitComponent < 0 ? '#f87171' : 'inherit' }}>
                          {habitComponent > 0 ? '+' : ''}{habitComponent.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span>Operations ({tasksCompletedToday} done / {tasksOverdue} overdue)</span> 
                        <span className="font-bold" style={{ color: opsComponent > 0 ? '#34d399' : opsComponent < 0 ? '#f87171' : 'inherit' }}>
                          {opsComponent > 0 ? '+' : ''}{opsComponent.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span>Missions ({missionsCompleted} done / {missionsStalled} stalled)</span> 
                        <span className="font-bold" style={{ color: missionsComponent > 0 ? '#34d399' : missionsComponent < 0 ? '#f87171' : 'inherit' }}>
                          {missionsComponent > 0 ? '+' : ''}{missionsComponent.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span>Streak Inertia ({currentStreak}d)</span> 
                        <span className="font-bold" style={{ color: streakComponent > 0 ? '#34d399' : 'inherit' }}>
                          {streakComponent > 0 ? '+' : ''}{streakComponent.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span>Weekly Win Rate ({weeklyWinRate}%)</span> 
                        <span className="font-bold" style={{ color: winRateComponent > 0 ? '#34d399' : winRateComponent < 0 ? '#f87171' : 'inherit' }}>
                          {winRateComponent > 0 ? '+' : ''}{winRateComponent.toFixed(1)}
                        </span>
                      </div>
                      {todayScreenTime && (
                        <div className="flex justify-between items-center py-1">
                          <span>Screen Intel ({todayScreenTime.total_hours}h / {todayScreenTime.doom_scroll_minutes || 0}m doom)</span> 
                          <span className="font-bold" style={{ color: screenComponent > 0 ? '#34d399' : screenComponent < 0 ? '#f87171' : 'inherit' }}>
                            {screenComponent > 0 ? '+' : ''}{screenComponent.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* XP STAT MATRIX */}
            <div className="dashboard-card p-5 sm:p-6" style={{ borderLeft: `4px solid ${arcColor}` }}>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Zap size={14} style={{ color: arcColor }} />
                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-300 font-bold">XP Matrix</span>
                </div>
                <span className="font-mono text-[8px] text-slate-500 uppercase font-semibold">LV.{currentLevel} DYNAMICS</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="font-display font-black tracking-tight leading-none text-cyan-400 text-lg sm:text-xl">
                    {xpNeeded >= 1000 ? `${(xpNeeded / 1000).toFixed(1)}k` : xpNeeded}
                  </div>
                  <div className="font-mono text-[8px] text-slate-400 uppercase mt-1.5">TO LV.{currentLevel + 1}</div>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="font-display font-black tracking-tight leading-none text-lg sm:text-xl" style={{ color: (dailyMomentum?.todayNet ?? xpToday) > 0 ? '#34d399' : (dailyMomentum?.todayNet ?? xpToday) < 0 ? '#f87171' : '#94a3b8' }}>
                    {dailyMomentum?.todayNet >= 0 ? '+' : ''}{dailyMomentum?.todayNet ?? xpToday}
                  </div>
                  <div className="font-mono text-[8px] text-slate-400 uppercase mt-1.5">TODAY</div>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="font-display font-black tracking-tight leading-none text-lg sm:text-xl" style={{ color: (dailyMomentum?.threeDayNet ?? xpThisWeek) > 0 ? '#34d399' : (dailyMomentum?.threeDayNet ?? xpThisWeek) < 0 ? '#f87171' : '#94a3b8' }}>
                    {dailyMomentum?.threeDayNet >= 0 ? '+' : ''}{dailyMomentum?.threeDayNet ?? xpThisWeek}
                  </div>
                  <div className="font-mono text-[8px] text-slate-400 uppercase mt-1.5">3-DAY NET</div>
                </div>
              </div>
            </div>

            {/* ── DIGITAL ADDICTION WIDGET ── */}
            {addictionData !== null && (
              <div
                className="dashboard-card p-5 sm:p-6 cursor-pointer transition-all hover:border-white/20"
                style={{ borderLeft: `4px solid ${addictionData.addScore >= 55 ? '#ef4444' : addictionData.addScore >= 30 ? '#f59e0b' : '#10b981'}` }}
                onClick={() => setExpandedWidget(expandedWidget === 'addiction' ? null : 'addiction')}
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Smartphone size={14} style={{ color: addictionData.addScore >= 55 ? '#ef4444' : addictionData.addScore >= 30 ? '#f59e0b' : '#10b981' }} />
                    <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-300 font-bold">Digital Discipline</span>
                  </div>
                  <span className="font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{
                    color: addictionData.addScore >= 55 ? '#ef4444' : addictionData.addScore >= 30 ? '#f59e0b' : '#10b981',
                    background: addictionData.addScore >= 55 ? 'rgba(239,68,68,0.15)' : addictionData.addScore >= 30 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                    border: `1px solid ${addictionData.addScore >= 55 ? 'rgba(239,68,68,0.3)' : addictionData.addScore >= 30 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`
                  }}>
                    {addictionData.addScore >= 55 ? '⚠ HOOKED' : addictionData.addScore >= 30 ? 'DRIFTING' : '✓ CLEAN'}
                  </span>
                </div>

                <div className="flex items-end justify-between mb-3.5">
                  <div>
                    <div className="font-display font-bold tracking-tight leading-none text-2xl sm:text-3xl" style={{ color: addictionData.addScore >= 55 ? '#ef4444' : addictionData.addScore >= 30 ? '#f59e0b' : '#10b981' }}>
                      {addictionData.addScore}
                      <span className="font-mono text-[10px] text-slate-500 ml-1">/ 100</span>
                    </div>
                    <div className="font-mono text-[8px] text-slate-400 uppercase mt-1">Discipline Index</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[11px] font-bold text-white">{addictionData.avgScreen}h <span className="text-slate-400 font-normal">avg/day</span></div>
                    <div className="font-mono text-[8px] text-slate-400 mt-0.5">{addictionData.daysClean}d clean (7d)</div>
                  </div>
                </div>

                {/* Addiction bar */}
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: addictionData.addScore >= 55 ? '#ef4444' : addictionData.addScore >= 30 ? '#f59e0b' : '#10b981' }}
                    initial={{ width: 0 }} animate={{ width: `${addictionData.addScore}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>

                {/* Doomscroll meter */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-slate-400">Doomscroll 7d:</span>
                  <span className="font-mono text-[10px] font-bold" style={{ color: addictionData.avgDoom > 60 ? '#ef4444' : addictionData.avgDoom > 30 ? '#f59e0b' : '#10b981' }}>
                    {addictionData.avgDoom}m
                  </span>
                  {addictionData.todaySt && (
                    <span className="ml-auto font-mono text-[8px] px-2 py-0.5 rounded-full" style={{
                      background: (parseFloat(addictionData.todaySt.total_hours) || 0) <= 4 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      color: (parseFloat(addictionData.todaySt.total_hours) || 0) <= 4 ? '#34d399' : '#f87171'
                    }}>
                      Today: {addictionData.todaySt.total_hours || '?'}h
                    </span>
                  )}
                </div>

                <AnimatePresence>
                  {expandedWidget === 'addiction' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3.5 pt-3.5 border-t border-white/10">
                      <div className="flex flex-col gap-2 font-mono text-[9px]">
                        <div className="text-slate-400 uppercase tracking-widest mb-0.5">INTEL BREAKDOWN</div>
                        {[
                          { label: `7-day avg screen time: ${addictionData.avgScreen}h (target ≤4h)`, ok: parseFloat(addictionData.avgScreen) <= 4 },
                          { label: `7-day avg doomscroll: ${addictionData.avgDoom}m (target ≤30m)`, ok: addictionData.avgDoom <= 30 },
                          { label: `Today logged: ${addictionData.todaySt ? addictionData.todaySt.total_hours + 'h' : 'not logged'}`, ok: !!addictionData.todaySt && (parseFloat(addictionData.todaySt.total_hours) || 0) <= 4 },
                          { label: `Clean days in last 7: ${addictionData.daysClean} (target ≥5)`, ok: addictionData.daysClean >= 5 },
                          { label: `Streaming avg: ${addictionData.avgStreaming || '0'}h (target ≤2h)`, ok: parseFloat(addictionData.avgStreaming || 0) <= 2 },
                        ].map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span style={{ color: f.ok ? '#34d399' : '#f87171' }}>{f.ok ? '✓' : '✗'}</span>
                            <span className="text-slate-300">{f.label}</span>
                          </div>
                        ))}
                        <div className="mt-2 pt-2 border-t border-dashed border-white/10">
                          <div className="text-slate-500">Today's directive: ≤4h screen · ≤30m doom · ≤2h streaming</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* DAY PRESSURE CLOCK */}
            <div className="dashboard-card p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-300 font-bold">Time Remaining</span>
                </div>
                <span className="font-mono text-[8px] font-bold px-2 py-0.5 rounded-full" style={{
                  color: dayUrgency === 'danger' ? '#f87171' : dayUrgency === 'warning' ? '#fbbf24' : '#94a3b8',
                  background: dayUrgency === 'danger' ? 'rgba(239,68,68,0.15)' : dayUrgency === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)'
                }}>
                  {dayUrgency === 'danger' ? '⚠ EXECUTE NOW' : dayUrgency === 'warning' ? 'WINDOW CLOSING' : 'TIME ON SIDE'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0 w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" fill="none"
                      stroke={dayUrgency === 'danger' ? '#ef4444' : dayUrgency === 'warning' ? '#f59e0b' : arcColor}
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - dayPct / 100)}`}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono font-bold text-white text-[9px]">{dayPct}%</span>
                  </div>
                </div>
                <div>
                  <div className="font-display font-black text-white text-2xl leading-none">
                    {hoursLeft}<span className="font-mono text-xs text-slate-400 font-normal">h left today</span>
                  </div>
                  <div className="font-mono text-[9px] text-slate-400 mt-1">
                    Day cycle resets at midnight
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
              className="w-full max-w-md p-6 bg-[#0a0d18]/95 border border-white/10 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl relative m-4"
            >
              <button 
                onClick={() => setEodQuickLogModal(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all absolute top-4 right-4"
              >
                <X size={16} />
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
