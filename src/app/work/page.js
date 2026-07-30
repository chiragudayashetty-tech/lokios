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
  Sparkles, TrendingUp, Target, Zap, AlertTriangle, Scissors, Camera
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
  // Work Log Units
  const [unitTotalWorked, setUnitTotalWorked] = useState('h')
  const [unitBeyondTatva, setUnitBeyondTatva] = useState('h')
  const [unitFocused, setUnitFocused] = useState('h')
  const [unitUnfocused, setUnitUnfocused] = useState('h')

  // Shoot Units
  const [unitShootHours, setUnitShootHours] = useState('h')
  const [unitShootRaw, setUnitShootRaw] = useState('m')

  // Edit Units
  const [unitEditHours, setUnitEditHours] = useState('h')
  const [unitEditFinished, setUnitEditFinished] = useState('m')

  // ----------------------------------------------------
  // FORM INPUT VALUES (Stored in their respective selected units)
  // ----------------------------------------------------
  const [valTotalWorked, setValTotalWorked] = useState('')
  const [valBeyondTatva, setValBeyondTatva] = useState('')
  const [valFocused, setValFocused] = useState('')
  const [valUnfocused, setValUnfocused] = useState('')
  const [workNotes, setWorkNotes] = useState('')

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

  // Date Range Filter for Analytics: '7days' | '30days' | 'all'
  const [analyticsRange, setAnalyticsRange] = useState('30days')

  // ----------------------------------------------------
  // FETCH LOGS (Supabase + localStorage fallback)
  // ----------------------------------------------------
  useEffect(() => {
    if (!user) return

    const fetchAllLogs = async () => {
      const sb = createClient()
      try {
        const { data: wData } = await sb
          .from('work_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        const { data: cData } = await sb
          .from('content_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        if (wData) {
          setWorkLogs(wData)
          if (typeof window !== 'undefined') localStorage.setItem('lokios_work_logs_cache', JSON.stringify(wData))
        } else if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('lokios_work_logs_cache')
          if (cached) setWorkLogs(JSON.parse(cached))
        }

        if (cData) {
          setContentLogs(cData)
          if (typeof window !== 'undefined') localStorage.setItem('lokios_content_logs_cache', JSON.stringify(cData))
        } else if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('lokios_content_logs_cache')
          if (cached) setContentLogs(JSON.parse(cached))
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
      setValTotalWorked(toInputValue(w.total_hours_worked, unitTotalWorked))
      setValBeyondTatva(toInputValue(w.beyond_tatva_hours, unitBeyondTatva))
      setValFocused(toInputValue(w.focused_hours, unitFocused))
      setValUnfocused(toInputValue(w.unfocused_hours ?? w.deep_execution_hours, unitUnfocused))
      setWorkNotes(w.notes ?? '')
    } else {
      setValTotalWorked('')
      setValBeyondTatva('')
      setValFocused('')
      setValUnfocused('')
      setWorkNotes('')
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

  // Converts any input value + unit back into Hours for DB storage
  const toHours = (val, unit) => {
    const num = parseFloat(val) || 0
    if (unit === 'm') return num / 60
    return num
  }

  // Converts any input value + unit back into Minutes for DB storage
  const toMinutes = (val, unit) => {
    const num = parseFloat(val) || 0
    if (unit === 'h') return num * 60
    return num
  }

  // ----------------------------------------------------
  // SAVE WORK LOG ENTRY (+2 XP REWARD)
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
      notes: workNotes || ''
    }

    const updated = [payload, ...workLogs.filter(l => l.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date))
    setWorkLogs(updated)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_work_logs_cache', JSON.stringify(updated))

    try {
      const sb = createClient()
      await sb.from('work_logs').upsert(payload, { onConflict: 'user_id,date' })
    } catch (err) {}

    awardXP(2, 'Logged Work Hours')
    setXpToast('+2 XP: Work Log Recorded')
    setTimeout(() => setXpToast(null), 3000)
    setSavingWork(false)
  }

  // ----------------------------------------------------
  // SAVE SHOOT LOG ENTRY (+2 XP REWARD)
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
      await sb.from('content_logs').upsert(payload, { onConflict: 'user_id,date' })
    } catch (err) {}

    awardXP(2, 'Logged Video Shoot')
    setXpToast('+2 XP: Shoot Log Recorded')
    setTimeout(() => setXpToast(null), 3000)
    setSavingShoot(false)
  }

  // ----------------------------------------------------
  // SAVE EDIT LOG ENTRY (+2 XP REWARD)
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
      await sb.from('content_logs').upsert(payload, { onConflict: 'user_id,date' })
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
    const totWork = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.total_hours_worked) || 0), 0)
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
        Worked: Number((parseFloat(w.total_hours_worked) || 0).toFixed(1)),
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
    <div className="flex items-center bg-tertiary border border-border-color rounded-lg p-0.5 ml-auto">
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

      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* HEADER & EXPORT INTEL MODAL TRIGGER */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-border-color">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber/10 border border-amber/30 text-amber flex-shrink-0">
              <Briefcase size={22} />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl tracking-widest text-primary uppercase">
                WORK INTELLIGENCE
              </h1>
            </div>
          </div>

          {/* Trigger Global Intel Export Modal */}
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-md transition-all active:scale-95"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Export Intel</span>
          </button>
        </div>

        {/* SUBPAGE NAVIGATION TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border-color/60 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('work_log')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap ${
              activeTab === 'work_log'
                ? 'bg-amber/15 border border-amber text-amber shadow-sm'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <Clock size={15} />
            <span>1. Work Log</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('content_ops')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap ${
              activeTab === 'content_ops'
                ? 'bg-cyan/15 border border-cyan text-cyan shadow-sm'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <Video size={15} />
            <span>2. Content Operations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-success/15 border border-success text-success shadow-sm'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <TrendingUp size={15} />
            <span>3. Analytics</span>
          </button>
        </div>

        {/* DATE SELECTOR */}
        <div className="flex items-center justify-between gap-3 p-3 bg-tertiary border border-border-color rounded-xl">
          <div className="flex items-center gap-2.5">
            <Calendar size={16} className="text-amber flex-shrink-0" />
            <span className="font-mono text-xs text-secondary uppercase font-bold">Log Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-secondary border border-border-color rounded-lg px-2.5 py-1 font-mono text-xs text-primary focus:outline-none focus:border-amber"
              style={{ background: '#121520', color: '#fff' }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-colors ${
                selectedDate === todayStr ? 'bg-amber text-black font-bold' : 'bg-secondary text-muted hover:text-primary border border-border-subtle'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getLocalDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000)))}
              className="px-2.5 py-1 bg-secondary hover:bg-hover border border-border-subtle rounded-lg font-mono text-xs text-muted hover:text-primary transition-colors"
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
            <HudPanel className="p-4 sm:p-5">
              <form onSubmit={handleSaveWorkLog} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 1. Total Hours Worked */}
                  <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
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
                      placeholder={unitTotalWorked === 'm' ? 'e.g. 510' : 'e.g. 8.5'}
                      value={valTotalWorked}
                      onChange={(e) => setValTotalWorked(e.target.value)}
                      className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                  </div>

                  {/* 2. Beyond Tatva Hours */}
                  <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
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
                      placeholder={unitBeyondTatva === 'm' ? 'e.g. 240' : 'e.g. 4.0'}
                      value={valBeyondTatva}
                      onChange={(e) => setValBeyondTatva(e.target.value)}
                      className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-cyan"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                  </div>

                  {/* 3. Focused Hours */}
                  <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
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
                      placeholder={unitFocused === 'm' ? 'e.g. 330' : 'e.g. 5.5'}
                      value={valFocused}
                      onChange={(e) => setValFocused(e.target.value)}
                      className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-success"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                  </div>

                  {/* 4. Unfocused / Distracted Hours */}
                  <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
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
                      placeholder={unitUnfocused === 'm' ? 'e.g. 90' : 'e.g. 1.5'}
                      value={valUnfocused}
                      onChange={(e) => setValUnfocused(e.target.value)}
                      className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-danger"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <textarea
                    rows={2}
                    placeholder="Work summary notes (optional)..."
                    value={workNotes}
                    onChange={(e) => setWorkNotes(e.target.value)}
                    className="w-full bg-secondary border border-border-color rounded-xl p-2.5 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                    style={{ background: '#141824', color: '#fff' }}
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingWork}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Save size={15} />
                    <span>{savingWork ? 'Saving...' : 'Save Work Log (+2 XP)'}</span>
                  </button>
                </div>
              </form>
            </HudPanel>

            {/* RECENT WORK LOGS */}
            <HudPanel className="p-4 sm:p-5">
              <h3 className="font-display text-xs uppercase tracking-wider text-muted mb-3">
                RECENT WORK HISTORY ({workLogs.length})
              </h3>

              {workLogs.length === 0 ? (
                <p className="font-mono text-xs text-muted text-center py-4">No work logs recorded yet.</p>
              ) : (
                <>
                  {/* Mobile Card View (< 768px) */}
                  <div className="md:hidden space-y-2.5">
                    {workLogs.map(l => (
                      <div key={l.date} className="p-3 rounded-xl bg-tertiary border border-border-color space-y-2">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="text-secondary font-bold">{l.date}</span>
                          <span className="text-amber font-bold">{(l.total_hours_worked || 0).toFixed(1)}h Worked</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1.5 border-t border-border-subtle/40">
                          <div>
                            <span className="text-muted block text-[9px] uppercase">Beyond</span>
                            <span className="text-cyan">{(l.beyond_tatva_hours || 0).toFixed(1)}h</span>
                          </div>
                          <div>
                            <span className="text-muted block text-[9px] uppercase">Focused</span>
                            <span className="text-success">{(l.focused_hours || 0).toFixed(1)}h</span>
                          </div>
                          <div>
                            <span className="text-muted block text-[9px] uppercase">Unfocused</span>
                            <span className="text-danger font-bold">{((l.unfocused_hours ?? l.deep_execution_hours) || 0).toFixed(1)}h</span>
                          </div>
                        </div>
                        {l.notes && <p className="font-mono text-[11px] text-muted italic pt-1">{l.notes}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border-color text-muted uppercase text-[10px]">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Total Worked</th>
                          <th className="py-2 px-3">Beyond Tatva</th>
                          <th className="py-2 px-3">Focused</th>
                          <th className="py-2 px-3">Unfocused</th>
                          <th className="py-2 px-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workLogs.map(l => (
                          <tr key={l.date} className="border-b border-border-subtle/50 hover:bg-tertiary/50 transition-colors">
                            <td className="py-2.5 px-3 text-secondary">{l.date}</td>
                            <td className="py-2.5 px-3"><strong className="text-amber">{(l.total_hours_worked || 0).toFixed(1)} h</strong></td>
                            <td className="py-2.5 px-3 text-cyan">{(l.beyond_tatva_hours || 0).toFixed(1)} h</td>
                            <td className="py-2.5 px-3 text-success">{(l.focused_hours || 0).toFixed(1)} h</td>
                            <td className="py-2.5 px-3 text-danger font-bold">{((l.unfocused_hours ?? l.deep_execution_hours) || 0).toFixed(1)} h</td>
                            <td className="py-2.5 px-3 text-muted max-w-xs truncate">{l.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </HudPanel>
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
                <Camera size={15} />
                <span>1. Log Shoot</span>
              </button>

              <button
                type="button"
                onClick={() => setContentMode('edit')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono text-xs uppercase font-bold transition-all ${
                  contentMode === 'edit' ? 'bg-amber text-black shadow-md' : 'text-muted hover:text-primary'
                }`}
              >
                <Scissors size={15} />
                <span>2. Log Edit</span>
              </button>
            </div>

            {/* SEPARATE FORM 1: SHOOT LOG */}
            {contentMode === 'shoot' && (
              <HudPanel className="p-4 sm:p-5 border-cyan/40">
                <form onSubmit={handleSaveShootLog} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Hours Shot */}
                    <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-cyan uppercase font-bold flex items-center gap-1.5">
                          <Clock size={13} /> Hours Shot
                        </label>
                        <FieldUnitToggle unit={unitShootHours} setUnit={setUnitShootHours} />
                      </div>
                      <input
                        type="number"
                        step={unitShootHours === 'm' ? '1' : '0.1'}
                        min="0"
                        placeholder={unitShootHours === 'm' ? 'e.g. 150' : 'e.g. 2.5'}
                        value={valShootHours}
                        onChange={(e) => setValShootHours(e.target.value)}
                        className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-cyan"
                        style={{ background: '#141824', color: '#fff' }}
                      />
                    </div>

                    {/* Raw Footage Shot */}
                    <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-cyan uppercase font-bold flex items-center gap-1.5">
                          <Film size={13} /> Raw Footage Shot
                        </label>
                        <FieldUnitToggle unit={unitShootRaw} setUnit={setUnitShootRaw} />
                      </div>
                      <input
                        type="number"
                        step={unitShootRaw === 'h' ? '0.1' : '1'}
                        min="0"
                        placeholder={unitShootRaw === 'h' ? 'e.g. 2.0' : 'e.g. 120'}
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
                      placeholder="Shoot production notes (optional)..."
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
              <HudPanel className="p-4 sm:p-5 border-amber/40">
                <form onSubmit={handleSaveEditLog} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Hours Edited */}
                    <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-amber uppercase font-bold flex items-center gap-1.5">
                          <Clock size={13} /> Hours Edited
                        </label>
                        <FieldUnitToggle unit={unitEditHours} setUnit={setUnitEditHours} />
                      </div>
                      <input
                        type="number"
                        step={unitEditHours === 'm' ? '1' : '0.1'}
                        min="0"
                        placeholder={unitEditHours === 'm' ? 'e.g. 240' : 'e.g. 4.0'}
                        value={valEditHours}
                        onChange={(e) => setValEditHours(e.target.value)}
                        className="w-full bg-tertiary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                        style={{ background: '#141824', color: '#fff' }}
                      />
                    </div>

                    {/* Finished Video Edited */}
                    <div className="p-3 rounded-xl bg-secondary border border-border-color space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-amber uppercase font-bold flex items-center gap-1.5">
                          <Video size={13} /> Finished Video Output
                        </label>
                        <FieldUnitToggle unit={unitEditFinished} setUnit={setUnitEditFinished} />
                      </div>
                      <input
                        type="number"
                        step={unitEditFinished === 'h' ? '0.1' : '1'}
                        min="0"
                        placeholder={unitEditFinished === 'h' ? 'e.g. 0.2' : 'e.g. 5'}
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
                      placeholder="Edit production notes (optional)..."
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

            {/* CONTENT LOG HISTORY */}
            <HudPanel className="p-4 sm:p-5">
              <h3 className="font-display text-xs uppercase tracking-wider text-muted mb-3">
                CONTENT HISTORY ({contentLogs.length})
              </h3>

              {contentLogs.length === 0 ? (
                <p className="font-mono text-xs text-muted text-center py-4">No content logs recorded yet.</p>
              ) : (
                <>
                  {/* Mobile Card View (< 768px) */}
                  <div className="md:hidden space-y-2.5">
                    {contentLogs.map(l => {
                      const editHrs = parseFloat(l.edit_hours) || 0
                      const finMins = parseFloat(l.edit_finished_minutes) || 0
                      const ratio = finMins > 0 ? ((editHrs * 60) / finMins).toFixed(1) : '—'

                      return (
                        <div key={l.date} className="p-3 rounded-xl bg-tertiary border border-border-color space-y-2">
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="text-secondary font-bold">{l.date}</span>
                            <span className="text-cyan font-bold">Edit Speed: {ratio} m/m</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1.5 border-t border-border-subtle/40">
                            <div className="p-2 rounded bg-secondary/60">
                              <span className="text-cyan block text-[9px] uppercase font-bold">🎥 Shoot</span>
                              <div>{(l.shoot_hours || 0).toFixed(1)}h ({l.shoot_raw_minutes || 0}m raw)</div>
                            </div>
                            <div className="p-2 rounded bg-secondary/60">
                              <span className="text-amber block text-[9px] uppercase font-bold">✂️ Edit</span>
                              <div>{(l.edit_hours || 0).toFixed(1)}h ({l.edit_finished_minutes || 0}m out)</div>
                            </div>
                          </div>
                          {l.notes && <p className="font-mono text-[11px] text-muted italic pt-1">{l.notes}</p>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop Table (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border-color text-muted uppercase text-[10px]">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Shoot Time</th>
                          <th className="py-2 px-3">Raw Footage</th>
                          <th className="py-2 px-3">Edit Time</th>
                          <th className="py-2 px-3">Finished Output</th>
                          <th className="py-2 px-3">Edit Speed Ratio</th>
                          <th className="py-2 px-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contentLogs.map(l => {
                          const editHrs = parseFloat(l.edit_hours) || 0
                          const finMins = parseFloat(l.edit_finished_minutes) || 0
                          const ratio = finMins > 0 ? ((editHrs * 60) / finMins).toFixed(1) : '—'

                          return (
                            <tr key={l.date} className="border-b border-border-subtle/50 hover:bg-tertiary/50 transition-colors">
                              <td className="py-2.5 px-3 text-secondary">{l.date}</td>
                              <td className="py-2.5 px-3 text-cyan">{(l.shoot_hours || 0).toFixed(1)} h</td>
                              <td className="py-2.5 px-3 text-secondary">{l.shoot_raw_minutes || 0} m</td>
                              <td className="py-2.5 px-3 text-amber font-bold">{(l.edit_hours || 0).toFixed(1)} h</td>
                              <td className="py-2.5 px-3 text-success font-bold">{l.edit_finished_minutes || 0} m</td>
                              <td className="py-2.5 px-3 text-info font-bold">{ratio} m edit / finished m</td>
                              <td className="py-2.5 px-3 text-muted max-w-xs truncate">{l.notes || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </HudPanel>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <HudPanel className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>TOTAL WORKED</span>
                  <Clock size={14} className="text-amber" />
                </div>
                <div className="font-display text-xl text-amber font-bold">
                  {totals.totWork.toFixed(1)} h
                </div>
                <div className="font-mono text-[9px] text-muted truncate">
                  BT: {totals.totBeyond.toFixed(1)} h ({totals.beyondRatio}%)
                </div>
              </HudPanel>

              <HudPanel className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>FOCUS RATIO</span>
                  <Zap size={14} className="text-success" />
                </div>
                <div className="font-display text-xl text-success font-bold">
                  {totals.focusRatio}%
                </div>
                <div className="font-mono text-[9px] text-muted truncate">
                  Focus: {totals.totFocus.toFixed(1)} h
                </div>
              </HudPanel>

              <HudPanel className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>RAW FOOTAGE</span>
                  <Film size={14} className="text-cyan" />
                </div>
                <div className="font-display text-xl text-cyan font-bold">
                  {totals.totShootRawMins} m
                </div>
                <div className="font-mono text-[9px] text-muted truncate">
                  Shoot: {totals.totShootHrs.toFixed(1)} h
                </div>
              </HudPanel>

              <HudPanel className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted font-mono text-[10px]">
                  <span>FINISHED VIDEO</span>
                  <Video size={14} className="text-amber" />
                </div>
                <div className="font-display text-xl text-amber font-bold">
                  {totals.totEditFinishedMins} m
                </div>
                <div className="font-mono text-[9px] text-muted truncate">
                  Speed: {totals.editRatio} m/m
                </div>
              </HudPanel>
            </div>

            {/* RECHARTS CHART 1: WORK ALLOCATION */}
            <HudPanel className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border-color">
                <div className="flex items-center gap-2 text-amber font-display text-xs uppercase">
                  <TrendingUp size={15} />
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
            <HudPanel className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border-color">
                <div className="flex items-center gap-2 text-cyan font-display text-xs uppercase">
                  <Video size={15} />
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
