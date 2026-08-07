'use client'

import React, { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import IntelExportModal from '@/components/ui/IntelExportModal'
import { createClient } from '@/lib/supabase/client'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid 
} from 'recharts'
import { 
  Briefcase, Video, Film, Clock, Calendar, Save, Download, 
  Sparkles, TrendingUp, Target, Zap, AlertTriangle, Scissors, Camera,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight
} from 'lucide-react'

export default function WorkPage() {
  const { auth: { user }, xp: { awardXP } } = useOS()

  // Primary subpage tab: 'work_log' | 'content_ops' | 'analytics'
  const [activeTab, setActiveTab] = useState('work_log')

  // Content Operations sub-mode: 'shoot' | 'edit'
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
  const [workNotes, setWorkNotes] = useState('')
  const [workTypes, setWorkTypes] = useState([]) // selected work type tags
  const [customWorkType, setCustomWorkType] = useState('')

  const WORK_TYPE_OPTIONS = [
    { label: 'Deep Work', color: '#D4AF37' },
    { label: 'Beyond Tatva', color: '#00F0FF' },
    { label: 'Meetings', color: '#A78BFA' },
    { label: 'Admin', color: '#9CA3AF' },
    { label: 'Research', color: '#60A5FA' },
    { label: 'Strategy', color: '#F97316' },
    { label: 'Content', color: '#10B981' },
    { label: 'Editing', color: '#EC4899' },
    { label: 'Learning', color: '#34D399' },
    { label: 'Client Work', color: '#FBBF24' },
  ]

  const [valShootHours, setValShootHours] = useState('')
  const [valShootRaw, setValShootRaw] = useState('')
  const [shootNotes, setShootNotes] = useState('')

  const [valEditHours, setValEditHours] = useState('')
  const [valEditFinished, setValEditFinished] = useState('')
  const [editNotes, setEditNotes] = useState('')

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

  // Helper: get YYYY-MM-DD for a date offset by N days from today
  const offsetDate = (daysOffset) => {
    const d = new Date()
    d.setDate(d.getDate() + daysOffset)
    return getLocalDateStr(d)
  }

  // Date Range Filter for Analytics: '7days' | '30days' | 'all'
  const [analyticsRange, setAnalyticsRange] = useState('30days')

  // ----------------------------------------------------
  // FETCH LOGS (Dual-table fetch + localStorage merge)
  // ----------------------------------------------------
  useEffect(() => {
    if (!user) return

    const fetchAllLogs = async () => {
      const sb = createClient()
      try {
        let fetchedW = []
        const { data: whData, error: whErr } = await sb
          .from('work_hours_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        if (!whErr && whData && whData.length > 0) {
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
      setWorkNotes(w.notes ?? '')
      setWorkTypes(w.work_type ? w.work_type.split(',').map(s => s.trim()).filter(Boolean) : [])
    } else {
      setValTotalWorked('')
      setValBeyondTatva('')
      setValFocused('')
      setValUnfocused('')
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

  // ----------------------------------------------------
  // SAVE WORK LOG ENTRY (BULLETPROOF SYNC & +2 XP REWARD)
  // ----------------------------------------------------
  const handleSaveWorkLog = async (e) => {
    e.preventDefault()
    if (!user) return
    setSavingWork(true)

    const payload = {
      user_id: user.id,
      date: selectedDate,
      total_hours_worked: toHours(valTotalWorked, unitTotalWorked),
      beyond_tatva_hours: toHours(valBeyondTatva, unitBeyondTatva),
      focused_hours: toHours(valFocused, unitFocused),
      unfocused_hours: toHours(valUnfocused, unitUnfocused),
      deep_execution_hours: toHours(valUnfocused, unitUnfocused),
      notes: workNotes || '',
      work_type: workTypes.join(', ')
    }

    // 1. Update local state & localStorage cache immediately for 0ms latency
    const updated = [payload, ...workLogs.filter(l => l.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date))
    setWorkLogs(updated)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_work_logs_cache', JSON.stringify(updated))

    // 2. Sync to Supabase: try work_hours_logs first, fallback to work_logs
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
        const { error: updateErr } = await sb
          .from(targetTable)
          .update({
            total_hours_worked: payload.total_hours_worked,
            beyond_tatva_hours: payload.beyond_tatva_hours,
            focused_hours: payload.focused_hours,
            unfocused_hours: payload.unfocused_hours,
            deep_execution_hours: payload.deep_execution_hours,
            notes: payload.notes,
            work_type: payload.work_type
          })
          .eq('id', existing[0].id)

        if (updateErr) console.error(`Work log update error on ${targetTable}:`, updateErr)
      } else {
        const { data: inserted, error: insertErr } = await sb
          .from(targetTable)
          .insert([payload])
          .select()

        if (insertErr) {
          console.error(`Work log insert error on ${targetTable}:`, insertErr)
          const minimal = {
            user_id: user.id,
            date: selectedDate,
            title: 'Daily Work Hours',
            duration_hours: payload.total_hours_worked,
            notes: payload.notes || ''
          }
          await sb.from('work_logs').insert([minimal])
        } else if (inserted && inserted.length > 0) {
          setWorkLogs(prev => prev.map(l => l.date === selectedDate ? { ...l, id: inserted[0].id } : l))
        }
      }
    } catch (err) {
      console.error('Save work log exception:', err)
    }

    awardXP(2, 'Logged Work Hours')
    setXpToast('+2 XP: Work Log Recorded')
    setTimeout(() => setXpToast(null), 3000)
    setSavingWork(false)
  }

  // ----------------------------------------------------
  // SAVE SHOOT LOG ENTRY (BULLETPROOF SYNC & +2 XP REWARD)
  // ----------------------------------------------------
  const handleSaveShootLog = async (e) => {
    e.preventDefault()
    if (!user) return
    setSavingShoot(true)

    const existing = contentLogs.find(l => l.date === selectedDate) || {}
    const payload = {
      user_id: user.id,
      date: selectedDate,
      shoot_hours: toHours(valShootHours, unitShootHours),
      shoot_raw_minutes: toMinutes(valShootRaw, unitShootRaw),
      edit_hours: parseFloat(existing.edit_hours) || 0,
      edit_finished_minutes: parseFloat(existing.edit_finished_minutes) || 0,
      notes: shootNotes || existing.notes || ''
    }

    const updated = [payload, ...contentLogs.filter(l => l.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date))
    setContentLogs(updated)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_content_logs_cache', JSON.stringify(updated))

    try {
      const sb = createClient()
      const { data: dbExisting } = await sb
        .from('content_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .limit(1)

      if (dbExisting && dbExisting.length > 0) {
        await sb
          .from('content_logs')
          .update({
            shoot_hours: payload.shoot_hours,
            shoot_raw_minutes: payload.shoot_raw_minutes,
            edit_hours: payload.edit_hours,
            edit_finished_minutes: payload.edit_finished_minutes,
            notes: payload.notes
          })
          .eq('id', dbExisting[0].id)
      } else {
        const { data: inserted } = await sb
          .from('content_logs')
          .insert([payload])
          .select()

        if (inserted && inserted.length > 0) {
          setContentLogs(prev => prev.map(l => l.date === selectedDate ? { ...l, id: inserted[0].id } : l))
        }
      }
    } catch (err) {
      console.error('Save shoot log exception:', err)
    }

    awardXP(2, 'Logged Video Shoot')
    setXpToast('+2 XP: Shoot Log Recorded')
    setTimeout(() => setXpToast(null), 3000)
    setSavingShoot(false)
  }

  // ----------------------------------------------------
  // SAVE EDIT LOG ENTRY (BULLETPROOF SYNC & +2 XP REWARD)
  // ----------------------------------------------------
  const handleSaveEditLog = async (e) => {
    e.preventDefault()
    if (!user) return
    setSavingEdit(true)

    const existing = contentLogs.find(l => l.date === selectedDate) || {}
    const payload = {
      user_id: user.id,
      date: selectedDate,
      shoot_hours: parseFloat(existing.shoot_hours) || 0,
      shoot_raw_minutes: parseFloat(existing.shoot_raw_minutes) || 0,
      edit_hours: toHours(valEditHours, unitEditHours),
      edit_finished_minutes: toMinutes(valEditFinished, unitEditFinished),
      notes: editNotes || existing.notes || ''
    }

    const updated = [payload, ...contentLogs.filter(l => l.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date))
    setContentLogs(updated)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_content_logs_cache', JSON.stringify(updated))

    try {
      const sb = createClient()
      const { data: dbExisting } = await sb
        .from('content_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .limit(1)

      if (dbExisting && dbExisting.length > 0) {
        await sb
          .from('content_logs')
          .update({
            shoot_hours: payload.shoot_hours,
            shoot_raw_minutes: payload.shoot_raw_minutes,
            edit_hours: payload.edit_hours,
            edit_finished_minutes: payload.edit_finished_minutes,
            notes: payload.notes
          })
          .eq('id', dbExisting[0].id)
      } else {
        const { data: inserted } = await sb
          .from('content_logs')
          .insert([payload])
          .select()

        if (inserted && inserted.length > 0) {
          setContentLogs(prev => prev.map(l => l.date === selectedDate ? { ...l, id: inserted[0].id } : l))
        }
      }
    } catch (err) {
      console.error('Save edit log exception:', err)
    }

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

  // Inline Unit Toggle Component for Each Individual Field
  const FieldUnitToggle = ({ unit, setUnit }) => (
    <div className="flex items-center bg-tertiary border border-border-color rounded-md p-0.5 ml-auto">
      <button
        type="button"
        onClick={() => setUnit('h')}
        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
          unit === 'h' ? 'bg-amber text-black shadow-sm' : 'text-muted hover:text-primary'
        }`}
      >
        h
      </button>
      <button
        type="button"
        onClick={() => setUnit('m')}
        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
          unit === 'm' ? 'bg-amber text-black shadow-sm' : 'text-muted hover:text-primary'
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
            className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[99999] bg-amber text-black font-mono font-bold text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-amber/40"
          >
            <Sparkles size={15} />
            <span>{xpToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
        {/* HEADER & EXPORT INTEL MODAL TRIGGER */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border-color">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber/10 border border-amber/30 text-amber flex-shrink-0">
              <Briefcase size={20} />
            </div>
            <h1 className="font-display text-lg sm:text-2xl tracking-widest text-primary uppercase">
              WORK INTELLIGENCE
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-md transition-all active:scale-95 shrink-0"
          >
            <Download size={14} />
            <span>Export Intel</span>
          </button>
        </div>

        {/* SUBPAGE NAVIGATION TABS (TOUCH-FRIENDLY & COMPACT) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border-color/60 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('work_log')}
            className={`flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap ${
              activeTab === 'work_log'
                ? 'bg-amber/15 border border-amber text-amber shadow-sm'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <Clock size={14} />
            <span>1. Work Log</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('content_ops')}
            className={`flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap ${
              activeTab === 'content_ops'
                ? 'bg-cyan/15 border border-cyan text-cyan shadow-sm'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <Video size={14} />
            <span>2. Content Operations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-success/15 border border-success text-success shadow-sm'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <TrendingUp size={14} />
            <span>3. Analytics</span>
          </button>
        </div>

        {/* DATE SELECTOR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-bg-secondary/90 border border-white/10 rounded-xl backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <Calendar size={15} className="text-amber flex-shrink-0" />
            <span className="font-mono text-xs text-muted uppercase font-bold">Log Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-primary focus:outline-none focus:border-amber transition-colors"
              style={{ color: '#fff' }}
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all border ${
                selectedDate === todayStr ? 'bg-amber text-black border-amber' : 'bg-black/40 text-muted hover:text-primary border-white/10'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getLocalDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000)))}
              className="px-3 py-1.5 bg-black/40 hover:bg-white/5 border border-white/10 rounded-lg font-mono text-xs text-muted hover:text-primary transition-all"
            >
              Yesterday
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBPAGE 1: WORK LOG */}
        {/* ========================================================================= */}
        {activeTab === 'work_log' && (
          <div className="space-y-5">
            <HudPanel className="p-4 sm:p-6 space-y-5">
              <form onSubmit={handleSaveWorkLog} className="space-y-5">
                {/* 4-COLUMN RESPONSIVE METRIC GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* 1. Total Hours Worked */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 focus-within:border-amber/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-xs text-amber uppercase font-bold flex items-center gap-1.5">
                        <Clock size={13} /> Total Worked
                      </label>
                      <FieldUnitToggle unit={unitTotalWorked} setUnit={setUnitTotalWorked} />
                    </div>
                    <input
                      type="number"
                      step={unitTotalWorked === 'm' ? '1' : '0.1'}
                      min="0"
                      placeholder="0"
                      value={valTotalWorked}
                      onChange={(e) => setValTotalWorked(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 font-mono text-lg font-bold text-primary focus:outline-none focus:border-amber transition-colors"
                      style={{ color: '#fff' }}
                    />
                  </div>

                  {/* 2. Beyond Tatva Hours */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 focus-within:border-cyan/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-xs text-cyan uppercase font-bold flex items-center gap-1.5">
                        <Target size={13} /> Beyond Tatva
                      </label>
                      <FieldUnitToggle unit={unitBeyondTatva} setUnit={setUnitBeyondTatva} />
                    </div>
                    <input
                      type="number"
                      step={unitBeyondTatva === 'm' ? '1' : '0.1'}
                      min="0"
                      placeholder="0"
                      value={valBeyondTatva}
                      onChange={(e) => setValBeyondTatva(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 font-mono text-lg font-bold text-primary focus:outline-none focus:border-cyan transition-colors"
                      style={{ color: '#fff' }}
                    />
                  </div>

                  {/* 3. Focused Hours */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 focus-within:border-success/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-xs text-success uppercase font-bold flex items-center gap-1.5">
                        <Zap size={13} /> Focused
                      </label>
                      <FieldUnitToggle unit={unitFocused} setUnit={setUnitFocused} />
                    </div>
                    <input
                      type="number"
                      step={unitFocused === 'm' ? '1' : '0.1'}
                      min="0"
                      placeholder="0"
                      value={valFocused}
                      onChange={(e) => setValFocused(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 font-mono text-lg font-bold text-primary focus:outline-none focus:border-success transition-colors"
                      style={{ color: '#fff' }}
                    />
                  </div>

                  {/* 4. Unfocused Hours */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 focus-within:border-danger/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-xs text-danger uppercase font-bold flex items-center gap-1.5">
                        <AlertTriangle size={13} /> Unfocused
                      </label>
                      <FieldUnitToggle unit={unitUnfocused} setUnit={setUnitUnfocused} />
                    </div>
                    <input
                      type="number"
                      step={unitUnfocused === 'm' ? '1' : '0.1'}
                      min="0"
                      placeholder="0"
                      value={valUnfocused}
                      onChange={(e) => setValUnfocused(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 font-mono text-lg font-bold text-primary focus:outline-none focus:border-danger transition-colors"
                      style={{ color: '#fff' }}
                    />
                  </div>
                </div>

                <div>
                  {/* TYPE OF WORK — Multi-select tags */}
                  <div className="space-y-2.5 bg-black/20 p-4 rounded-xl border border-white/5">
                    <label className="font-mono text-xs text-purple-400 uppercase font-bold flex items-center gap-1.5">
                      <Sparkles size={13} /> Type of Work
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
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider border transition-all ${
                              active ? 'text-black shadow-md' : 'text-muted hover:text-primary bg-black/40'
                            }`}
                            style={active
                              ? { background: opt.color, borderColor: opt.color }
                              : { borderColor: `${opt.color}40` }
                            }
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                    {/* Custom type input */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={customWorkType}
                        onChange={e => setCustomWorkType(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customWorkType.trim()) {
                            e.preventDefault()
                            const val = customWorkType.trim()
                            if (!workTypes.includes(val)) setWorkTypes(prev => [...prev, val])
                            setCustomWorkType('')
                          }
                        }}
                        placeholder="Custom type... (press Enter)"
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-primary focus:outline-none focus:border-purple-400 transition-colors"
                        style={{ color: '#fff' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = customWorkType.trim()
                          if (val && !workTypes.includes(val)) setWorkTypes(prev => [...prev, val])
                          setCustomWorkType('')
                        }}
                        className="px-4 py-1.5 bg-purple-500/20 border border-purple-500/40 rounded-lg font-mono text-xs text-purple-300 hover:bg-purple-500/30 transition-all font-bold"
                      >
                        + Add
                      </button>
                    </div>
                    {workTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                        {workTypes.map(t => (
                          <span
                            key={t}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 border border-purple-400/40 font-mono text-xs text-purple-300 font-bold"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() => setWorkTypes(prev => prev.filter(x => x !== t))}
                              className="text-purple-400 hover:text-danger ml-0.5 font-bold"
                            >×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <textarea
                    rows={3}
                    placeholder="Work session notes..."
                    value={workNotes}
                    onChange={(e) => setWorkNotes(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-xs text-primary focus:outline-none focus:border-amber transition-colors"
                    style={{ color: '#fff' }}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingWork}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Save size={15} />
                    <span>{savingWork ? 'Saving...' : 'Save Work Log (+2 XP)'}</span>
                  </button>
                </div>
              </form>
            </HudPanel>

            {/* RECENT WORK LOGS (DROPDOWN ACCORDION MENU) */}
            {(() => {
              const windowEnd = offsetDate(workWeekOffset * 7)
              const windowStart = offsetDate(workWeekOffset * 7 - 6)
              const visibleLogs = nonEmptyWorkLogs.filter(l => l.date >= windowStart && l.date <= windowEnd)
              const hasPrev = nonEmptyWorkLogs.some(l => l.date < windowStart)
              const hasNext = workWeekOffset < 0
              return (
                <HudPanel className="p-3.5 sm:p-5 space-y-3">
                  {/* Clean Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
                    <h3 className="font-display text-xs uppercase tracking-widest text-amber font-bold flex items-center gap-2">
                      <Briefcase size={13} />
                      Work History
                    </h3>
                    <span className="font-mono text-[10px] text-muted uppercase">
                      {visibleLogs.length} LOG{visibleLogs.length !== 1 ? 'S' : ''}
                    </span>
                  </div>

                  {/* Dedicated Week Navigation Bar */}
                  <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setWorkWeekOffset(w => w - 1)}
                      disabled={!hasPrev}
                      className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-primary font-bold text-[10px] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={13} />
                      <span>Prev Week</span>
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-amber text-[11px] tracking-wider uppercase truncate">
                        {windowStart.slice(5).replace('-', '/')} – {windowEnd.slice(5).replace('-', '/')}
                      </span>
                      {workWeekOffset < 0 && (
                        <button
                          type="button"
                          onClick={() => setWorkWeekOffset(0)}
                          className="px-2 py-0.5 rounded bg-amber/20 border border-amber/40 text-amber text-[9px] font-bold uppercase hover:bg-amber/30 transition-all shrink-0"
                        >
                          CURRENT
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setWorkWeekOffset(w => Math.min(0, w + 1))}
                      disabled={!hasNext}
                      className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-primary font-bold text-[10px] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span>Next Week</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  {visibleLogs.length === 0 ? (
                    <p className="font-mono text-[10px] text-muted text-center py-6">No logs for this week.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {visibleLogs.map((l, idx) => {
                        const tot = (parseFloat(l.total_hours_worked ?? l.duration_hours) || 0).toFixed(1)
                        const isExpanded = expandedWorkDates.has(l.date) || (expandedWorkDates.size === 0 && idx === 0)
                        return (
                          <div key={l.date} className="rounded-lg bg-bg-primary border border-border-color overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleWorkDate(l.date)}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.03] transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="font-mono text-[10px] text-secondary font-bold shrink-0">{l.date}</span>
                                <span className="font-mono text-[9px] text-cyan truncate hidden sm:inline">
                                  {(l.beyond_tatva_hours || 0).toFixed(1)}h beyond
                                </span>
                                {l.notes && (
                                  <span className="font-mono text-[9px] text-muted truncate hidden md:inline">
                                    · {l.notes.slice(0, 40)}{l.notes.length > 40 ? '…' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-[10px] text-amber font-bold">{tot}h</span>
                                {isExpanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-3.5 pb-3 pt-1 border-t border-border-subtle/40 bg-black/20 space-y-2">
                                <div className="flex gap-2 text-center">
                                  <div className="flex-1 py-2 rounded-lg bg-bg-primary border border-cyan/20">
                                    <div className="font-mono text-[8px] text-muted uppercase tracking-wider">Beyond</div>
                                    <div className="font-mono text-sm text-cyan font-bold">{(l.beyond_tatva_hours || 0).toFixed(1)}h</div>
                                  </div>
                                  <div className="flex-1 py-2 rounded-lg bg-bg-primary border border-success/20">
                                    <div className="font-mono text-[8px] text-muted uppercase tracking-wider">Focused</div>
                                    <div className="font-mono text-sm text-success font-bold">{(l.focused_hours || 0).toFixed(1)}h</div>
                                  </div>
                                  <div className="flex-1 py-2 rounded-lg bg-bg-primary border border-danger/20">
                                    <div className="font-mono text-[8px] text-muted uppercase tracking-wider">Unfocused</div>
                                    <div className="font-mono text-sm text-danger font-bold">{((l.unfocused_hours ?? l.deep_execution_hours) || 0).toFixed(1)}h</div>
                                  </div>
                                </div>
                                {l.notes && (
                                  <div className="font-mono text-[10px] text-muted leading-relaxed pt-1 border-t border-border-subtle/30">{l.notes}</div>
                                )}
                                {l.work_type && (
                                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border-subtle/30">
                                    <span className="font-mono text-[9px] text-muted uppercase">Type:</span>
                                    {l.work_type.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                                      <span key={t} className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 font-mono text-[9px] text-purple-300">{t}</span>
                                    ))}
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
          <div className="space-y-5">
            {/* CONTENT MODE SUB-SWITCHER */}
            <div className="flex items-center gap-2 p-1 bg-tertiary border border-border-color rounded-xl">
              <button
                type="button"
                onClick={() => setContentMode('shoot')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono text-xs uppercase font-bold transition-all ${
                  contentMode === 'shoot' ? 'bg-cyan text-black shadow-md' : 'text-muted hover:text-primary'
                }`}
              >
                <Camera size={14} />
                <span>1. Log Shoot</span>
              </button>

              <button
                type="button"
                onClick={() => setContentMode('edit')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono text-xs uppercase font-bold transition-all ${
                  contentMode === 'edit' ? 'bg-amber text-black shadow-md' : 'text-muted hover:text-primary'
                }`}
              >
                <Scissors size={14} />
                <span>2. Log Edit</span>
              </button>
            </div>

            {/* SEPARATE FORM 1: SHOOT LOG */}
            {contentMode === 'shoot' && (
              <HudPanel className="p-3.5 sm:p-5 space-y-4 border-cyan/40">
                <form onSubmit={handleSaveShootLog} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-cyan uppercase font-bold flex items-center gap-1.5">
                          <Clock size={12} /> Hours Shot
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
                        className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-cyan"
                        style={{ background: '#141824', color: '#fff' }}
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-cyan uppercase font-bold flex items-center gap-1.5">
                          <Film size={12} /> Raw Footage
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
                        className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-cyan"
                        style={{ background: '#141824', color: '#fff' }}
                      />
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      placeholder="Notes..."
                      value={shootNotes}
                      onChange={(e) => setShootNotes(e.target.value)}
                      className="w-full bg-secondary border border-border-color rounded-xl p-2.5 font-mono text-xs text-primary focus:outline-none focus:border-cyan"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingShoot}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan hover:bg-cyan-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Save size={15} />
                      <span>{savingShoot ? 'Saving...' : 'Save Shoot Log (+2 XP)'}</span>
                    </button>
                  </div>
                </form>
              </HudPanel>
            )}

            {/* SEPARATE FORM 2: EDIT LOG */}
            {contentMode === 'edit' && (
              <HudPanel className="p-3.5 sm:p-5 space-y-4 border-amber/40">
                <form onSubmit={handleSaveEditLog} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-amber uppercase font-bold flex items-center gap-1.5">
                          <Clock size={12} /> Hours Edited
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
                        className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                        style={{ background: '#141824', color: '#fff' }}
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-amber uppercase font-bold flex items-center gap-1.5">
                          <Video size={12} /> Finished Output
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
                        className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                        style={{ background: '#141824', color: '#fff' }}
                      />
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      placeholder="Notes..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full bg-secondary border border-border-color rounded-xl p-2.5 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Save size={15} />
                      <span>{savingEdit ? 'Saving...' : 'Save Edit Log (+2 XP)'}</span>
                    </button>
                  </div>
                </form>
              </HudPanel>
            )}

            {/* CONTENT LOG HISTORY (DROPDOWN ACCORDION MENU) */}
            {(() => {
              const windowEnd = offsetDate(contentWeekOffset * 7)
              const windowStart = offsetDate(contentWeekOffset * 7 - 6)
              const visibleLogs = nonEmptyContentLogs.filter(l => l.date >= windowStart && l.date <= windowEnd)
              const hasPrev = nonEmptyContentLogs.some(l => l.date < windowStart)
              const hasNext = contentWeekOffset < 0
              return (
                <HudPanel className="p-3.5 sm:p-5 space-y-3">
                  {/* Clean Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
                    <h3 className="font-display text-xs uppercase tracking-widest text-cyan font-bold flex items-center gap-2">
                      <Film size={13} />
                      Content History
                    </h3>
                    <span className="font-mono text-[10px] text-muted uppercase">
                      {visibleLogs.length} LOG{visibleLogs.length !== 1 ? 'S' : ''}
                    </span>
                  </div>

                  {/* Dedicated Week Navigation Bar */}
                  <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setContentWeekOffset(w => w - 1)}
                      disabled={!hasPrev}
                      className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-primary font-bold text-[10px] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={13} />
                      <span>Prev Week</span>
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-cyan text-[11px] tracking-wider uppercase truncate">
                        {windowStart.slice(5).replace('-', '/')} – {windowEnd.slice(5).replace('-', '/')}
                      </span>
                      {contentWeekOffset < 0 && (
                        <button
                          type="button"
                          onClick={() => setContentWeekOffset(0)}
                          className="px-2 py-0.5 rounded bg-cyan/20 border border-cyan/40 text-cyan text-[9px] font-bold uppercase hover:bg-cyan/30 transition-all shrink-0"
                        >
                          CURRENT
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setContentWeekOffset(w => Math.min(0, w + 1))}
                      disabled={!hasNext}
                      className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-primary font-bold text-[10px] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span>Next Week</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  {visibleLogs.length === 0 ? (
                    <p className="font-mono text-[10px] text-muted text-center py-6">No logs for this week.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {visibleLogs.map((l, idx) => {
                        const editHrs = parseFloat(l.edit_hours) || 0
                        const finMins = parseFloat(l.edit_finished_minutes) || 0
                        const ratio = finMins > 0 ? ((editHrs * 60) / finMins).toFixed(1) : '—'
                        const isExpanded = expandedContentDates.has(l.date) || (expandedContentDates.size === 0 && idx === 0)
                        return (
                          <div key={l.date} className="rounded-lg bg-bg-primary border border-border-color overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleContentDate(l.date)}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.03] transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="font-mono text-[10px] text-secondary font-bold shrink-0">{l.date}</span>
                                <span className="font-mono text-[9px] text-amber truncate hidden sm:inline">
                                  ✂ {(l.edit_hours || 0).toFixed(1)}h edit
                                </span>
                                {l.notes && (
                                  <span className="font-mono text-[9px] text-muted truncate hidden md:inline">
                                    · {l.notes.slice(0, 40)}{l.notes.length > 40 ? '…' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-[9px] text-cyan font-bold">{ratio} m/m</span>
                                {isExpanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-3.5 pb-3 pt-1 border-t border-border-subtle/40 bg-black/20 space-y-2">
                                <div className="flex gap-2 text-center">
                                  <div className="flex-1 py-2 rounded-lg bg-bg-primary border border-cyan/20">
                                    <div className="font-mono text-[8px] text-muted uppercase tracking-wider">🎥 Shoot</div>
                                    <div className="font-mono text-sm text-cyan font-bold">{(l.shoot_hours || 0).toFixed(1)}h</div>
                                    <div className="font-mono text-[8px] text-muted">{l.shoot_raw_minutes || 0}m raw</div>
                                  </div>
                                  <div className="flex-1 py-2 rounded-lg bg-bg-primary border border-amber/20">
                                    <div className="font-mono text-[8px] text-muted uppercase tracking-wider">✂ Edit</div>
                                    <div className="font-mono text-sm text-amber font-bold">{(l.edit_hours || 0).toFixed(1)}h</div>
                                    <div className="font-mono text-[8px] text-muted">{l.edit_finished_minutes || 0}m out</div>
                                  </div>
                                </div>
                                {l.notes && (
                                  <div className="font-mono text-[10px] text-muted leading-relaxed pt-1 border-t border-border-subtle/30">{l.notes}</div>
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
        {/* SUBPAGE 3: ANALYTICS */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {/* RANGE SELECTOR */}
            <div className="flex items-center justify-between p-3 bg-tertiary border border-border-color rounded-xl">
              <span className="font-mono text-xs text-secondary uppercase font-bold">Analytics Period:</span>
              <div className="flex items-center bg-secondary border border-border-color rounded-lg p-0.5">
                {['7days', '30days', 'all'].map(rangeKey => (
                  <button
                    key={rangeKey}
                    type="button"
                    onClick={() => setAnalyticsRange(rangeKey)}
                    className={`px-3 py-1 rounded font-mono text-xs uppercase font-bold transition-all ${
                      analyticsRange === rangeKey ? 'bg-amber text-black shadow-sm' : 'text-muted hover:text-primary'
                    }`}
                  >
                    {rangeKey === '7days' ? '7 Days' : rangeKey === '30days' ? '30 Days' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
              <HudPanel className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>TOTAL WORKED</span>
                  <Clock size={13} className="text-amber" />
                </div>
                <div className="font-display text-xl sm:text-2xl text-amber font-bold">
                  {totals.totWork.toFixed(1)} h
                </div>
                <div className="font-mono text-[9px] sm:text-[10px] text-muted truncate">
                  BT: {totals.totBeyond.toFixed(1)} h ({totals.beyondRatio}%)
                </div>
              </HudPanel>

              <HudPanel className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>FOCUS RATIO</span>
                  <Zap size={13} className="text-success" />
                </div>
                <div className="font-display text-xl sm:text-2xl text-success font-bold">
                  {totals.focusRatio}%
                </div>
                <div className="font-mono text-[9px] sm:text-[10px] text-muted truncate">
                  Focus: {totals.totFocus.toFixed(1)} h
                </div>
              </HudPanel>

              <HudPanel className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>RAW FOOTAGE</span>
                  <Film size={13} className="text-cyan" />
                </div>
                <div className="font-display text-xl sm:text-2xl text-cyan font-bold">
                  {totals.totShootRawMins} m
                </div>
                <div className="font-mono text-[9px] sm:text-[10px] text-muted truncate">
                  Shoot: {totals.totShootHrs.toFixed(1)} h
                </div>
              </HudPanel>

              <HudPanel className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>FINISHED VIDEO</span>
                  <Video size={13} className="text-amber" />
                </div>
                <div className="font-display text-xl sm:text-2xl text-amber font-bold">
                  {totals.totEditFinishedMins} m
                </div>
                <div className="font-mono text-[9px] sm:text-[10px] text-muted truncate">
                  Speed: {totals.editRatio} m/m
                </div>
              </HudPanel>
            </div>

            {/* RECHARTS CHART 1: WORK ALLOCATION */}
            <HudPanel className="p-3.5 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border-color">
                <div className="flex items-center gap-2 text-amber font-display text-xs uppercase">
                  <TrendingUp size={14} />
                  <span>Work Hours Allocation (Hours)</span>
                </div>
              </div>

              {chartData.length === 0 ? (
                <p className="font-mono text-xs text-muted text-center py-6">No data for selected period.</p>
              ) : (
                <div className="h-56 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradWorked" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gradBeyond" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gradFocused" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gradUnfocused" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262B3D" />
                      <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#12151E', borderColor: '#262B3D', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                      <Area type="monotone" dataKey="Worked" stroke="#D4AF37" fillOpacity={1} fill="url(#gradWorked)" name="Total Worked" />
                      <Area type="monotone" dataKey="BeyondTatva" stroke="#00F0FF" fillOpacity={1} fill="url(#gradBeyond)" name="Beyond Tatva" />
                      <Area type="monotone" dataKey="Focused" stroke="#10B981" fillOpacity={1} fill="url(#gradFocused)" name="Focused" />
                      <Area type="monotone" dataKey="Unfocused" stroke="#EF4444" fillOpacity={1} fill="url(#gradUnfocused)" name="Unfocused" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </HudPanel>

            {/* RECHARTS CHART 2: CONTENT VELOCITY */}
            <HudPanel className="p-3.5 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border-color">
                <div className="flex items-center gap-2 text-cyan font-display text-xs uppercase">
                  <Video size={14} />
                  <span>Content Velocity (Raw vs Finished Minutes)</span>
                </div>
              </div>

              {chartData.length === 0 ? (
                <p className="font-mono text-xs text-muted text-center py-6">No data for selected period.</p>
              ) : (
                <div className="h-56 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262B3D" />
                      <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#12151E', borderColor: '#262B3D', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                      <Bar dataKey="RawMins" fill="#00F0FF" radius={[4, 4, 0, 0]} name="Raw Footage (m)" />
                      <Bar dataKey="FinishedMins" fill="#D4AF37" radius={[4, 4, 0, 0]} name="Finished Output (m)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </HudPanel>
          </div>
        )}
      </div>

      {/* INTEL EXPORT MODAL */}
      <IntelExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </AppShell>
  )
}
