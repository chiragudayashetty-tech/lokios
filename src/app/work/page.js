'use client'

import React, { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid 
} from 'recharts'
import { 
  Briefcase, Video, Film, Clock, Calendar, Check, Save, Download, Printer, 
  Sparkles, TrendingUp, Cpu, Flame, Target, Shield, Filter, FileSpreadsheet,
  RotateCcw, ArrowRight, Zap
} from 'lucide-react'

export default function WorkPage() {
  const { auth: { user }, xp: { awardXP } } = useOS()

  // Primary subpage tab: 'work_log' | 'content_ops' | 'analytics'
  const [activeTab, setActiveTab] = useState('work_log')

  // Time Unit Display Toggle: 'hours' | 'minutes'
  const [timeUnit, setTimeUnit] = useState('hours')

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
  // DATA STATES
  // ----------------------------------------------------
  const [workLogs, setWorkLogs] = useState([])
  const [contentLogs, setContentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingWork, setSavingWork] = useState(false)
  const [savingContent, setSavingContent] = useState(false)

  // Work Log Form State
  const [totalHoursWorked, setTotalHoursWorked] = useState('')
  const [beyondTatvaHours, setBeyondTatvaHours] = useState('')
  const [focusedHours, setFocusedHours] = useState('')
  const [deepExecutionHours, setDeepExecutionHours] = useState('')
  const [workNotes, setWorkNotes] = useState('')

  // Content Ops Form State
  const [shootHours, setShootHours] = useState('')
  const [shootRawMinutes, setShootRawMinutes] = useState('')
  const [editHours, setEditHours] = useState('')
  const [editFinishedMinutes, setEditFinishedMinutes] = useState('')
  const [contentNotes, setContentNotes] = useState('')

  // Date Range Filter for Analytics: '7days' | '30days' | 'all'
  const [analyticsRange, setAnalyticsRange] = useState('30days')

  // ----------------------------------------------------
  // FETCH LOGS (Supabase + localStorage fallback)
  // ----------------------------------------------------
  useEffect(() => {
    if (!user) return

    const fetchAllLogs = async () => {
      setLoading(true)
      const sb = createClient()

      try {
        // Fetch Work Logs
        const { data: wData } = await sb
          .from('work_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        // Fetch Content Logs
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
        console.warn('Supabase fetch notice (falling back to cache):', err.message)
        if (typeof window !== 'undefined') {
          const wCached = localStorage.getItem('lokios_work_logs_cache')
          if (wCached) setWorkLogs(JSON.parse(wCached))
          const cCached = localStorage.getItem('lokios_content_logs_cache')
          if (cCached) setContentLogs(JSON.parse(cCached))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAllLogs()
  }, [user])

  // Populate form fields when selectedDate changes
  useEffect(() => {
    const existingWork = workLogs.find(l => l.date === selectedDate)
    if (existingWork) {
      setTotalHoursWorked(existingWork.total_hours_worked ?? '')
      setBeyondTatvaHours(existingWork.beyond_tatva_hours ?? '')
      setFocusedHours(existingWork.focused_hours ?? '')
      setDeepExecutionHours(existingWork.deep_execution_hours ?? '')
      setWorkNotes(existingWork.notes ?? '')
    } else {
      setTotalHoursWorked('')
      setBeyondTatvaHours('')
      setFocusedHours('')
      setDeepExecutionHours('')
      setWorkNotes('')
    }

    const existingContent = contentLogs.find(l => l.date === selectedDate)
    if (existingContent) {
      setShootHours(existingContent.shoot_hours ?? '')
      setShootRawMinutes(existingContent.shoot_raw_minutes ?? '')
      setEditHours(existingContent.edit_hours ?? '')
      setEditFinishedMinutes(existingContent.edit_finished_minutes ?? '')
      setContentNotes(existingContent.notes ?? '')
    } else {
      setShootHours('')
      setShootRawMinutes('')
      setEditHours('')
      setEditFinishedMinutes('')
      setContentNotes('')
    }
  }, [selectedDate, workLogs, contentLogs])

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
      total_hours_worked: parseFloat(totalHoursWorked) || 0,
      beyond_tatva_hours: parseFloat(beyondTatvaHours) || 0,
      focused_hours: parseFloat(focusedHours) || 0,
      deep_execution_hours: parseFloat(deepExecutionHours) || 0,
      notes: workNotes || ''
    }

    // Update local state & cache
    const updatedWorkLogs = [
      payload,
      ...workLogs.filter(l => l.date !== selectedDate)
    ].sort((a, b) => b.date.localeCompare(a.date))

    setWorkLogs(updatedWorkLogs)
    if (typeof window !== 'undefined') {
      localStorage.setItem('lokios_work_logs_cache', JSON.stringify(updatedWorkLogs))
    }

    // Save to Supabase
    try {
      const sb = createClient()
      const { error } = await sb.from('work_logs').upsert(payload, { onConflict: 'user_id,date' })
      if (error) console.error('Supabase work_logs save warning:', error.message)
    } catch (err) {
      console.warn('Network sync pending, saved locally:', err.message)
    }

    // Award +2 XP Reward
    awardXP(2, 'Logged Work Hours')
    setXpToast('+2 XP: Work Log Recorded')
    setTimeout(() => setXpToast(null), 3000)

    setSavingWork(false)
  }

  // ----------------------------------------------------
  // SAVE CONTENT OPS ENTRY (+2 XP REWARD)
  // ----------------------------------------------------
  const handleSaveContentLog = async (e) => {
    e.preventDefault()
    if (!user) return
    setSavingContent(true)

    const payload = {
      user_id: user.id,
      date: selectedDate,
      shoot_hours: parseFloat(shootHours) || 0,
      shoot_raw_minutes: parseFloat(shootRawMinutes) || 0,
      edit_hours: parseFloat(editHours) || 0,
      edit_finished_minutes: parseFloat(editFinishedMinutes) || 0,
      notes: contentNotes || ''
    }

    // Update local state & cache
    const updatedContentLogs = [
      payload,
      ...contentLogs.filter(l => l.date !== selectedDate)
    ].sort((a, b) => b.date.localeCompare(a.date))

    setContentLogs(updatedContentLogs)
    if (typeof window !== 'undefined') {
      localStorage.setItem('lokios_content_logs_cache', JSON.stringify(updatedContentLogs))
    }

    // Save to Supabase
    try {
      const sb = createClient()
      const { error } = await sb.from('content_logs').upsert(payload, { onConflict: 'user_id,date' })
      if (error) console.error('Supabase content_logs save warning:', error.message)
    } catch (err) {
      console.warn('Network sync pending, saved locally:', err.message)
    }

    // Award +2 XP Reward
    awardXP(2, 'Logged Content Operations')
    setXpToast('+2 XP: Content Operations Logged')
    setTimeout(() => setXpToast(null), 3000)

    setSavingContent(false)
  }

  // ----------------------------------------------------
  // UNIT CONVERSION HELPERS
  // ----------------------------------------------------
  const formatTimeVal = (hoursVal) => {
    const val = parseFloat(hoursVal) || 0
    if (timeUnit === 'minutes') {
      return `${Math.round(val * 60)} m`
    }
    return `${val.toFixed(1)} h`
  }

  const formatMinVal = (minsVal) => {
    const val = parseFloat(minsVal) || 0
    if (timeUnit === 'hours') {
      return `${(val / 60).toFixed(1)} h`
    }
    return `${Math.round(val)} m`
  }

  // ----------------------------------------------------
  // ANALYTICS COMPUTATIONS
  // ----------------------------------------------------
  const filteredWorkLogs = useMemo(() => {
    if (analyticsRange === '7days') {
      const sevenDaysAgo = getLocalDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      return workLogs.filter(l => l.date >= sevenDaysAgo)
    } else if (analyticsRange === '30days') {
      const thirtyDaysAgo = getLocalDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      return workLogs.filter(l => l.date >= thirtyDaysAgo)
    }
    return workLogs
  }, [workLogs, analyticsRange])

  const filteredContentLogs = useMemo(() => {
    if (analyticsRange === '7days') {
      const sevenDaysAgo = getLocalDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      return contentLogs.filter(l => l.date >= sevenDaysAgo)
    } else if (analyticsRange === '30days') {
      const thirtyDaysAgo = getLocalDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      return contentLogs.filter(l => l.date >= thirtyDaysAgo)
    }
    return contentLogs
  }, [contentLogs, analyticsRange])

  // Summary Totals
  const totals = useMemo(() => {
    const totWork = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.total_hours_worked) || 0), 0)
    const totBeyond = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.beyond_tatva_hours) || 0), 0)
    const totFocus = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.focused_hours) || 0), 0)
    const totDeep = filteredWorkLogs.reduce((acc, l) => acc + (parseFloat(l.deep_execution_hours) || 0), 0)

    const totShootHrs = filteredContentLogs.reduce((acc, l) => acc + (parseFloat(l.shoot_hours) || 0), 0)
    const totShootRawMins = filteredContentLogs.reduce((acc, l) => acc + (parseFloat(l.shoot_raw_minutes) || 0), 0)
    const totEditHrs = filteredContentLogs.reduce((acc, l) => acc + (parseFloat(l.edit_hours) || 0), 0)
    const totEditFinishedMins = filteredContentLogs.reduce((acc, l) => acc + (parseFloat(l.edit_finished_minutes) || 0), 0)

    const focusRatio = totWork > 0 ? Math.round((totFocus / totWork) * 100) : 0
    const beyondRatio = totWork > 0 ? Math.round((totBeyond / totWork) * 100) : 0
    const editRatio = totEditFinishedMins > 0 ? ((totEditHrs * 60) / totEditFinishedMins).toFixed(1) : '—'

    return {
      totWork, totBeyond, totFocus, totDeep,
      totShootHrs, totShootRawMins, totEditHrs, totEditFinishedMins,
      focusRatio, beyondRatio, editRatio
    }
  }, [filteredWorkLogs, filteredContentLogs])

  // Chart Data Preparation
  const chartData = useMemo(() => {
    // Map dates for work + content
    const allDatesSet = new Set([
      ...filteredWorkLogs.map(l => l.date),
      ...filteredContentLogs.map(l => l.date)
    ])

    const sortedDates = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b))

    return sortedDates.map(d => {
      const w = filteredWorkLogs.find(l => l.date === d) || {}
      const c = filteredContentLogs.find(l => l.date === d) || {}

      const workMultiplier = timeUnit === 'minutes' ? 60 : 1
      const minMultiplier = timeUnit === 'hours' ? (1 / 60) : 1

      return {
        date: d.slice(5), // 'MM-DD'
        fullDate: d,
        Worked: Number(((parseFloat(w.total_hours_worked) || 0) * workMultiplier).toFixed(1)),
        BeyondTatva: Number(((parseFloat(w.beyond_tatva_hours) || 0) * workMultiplier).toFixed(1)),
        Focused: Number(((parseFloat(w.focused_hours) || 0) * workMultiplier).toFixed(1)),
        ShootHours: Number(((parseFloat(c.shoot_hours) || 0) * workMultiplier).toFixed(1)),
        RawMins: Number(((parseFloat(c.shoot_raw_minutes) || 0) * minMultiplier).toFixed(1)),
        EditHours: Number(((parseFloat(c.edit_hours) || 0) * workMultiplier).toFixed(1)),
        FinishedMins: Number(((parseFloat(c.edit_finished_minutes) || 0) * minMultiplier).toFixed(1)),
      }
    })
  }, [filteredWorkLogs, filteredContentLogs, timeUnit])

  // ----------------------------------------------------
  // EXPORT CSV ENGINE
  // ----------------------------------------------------
  const handleExportCSV = (type) => {
    let csvContent = 'data:text/csv;charset=utf-8,'
    if (type === 'work') {
      csvContent += 'Date,Total Hours Worked,Beyond Tatva Hours,Focused Hours,Strategic Hours,Notes\n'
      workLogs.forEach(l => {
        csvContent += `"${l.date}","${l.total_hours_worked || 0}","${l.beyond_tatva_hours || 0}","${l.focused_hours || 0}","${l.deep_execution_hours || 0}","${(l.notes || '').replace(/"/g, '""')}"\n`
      })
    } else {
      csvContent += 'Date,Shoot Hours,Raw Footage Minutes,Edit Hours,Finished Video Minutes,Notes\n'
      contentLogs.forEach(l => {
        csvContent += `"${l.date}","${l.shoot_hours || 0}","${l.shoot_raw_minutes || 0}","${l.edit_hours || 0}","${l.edit_finished_minutes || 0}","${(l.notes || '').replace(/"/g, '""')}"\n`
      })
    }

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `LokiOS_${type === 'work' ? 'Work_Logs' : 'Content_Operations_Logs'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ----------------------------------------------------
  // EXPORT PDF REPORT TRIGGER
  // ----------------------------------------------------
  const handlePrintPDFReport = () => {
    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Loki OS - Work & Content Operations Report</title>
        <style>
          :root { --bg: #090A0F; --card: #12151E; --border: #262B3D; --text: #F3F4F6; --muted: #9CA3AF; --amber: #D4AF37; --cyan: #00F0FF; --green: #10B981; }
          body { font-family: monospace, sans-serif; background-color: var(--bg); color: var(--text); padding: 30px; margin: 0; }
          .header { border-bottom: 2px solid var(--amber); padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 24px; font-weight: bold; color: var(--amber); margin: 0; }
          .section { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
          .section-title { font-size: 15px; color: var(--cyan); margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
          th { color: var(--muted); text-transform: uppercase; font-size: 10px; }
          .text-amber { color: var(--amber); font-weight: bold; }
          .text-cyan { color: var(--cyan); font-weight: bold; }
          @media print {
            body { background: #fff; color: #000; padding: 15px; }
            .section { background: #fff; border: 1px solid #ccc; color: #000; }
            .section-title { color: #000; border-bottom-color: #ccc; }
            th, td { border-bottom-color: #eee; }
            th { color: #555; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">LOKI OS // WORK & CONTENT OPERATIONS REPORT</h1>
            <div style="font-size: 12px; color: var(--muted); margin-top: 5px;">OPERATOR: CHIRAG | RANGE: ${analyticsRange.toUpperCase()}</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: var(--muted);">GENERATED ON: ${new Date().toLocaleDateString()}</div>
        </div>

        <div class="section">
          <h2 class="section-title">⏱️ WORK METRICS SUMMARY</h2>
          <p>Total Hours Worked: <strong>${totals.totWork.toFixed(1)} h</strong> | Beyond Tatva: <strong>${totals.totBeyond.toFixed(1)} h (${totals.beyondRatio}%)</strong> | Focused Hours: <strong>${totals.totFocus.toFixed(1)} h (${totals.focusRatio}%)</strong></p>
          <table>
            <thead>
              <tr><th>Date</th><th>Total Worked</th><th>Beyond Tatva</th><th>Focused</th><th>Strategic</th><th>Notes</th></tr>
            </thead>
            <tbody>
              ${filteredWorkLogs.map(l => `
                <tr>
                  <td>${l.date}</td>
                  <td><strong class="text-amber">${l.total_hours_worked || 0} h</strong></td>
                  <td>${l.beyond_tatva_hours || 0} h</td>
                  <td>${l.focused_hours || 0} h</td>
                  <td>${l.deep_execution_hours || 0} h</td>
                  <td>${l.notes || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2 class="section-title">🎬 CONTENT OPERATIONS SUMMARY</h2>
          <p>Total Shoot Hours: <strong>${totals.totShootHrs.toFixed(1)} h</strong> | Raw Footage: <strong>${totals.totShootRawMins} mins</strong> | Edit Hours: <strong>${totals.totEditHrs.toFixed(1)} h</strong> | Finished Video: <strong>${totals.totEditFinishedMins} mins</strong></p>
          <table>
            <thead>
              <tr><th>Date</th><th>Shoot Hours</th><th>Raw Footage (Mins)</th><th>Edit Hours</th><th>Finished Video (Mins)</th><th>Edit Ratio</th><th>Notes</th></tr>
            </thead>
            <tbody>
              ${filteredContentLogs.map(l => {
                const ratio = l.edit_finished_minutes > 0 ? ((l.edit_hours * 60) / l.edit_finished_minutes).toFixed(1) : '—'
                return `
                  <tr>
                    <td>${l.date}</td>
                    <td>${l.shoot_hours || 0} h</td>
                    <td>${l.shoot_raw_minutes || 0} m</td>
                    <td><strong class="text-cyan">${l.edit_hours || 0} h</strong></td>
                    <td><strong class="text-amber">${l.edit_finished_minutes || 0} m</strong></td>
                    <td>${ratio} m edit / finished m</td>
                    <td>${l.notes || '—'}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(fullHTML)
    doc.close()

    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 4000)
    }, 500)
  }

  return (
    <AppShell>
      {/* Floating XP Toast */}
      <AnimatePresence>
        {xpToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[99999] bg-amber text-black font-mono font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-amber/40"
          >
            <Sparkles size={16} />
            <span>{xpToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* HEADER & TIME UNIT TOGGLE */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-border-color">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber/10 border border-amber/30 text-amber">
                <Briefcase size={26} />
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl tracking-widest text-primary uppercase">
                  WORK & CONTENT OPERATIONS
                </h1>
                <p className="font-mono text-xs text-muted">
                  Log effort, track video shoot/edit minutes, & measure production efficiency
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Time Unit Toggle */}
            <div className="flex items-center bg-tertiary border border-border-color rounded-xl p-1">
              <span className="font-mono text-[10px] text-muted px-2.5 uppercase font-bold">UNIT:</span>
              <button
                type="button"
                onClick={() => setTimeUnit('hours')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                  timeUnit === 'hours'
                    ? 'bg-amber text-black shadow-md'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Hours (h)
              </button>
              <button
                type="button"
                onClick={() => setTimeUnit('minutes')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                  timeUnit === 'minutes'
                    ? 'bg-amber text-black shadow-md'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Minutes (m)
              </button>
            </div>
          </div>
        </div>

        {/* NAVIGATION SUBPAGE TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border-color/60">
          <button
            type="button"
            onClick={() => setActiveTab('work_log')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all whitespace-nowrap ${
              activeTab === 'work_log'
                ? 'bg-amber/15 border border-amber text-amber shadow-lg shadow-amber/10'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <Clock size={16} />
            <span>1. Work Log</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('content_ops')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all whitespace-nowrap ${
              activeTab === 'content_ops'
                ? 'bg-cyan/15 border border-cyan text-cyan shadow-lg shadow-cyan/10'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <Video size={16} />
            <span>2. Content Operations (Shoot & Edit)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-success/15 border border-success text-success shadow-lg shadow-success/10'
                : 'bg-tertiary border border-border-color text-muted hover:text-primary'
            }`}
          >
            <TrendingUp size={16} />
            <span>3. Analytics & Export</span>
          </button>
        </div>

        {/* GLOBAL DATE SELECTOR */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-tertiary border border-border-color rounded-2xl">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-amber" />
            <span className="font-mono text-xs text-secondary uppercase font-bold">Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-secondary border border-border-color rounded-xl px-3 py-1.5 font-mono text-xs text-primary focus:outline-none focus:border-amber"
              style={{ background: '#121520', color: '#fff' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted uppercase">PRESETS:</span>
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1 rounded-lg font-mono text-xs transition-colors ${
                selectedDate === todayStr
                  ? 'bg-amber text-black font-bold'
                  : 'bg-secondary text-muted hover:text-primary border border-border-subtle'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getLocalDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000)))}
              className="px-3 py-1 bg-secondary hover:bg-hover border border-border-subtle rounded-lg font-mono text-xs text-muted hover:text-primary transition-colors"
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
            <HudPanel className="p-6">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-border-color">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber/10 border border-amber/30 text-amber">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h2 className="font-display text-lg uppercase tracking-wider text-primary">
                      LOG WORK HOURS FOR {selectedDate}
                    </h2>
                    <p className="font-mono text-xs text-muted">
                      Record total worked, Beyond Tatva focus, & strategic execution (+2 XP Reward)
                    </p>
                  </div>
                </div>

                <span className="font-mono text-xs text-success bg-success/10 border border-success/30 px-3 py-1 rounded-full">
                  +2 XP per entry
                </span>
              </div>

              <form onSubmit={handleSaveWorkLog} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Total Hours Worked */}
                  <div className="p-4 rounded-xl bg-secondary border border-border-color space-y-2">
                    <label className="block font-mono text-xs text-amber uppercase font-bold flex items-center gap-2">
                      <Clock size={14} /> Total Worked (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="24"
                      placeholder="e.g. 8.5"
                      value={totalHoursWorked}
                      onChange={(e) => setTotalHoursWorked(e.target.value)}
                      className="w-full bg-tertiary border border-border-color rounded-lg p-3 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                    <span className="font-mono text-[10px] text-muted block">
                      Displays as: {formatTimeVal(totalHoursWorked)}
                    </span>
                  </div>

                  {/* 2. Beyond Tatva Hours */}
                  <div className="p-4 rounded-xl bg-secondary border border-border-color space-y-2">
                    <label className="block font-mono text-xs text-cyan uppercase font-bold flex items-center gap-2">
                      <Target size={14} /> Beyond Tatva (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="24"
                      placeholder="e.g. 4.0"
                      value={beyondTatvaHours}
                      onChange={(e) => setBeyondTatvaHours(e.target.value)}
                      className="w-full bg-tertiary border border-border-color rounded-lg p-3 font-mono text-sm text-primary focus:outline-none focus:border-cyan"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                    <span className="font-mono text-[10px] text-muted block">
                      Displays as: {formatTimeVal(beyondTatvaHours)}
                    </span>
                  </div>

                  {/* 3. Focused Hours */}
                  <div className="p-4 rounded-xl bg-secondary border border-border-color space-y-2">
                    <label className="block font-mono text-xs text-success uppercase font-bold flex items-center gap-2">
                      <Zap size={14} /> Focused Hours (High Conc.)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="24"
                      placeholder="e.g. 5.5"
                      value={focusedHours}
                      onChange={(e) => setFocusedHours(e.target.value)}
                      className="w-full bg-tertiary border border-border-color rounded-lg p-3 font-mono text-sm text-primary focus:outline-none focus:border-success"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                    <span className="font-mono text-[10px] text-muted block">
                      Displays as: {formatTimeVal(focusedHours)}
                    </span>
                  </div>

                  {/* 4. Strategic / Deep Execution Hours */}
                  <div className="p-4 rounded-xl bg-secondary border border-border-color space-y-2">
                    <label className="block font-mono text-xs text-info uppercase font-bold flex items-center gap-2">
                      <Cpu size={14} /> Strategic / Deep Execution
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="24"
                      placeholder="e.g. 3.0"
                      value={deepExecutionHours}
                      onChange={(e) => setDeepExecutionHours(e.target.value)}
                      className="w-full bg-tertiary border border-border-color rounded-lg p-3 font-mono text-sm text-primary focus:outline-none focus:border-info"
                      style={{ background: '#141824', color: '#fff' }}
                    />
                    <span className="font-mono text-[10px] text-muted block">
                      Displays as: {formatTimeVal(deepExecutionHours)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block font-mono text-xs text-secondary uppercase font-bold mb-2">
                    Daily Work Summary Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Summary of key tasks completed, focus blockers, or operational milestones..."
                    value={workNotes}
                    onChange={(e) => setWorkNotes(e.target.value)}
                    className="w-full bg-secondary border border-border-color rounded-xl p-3 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                    style={{ background: '#141824', color: '#fff' }}
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingWork}
                    className="flex items-center gap-2 px-6 py-3 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-lg shadow-amber/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Save size={16} />
                    <span>{savingWork ? 'Saving Log...' : 'Save Work Log (+2 XP)'}</span>
                  </button>
                </div>
              </form>
            </HudPanel>

            {/* RECENT WORK LOGS TABLE */}
            <HudPanel className="p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-color">
                <h3 className="font-display text-md uppercase tracking-wider text-primary">
                  RECENT WORK LOG HISTORY ({workLogs.length})
                </h3>
                <button
                  type="button"
                  onClick={() => handleExportCSV('work')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary hover:bg-hover border border-border-color rounded-lg font-mono text-xs text-secondary hover:text-primary transition-colors"
                >
                  <FileSpreadsheet size={14} className="text-amber" />
                  <span>Export Work CSV</span>
                </button>
              </div>

              {workLogs.length === 0 ? (
                <p className="font-mono text-xs text-muted text-center py-6">
                  No work logs recorded yet. Use the form above to log hours for {selectedDate}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-color text-muted uppercase text-[10px]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Total Worked</th>
                        <th className="py-2.5 px-3">Beyond Tatva</th>
                        <th className="py-2.5 px-3">Focused Hours</th>
                        <th className="py-2.5 px-3">Strategic Hours</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workLogs.map(l => (
                        <tr key={l.date} className="border-b border-border-subtle/50 hover:bg-tertiary/50 transition-colors">
                          <td className="py-3 px-3 text-secondary">{l.date}</td>
                          <td className="py-3 px-3"><strong className="text-amber">{formatTimeVal(l.total_hours_worked)}</strong></td>
                          <td className="py-3 px-3 text-cyan">{formatTimeVal(l.beyond_tatva_hours)}</td>
                          <td className="py-3 px-3 text-success">{formatTimeVal(l.focused_hours)}</td>
                          <td className="py-3 px-3 text-info">{formatTimeVal(l.deep_execution_hours)}</td>
                          <td className="py-3 px-3 text-muted max-w-xs truncate">{l.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </HudPanel>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBPAGE 2: CONTENT OPERATIONS (SHOOT & EDIT) */}
        {/* ========================================================================= */}
        {activeTab === 'content_ops' && (
          <div className="space-y-6">
            <HudPanel className="p-6">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-border-color">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan/10 border border-cyan/30 text-cyan">
                    <Video size={20} />
                  </div>
                  <div>
                    <h2 className="font-display text-lg uppercase tracking-wider text-primary">
                      CONTENT OPERATIONS (SHOOT & EDIT) FOR {selectedDate}
                    </h2>
                    <p className="font-mono text-xs text-muted">
                      Track shoot time, raw footage minutes, edit time, & finished video output (+2 XP Reward)
                    </p>
                  </div>
                </div>

                <span className="font-mono text-xs text-success bg-success/10 border border-success/30 px-3 py-1 rounded-full">
                  +2 XP per entry
                </span>
              </div>

              <form onSubmit={handleSaveContentLog} className="space-y-6">
                {/* 2 PANELS: SHOOT TRACKER & EDIT TRACKER */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* PANEL 1: SHOOT TRACKER */}
                  <div className="p-5 rounded-2xl bg-secondary border border-cyan/40 space-y-4">
                    <div className="flex items-center gap-2 text-cyan font-display text-sm uppercase tracking-wider pb-2 border-b border-cyan/20">
                      <Film size={18} />
                      <span>1. Shoot Tracking</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block font-mono text-xs text-secondary uppercase mb-1">
                          Hours Shot (Recording Time)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="24"
                          placeholder="e.g. 2.5"
                          value={shootHours}
                          onChange={(e) => setShootHours(e.target.value)}
                          className="w-full bg-tertiary border border-border-color rounded-lg p-3 font-mono text-sm text-primary focus:outline-none focus:border-cyan"
                          style={{ background: '#141824', color: '#fff' }}
                        />
                        <span className="font-mono text-[10px] text-muted block mt-1">
                          Displays as: {formatTimeVal(shootHours)}
                        </span>
                      </div>

                      <div>
                        <label className="block font-mono text-xs text-secondary uppercase mb-1">
                          Raw Footage Shot (Minutes)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="e.g. 120"
                          value={shootRawMinutes}
                          onChange={(e) => setShootRawMinutes(e.target.value)}
                          className="w-full bg-tertiary border border-border-color rounded-lg p-3 font-mono text-sm text-primary focus:outline-none focus:border-cyan"
                          style={{ background: '#141824', color: '#fff' }}
                        />
                        <span className="font-mono text-[10px] text-muted block mt-1">
                          Displays as: {formatMinVal(shootRawMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PANEL 2: EDIT TRACKER */}
                  <div className="p-5 rounded-2xl bg-secondary border border-amber/40 space-y-4">
                    <div className="flex items-center gap-2 text-amber font-display text-sm uppercase tracking-wider pb-2 border-b border-amber/20">
                      <Video size={18} />
                      <span>2. Edit Tracking</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block font-mono text-xs text-secondary uppercase mb-1">
                          Hours Edited (Time in NLE / Software)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="24"
                          placeholder="e.g. 4.0"
                          value={editHours}
                          onChange={(e) => setEditHours(e.target.value)}
                          className="w-full bg-tertiary border border-border-color rounded-lg p-3 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                          style={{ background: '#141824', color: '#fff' }}
                        />
                        <span className="font-mono text-[10px] text-muted block mt-1">
                          Displays as: {formatTimeVal(editHours)}
                        </span>
                      </div>

                      <div>
                        <label className="block font-mono text-xs text-secondary uppercase mb-1">
                          Finished Video Edited (Minutes of Final Output)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="e.g. 5.0"
                          value={editFinishedMinutes}
                          onChange={(e) => setEditFinishedMinutes(e.target.value)}
                          className="w-full bg-tertiary border border-border-color rounded-lg p-3 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                          style={{ background: '#141824', color: '#fff' }}
                        />
                        <span className="font-mono text-[10px] text-muted block mt-1">
                          Displays as: {formatMinVal(editFinishedMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Notes */}
                <div>
                  <label className="block font-mono text-xs text-secondary uppercase font-bold mb-2">
                    Content Production Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Specify project name (e.g. Beyond Tatva Module 2 Lesson 4), shooting environment, or edit notes..."
                    value={contentNotes}
                    onChange={(e) => setContentNotes(e.target.value)}
                    className="w-full bg-secondary border border-border-color rounded-xl p-3 font-mono text-xs text-primary focus:outline-none focus:border-cyan"
                    style={{ background: '#141824', color: '#fff' }}
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingContent}
                    className="flex items-center gap-2 px-6 py-3 bg-cyan hover:bg-cyan-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-lg shadow-cyan/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Save size={16} />
                    <span>{savingContent ? 'Saving Content Log...' : 'Save Content Log (+2 XP)'}</span>
                  </button>
                </div>
              </form>
            </HudPanel>

            {/* RECENT CONTENT LOGS TABLE */}
            <HudPanel className="p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-color">
                <h3 className="font-display text-md uppercase tracking-wider text-primary">
                  RECENT CONTENT OPERATIONS LOGS ({contentLogs.length})
                </h3>
                <button
                  type="button"
                  onClick={() => handleExportCSV('content')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary hover:bg-hover border border-border-color rounded-lg font-mono text-xs text-secondary hover:text-primary transition-colors"
                >
                  <FileSpreadsheet size={14} className="text-cyan" />
                  <span>Export Content CSV</span>
                </button>
              </div>

              {contentLogs.length === 0 ? (
                <p className="font-mono text-xs text-muted text-center py-6">
                  No content logs recorded yet. Use the form above to log shoot & edit data for {selectedDate}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-color text-muted uppercase text-[10px]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Shoot Time</th>
                        <th className="py-2.5 px-3">Raw Footage</th>
                        <th className="py-2.5 px-3">Edit Time</th>
                        <th className="py-2.5 px-3">Finished Output</th>
                        <th className="py-2.5 px-3">Edit Speed Ratio</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contentLogs.map(l => {
                        const editHrs = parseFloat(l.edit_hours) || 0
                        const finMins = parseFloat(l.edit_finished_minutes) || 0
                        const ratio = finMins > 0 ? ((editHrs * 60) / finMins).toFixed(1) : '—'

                        return (
                          <tr key={l.date} className="border-b border-border-subtle/50 hover:bg-tertiary/50 transition-colors">
                            <td className="py-3 px-3 text-secondary">{l.date}</td>
                            <td className="py-3 px-3 text-cyan">{formatTimeVal(l.shoot_hours)}</td>
                            <td className="py-3 px-3 text-secondary">{formatMinVal(l.shoot_raw_minutes)}</td>
                            <td className="py-3 px-3 text-amber font-bold">{formatTimeVal(l.edit_hours)}</td>
                            <td className="py-3 px-3 text-success font-bold">{formatMinVal(l.edit_finished_minutes)}</td>
                            <td className="py-3 px-3 text-info font-bold">{ratio} m edit / finished m</td>
                            <td className="py-3 px-3 text-muted max-w-xs truncate">{l.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </HudPanel>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBPAGE 3: ANALYTICS & EXPORT ENGINE */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* RANGE SELECTOR & EXPORT ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-tertiary border border-border-color rounded-2xl">
              <div className="flex items-center gap-3">
                <Filter size={18} className="text-amber" />
                <span className="font-mono text-xs text-secondary uppercase font-bold">Analytics Period:</span>
                <div className="flex items-center bg-secondary border border-border-color rounded-lg p-1">
                  {['7days', '30days', 'all'].map(rangeKey => (
                    <button
                      key={rangeKey}
                      type="button"
                      onClick={() => setAnalyticsRange(rangeKey)}
                      className={`px-3 py-1 rounded font-mono text-xs uppercase font-bold transition-all ${
                        analyticsRange === rangeKey
                          ? 'bg-amber text-black shadow'
                          : 'text-muted hover:text-primary'
                      }`}
                    >
                      {rangeKey === '7days' ? '7 Days' : rangeKey === '30days' ? '30 Days' : 'All Time'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleExportCSV('work')}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border-color hover:border-amber/50 rounded-xl font-mono text-xs text-secondary hover:text-primary transition-colors"
                >
                  <FileSpreadsheet size={15} className="text-amber" />
                  <span>Work CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCSV('content')}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border-color hover:border-cyan/50 rounded-xl font-mono text-xs text-secondary hover:text-primary transition-colors"
                >
                  <FileSpreadsheet size={15} className="text-cyan" />
                  <span>Content CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintPDFReport}
                  className="flex items-center gap-2 px-5 py-2 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold rounded-xl shadow-lg shadow-amber/20 transition-all active:scale-95"
                >
                  <Printer size={16} />
                  <span>Export PDF / Report</span>
                </button>
              </div>
            </div>

            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Worked */}
              <HudPanel className="p-5 space-y-2">
                <div className="flex items-center justify-between text-muted font-mono text-xs">
                  <span>TOTAL WORKED</span>
                  <Clock size={16} className="text-amber" />
                </div>
                <div className="font-display text-2xl text-amber font-bold">
                  {formatTimeVal(totals.totWork)}
                </div>
                <div className="font-mono text-[10px] text-muted">
                  Beyond Tatva: {formatTimeVal(totals.totBeyond)} ({totals.beyondRatio}%)
                </div>
              </HudPanel>

              {/* Card 2: Focus Ratio */}
              <HudPanel className="p-5 space-y-2">
                <div className="flex items-center justify-between text-muted font-mono text-xs">
                  <span>FOCUS RATIO</span>
                  <Zap size={16} className="text-success" />
                </div>
                <div className="font-display text-2xl text-success font-bold">
                  {totals.focusRatio}%
                </div>
                <div className="font-mono text-[10px] text-muted">
                  Focused Hours: {formatTimeVal(totals.totFocus)}
                </div>
              </HudPanel>

              {/* Card 3: Raw Footage Shot */}
              <HudPanel className="p-5 space-y-2">
                <div className="flex items-center justify-between text-muted font-mono text-xs">
                  <span>RAW FOOTAGE SHOT</span>
                  <Film size={16} className="text-cyan" />
                </div>
                <div className="font-display text-2xl text-cyan font-bold">
                  {formatMinVal(totals.totShootRawMins)}
                </div>
                <div className="font-mono text-[10px] text-muted">
                  Shoot Time: {formatTimeVal(totals.totShootHrs)}
                </div>
              </HudPanel>

              {/* Card 4: Finished Video Output */}
              <HudPanel className="p-5 space-y-2">
                <div className="flex items-center justify-between text-muted font-mono text-xs">
                  <span>FINISHED VIDEO EDITED</span>
                  <Video size={16} className="text-amber" />
                </div>
                <div className="font-display text-2xl text-amber font-bold">
                  {formatMinVal(totals.totEditFinishedMins)}
                </div>
                <div className="font-mono text-[10px] text-muted">
                  Edit Speed: {totals.editRatio} m edit / finished m
                </div>
              </HudPanel>
            </div>

            {/* RECHARTS CHART 1: WORK ALLOCATION */}
            <HudPanel className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border-color">
                <div className="flex items-center gap-2 text-amber font-display text-sm uppercase">
                  <TrendingUp size={18} />
                  <span>Work Hours Allocation ({timeUnit.toUpperCase()})</span>
                </div>
                <span className="font-mono text-xs text-muted">
                  Worked vs Beyond Tatva vs Focused Hours
                </span>
              </div>

              {chartData.length === 0 ? (
                <p className="font-mono text-xs text-muted text-center py-10">
                  No work data available for the selected date range.
                </p>
              ) : (
                <div className="h-72 w-full">
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
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262B3D" />
                      <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#12151E', borderColor: '#262B3D', borderRadius: '8px', color: '#fff', fontSize: '12px' }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Area type="monotone" dataKey="Worked" stroke="#D4AF37" fillOpacity={1} fill="url(#gradWorked)" name="Total Worked" />
                      <Area type="monotone" dataKey="BeyondTatva" stroke="#00F0FF" fillOpacity={1} fill="url(#gradBeyond)" name="Beyond Tatva" />
                      <Area type="monotone" dataKey="Focused" stroke="#10B981" fillOpacity={1} fill="url(#gradFocused)" name="Focused Hours" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </HudPanel>

            {/* RECHARTS CHART 2: CONTENT OPERATIONS VELOCITY */}
            <HudPanel className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border-color">
                <div className="flex items-center gap-2 text-cyan font-display text-sm uppercase">
                  <Video size={18} />
                  <span>Content Velocity: Raw Footage vs Finished Output ({timeUnit.toUpperCase()})</span>
                </div>
                <span className="font-mono text-xs text-muted">
                  Minutes/Hours Shot vs Finished Video Edited
                </span>
              </div>

              {chartData.length === 0 ? (
                <p className="font-mono text-xs text-muted text-center py-10">
                  No content operations data available for the selected date range.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262B3D" />
                      <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#12151E', borderColor: '#262B3D', borderRadius: '8px', color: '#fff', fontSize: '12px' }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="RawMins" fill="#00F0FF" radius={[4, 4, 0, 0]} name={`Raw Footage (${timeUnit})`} />
                      <Bar dataKey="FinishedMins" fill="#D4AF37" radius={[4, 4, 0, 0]} name={`Finished Output (${timeUnit})`} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </HudPanel>
          </div>
        )}
      </div>
    </AppShell>
  )
}
