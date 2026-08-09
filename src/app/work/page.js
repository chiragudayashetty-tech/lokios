'use client'

import React, { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import IntelExportModal from '@/components/ui/IntelExportModal'
import { createClient } from '@/lib/supabase/client'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, PieChart, Pie, Cell 
} from 'recharts'
import { 
  Briefcase, Video, Film, Clock, Calendar, Save, Download, 
  Sparkles, TrendingUp, Target, Zap, AlertTriangle, Scissors, Camera,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Flag, Shield,
  FileText, MoreHorizontal, Plus, Trash2, CheckCircle2, Layers, Share2, Youtube, RotateCcw
} from 'lucide-react'

export default function WorkPage() {
  const { auth: { user }, xp: { awardXP } } = useOS()

  // Primary subpage tab: 'work_log' | 'content_ops' | 'analytics'
  const [activeTab, setActiveTab] = useState('work_log')

  // Content Operations sub-mode: 'shoot' | 'edit' | 'planner'
  const [contentMode, setContentMode] = useState('shoot')

  // Export Modal trigger state
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Date Selection for Logging (YYYY-MM-DD)
  const getLocalDateStr = (d = new Date()) => {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - (offset * 60 * 1000))
    return local.toISOString().split('T')[0]
  }

  const todayStr = getLocalDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(todayStr)

  // XP Toast State
  const [xpToast, setXpToast] = useState(null)

  // Analytics Period Selector ('7days' | '30days' | 'all')
  const [analyticsRange, setAnalyticsRange] = useState('7days')

  // ----------------------------------------------------
  // INDIVIDUAL FIELD TIME UNITS ('h' | 'm')
  // ----------------------------------------------------
  const [unitTotalWorked, setUnitTotalWorked] = useState('h')
  const [unitBeyondTatva, setUnitBeyondTatva] = useState('h')
  const [unitFocused, setUnitFocused] = useState('h')
  const [unitUnfocused, setUnitUnfocused] = useState('h')

  const [unitShootHours, setUnitShootHours] = useState('h')
  const [unitShootRaw, setUnitShootRaw] = useState('m')

  const [unitEditHours, setUnitEditHours] = useState('h')
  const [unitEditFinished, setUnitEditFinished] = useState('m')

  // FORM INPUT VALUES
  const [valTotalWorked, setValTotalWorked] = useState('')
  const [valBeyondTatva, setValBeyondTatva] = useState('')
  const [valFocused, setValFocused] = useState('')
  const [valUnfocused, setValUnfocused] = useState('')
  const [workWhatDidYouDo, setWorkWhatDidYouDo] = useState('')
  const [workNotes, setWorkNotes] = useState('')
  const [workTypes, setWorkTypes] = useState([]) // selected work type tags
  const [customWorkType, setCustomWorkType] = useState('')
  const [focusLevel, setFocusLevel] = useState(3) // 1=😠, 2=🙁, 3=😐 (Focused), 4=🙂, 5=😄

  const FOCUS_LEVEL_OPTIONS = [
    { level: 1, emoji: '😠', label: 'Very Distracted', color: '#ef4444' },
    { level: 2, emoji: '🙁', label: 'Distracted', color: '#f97316' },
    { level: 3, emoji: '😐', label: 'Focused', color: '#22c55e' },
    { level: 4, emoji: '🙂', label: 'Deep Focus', color: '#00F0FF' },
    { level: 5, emoji: '😄', label: 'Flow State', color: '#D4AF37' },
  ]

  const WORK_TYPE_OPTIONS = [
    { label: 'DEEP WORK', color: '#D4AF37' },
    { label: 'BEYOND TATVA', color: '#00F0FF' },
    { label: 'MEETINGS', color: '#A78BFA' },
    { label: 'ADMIN', color: '#9CA3AF' },
    { label: 'RESEARCH', color: '#60A5FA' },
    { label: 'STRATEGY', color: '#F97316' },
    { label: 'CONTENT', color: '#10B981' },
    { label: 'EDITING', color: '#EC4899' },
    { label: 'LEARNING', color: '#34D399' },
    { label: 'CLIENT WORK', color: '#FBBF24' },
  ]

  const [valShootHours, setValShootHours] = useState('')
  const [valShootRaw, setValShootRaw] = useState('')
  const [shootNotes, setShootNotes] = useState('')

  const [valEditHours, setValEditHours] = useState('')
  const [valEditFinished, setValEditFinished] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Content Pipeline Ideas State
  const [contentIdeas, setContentIdeas] = useState([
    { id: 1, title: 'Building ChiragOS MVP: Modern Agentic System', platform: 'YouTube', status: 'Scripting', length: '15m' },
    { id: 2, title: 'How I Built My Personal AI Ecosystem with Gemini 2.0', platform: 'X / Twitter', status: 'Editing', length: '8m' },
    { id: 3, title: 'Weekly Review: High Performance Execution Framework', platform: 'Newsletter', status: 'Idea', length: '5m read' }
  ])
  const [newIdeaTitle, setNewIdeaTitle] = useState('')
  const [newIdeaPlatform, setNewIdeaPlatform] = useState('YouTube')

  // DATA STATES
  const [workLogs, setWorkLogs] = useState([])
  const [contentLogs, setContentLogs] = useState([])
  const [savingWork, setSavingWork] = useState(false)
  const [savingShoot, setSavingShoot] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  // Accordion Dropdown States for History Logs
  const [expandedWorkDates, setExpandedWorkDates] = useState(new Set())
  const [expandedContentDates, setExpandedContentDates] = useState(new Set())

  // Week-based calendar navigation (0 = current week, -1 = prev week, etc.)
  const [workWeekOffset, setWorkWeekOffset] = useState(0)
  const [contentWeekOffset, setContentWeekOffset] = useState(0)

  const toggleWorkDate = (date) => {
    setExpandedWorkDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const toggleContentDate = (date) => {
    setExpandedContentDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  // FETCH ALL WORK & CONTENT LOGS
  useEffect(() => {
    if (!user) return

    const fetchAllLogs = async () => {
      try {
        const sb = createClient()
        let fetchedW = []

        // Try work_hours_logs first, fallback to work_logs
        const { data: whData, error: whErr } = await sb
          .from('work_hours_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        if (!whErr && whData) {
          fetchedW = whData
        } else {
          const { data: wData } = await sb
            .from('work_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
          if (wData) fetchedW = wData
        }

        const { data: cData } = await sb
          .from('content_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        let fetchedC = cData || []

        // Merge with local cache if local has entries not yet in DB
        if (typeof window !== 'undefined') {
          const wCached = localStorage.getItem('lokios_work_logs_cache')
          if (wCached) {
            const parsedW = JSON.parse(wCached)
            const map = new Map()
            fetchedW.forEach(l => map.set(l.date, l))
            parsedW.forEach(l => {
              if (!map.has(l.date)) map.set(l.date, l)
            })
            fetchedW = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
          }

          const cCached = localStorage.getItem('lokios_content_logs_cache')
          if (cCached) {
            const parsedC = JSON.parse(cCached)
            const map = new Map()
            fetchedC.forEach(l => map.set(l.date, l))
            parsedC.forEach(l => {
              if (!map.has(l.date)) map.set(l.date, l)
            })
            fetchedC = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
          }
        }

        setWorkLogs(fetchedW)
        setContentLogs(fetchedC)

        if (typeof window !== 'undefined') {
          localStorage.setItem('lokios_work_logs_cache', JSON.stringify(fetchedW))
          localStorage.setItem('lokios_content_logs_cache', JSON.stringify(fetchedC))
        }
      } catch (err) {
        if (typeof window !== 'undefined') {
          const wCached = localStorage.getItem('lokios_work_logs_cache')
          if (wCached) setWorkLogs(JSON.parse(wCached))
          const cCached = localStorage.getItem('lokios_content_logs_cache')
          if (cCached) setContentLogs(JSON.parse(cCached))
        }
      }
    }

    fetchAllLogs()
  }, [user])

  // Helper to convert stored Hours value to input field value based on selected unit
  const toInputValue = (hoursVal, unit) => {
    if (hoursVal === '' || hoursVal === undefined || hoursVal === null) return ''
    const num = parseFloat(hoursVal) || 0
    if (unit === 'm') return Math.round(num * 60).toString()
    return num.toString()
  }

  // Populate forms when date or field unit changes
  useEffect(() => {
    const w = workLogs.find(l => l.date === selectedDate)
    if (w) {
      setValTotalWorked(toInputValue(w.total_hours_worked ?? w.duration_hours, unitTotalWorked))
      setValBeyondTatva(toInputValue(w.beyond_tatva_hours, unitBeyondTatva))
      setValFocused(toInputValue(w.focused_hours, unitFocused))
      setValUnfocused(toInputValue(w.unfocused_hours ?? w.deep_execution_hours, unitUnfocused))
      
      const fullNotes = w.notes ?? ''
      if (fullNotes.includes('--- WIN/LEARNING ---')) {
        const parts = fullNotes.split('--- WIN/LEARNING ---')
        setWorkWhatDidYouDo(parts[0]?.trim() || '')
        setWorkNotes(parts[1]?.trim() || '')
      } else {
        setWorkWhatDidYouDo(fullNotes)
        setWorkNotes('')
      }
      setWorkTypes(w.work_type ? w.work_type.split(',').map(s => s.trim()).filter(Boolean) : [])
    } else {
      setValTotalWorked('')
      setValBeyondTatva('')
      setValFocused('')
      setValUnfocused('')
      setWorkWhatDidYouDo('')
      setWorkNotes('')
      setWorkTypes([])
    }

    const c = contentLogs.find(l => l.date === selectedDate)
    if (c) {
      setValShootHours(toInputValue(c.shoot_hours, unitShootHours))
      setValShootRaw(toInputValue((c.shoot_raw_minutes || 0) / 60, unitShootRaw))
      setShootNotes(c.notes ?? '')
      setValEditHours(toInputValue(c.edit_hours, unitEditHours))
      setValEditFinished(toInputValue((c.edit_finished_minutes || 0) / 60, unitEditFinished))
      setEditNotes(c.notes ?? '')
    } else {
      setValShootHours('')
      setValShootRaw('')
      setShootNotes('')
      setValEditHours('')
      setValEditFinished('')
      setEditNotes('')
    }
  }, [selectedDate, workLogs, contentLogs, unitTotalWorked, unitBeyondTatva, unitFocused, unitUnfocused, unitShootHours, unitShootRaw, unitEditHours, unitEditFinished])

  const toHours = (val, unit) => {
    const num = parseFloat(val) || 0
    if (unit === 'm') return num / 60
    return num
  }

  const toMinutes = (val, unit) => {
    const num = parseFloat(val) || 0
    if (unit === 'h') return num * 60
    return num
  }

  // ----------------------------------------------------
  // FILTERED NON-EMPTY LOGS FOR HISTORY DISPLAY
  // ----------------------------------------------------
  const nonEmptyWorkLogs = useMemo(() => {
    return workLogs.filter(l => {
      const tot = parseFloat(l.total_hours_worked ?? l.duration_hours) || 0
      const bt = parseFloat(l.beyond_tatva_hours) || 0
      const foc = parseFloat(l.focused_hours) || 0
      const unfoc = parseFloat(l.unfocused_hours ?? l.deep_execution_hours) || 0
      const hasNotes = l.notes && l.notes.trim() !== ''
      return tot > 0 || bt > 0 || foc > 0 || unfoc > 0 || hasNotes
    })
  }, [workLogs])

  const nonEmptyContentLogs = useMemo(() => {
    return contentLogs.filter(l => {
      const shootHrs = parseFloat(l.shoot_hours) || 0
      const shootRaw = parseFloat(l.shoot_raw_minutes) || 0
      const editHrs = parseFloat(l.edit_hours) || 0
      const editFin = parseFloat(l.edit_finished_minutes) || 0
      const hasNotes = l.notes && l.notes.trim() !== ''
      return shootHrs > 0 || shootRaw > 0 || editHrs > 0 || editFin > 0 || hasNotes
    })
  }, [contentLogs])

  // Compute Today's Metric Totals for Top Summary Bar
  const todayWorkLog = useMemo(() => {
    return workLogs.find(l => l.date === selectedDate) || {}
  }, [workLogs, selectedDate])

  const todayTotals = useMemo(() => {
    const tot = parseFloat(todayWorkLog.total_hours_worked ?? todayWorkLog.duration_hours) || toHours(valTotalWorked, unitTotalWorked)
    const bt = parseFloat(todayWorkLog.beyond_tatva_hours) || toHours(valBeyondTatva, unitBeyondTatva)
    const foc = parseFloat(todayWorkLog.focused_hours) || toHours(valFocused, unitFocused)
    const unfoc = parseFloat(todayWorkLog.unfocused_hours ?? todayWorkLog.deep_execution_hours) || toHours(valUnfocused, unitUnfocused)
    return { tot, bt, foc, unfoc }
  }, [todayWorkLog, valTotalWorked, valBeyondTatva, valFocused, valUnfocused, unitTotalWorked, unitBeyondTatva, unitFocused, unitUnfocused])

  // Helper for Date Navigation Formatting (e.g. 02 Aug - 08 Aug 2026)
  const offsetDate = (daysOffset) => {
    const d = new Date()
    d.setDate(d.getDate() + daysOffset)
    return getLocalDateStr(d)
  }

  const formatWeekRange = (weekOffset) => {
    const now = new Date()
    const currentDayOfWeek = now.getDay() // 0 = Sun
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - currentDayOfWeek + (weekOffset * 7))
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)

    const opt = { day: '2-digit', month: 'short' }
    const startStr = startOfWeek.toLocaleDateString('en-GB', opt)
    const endStr = endOfWeek.toLocaleDateString('en-GB', opt)
    const yearStr = endOfWeek.getFullYear()
    return `${startStr} – ${endStr} ${yearStr}`
  }

  // ----------------------------------------------------
  // SAVE WORK LOG ENTRY (BULLETPROOF SYNC & +2 XP REWARD)
  // ----------------------------------------------------
  const handleSaveWorkLog = async (e) => {
    e.preventDefault()
    if (!user) return
    setSavingWork(true)

    const combinedNotes = workWhatDidYouDo && workNotes 
      ? `${workWhatDidYouDo}\n--- WIN/LEARNING ---\n${workNotes}`
      : workWhatDidYouDo || workNotes || ''

    const payload = {
      user_id: user.id,
      date: selectedDate,
      total_hours_worked: toHours(valTotalWorked, unitTotalWorked),
      beyond_tatva_hours: toHours(valBeyondTatva, unitBeyondTatva),
      focused_hours: toHours(valFocused, unitFocused),
      unfocused_hours: toHours(valUnfocused, unitUnfocused),
      deep_execution_hours: toHours(valUnfocused, unitUnfocused),
      notes: combinedNotes,
      work_type: workTypes.join(', ')
    }

    // Update local state & localStorage cache immediately
    const updated = [payload, ...workLogs.filter(l => l.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date))
    setWorkLogs(updated)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_work_logs_cache', JSON.stringify(updated))

    // Sync to Supabase
    try {
      const sb = createClient()
      let targetTable = 'work_hours_logs'
      let { data: existing, error: selectErr } = await sb
        .from('work_hours_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .limit(1)

      if (selectErr) {
        targetTable = 'work_logs'
        const fallbackRes = await sb
          .from('work_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', selectedDate)
          .limit(1)
        existing = fallbackRes.data
      }

      if (existing && existing.length > 0) {
        await sb.from(targetTable).update({
          total_hours_worked: payload.total_hours_worked,
          beyond_tatva_hours: payload.beyond_tatva_hours,
          focused_hours: payload.focused_hours,
          unfocused_hours: payload.unfocused_hours,
          deep_execution_hours: payload.deep_execution_hours,
          notes: payload.notes,
          work_type: payload.work_type
        }).eq('id', existing[0].id)
      } else {
        await sb.from(targetTable).insert(payload)
      }
    } catch (err) {
      console.error('Save work log exception:', err)
    }

    awardXP(2, 'Logged Work Session')
    setXpToast('+2 XP: Work Log Recorded')
    setTimeout(() => setXpToast(null), 3000)
    setSavingWork(false)
  }

  // SAVE SHOOT LOG
  const handleSaveShootLog = async (e) => {
    e.preventDefault()
    if (!user) return
    setSavingShoot(true)

    const currentLog = contentLogs.find(l => l.date === selectedDate) || {}
    const payload = {
      user_id: user.id,
      date: selectedDate,
      shoot_hours: toHours(valShootHours, unitShootHours),
      shoot_raw_minutes: toMinutes(valShootRaw, unitShootRaw),
      edit_hours: currentLog.edit_hours || 0,
      edit_finished_minutes: currentLog.edit_finished_minutes || 0,
      notes: shootNotes || currentLog.notes || ''
    }

    const updated = [payload, ...contentLogs.filter(l => l.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date))
    setContentLogs(updated)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_content_logs_cache', JSON.stringify(updated))

    try {
      const sb = createClient()
      const { data: existing } = await sb.from('content_logs').select('id').eq('user_id', user.id).eq('date', selectedDate).limit(1)
      if (existing && existing.length > 0) {
        await sb.from('content_logs').update(payload).eq('id', existing[0].id)
      } else {
        await sb.from('content_logs').insert(payload)
      }
    } catch (err) {}

    awardXP(2, 'Logged Video Shoot')
    setXpToast('+2 XP: Shoot Log Recorded')
    setTimeout(() => setXpToast(null), 3000)
    setSavingShoot(false)
  }

  // SAVE EDIT LOG
  const handleSaveEditLog = async (e) => {
    e.preventDefault()
    if (!user) return
    setSavingEdit(true)

    const currentLog = contentLogs.find(l => l.date === selectedDate) || {}
    const payload = {
      user_id: user.id,
      date: selectedDate,
      shoot_hours: currentLog.shoot_hours || 0,
      shoot_raw_minutes: currentLog.shoot_raw_minutes || 0,
      edit_hours: toHours(valEditHours, unitEditHours),
      edit_finished_minutes: toMinutes(valEditFinished, unitEditFinished),
      notes: editNotes || currentLog.notes || ''
    }

    const updated = [payload, ...contentLogs.filter(l => l.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date))
    setContentLogs(updated)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_content_logs_cache', JSON.stringify(updated))

    try {
      const sb = createClient()
      const { data: existing } = await sb.from('content_logs').select('id').eq('user_id', user.id).eq('date', selectedDate).limit(1)
      if (existing && existing.length > 0) {
        await sb.from('content_logs').update(payload).eq('id', existing[0].id)
      } else {
        await sb.from('content_logs').insert(payload)
      }
    } catch (err) {}

    awardXP(2, 'Logged Video Edit')
    setXpToast('+2 XP: Edit Log Recorded')
    setTimeout(() => setXpToast(null), 3000)
    setSavingEdit(false)
  }

  // ----------------------------------------------------
  // ANALYTICS COMPUTATIONS
  // ----------------------------------------------------
  const filteredWorkLogs = useMemo(() => {
    if (analyticsRange === '7days') {
      const past = getLocalDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      return workLogs.filter(l => l.date >= past)
    } else if (analyticsRange === '30days') {
      const past = getLocalDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      return workLogs.filter(l => l.date >= past)
    }
    return workLogs
  }, [workLogs, analyticsRange])

  const filteredContentLogs = useMemo(() => {
    if (analyticsRange === '7days') {
      const past = getLocalDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      return contentLogs.filter(l => l.date >= past)
    } else if (analyticsRange === '30days') {
      const past = getLocalDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      return contentLogs.filter(l => l.date >= past)
    }
    return contentLogs
  }, [contentLogs, analyticsRange])

  const totals = useMemo(() => {
    const totWork = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.total_hours_worked ?? l.duration_hours) || 0), 0)
    const totBeyond = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.beyond_tatva_hours) || 0), 0)
    const totFocus = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.focused_hours) || 0), 0)
    const totUnfocused = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.unfocused_hours ?? l.deep_execution_hours) || 0), 0)

    const totShootHrs = filteredContentLogs.reduce((acc, l) => acc + (parseFloat(l.shoot_hours) || 0), 0)
    const totShootRawMins = filteredContentLogs.reduce((acc, l) => acc + (parseFloat(l.shoot_raw_minutes) || 0), 0)
    const totEditHrs = filteredContentLogs.reduce((acc, l) => acc + (parseFloat(l.edit_hours) || 0), 0)
    const totEditFinishedMins = filteredContentLogs.reduce((acc, l) => acc + (parseFloat(l.edit_finished_minutes) || 0), 0)

    const focusRatio = totWork > 0 ? Math.round((totFocus / totWork) * 100) : 0
    const beyondRatio = totWork > 0 ? Math.round((totBeyond / totWork) * 100) : 0
    const editRatio = totEditFinishedMins > 0 ? ((totEditHrs * 60) / totEditFinishedMins).toFixed(1) : '—'

    return {
      totWork, totBeyond, totFocus, totUnfocused,
      totShootHrs, totShootRawMins, totEditHrs, totEditFinishedMins,
      focusRatio, beyondRatio, editRatio
    }
  }, [filteredWorkLogs, filteredContentLogs])

  const chartData = useMemo(() => {
    const allDatesSet = new Set([...filteredWorkLogs.map(l => l.date), ...filteredContentLogs.map(l => l.date)])
    const sortedDates = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b))

    return sortedDates.map(d => {
      const w = filteredWorkLogs.find(l => l.date === d) || {}
      const c = filteredContentLogs.find(l => l.date === d) || {}

      return {
        date: d.slice(5),
        fullDate: d,
        Worked: Number((parseFloat(w.total_hours_worked ?? w.duration_hours) || 0).toFixed(1)),
        BeyondTatva: Number((parseFloat(w.beyond_tatva_hours) || 0).toFixed(1)),
        Focused: Number((parseFloat(w.focused_hours) || 0).toFixed(1)),
        Unfocused: Number((parseFloat(w.unfocused_hours ?? w.deep_execution_hours) || 0).toFixed(1)),
        RawMins: Number((parseFloat(c.shoot_raw_minutes) || 0).toFixed(0)),
        FinishedMins: Number((parseFloat(c.edit_finished_minutes) || 0).toFixed(0)),
      }
    })
  }, [filteredWorkLogs, filteredContentLogs])

  // Field Unit Toggle Helper
  const FieldUnitToggle = ({ unit, setUnit }) => (
    <div className="flex items-center bg-black/60 border border-white/10 rounded-md p-0.5 ml-auto">
      <button
        type="button"
        onClick={() => setUnit('h')}
        className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
          unit === 'h' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-muted hover:text-primary'
        }`}
      >
        h
      </button>
      <button
        type="button"
        onClick={() => setUnit('m')}
        className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
          unit === 'm' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-muted hover:text-primary'
        }`}
      >
        m
      </button>
    </div>
  )

  return (
    <AppShell>
      {/* Floating XP Toast */}
      <AnimatePresence>
        {xpToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[99999] bg-[#D4AF37] text-black font-mono font-bold text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-[#D4AF37]/40"
          >
            <Sparkles size={15} />
            <span>{xpToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
        
        {/* ========================================================================= */}
        {/* TOP BAR: HEADER & SUBPAGE TABS */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]">
              <Briefcase size={22} />
            </div>
            <h1 className="font-display text-xl sm:text-2xl tracking-wider text-white font-extrabold uppercase flex items-center gap-2">
              WORK INTELLIGENCE
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:opacity-90 text-black font-mono text-xs font-bold uppercase rounded-xl shadow-lg transition-all active:scale-95 shrink-0 self-start sm:self-auto"
          >
            <Download size={14} />
            <span>Export Intel</span>
          </button>
        </div>

        {/* 3 MAIN SUBPAGE TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('work_log')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap border ${
              activeTab === 'work_log'
                ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37] shadow-lg'
                : 'bg-black/40 border-white/10 text-muted hover:text-primary hover:border-white/20'
            }`}
          >
            <Clock size={14} />
            <span>-01. WORK LOG</span>
            <RotateCcw size={11} className="opacity-70" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('content_ops')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap border ${
              activeTab === 'content_ops'
                ? 'bg-[#00F0FF]/15 border-[#00F0FF] text-[#00F0FF] shadow-lg'
                : 'bg-black/40 border-white/10 text-muted hover:text-primary hover:border-white/20'
            }`}
          >
            <Video size={14} />
            <span>-02. CONTENT OPERATIONS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap border ${
              activeTab === 'analytics'
                ? 'bg-[#22c55e]/15 border-[#22c55e] text-[#22c55e] shadow-lg'
                : 'bg-black/40 border-white/10 text-muted hover:text-primary hover:border-white/20'
            }`}
          >
            <TrendingUp size={14} />
            <span>-03. ANALYTICS</span>
          </button>
        </div>

        {/* DATE SELECTOR ROW */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#D4AF37] uppercase font-bold tracking-widest flex items-center gap-1.5">
              LOG DATE:
            </span>
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-black/80 border border-white/15 rounded-xl px-3.5 py-1.5 font-mono text-sm font-bold text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-4 py-1.5 rounded-xl font-mono text-xs font-bold transition-all border ${
                selectedDate === todayStr ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-black/40 text-muted hover:text-primary border-white/10'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getLocalDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000)))}
              className="px-4 py-1.5 bg-black/40 hover:bg-white/5 border border-white/10 rounded-xl font-mono text-xs text-muted hover:text-primary transition-all font-bold"
            >
              Yesterday
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBPAGE 1: WORK LOG */}
        {/* ========================================================================= */}
        {activeTab === 'work_log' && (
          <div className="space-y-6">

            {/* LOG YOUR WORK FORM SECTION */}
            <HudPanel className="p-5 sm:p-7 space-y-6">
              <form onSubmit={handleSaveWorkLog} className="space-y-6">
                
                {/* SECTION HEADER */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <span className="text-base">📝</span>
                  <h3 className="font-display text-xs uppercase tracking-widest text-white font-extrabold">
                    LOG YOUR WORK
                  </h3>
                </div>

                {/* TYPE OF WORK TAG PILLS */}
                <div className="space-y-2.5">
                  <label className="font-mono text-xs text-muted uppercase font-bold tracking-wider block">
                    TYPE OF WORK
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WORK_TYPE_OPTIONS.map(opt => {
                      const active = workTypes.includes(opt.label)
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setWorkTypes(prev =>
                            prev.includes(opt.label)
                              ? prev.filter(t => t !== opt.label)
                              : [...prev, opt.label]
                          )}
                          className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-bold tracking-wider border transition-all ${
                            active 
                              ? 'bg-black text-white shadow-md' 
                              : 'bg-black/40 text-muted hover:text-primary border-white/10'
                          }`}
                          style={active
                            ? { borderColor: opt.color, color: opt.color, boxShadow: `0 0 12px ${opt.color}30` }
                            : {}
                          }
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* TWO-COLUMN GRID LAYOUT (MATCHING REFERENCE IMAGE) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* LEFT COLUMN: WHAT DID YOU WORK ON & SESSION NOTES (2 COLS) */}
                  <div className="lg:col-span-2 space-y-4">
                    
                    {/* 1. What did you work on? */}
                    <div className="space-y-2">
                      <label className="font-mono text-xs text-muted uppercase font-bold tracking-wider block">
                        What did you work on?
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Describe what you did, wins, learnings, challenges..."
                        value={workWhatDidYouDo}
                        onChange={(e) => setWorkWhatDidYouDo(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl p-3.5 font-mono text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-colors leading-relaxed"
                      />
                    </div>

                    {/* 2. WORK SESSION NOTES (OPTIONAL) */}
                    <div className="space-y-2">
                      <label className="font-mono text-xs text-muted uppercase font-bold tracking-wider block">
                        WORK SESSION NOTES (OPTIONAL)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Add any extra context, thoughts or reflections..."
                        value={workNotes}
                        onChange={(e) => setWorkNotes(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl p-3.5 font-mono text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-colors leading-relaxed"
                      />
                    </div>

                  </div>

                  {/* RIGHT COLUMN: DURATION, FOCUS LEVEL & SAVE BUTTON (1 COL) */}
                  <div className="space-y-5 flex flex-col justify-between">
                    
                    {/* DURATION INPUT */}
                    <div className="space-y-2">
                      <label className="font-mono text-xs text-muted uppercase font-bold tracking-wider flex items-center justify-between">
                        <span>DURATION</span>
                        <FieldUnitToggle unit={unitTotalWorked} setUnit={setUnitTotalWorked} />
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step={unitTotalWorked === 'm' ? '1' : '0.1'}
                          min="0"
                          placeholder="0h 00m"
                          value={valTotalWorked}
                          onChange={(e) => setValTotalWorked(e.target.value)}
                          className="w-full bg-black/70 border border-white/15 rounded-xl p-3 font-mono text-base font-bold text-white focus:outline-none focus:border-[#D4AF37] transition-colors pr-10"
                        />
                        <Clock size={16} className="absolute right-3.5 text-muted pointer-events-none" />
                      </div>
                    </div>

                    {/* FOCUS LEVEL (5 SENTIMENT FACE ICONS) */}
                    <div className="space-y-2">
                      <label className="font-mono text-xs text-muted uppercase font-bold tracking-wider block">
                        FOCUS LEVEL
                      </label>
                      <div className="flex items-center justify-between gap-2 p-2 bg-black/60 border border-white/10 rounded-xl">
                        {FOCUS_LEVEL_OPTIONS.map(opt => {
                          const active = focusLevel === opt.level
                          return (
                            <button
                              key={opt.level}
                              type="button"
                              onClick={() => setFocusLevel(opt.level)}
                              className={`p-2.5 rounded-xl text-xl transition-all flex flex-col items-center gap-1 ${
                                active 
                                  ? 'bg-[#22c55e]/20 border-2 border-[#22c55e] scale-110 shadow-lg' 
                                  : 'opacity-40 hover:opacity-100 hover:bg-white/5'
                              }`}
                            >
                              <span>{opt.emoji}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="text-center font-mono text-[11px] text-[#22c55e] font-bold">
                        {FOCUS_LEVEL_OPTIONS.find(o => o.level === focusLevel)?.label}
                      </div>
                    </div>

                    {/* SAVE BUTTON */}
                    <button
                      type="submit"
                      disabled={savingWork}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#D4AF37] via-[#FBBF24] to-[#B8860B] hover:opacity-95 text-black font-mono text-xs font-extrabold uppercase rounded-xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Save size={16} />
                      <span>{savingWork ? 'SAVING...' : 'SAVE WORK LOG'}</span>
                      <span className="ml-1 px-2 py-0.5 rounded bg-black/20 text-black font-mono text-[10px] font-bold">+2 XP</span>
                    </button>

                  </div>

                </div>

              </form>
            </HudPanel>

            {/* WORK HISTORY SECTION */}
            {(() => {
              const windowEnd = offsetDate(workWeekOffset * 7)
              const windowStart = offsetDate(workWeekOffset * 7 - 6)
              const visibleLogs = nonEmptyWorkLogs.filter(l => l.date >= windowStart && l.date <= windowEnd)
              const hasPrev = nonEmptyWorkLogs.some(l => l.date < windowStart)
              const hasNext = workWeekOffset < 0

              const weekBeyond = visibleLogs.reduce((acc, l) => acc + (parseFloat(l.beyond_tatva_hours) || 0), 0)
              const weekFocused = visibleLogs.reduce((acc, l) => acc + (parseFloat(l.focused_hours) || 0), 0)
              const weekUnfocused = visibleLogs.reduce((acc, l) => acc + (parseFloat(l.unfocused_hours ?? l.deep_execution_hours) || 0), 0)
              const weekTotal = visibleLogs.reduce((acc, l) => acc + (parseFloat(l.total_hours_worked ?? l.duration_hours) || 0), 0)

              return (
                <HudPanel className="p-5 sm:p-6 space-y-4">
                  
                  {/* WORK HISTORY HEADER */}
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <h3 className="font-display text-xs uppercase tracking-widest text-[#D4AF37] font-extrabold flex items-center gap-2">
                      <Clock size={15} />
                      WORK HISTORY
                    </h3>
                    <span className="font-mono text-xs text-muted uppercase font-bold">
                      {visibleLogs.length} LOGS
                    </span>
                  </div>

                  {/* WEEK NAVIGATION BAR */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setWorkWeekOffset(w => w - 1)}
                      disabled={!hasPrev}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                      <span>PREV WEEK</span>
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar size={14} className="text-[#D4AF37] shrink-0" />
                      <span className="font-bold text-white text-xs tracking-wider uppercase truncate">
                        {formatWeekRange(workWeekOffset)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setWorkWeekOffset(w => Math.min(0, w + 1))}
                      disabled={!hasNext}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span>NEXT WEEK</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* SUMMARY METRICS BAR */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-black/40 border border-white/10 text-center font-mono text-xs">
                    <div>
                      <div className="text-muted uppercase text-[9px] font-bold">BEYOND TATVA</div>
                      <div className="text-[#00F0FF] font-bold mt-0.5">{weekBeyond.toFixed(1)}h</div>
                    </div>
                    <div>
                      <div className="text-muted uppercase text-[9px] font-bold">FOCUSED</div>
                      <div className="text-[#22c55e] font-bold mt-0.5">{weekFocused.toFixed(1)}h</div>
                    </div>
                    <div>
                      <div className="text-muted uppercase text-[9px] font-bold">UNFOCUSED</div>
                      <div className="text-[#ef4444] font-bold mt-0.5">{weekUnfocused.toFixed(1)}h</div>
                    </div>
                    <div>
                      <div className="text-muted uppercase text-[9px] font-bold">TOTAL</div>
                      <div className="text-white font-bold mt-0.5">{weekTotal.toFixed(1)}h</div>
                    </div>
                  </div>

                  {/* HISTORY ITEM ROWS */}
                  {visibleLogs.length === 0 ? (
                    <p className="font-mono text-xs text-muted text-center py-8">No work logs recorded for this week.</p>
                  ) : (
                    <div className="space-y-2">
                      {visibleLogs.map((l, idx) => {
                        const tot = (parseFloat(l.total_hours_worked ?? l.duration_hours) || 0).toFixed(1)
                        const logDateObj = new Date(l.date)
                        const monthStr = logDateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                        const dayStr = logDateObj.getDate().toString().padStart(2, '0')
                        const isExpanded = expandedWorkDates.has(l.date) || (expandedWorkDates.size === 0 && idx === 0)

                        const titleText = l.notes 
                          ? l.notes.split('\n')[0].slice(0, 50)
                          : 'Work Session Log'

                        return (
                          <div key={l.date} className="rounded-xl bg-black/60 border border-white/10 overflow-hidden hover:border-[#D4AF37]/40 transition-all">
                            <div 
                              className="p-3.5 flex items-center justify-between gap-3 cursor-pointer"
                              onClick={() => toggleWorkDate(l.date)}
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                {/* Date Badge */}
                                <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-center shrink-0 min-w-[50px]">
                                  <div className="font-mono text-[9px] text-muted font-bold uppercase">{monthStr}</div>
                                  <div className="font-mono text-sm text-white font-extrabold">{dayStr}</div>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="font-mono text-xs font-bold text-white truncate">
                                    {titleText}
                                  </div>
                                  {l.notes && (
                                    <div className="font-mono text-[10px] text-muted truncate mt-0.5">
                                      {l.notes.replace('\n--- WIN/LEARNING ---\n', ' · ')}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono text-xs font-extrabold text-[#D4AF37]">
                                  {tot}h
                                </span>

                                {l.work_type && (
                                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 font-mono text-[9px] text-white font-bold uppercase hidden sm:inline">
                                    {l.work_type.split(',')[0]}
                                  </span>
                                )}

                                <button type="button" className="text-muted hover:text-white p-1">
                                  <MoreHorizontal size={16} />
                                </button>
                              </div>
                            </div>

                            {/* EXPANDED DETAILS */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-white/10 bg-black/40 space-y-3">
                                <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                                  <div className="p-2 rounded-lg bg-black/40 border border-[#00F0FF]/30">
                                    <div className="text-[9px] text-muted uppercase">Beyond Tatva</div>
                                    <div className="text-[#00F0FF] font-bold">{(l.beyond_tatva_hours || 0).toFixed(1)}h</div>
                                  </div>
                                  <div className="p-2 rounded-lg bg-black/40 border border-[#22c55e]/30">
                                    <div className="text-[9px] text-muted uppercase">Focused</div>
                                    <div className="text-[#22c55e] font-bold">{(l.focused_hours || 0).toFixed(1)}h</div>
                                  </div>
                                  <div className="p-2 rounded-lg bg-black/40 border border-[#ef4444]/30">
                                    <div className="text-[9px] text-muted uppercase">Unfocused</div>
                                    <div className="text-[#ef4444] font-bold">{((l.unfocused_hours ?? l.deep_execution_hours) || 0).toFixed(1)}h</div>
                                  </div>
                                </div>
                                {l.notes && (
                                  <div className="font-mono text-xs text-muted leading-relaxed whitespace-pre-line p-2.5 rounded-lg bg-black/30 border border-white/5">
                                    {l.notes}
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        )
                      })}
                    </div>
                  )}

                </HudPanel>
              )
            })()}

          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBPAGE 2: CONTENT OPERATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'content_ops' && (
          <div className="space-y-6">
            
            {/* CONTENT MODE SUB-SWITCHER */}
            <div className="flex items-center gap-2 p-1.5 bg-black/60 border border-white/10 rounded-2xl">
              <button
                type="button"
                onClick={() => setContentMode('shoot')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all ${
                  contentMode === 'shoot' ? 'bg-[#00F0FF] text-black shadow-lg' : 'text-muted hover:text-white'
                }`}
              >
                <Camera size={15} />
                <span>1. Log Video Shoot</span>
              </button>

              <button
                type="button"
                onClick={() => setContentMode('edit')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all ${
                  contentMode === 'edit' ? 'bg-[#D4AF37] text-black shadow-lg' : 'text-muted hover:text-white'
                }`}
              >
                <Scissors size={15} />
                <span>2. Log Video Edit</span>
              </button>
            </div>

            {/* SHOOT LOG FORM */}
            {contentMode === 'shoot' && (
              <HudPanel className="p-5 sm:p-7 space-y-5 border-[#00F0FF]/40">
                <form onSubmit={handleSaveShootLog} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-[#00F0FF] uppercase font-bold flex items-center gap-1.5">
                          <Clock size={14} /> Hours Shot
                        </label>
                        <FieldUnitToggle unit={unitShootHours} setUnit={setUnitShootHours} />
                      </div>
                      <input
                        type="number"
                        step={unitShootHours === 'm' ? '1' : '0.1'}
                        min="0"
                        placeholder="0"
                        value={valShootHours}
                        onChange={(e) => setValShootHours(e.target.value)}
                        className="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 font-mono text-base font-bold text-white focus:outline-none focus:border-[#00F0FF]"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-[#00F0FF] uppercase font-bold flex items-center gap-1.5">
                          <Film size={14} /> Raw Footage (Minutes)
                        </label>
                        <FieldUnitToggle unit={unitShootRaw} setUnit={setUnitShootRaw} />
                      </div>
                      <input
                        type="number"
                        step={unitShootRaw === 'h' ? '0.1' : '1'}
                        min="0"
                        placeholder="0"
                        value={valShootRaw}
                        onChange={(e) => setValShootRaw(e.target.value)}
                        className="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 font-mono text-base font-bold text-white focus:outline-none focus:border-[#00F0FF]"
                      />
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={3}
                      placeholder="Shoot session notes & video title..."
                      value={shootNotes}
                      onChange={(e) => setShootNotes(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-xl p-3.5 font-mono text-xs text-white focus:outline-none focus:border-[#00F0FF]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingShoot}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#00F0FF] hover:opacity-90 text-black font-mono text-xs font-extrabold uppercase rounded-xl shadow-lg transition-all"
                    >
                      <Save size={15} />
                      <span>{savingShoot ? 'SAVING...' : 'SAVE SHOOT LOG (+2 XP)'}</span>
                    </button>
                  </div>
                </form>
              </HudPanel>
            )}

            {/* EDIT LOG FORM */}
            {contentMode === 'edit' && (
              <HudPanel className="p-5 sm:p-7 space-y-5 border-[#D4AF37]/40">
                <form onSubmit={handleSaveEditLog} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-[#D4AF37] uppercase font-bold flex items-center gap-1.5">
                          <Clock size={14} /> Hours Edited
                        </label>
                        <FieldUnitToggle unit={unitEditHours} setUnit={setUnitEditHours} />
                      </div>
                      <input
                        type="number"
                        step={unitEditHours === 'm' ? '1' : '0.1'}
                        min="0"
                        placeholder="0"
                        value={valEditHours}
                        onChange={(e) => setValEditHours(e.target.value)}
                        className="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 font-mono text-base font-bold text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-[#D4AF37] uppercase font-bold flex items-center gap-1.5">
                          <Video size={14} /> Finished Output (Minutes)
                        </label>
                        <FieldUnitToggle unit={unitEditFinished} setUnit={setUnitEditFinished} />
                      </div>
                      <input
                        type="number"
                        step={unitEditFinished === 'h' ? '0.1' : '1'}
                        min="0"
                        placeholder="0"
                        value={valEditFinished}
                        onChange={(e) => setValEditFinished(e.target.value)}
                        className="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 font-mono text-base font-bold text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={3}
                      placeholder="Editing notes, cuts, audio edits..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-xl p-3.5 font-mono text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37] hover:opacity-90 text-black font-mono text-xs font-extrabold uppercase rounded-xl shadow-lg transition-all"
                    >
                      <Save size={15} />
                      <span>{savingEdit ? 'SAVING...' : 'SAVE EDIT LOG (+2 XP)'}</span>
                    </button>
                  </div>
                </form>
              </HudPanel>
            )}

            {/* CONTENT LOG HISTORY */}
            {(() => {
              const windowEnd = offsetDate(contentWeekOffset * 7)
              const windowStart = offsetDate(contentWeekOffset * 7 - 6)
              const visibleLogs = nonEmptyContentLogs.filter(l => l.date >= windowStart && l.date <= windowEnd)
              const hasPrev = nonEmptyContentLogs.some(l => l.date < windowStart)
              const hasNext = contentWeekOffset < 0
              return (
                <HudPanel className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="font-display text-xs uppercase tracking-widest text-[#00F0FF] font-extrabold flex items-center gap-2">
                      <Film size={15} />
                      CONTENT HISTORY
                    </h3>
                    <span className="font-mono text-xs text-muted uppercase font-bold">
                      {visibleLogs.length} LOGS
                    </span>
                  </div>

                  {visibleLogs.length === 0 ? (
                    <p className="font-mono text-xs text-muted text-center py-6">No content logs for this week.</p>
                  ) : (
                    <div className="space-y-2">
                      {visibleLogs.map((l) => (
                        <div key={l.date} className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-3">
                          <div>
                            <span className="font-mono text-xs text-white font-bold">{l.date}</span>
                            {l.notes && <div className="font-mono text-[10px] text-muted">{l.notes}</div>}
                          </div>
                          <div className="flex items-center gap-3 font-mono text-xs font-bold">
                            <span className="text-[#00F0FF]">🎥 {(l.shoot_hours || 0).toFixed(1)}h</span>
                            <span className="text-[#D4AF37]">✂ {(l.edit_hours || 0).toFixed(1)}h</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </HudPanel>
              )
            })()}

          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBPAGE 3: ANALYTICS */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            
            {/* RANGE SELECTOR */}
            <div className="flex items-center justify-between p-3.5 bg-black/60 border border-white/10 rounded-2xl">
              <span className="font-mono text-xs text-muted uppercase font-bold tracking-wider">Analytics Period:</span>
              <div className="flex items-center bg-black border border-white/10 rounded-xl p-1">
                {['7days', '30days', 'all'].map(rangeKey => (
                  <button
                    key={rangeKey}
                    type="button"
                    onClick={() => setAnalyticsRange(rangeKey)}
                    className={`px-4 py-1.5 rounded-lg font-mono text-xs uppercase font-bold transition-all ${
                      analyticsRange === rangeKey ? 'bg-[#D4AF37] text-black shadow-md' : 'text-muted hover:text-white'
                    }`}
                  >
                    {rangeKey === '7days' ? '7 Days' : rangeKey === '30days' ? '30 Days' : 'All Time'}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <HudPanel className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>TOTAL WORKED</span>
                  <Clock size={14} className="text-[#D4AF37]" />
                </div>
                <div className="font-display text-2xl text-white font-extrabold">
                  {totals.totWork.toFixed(1)} h
                </div>
                <div className="font-mono text-[10px] text-muted truncate">
                  Beyond Tatva: {totals.totBeyond.toFixed(1)} h
                </div>
              </HudPanel>

              <HudPanel className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>FOCUS RATIO</span>
                  <Zap size={14} className="text-[#22c55e]" />
                </div>
                <div className="font-display text-2xl text-[#22c55e] font-extrabold">
                  {totals.focusRatio}%
                </div>
                <div className="font-mono text-[10px] text-muted truncate">
                  Focused: {totals.totFocus.toFixed(1)} h
                </div>
              </HudPanel>

              <HudPanel className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>RAW FOOTAGE</span>
                  <Film size={14} className="text-[#00F0FF]" />
                </div>
                <div className="font-display text-2xl text-[#00F0FF] font-extrabold">
                  {totals.totShootRawMins} m
                </div>
                <div className="font-mono text-[10px] text-muted truncate">
                  Shoot: {totals.totShootHrs.toFixed(1)} h
                </div>
              </HudPanel>

              <HudPanel className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>FINISHED VIDEO</span>
                  <Video size={14} className="text-[#D4AF37]" />
                </div>
                <div className="font-display text-2xl text-[#D4AF37] font-extrabold">
                  {totals.totEditFinishedMins} m
                </div>
                <div className="font-mono text-[10px] text-muted truncate">
                  Edit: {totals.totEditHrs.toFixed(1)} h
                </div>
              </HudPanel>
            </div>

            {/* WORK & CONTENT RECHARTS VISUALIZATION */}
            <HudPanel label="WORK & CONTENT EXECUTION TRENDS" glow>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gradWork" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradFocus" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#888" fontSize={11} />
                    <YAxis stroke="#888" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#0a0a0c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontFamily: 'var(--font-mono)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }} />
                    <Area type="monotone" dataKey="Worked" stroke="#D4AF37" fill="url(#gradWork)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Focused" stroke="#22c55e" fill="url(#gradFocus)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </HudPanel>

          </div>
        )}

      </div>

      {/* EXPORT INTEL MODAL */}
      <IntelExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        workLogs={workLogs}
        contentLogs={contentLogs}
      />
    </AppShell>
  )
}
