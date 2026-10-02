'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Download, Calendar, CheckSquare, Target, Monitor, 
  Crosshair, FileText, Check, Printer, Sparkles, Briefcase,
  BookOpen, Zap, Camera, Brain, ClipboardList, Mic, Wallet
} from 'lucide-react'
import { useOS } from '@/lib/context/OSContext'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr, parseTaskNotes } from '@/lib/utils/dates'

export default function IntelExportModal({ isOpen, onClose }) {
  const { auth: { user } = {}, profile: { profile } = {}, goals: { goals = [] } = {}, tasks: { tasks = [] } = {}, habits: { habits = [], stoppedHabits = [], allHabits = [], monthLogs = [] } = {} } = useOS() || {}

  const now = new Date()
  const firstDayStr = getLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const todayStr = getLocalDateStr(now)

  const [startDate, setStartDate] = useState(firstDayStr)
  const [endDate, setEndDate] = useState(todayStr)

  const [selectedModules, setSelectedModules] = useState({
    work_intel: true,
    missions: true,
    operations: true,
    habits: true,
    journal: true,
    weekly_debrief: true,
    screen_intel: true,
    speaking_intel: true,
    budget_intel: true,
  })

  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  const toggleModule = (key) => {
    setSelectedModules(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const setPreset = (preset) => {
    const today = new Date()
    if (preset === 'this_month') {
      setStartDate(getLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1)))
      setEndDate(getLocalDateStr(today))
    } else if (preset === 'last_30') {
      const past = new Date(); past.setDate(past.getDate() - 30)
      setStartDate(getLocalDateStr(past)); setEndDate(getLocalDateStr(today))
    } else if (preset === 'this_week') {
      const dayOfWeek = today.getDay()
      const diffToMon = (dayOfWeek + 6) % 7
      const mon = new Date(today); mon.setDate(today.getDate() - diffToMon)
      setStartDate(getLocalDateStr(mon)); setEndDate(getLocalDateStr(today))
    } else if (preset === 'all') {
      setStartDate('2026-01-01'); setEndDate(getLocalDateStr(today))
    }
  }

  const generateReport = async (format = 'report') => {
    if (!user) return
    setIsExporting(true)

    try {
      const supabase = createClient()

      // Fetch all data in parallel
      const [
        screenRes,
        workHoursRes, workRes, contentRes,
        habitLogsRes, journalRes, speakingRes,
        habitsRes, budgetRes
      ] = await Promise.all([
        supabase.from('screen_time_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('work_hours_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        supabase.from('work_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('content_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('journal_entries').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        supabase.from('speaking_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        supabase.from('habits').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('budget_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: false })
      ])

      let workLogs = (workHoursRes.data && workHoursRes.data.length > 0) ? workHoursRes.data : []
      const allWorkLogs = workRes.data || []

      // Fallback cache for work_hours_logs
      if (workLogs.length === 0 && typeof window !== 'undefined') {
        const cached = localStorage.getItem('lokios_work_logs_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          workLogs = parsed.filter(l => l.date >= startDate && l.date <= endDate)
        }
      }

      let contentLogs = contentRes.data || []
      if (contentLogs.length === 0 && typeof window !== 'undefined') {
        const cached = localStorage.getItem('lokios_content_logs_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          contentLogs = parsed.filter(l => l.date >= startDate && l.date <= endDate)
        }
      }

      const screenLogs = screenRes.data || []
      let speakingLogs = speakingRes?.data || []
      if (speakingLogs.length === 0 && typeof window !== 'undefined') {
        const cached = localStorage.getItem(`lokios_speaking_logs_${user.id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          speakingLogs = parsed.filter(l => l.date >= startDate && l.date <= endDate)
        }
      }
      const fetchedHabitLogs = (habitLogsRes.data && habitLogsRes.data.length > 0) ? habitLogsRes.data : (monthLogs || [])
      const fetchedHabits = (habitsRes?.data && habitsRes.data.length > 0) ? habitsRes.data : (allHabits && allHabits.length > 0 ? allHabits : habits)
      const journalEntries = journalRes.data || []

      let budgetLogs = budgetRes?.data || []
      if (budgetLogs.length === 0 && typeof window !== 'undefined') {
        const cached = localStorage.getItem(`lokios_budget_logs_${user.id}`)
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            budgetLogs = parsed.filter(l => l.date >= startDate && l.date <= endDate)
          } catch (e) {}
        }
      }

      // Weekly debriefs from work_logs
      const weeklyDebriefs = allWorkLogs.filter(l =>
        l.title && l.title.toLowerCase().startsWith('weekly debrief') &&
        l.date >= startDate && l.date <= endDate
      )

      // Filter goals and tasks
      const filteredGoals = (goals || []).filter(g => {
        const cDate = g.completed_at ? getLocalDateStr(new Date(g.completed_at)) : null
        const dDate = g.deadline || g.due_date || null
        const crDate = g.created_at ? getLocalDateStr(new Date(g.created_at)) : null
        if (cDate && cDate >= startDate && cDate <= endDate) return true
        if (dDate && dDate >= startDate && dDate <= endDate) return true
        if (crDate && crDate >= startDate && crDate <= endDate) return true
        return !dDate && !crDate
      })

      const filteredTasks = (tasks || []).filter(t => {
        const cDate = t.completed_at ? getLocalDateStr(new Date(t.completed_at)) : null
        const dDate = t.due_date || null
        const crDate = t.created_at ? getLocalDateStr(new Date(t.created_at)) : null
        if (cDate && cDate >= startDate && cDate <= endDate) return true
        if (dDate && dDate >= startDate && dDate <= endDate) return true
        if (crDate && crDate >= startDate && crDate <= endDate) return true
        return !dDate && !crDate
      })

      const filteredHabitLogs = fetchedHabitLogs.filter(l => l.date >= startDate && l.date <= endDate)

      if (format === 'json') {
        const payload = {
          report_metadata: { user: profile?.full_name || 'Operator', export_date: new Date().toISOString(), range: { startDate, endDate } },
          work_intel: selectedModules.work_intel ? { work_logs: workLogs, content_logs: contentLogs } : undefined,
          missions: selectedModules.missions ? filteredGoals : undefined,
          operations: selectedModules.operations ? filteredTasks : undefined,
          habits: selectedModules.habits ? { habits, logs: filteredHabitLogs } : undefined,
          journal: selectedModules.journal ? journalEntries : undefined,
          weekly_debrief: selectedModules.weekly_debrief ? weeklyDebriefs : undefined,
          screen_intel: selectedModules.screen_intel ? screenLogs : undefined,
          speaking_intel: selectedModules.speaking_intel ? speakingLogs : undefined,
          budget_intel: selectedModules.budget_intel ? budgetLogs : undefined,
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `LokiOS_Intel_Export_${startDate}_to_${endDate}.json`
        a.click()
        URL.revokeObjectURL(url)
        setIsExporting(false)
        return
      }

      // ──────────────────────────────────────────────────────────────
      // BUILD HTML REPORT
      // ──────────────────────────────────────────────────────────────
      const totalWorkHours = workLogs.reduce((acc, l) => acc + (parseFloat(l.total_hours_worked) || 0), 0).toFixed(1)
      const totalFocusedHours = workLogs.reduce((acc, l) => acc + (parseFloat(l.focused_hours) || 0), 0).toFixed(1)
      const completedTasksCount = filteredTasks.filter(t => t.status === 'completed').length
      const totalTasksCount = filteredTasks.length
      const taskSuccessRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0
      const completedGoalsCount = filteredGoals.filter(g => g.status === 'completed').length
      const totalGoalsCount = filteredGoals.length
      const habitCompletedLogsCount = filteredHabitLogs.filter(l => l.status === 'completed').length

      let sectionsHTML = ''

      // 0. WORK & CONTENT INTELLIGENCE
      if (selectedModules.work_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>💼 WORK & CONTENT INTELLIGENCE</span>
              <span class="badge badge-warning">${workLogs.length} Work Logs • ${contentLogs.length} Content Ops</span>
            </h2>
            <div class="sub-heading">⏱️ WORK SESSIONS & FOCUS LOGS</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Worked</th>
                  <th>Beyond Tatva</th>
                  <th>Focused Exec</th>
                  <th>Unfocused / Other</th>
                  <th>Type of Work</th>
                  <th>Notes / Deliverables</th>
                </tr>
              </thead>
              <tbody>
                ${workLogs.length === 0 ? '<tr><td colspan="7" class="text-muted" style="text-align:center;">No work sessions logged in this range.</td></tr>' : workLogs.map(l => {
                  const typeTagsHTML = l.work_type
                    ? l.work_type.split(',').map(t => t.trim()).filter(Boolean)
                        .map(t => `<span class="work-tag">${t}</span>`).join(' ')
                    : '—'
                  return `
                    <tr>
                      <td class="font-mono font-bold">${l.date}</td>
                      <td><strong class="text-accent font-mono">${l.total_hours_worked || 0}h</strong></td>
                      <td><span class="text-blue font-mono">${l.beyond_tatva_hours || 0}h</span></td>
                      <td><strong class="text-green font-mono">${l.focused_hours || 0}h</strong></td>
                      <td><span class="text-red font-mono">${(l.unfocused_hours ?? l.deep_execution_hours) || 0}h</span></td>
                      <td>${typeTagsHTML}</td>
                      <td style="max-width:240px;color:#334155;">${l.notes || '—'}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>

            <div class="sub-heading">🎬 CONTENT PRODUCTION & POST-OPERATIONS</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shoot Duration</th>
                  <th>Raw Footage</th>
                  <th>Editing Time</th>
                  <th>Finished Output</th>
                  <th>Production Ratio</th>
                  <th>Operational Notes</th>
                </tr>
              </thead>
              <tbody>
                ${contentLogs.length === 0 ? '<tr><td colspan="7" class="text-muted" style="text-align:center;">No content operations logged in this range.</td></tr>' : contentLogs.map(l => {
                  const ratio = l.edit_finished_minutes > 0 ? ((l.edit_hours * 60) / l.edit_finished_minutes).toFixed(1) : '—'
                  return `
                    <tr>
                      <td class="font-mono font-bold">${l.date}</td>
                      <td class="font-mono">${l.shoot_hours || 0}h</td>
                      <td class="font-mono">${l.shoot_raw_minutes || 0}m</td>
                      <td><strong class="text-accent font-mono">${l.edit_hours || 0}h</strong></td>
                      <td><strong class="text-green font-mono">${l.edit_finished_minutes || 0}m</strong></td>
                      <td class="font-mono text-muted">${ratio !== '—' ? `${ratio}m per fin. min` : '—'}</td>
                      <td style="max-width:240px;color:#334155;">${l.notes || '—'}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 1. MISSIONS
      if (selectedModules.missions) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>🎯 MISSIONS & STRATEGIC QUESTS</span>
              <span class="badge badge-info">${filteredGoals.length} Tracked • ${completedGoalsCount} Completed</span>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Mission Title</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Deployed On</th>
                  <th>Deadline</th>
                  <th>Completed On</th>
                  <th>Accomplishment / Notes</th>
                  <th>Progress</th>
                  <th>Reward</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredGoals.length === 0 ? '<tr><td colspan="10" class="text-muted" style="text-align:center;">No missions logged in this range.</td></tr>' : filteredGoals.map(g => {
                  const deployedStr = g.created_at ? getLocalDateStr(new Date(g.created_at)) : '—'
                  const dueDateStr = g.deadline || g.due_date || 'None'
                  const completedStr = g.completed_at ? getLocalDateStr(new Date(g.completed_at)) : (g.status === 'completed' ? 'Done' : '—')
                  const { completionNote, failureNote } = parseTaskNotes(g.description)
                  const noteText = completionNote || failureNote || '—'
                  return `
                    <tr>
                      <td><strong>${g.title}</strong></td>
                      <td><span class="badge badge-info">${g.type || 'Side Quest'}</span></td>
                      <td style="text-transform:uppercase;font-size:10.5px;">${g.category ? String(g.category).toUpperCase().replace('_', ' ') : 'GENERAL'}</td>
                      <td><span class="text-blue font-mono font-bold">${deployedStr}</span></td>
                      <td class="font-mono text-muted">${dueDateStr}</td>
                      <td><strong class="${g.status === 'completed' ? 'text-green' : 'text-muted'} font-mono">${completedStr}</strong></td>
                      <td style="max-width:200px;font-size:11px;color:#334155;">${noteText}</td>
                      <td>
                        <div class="progress-bar"><div class="progress-fill" style="width:${g.progress || 0}%"></div></div>
                        <small class="font-mono font-bold">${g.progress || 0}%</small>
                      </td>
                      <td><strong class="text-accent font-mono">+${g.xp_reward || 100} XP</strong></td>
                      <td><span class="badge ${g.status === 'completed' ? 'badge-success' : 'badge-warning'}">${(g.status || 'active').toUpperCase()}</span></td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 2. OPERATIONS
      if (selectedModules.operations) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>⚡ OPERATIONS & TACTICAL TASKS</span>
              <span class="badge badge-success">${filteredTasks.length} Total • ${completedTasksCount} Completed (${taskSuccessRate}%)</span>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Operation Title</th>
                  <th>Difficulty</th>
                  <th>Category</th>
                  <th>Deployed On</th>
                  <th>Due Date</th>
                  <th>Completed On</th>
                  <th>Debrief / Notes</th>
                  <th>Reward</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTasks.length === 0 ? '<tr><td colspan="9" class="text-muted" style="text-align:center;">No operations logged in this range.</td></tr>' : filteredTasks.map(t => {
                  const deployedStr = t.created_at ? getLocalDateStr(new Date(t.created_at)) : '—'
                  const dueDateStr = t.due_date || 'None'
                  const completedStr = t.completed_at ? getLocalDateStr(new Date(t.completed_at)) : (t.status === 'completed' ? 'Done' : '—')
                  const diffLabel = (t.difficulty || t.priority || 'MEDIUM').toUpperCase()
                  const { completionNote, failureNote } = parseTaskNotes(t.description)
                  const noteHtml = completionNote 
                    ? `<span class="text-green font-bold">${completionNote}</span>` 
                    : failureNote 
                    ? `<span class="text-red font-bold">${failureNote}</span>` 
                    : '<span class="text-muted">—</span>'

                  const isTaskFailed = t.status === 'failed' || t.status === 'cancelled'
                  const isWeeklyGoal = t.category === 'weekly_goal' || (t.description || '').includes('[Weekly Goal]')
                  const xpAmount = isWeeklyGoal ? 25 : (t.xp_reward || 30)
                  const xpDisplay = isTaskFailed ? `-${xpAmount} XP` : `+${xpAmount} XP`
                  const xpClass = isTaskFailed ? 'text-red' : 'text-accent'

                  return `
                    <tr>
                      <td><strong>${t.title}</strong></td>
                      <td><span class="badge ${t.difficulty === 'HARD' || t.difficulty === 'EXTREME' ? 'badge-danger' : t.difficulty === 'EASY' ? 'badge-info' : 'badge-warning'}">${diffLabel}</span></td>
                      <td style="text-transform:uppercase;font-size:10.5px;">${t.category ? String(t.category).toUpperCase().replace('_', ' ') : (t.stat_category || 'GENERAL')}</td>
                      <td><span class="text-blue font-mono font-bold">${deployedStr}</span></td>
                      <td class="font-mono text-muted">${dueDateStr}</td>
                      <td><strong class="${t.status === 'completed' ? 'text-green' : 'text-muted'} font-mono">${completedStr}</strong></td>
                      <td style="max-width:210px;font-size:11px;">${noteHtml}</td>
                      <td><strong class="${xpClass} font-mono">${xpDisplay}</strong></td>
                      <td><span class="badge ${t.status === 'completed' ? 'badge-success' : isTaskFailed ? 'badge-danger' : 'badge-warning'}">${(t.status || 'pending').toUpperCase()}</span></td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 3. HABITS MATRIX
      if (selectedModules.habits) {
        const curr = new Date(startDate)
        const endD = new Date(endDate)
        const dateList = []
        while (curr <= endD) {
          const yyyy = curr.getFullYear()
          const mm = String(curr.getMonth() + 1).padStart(2, '0')
          const dd = String(curr.getDate()).padStart(2, '0')
          const dateStr = `${yyyy}-${mm}-${dd}`
          dateList.push({ dateStr, dayNum: curr.getDate(), dayOfWeek: curr.getDay(), monthShort: curr.toLocaleDateString('en-US', { month: 'short' }) })
          curr.setDate(curr.getDate() + 1)
        }
        const logMap = new Map()
        filteredHabitLogs.forEach(l => { if (l.habit_id && l.date) logMap.set(`${l.habit_id}::${l.date}`, l.status || 'completed') })
        const chunks = []
        if (dateList.length > 35) { for (let i = 0; i < dateList.length; i += 31) chunks.push(dateList.slice(i, i + 31)) }
        else chunks.push(dateList)
        // Filter habits: Include active habits + stopped habits that were active during this period (or have logs in this period)
        const matrixHabits = (fetchedHabits && fetchedHabits.length > 0 ? fetchedHabits : (allHabits && allHabits.length > 0 ? allHabits : habits)).filter(h => {
          if (h.is_active !== false) return true

          // Check if stopped habit has logs in this date range
          const hasLogsInRange = filteredHabitLogs.some(l => l.habit_id === h.id && l.date >= startDate && l.date <= endDate)
          if (hasLogsInRange) return true

          // Determine stopped date
          let stoppedDateStr = null
          if (h.stopped_at) {
            const p = new Date(h.stopped_at)
            if (!isNaN(p.getTime())) stoppedDateStr = getLocalDateStr(p)
          }
          if (!stoppedDateStr && h.description) {
            const m = h.description.match(/\[STOPPED(?:_AT)?:([^\]]+)\]/i)
            if (m && m[1]) {
              const p = new Date(m[1].trim())
              if (!isNaN(p.getTime())) stoppedDateStr = getLocalDateStr(p)
              else if (/^\d{4}-\d{2}-\d{2}$/.test(m[1].trim())) stoppedDateStr = m[1].trim()
            }
          }
          if (!stoppedDateStr) {
            const logsForHabit = filteredHabitLogs.filter(l => l.habit_id === h.id && l.date)
            if (logsForHabit.length > 0) {
              const sorted = [...logsForHabit].sort((a, b) => b.date.localeCompare(a.date))
              stoppedDateStr = sorted[0].date
            } else if (h.updated_at) {
              stoppedDateStr = getLocalDateStr(new Date(h.updated_at))
            }
          }

          // If stopped on or after startDate, it was active during this period!
          if (stoppedDateStr && stoppedDateStr >= startDate) return true

          // If all-time export, include all stopped habits
          if (startDate <= '2026-01-02') return true

          return false
        })

        let habitTablesHTML = ''
        chunks.forEach((chunk, chunkIdx) => {
          const chunkStart = chunk[0].dateStr; const chunkEnd = chunk[chunk.length - 1].dateStr
          habitTablesHTML += `
            ${chunks.length > 1 ? `<h3 style="font-size:12px;color:#D4AF37;margin-top:${chunkIdx > 0 ? '18px' : '6px'};margin-bottom:6px;">📅 ${chunkStart} TO ${chunkEnd}</h3>` : ''}
            <div style="overflow-x:auto;margin-bottom:12px;">
              <table class="matrix-table">
                <thead>
                  <tr>
                    <th style="min-width:150px;text-align:left;">Routine</th>
                    <th style="width:35px;text-align:center;">XP</th>
                    ${chunk.map(d => `<th style="width:20px;text-align:center;font-size:8px;padding:2px;" title="${d.monthShort} ${d.dayNum}">${d.dayNum}</th>`).join('')}
                    <th style="width:40px;text-align:center;">DONE</th>
                    <th style="width:40px;text-align:center;">GOAL</th>
                    <th style="width:40px;text-align:center;">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${matrixHabits.map(h => {
                    let doneCount = 0; let goalCount = 0
                    const rawCreatedAt = h.created_at || h.created_date
                    let createdDateStr = null
                    if (rawCreatedAt && (rawCreatedAt.startsWith('2026-01-01') || rawCreatedAt.startsWith('2026-01-02'))) {
                      const logsForHabit = filteredHabitLogs.filter(l => l.habit_id === h.id && l.date)
                      if (logsForHabit.length > 0) { const sorted = [...logsForHabit].sort((a, b) => a.date.localeCompare(b.date)); createdDateStr = sorted[0].date }
                      else createdDateStr = getLocalDateStr()
                    } else if (rawCreatedAt) { const p = new Date(rawCreatedAt); if (!isNaN(p.getTime())) createdDateStr = getLocalDateStr(p) }
                    else createdDateStr = getLocalDateStr()

                    let stoppedDateStr = null
                    if (h.stopped_at) {
                      const p = new Date(h.stopped_at)
                      if (!isNaN(p.getTime())) stoppedDateStr = getLocalDateStr(p)
                    }
                    if (!stoppedDateStr && h.description) {
                      const m = h.description.match(/\[STOPPED(?:_AT)?:([^\]]+)\]/i)
                      if (m && m[1]) {
                        const p = new Date(m[1].trim())
                        if (!isNaN(p.getTime())) stoppedDateStr = getLocalDateStr(p)
                        else if (/^\d{4}-\d{2}-\d{2}$/.test(m[1].trim())) stoppedDateStr = m[1].trim()
                      }
                    }
                    if (!stoppedDateStr && h.is_active === false) {
                      const logsForHabit = filteredHabitLogs.filter(l => l.habit_id === h.id && l.date)
                      if (logsForHabit.length > 0) {
                        const sorted = [...logsForHabit].sort((a, b) => b.date.localeCompare(a.date))
                        stoppedDateStr = sorted[0].date
                      } else if (h.updated_at) {
                        stoppedDateStr = getLocalDateStr(new Date(h.updated_at))
                      }
                    }

                    const freqDays = h.frequency_days || [0, 1, 2, 3, 4, 5, 6]

                    const dayCellsHTML = chunk.map(dItem => {
                      const { dateStr, dayOfWeek } = dItem
                      const explicitStatus = logMap.get(`${h.id}::${dateStr}`)
                      let status = 'none'

                      if (createdDateStr && dateStr < createdDateStr) {
                        status = 'blocked'
                      } else if (stoppedDateStr && dateStr > stoppedDateStr) {
                        // After routine was stopped -> locked/stopped, does NOT count toward goal
                        status = 'stopped'
                      } else if (!freqDays.includes(dayOfWeek)) {
                        status = 'rest'
                      } else if (explicitStatus) {
                        status = explicitStatus
                      }

                      // ONLY count towards goal if scheduled AND active (UNTIL IT WAS STOPPED)
                      if (freqDays.includes(dayOfWeek) && (!createdDateStr || dateStr >= createdDateStr) && (!stoppedDateStr || dateStr <= stoppedDateStr)) {
                        goalCount++
                      }

                      if (status === 'completed') { doneCount++; return `<td class="cell cell-done" title="${dItem.monthShort} ${dItem.dayNum}: Completed">✓</td>` }
                      else if (status === 'failed') return `<td class="cell cell-fail" title="${dItem.monthShort} ${dItem.dayNum}: Failed">✗</td>`
                      else if (status === 'stopped') return `<td class="cell cell-blocked" style="background:#F1F5F9;color:#94A3B8;" title="Stopped on ${stoppedDateStr}">▨</td>`
                      else if (status === 'rest') return `<td class="cell cell-blocked" style="background:#F8FAFC;color:#CBD5E1;" title="Off-day">▨</td>`
                      else if (status === 'blocked') return `<td class="cell cell-blocked" style="background:#F8FAFC;color:#CBD5E1;" title="Pre-creation">▨</td>`
                      return `<td class="cell cell-empty"></td>`
                    }).join('')

                    const safeGoal = Math.max(0, goalCount)
                    const pct = safeGoal === 0 ? 0 : Math.round((doneCount / safeGoal) * 100)
                    const cleanTitle = (h.title || '').replace(/\[STOPPED(?:_AT)?:[^\]]+\]/gi, '').trim()
                    const stoppedBadge = h.is_active === false 
                      ? `<span class="badge badge-warning" style="font-size:8.5px;padding:1px 5px;margin-left:4px;">STOPPED ${stoppedDateStr ? `(${stoppedDateStr})` : ''}</span>`
                      : ''

                    return `<tr>
                      <td style="text-align:left;">
                        <strong>${cleanTitle}</strong>
                        ${stoppedBadge}
                      </td>
                      <td style="text-align:center;" class="text-accent font-mono font-bold">${h.xp_per_completion || 25}</td>
                      ${dayCellsHTML}
                      <td style="text-align:center;" class="text-green font-bold font-mono">${doneCount}</td>
                      <td style="text-align:center;" class="text-muted font-mono">${safeGoal}</td>
                      <td style="text-align:center;" class="${pct >= 80 ? 'text-green' : pct >= 50 ? 'text-accent' : 'text-red'} font-bold font-mono">${pct}%</td>
                    </tr>`
                  }).join('')}
                </tbody>
              </table>
            </div>
          `
        })
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>🔥 HABITS & DAILY OPS MATRIX</span>
              <span class="badge badge-danger">${matrixHabits.length} Routines (${matrixHabits.filter(h => h.is_active !== false).length} Active, ${matrixHabits.filter(h => h.is_active === false).length} Preserved) • ${startDate} TO ${endDate}</span>
            </h2>
            ${habitTablesHTML}
          </div>
        `
      }

      // 4. JOURNAL ENTRIES
      if (selectedModules.journal) {
        const moodEmoji = { great: '🟢 GREAT', good: '🟡 GOOD', okay: '🟠 OKAY', bad: '🔴 BAD', terrible: '⚫ TERRIBLE' }
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>📓 DAILY REFLECTIONS & JOURNAL LOGS</span>
              <span class="badge badge-success">${journalEntries.length} Entries</span>
            </h2>
            ${journalEntries.length === 0 ? '<p class="text-muted" style="text-align:center;padding:12px 0;">No journal entries logged in this range.</p>' : `
              <div class="journal-entries">
                ${journalEntries.map(e => {
                  const content = e.content || e.what_did_i_do || e.reflection || e.description || ''
                  const moodLabel = moodEmoji[e.mood] || (e.mood ? e.mood.toUpperCase() : '—')
                  const words = content ? content.split(/\s+/).filter(Boolean).length : (e.word_count || 0)
                  return `
                    <div class="journal-entry">
                      <div class="journal-header">
                        <span class="journal-date">📅 ${e.date}</span>
                        <span class="journal-mood">${moodLabel}</span>
                        <span class="journal-meta">${words} words</span>
                      </div>
                      <div class="journal-body">${content.replace(/\n/g, '<br>')}</div>
                    </div>
                  `
                }).join('')}
              </div>
            `}
          </div>
        `
      }

      // 5. WEEKLY DEBRIEFS
      if (selectedModules.weekly_debrief) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>📋 WEEKLY OPERATIONAL DEBRIEFS</span>
              <span class="badge badge-purple">${weeklyDebriefs.length} Debriefs</span>
            </h2>
            ${weeklyDebriefs.length === 0 ? '<p class="text-muted" style="text-align:center;padding:12px 0;">No weekly debriefs logged in this range.</p>' : `
              <div class="journal-entries">
                ${weeklyDebriefs.map(d => {
                  const content = d.description || d.notes || d.content || ''
                  return `
                    <div class="journal-entry debrief">
                      <div class="journal-header">
                        <span class="journal-date text-purple">🗓️ ${d.date}</span>
                        <span class="journal-mood text-purple font-bold">${d.title}</span>
                      </div>
                      <div class="journal-body">${content.replace(/\n/g, '<br>')}</div>
                    </div>
                  `
                }).join('')}
              </div>
            `}
          </div>
        `
      }



      // 8. SCREEN INTEL
      if (selectedModules.screen_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>📱 SCREEN DISCIPLINE INTEL</span>
              <span class="badge badge-info">${screenLogs.length} Daily Records</span>
            </h2>
            <table>
              <thead><tr><th>Date</th><th>Screen Time</th><th>Doomscroll</th><th>Streaming</th><th>Discipline Status</th></tr></thead>
              <tbody>
                ${screenLogs.length === 0 ? '<tr><td colspan="5" class="text-muted" style="text-align:center;">No screen intel logged in this range.</td></tr>' : screenLogs.map(l => `
                  <tr>
                    <td class="font-mono font-bold">${l.date}</td>
                    <td><strong class="font-mono">${l.total_hours || 0} hrs</strong></td>
                    <td class="font-mono text-muted">${l.doom_scroll_minutes || l.doomscroll_minutes || 0}m</td>
                    <td class="font-mono text-muted">${l.streaming_hours || 0} hrs</td>
                    <td><span class="badge ${parseFloat(l.total_hours) < 6 ? 'badge-success' : 'badge-danger'}">${parseFloat(l.total_hours) < 6 ? '✓ CLEAN DISCIPLINE' : '⚠ OVER THRESHOLD'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 9. SPEAKING PRACTICE
      if (selectedModules.speaking_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>🎙️ SPEAKING PRACTICE & CAMERA CONFIDENCE</span>
              <span class="badge badge-warning">${speakingLogs.length} Sessions</span>
            </h2>
            <table>
              <thead><tr><th>Date</th><th>Topic / Session</th><th>Rating</th><th>Recording Link</th><th>Debrief Notes</th></tr></thead>
              <tbody>
                ${speakingLogs.length === 0 ? '<tr><td colspan="5" class="text-muted" style="text-align:center;">No speaking sessions logged in this range.</td></tr>' : speakingLogs.map(l => `
                  <tr>
                    <td class="font-mono font-bold">${l.date}</td>
                    <td><strong>${l.day_number ? `Day ${l.day_number}: ` : ''}${l.topic || 'Speaking Practice'}</strong></td>
                    <td class="font-mono font-bold text-accent">${l.rating ? `${l.rating}/5 ⭐` : '—'}</td>
                    <td>${l.drive_link ? `<a href="${l.drive_link}" target="_blank" class="text-blue" style="text-decoration:underline;word-break:break-all;font-size:11px;">${l.drive_link}</a>` : '<span class="text-muted">—</span>'}</td>
                    <td style="color:#334155;font-size:11.5px;">${l.notes || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 10. BUDGET & DAILY EXPENSE INTELLIGENCE
      if (selectedModules.budget_intel) {
        const totalBudgetSpent = budgetLogs.reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0)
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">
              <span>💳 DAILY BUDGET & EXPENSE INTELLIGENCE</span>
              <span class="badge badge-success">${budgetLogs.length} Expenses • ₹${totalBudgetSpent.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Total</span>
            </h2>
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Note / Description</th><th style="text-align:right;">Amount (₹)</th></tr></thead>
              <tbody>
                ${budgetLogs.length === 0 ? '<tr><td colspan="4" class="text-muted" style="text-align:center;">No expenses logged in this range.</td></tr>' : budgetLogs.map(l => `
                  <tr>
                    <td class="font-mono font-bold">${l.date}</td>
                    <td>
                      <span class="badge badge-warning">${l.custom_category || l.category || 'Expense'}</span>
                    </td>
                    <td style="color:#334155;font-size:11.5px;">${l.description || '—'}</td>
                    <td style="text-align:right;"><strong class="font-mono text-accent">₹${parseFloat(l.amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }



      // ── Full HTML Document ──
      const fullHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Loki OS — Tactical Performance Report (${startDate} to ${endDate})</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 14mm;
            }

            *, *::before, *::after {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            :root {
              --bg: #F8FAFC;
              --card: #FFFFFF;
              --border: #E2E8F0;
              --border-strong: #CBD5E1;
              --text: #0F172A;
              --text-muted: #64748B;
              --accent: #B45309;
              --accent-light: #FEF3C7;
              --blue: #0284C7;
              --blue-light: #E0F2FE;
              --green: #15803D;
              --green-light: #DCFCE7;
              --red: #B91C1C;
              --red-light: #FEE2E2;
              --purple: #6D28D9;
              --purple-light: #F3E8FF;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background: var(--bg);
              color: var(--text);
              padding: 24px;
              margin: 0;
              line-height: 1.5;
              -webkit-font-smoothing: antialiased;
            }

            @media print {
              body {
                background: #FFFFFF !important;
                padding: 0 !important;
              }
            }

            /* Report Header Card */
            .report-header {
              background: #FFFFFF;
              border: 1px solid var(--border);
              border-top: 4px solid var(--accent);
              border-radius: 12px;
              padding: 20px 24px;
              margin-bottom: 22px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            }

            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 20px;
              border-bottom: 1px solid var(--border);
              padding-bottom: 16px;
              margin-bottom: 16px;
            }

            .tagline {
              font-family: monospace;
              font-size: 10.5px;
              font-weight: 700;
              letter-spacing: 1.5px;
              color: var(--accent);
              text-transform: uppercase;
              margin-bottom: 4px;
            }

            .report-title {
              font-size: 24px;
              font-weight: 800;
              letter-spacing: 0.5px;
              color: var(--text);
              margin: 0 0 6px 0;
            }

            .meta-row {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 8px;
              font-size: 11.5px;
              color: var(--text-muted);
            }

            .meta-item strong {
              color: var(--text);
            }

            .meta-sep {
              color: var(--border-strong);
            }

            .header-right {
              text-align: right;
              flex-shrink: 0;
            }

            .badge-status {
              display: inline-block;
              background: #FEF3C7;
              color: #92400E;
              border: 1px solid #FCD34D;
              padding: 3px 8px;
              border-radius: 6px;
              font-family: monospace;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 1px;
              margin-bottom: 6px;
            }

            .timestamp-label {
              font-size: 9.5px;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              color: var(--text-muted);
            }

            .timestamp-val {
              font-family: monospace;
              font-weight: 700;
              font-size: 12px;
              color: var(--text);
            }

            /* KPI Summary Cards Grid */
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 10px;
            }

            @media (max-width: 768px) {
              .kpi-grid {
                grid-template-columns: repeat(2, 1fr);
              }
            }

            .kpi-card {
              background: #F8FAFC;
              border: 1px solid var(--border);
              border-radius: 8px;
              padding: 10px 12px;
              text-align: center;
            }

            .kpi-label {
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              color: var(--text-muted);
              margin-bottom: 3px;
            }

            .kpi-val {
              font-size: 18px;
              font-weight: 800;
              font-family: monospace;
              line-height: 1.1;
              margin-bottom: 2px;
            }

            .kpi-denom {
              font-size: 11px;
              font-weight: 600;
              color: var(--text-muted);
            }

            .kpi-sub {
              font-size: 9.5px;
              color: var(--text-muted);
              font-weight: 500;
            }

            /* Sections */
            .section {
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 12px;
              padding: 18px 22px;
              margin-bottom: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.03);
              page-break-inside: auto;
            }

            .section-title {
              font-size: 13.5px;
              font-weight: 800;
              letter-spacing: 0.8px;
              color: var(--text);
              margin-top: 0;
              margin-bottom: 12px;
              border-bottom: 2px solid var(--border);
              padding-bottom: 8px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              page-break-after: avoid;
              break-after: avoid;
            }

            .sub-heading {
              font-size: 11.5px;
              font-weight: 700;
              letter-spacing: 0.5px;
              color: var(--accent);
              margin-top: 14px;
              margin-bottom: 8px;
              page-break-after: avoid;
              break-after: avoid;
            }

            /* Tables */
            table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              font-size: 11px;
              border: 1px solid var(--border);
              border-radius: 8px;
              overflow: hidden;
              margin-bottom: 12px;
            }

            thead {
              display: table-header-group;
            }

            tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }

            th {
              background: #F8FAFC;
              color: #475569;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
              padding: 8px 10px;
              border-bottom: 2px solid var(--border);
              border-right: 1px solid var(--border);
              text-align: left;
            }

            th:last-child {
              border-right: none;
            }

            td {
              padding: 7px 10px;
              border-bottom: 1px solid #F1F5F9;
              border-right: 1px solid #F1F5F9;
              vertical-align: middle;
              color: #1E293B;
            }

            td:last-child {
              border-right: none;
            }

            tbody tr:nth-child(even) {
              background: #FAFAFC;
            }

            tbody tr:last-child td {
              border-bottom: none;
            }

            /* Habits Matrix Table */
            .matrix-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              font-size: 9.5px;
              border: 1px solid var(--border);
              border-radius: 8px;
              overflow: hidden;
            }

            .matrix-table th {
              padding: 5px 2px;
              text-align: center;
              font-size: 8.5px;
              border-right: 1px solid var(--border);
              border-bottom: 2px solid var(--border);
            }

            .matrix-table td {
              padding: 4px 2px;
              border-right: 1px solid #E2E8F0;
              border-bottom: 1px solid #E2E8F0;
              text-align: center;
            }

            .cell-done {
              background: #DCFCE7 !important;
              color: #15803D !important;
              font-weight: 800;
              font-size: 11px;
            }

            .cell-fail {
              background: #FEE2E2 !important;
              color: #B91C1C !important;
              font-weight: 800;
              font-size: 11px;
            }

            .cell-blocked {
              background: #F1F5F9 !important;
              color: #94A3B8 !important;
              font-size: 8.5px;
            }

            .cell-empty {
              background: #FFFFFF;
            }

            /* Badges */
            .badge {
              display: inline-block;
              padding: 2px 7px;
              border-radius: 9999px;
              font-size: 9.5px;
              font-weight: 700;
              font-family: monospace;
              letter-spacing: 0.3px;
              white-space: nowrap;
            }

            .badge-success { background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; }
            .badge-warning { background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D; }
            .badge-danger  { background: #FEE2E2; color: #B91C1C; border: 1px solid #FCA5A5; }
            .badge-info    { background: #E0F2FE; color: #0369A1; border: 1px solid #7DD3FC; }
            .badge-purple  { background: #F3E8FF; color: #6D28D9; border: 1px solid #D8B4FE; }

            /* Progress bar */
            .progress-bar {
              width: 55px;
              height: 6px;
              background: #E2E8F0;
              border-radius: 3px;
              overflow: hidden;
              display: inline-block;
              vertical-align: middle;
              margin-right: 4px;
            }

            .progress-fill {
              height: 100%;
              background: #B45309;
              border-radius: 3px;
            }

            /* Tags & Typography Utilities */
            .work-tag {
              display: inline-block;
              padding: 1px 6px;
              border-radius: 4px;
              font-size: 9.5px;
              background: #F3E8FF;
              color: #6D28D9;
              border: 1px solid #D8B4FE;
              margin: 1px 2px;
              font-weight: 600;
            }

            .text-accent { color: #B45309; }
            .text-green  { color: #15803D; }
            .text-red    { color: #B91C1C; }
            .text-blue   { color: #0369A1; }
            .text-purple { color: #6D28D9; }
            .text-muted  { color: #64748B; }
            .font-mono   { font-family: monospace; }
            .font-bold   { font-weight: 700; }

            /* Journal & Debriefs */
            .journal-entries {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }

            .journal-entry {
              border: 1px solid var(--border);
              border-left: 4px solid var(--accent);
              padding: 12px 16px;
              background: #F8FAFC;
              border-radius: 0 8px 8px 0;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .journal-entry.debrief {
              border-left-color: #6D28D9;
            }

            .journal-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 8px;
              padding-bottom: 6px;
              border-bottom: 1px solid #E2E8F0;
              flex-wrap: wrap;
              gap: 8px;
            }

            .journal-date {
              font-weight: 800;
              font-size: 11px;
              font-family: monospace;
              color: var(--accent);
              letter-spacing: 0.5px;
            }

            .journal-mood {
              font-size: 11px;
              font-weight: 700;
            }

            .journal-meta {
              font-size: 10px;
              font-family: monospace;
              color: var(--text-muted);
            }

            .journal-body {
              font-size: 12px;
              color: #334155;
              line-height: 1.65;
              white-space: pre-wrap;
              word-break: break-word;
            }

            /* Report Footer */
            .report-footer {
              border-top: 1px solid var(--border);
              padding-top: 14px;
              margin-top: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 10px;
              font-family: monospace;
              color: var(--text-muted);
              page-break-inside: avoid;
              break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div class="header-top">
              <div>
                <div class="tagline">LOKI OS // EXECUTIVE INTELLIGENCE & AUDIT ENGINE</div>
                <h1 class="report-title">TACTICAL PERFORMANCE REPORT</h1>
                <div class="meta-row">
                  <span class="meta-item"><strong>OPERATOR:</strong> ${profile?.full_name || 'CHIRAG SHETTY'}</span>
                  <span class="meta-sep">•</span>
                  <span class="meta-item"><strong>AUDIT PERIOD:</strong> ${startDate} → ${endDate}</span>
                  <span class="meta-sep">•</span>
                  <span class="meta-item"><strong>SECURITY LEVEL:</strong> SAGA DOSSIER</span>
                </div>
              </div>
              <div class="header-right">
                <div class="badge-status">AUTHENTICATED AUDIT</div>
                <div class="timestamp-label">GENERATED ON</div>
                <div class="timestamp-val">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>

            <!-- Executive KPI Summary Banner -->
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-label">Work Logged</div>
                <div class="kpi-val text-accent">${totalWorkHours}h</div>
                <div class="kpi-sub">${totalFocusedHours}h Focused Exec</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Tasks / Ops</div>
                <div class="kpi-val text-green">${completedTasksCount} <span class="kpi-denom">/ ${totalTasksCount}</span></div>
                <div class="kpi-sub">${taskSuccessRate}% Completion Rate</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Missions / Quests</div>
                <div class="kpi-val text-blue">${completedGoalsCount} <span class="kpi-denom">/ ${totalGoalsCount}</span></div>
                <div class="kpi-sub">${totalGoalsCount - completedGoalsCount} In Progress</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Habits Matrix</div>
                <div class="kpi-val text-green">${habitCompletedLogsCount}</div>
                <div class="kpi-sub">Executions Logged</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Intel Records</div>
                <div class="kpi-val text-purple">${journalEntries.length + weeklyDebriefs.length}</div>
                <div class="kpi-sub">${journalEntries.length} Journals • ${weeklyDebriefs.length} Debriefs</div>
              </div>
            </div>
          </div>

          ${sectionsHTML || '<p style="color:var(--text-muted);text-align:center;padding:40px;">No modules selected for export.</p>'}

          <div class="report-footer">
            <div>AUTHENTICATED DOSSIER • GENERATED BY LOKI OS EXECUTIVE INTELLIGENCE ENGINE</div>
            <div>STRICTLY CONFIDENTIAL • RECORD ID: ${Date.now().toString(36).toUpperCase()}</div>
          </div>
        </body>
        </html>
      `

      const reportBlob = new Blob([fullHTML], { type: 'text/html' })
      const reportUrl = URL.createObjectURL(reportBlob)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow.document
      doc.open(); doc.write(fullHTML); doc.close()
      setTimeout(() => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 4000)
      }, 500)

    } catch (e) {
      console.error('Failed to generate intel report:', e)
      alert('Error generating report: ' + (e.message || e))
    } finally {
      setIsExporting(false)
    }
  }

  // Module definitions for UI
  const MODULE_DEFS = [
    { key: 'work_intel',      icon: Briefcase,      label: 'Work & Content Logs',     color: 'text-amber',   desc: 'Hours, type of work, content ops' },
    { key: 'budget_intel',    icon: Wallet,         label: 'Budget & Expense Logs',   color: 'text-emerald-400', desc: 'Daily expense entries & spending records' },
    { key: 'missions',        icon: Target,          label: 'Missions & Quests',        color: 'text-amber',   desc: 'Goals with lifecycle dates' },
    { key: 'operations',      icon: CheckSquare,     label: 'Operations & Tasks',       color: 'text-info',    desc: 'Tasks with deployed/completed dates' },
    { key: 'habits',          icon: Crosshair,       label: 'Habits Matrix',            color: 'text-danger',  desc: 'Daily ops completion grid' },
    { key: 'journal',         icon: BookOpen,        label: 'Journal Entries',          color: 'text-success', desc: 'Daily reflections & mood' },
    { key: 'weekly_debrief',  icon: ClipboardList,   label: 'Weekly Debriefs',          color: 'text-purple-400', desc: 'Wins, fails, next week goals' },
    { key: 'screen_intel',    icon: Monitor,         label: 'Screen Intel',             color: 'text-success', desc: 'Screen time logs' },
    { key: 'speaking_intel',  icon: Mic,             label: 'Speaking Practice',        color: 'text-amber',   desc: '30-day camera challenge & video links' },
  ]

  return (
    <AnimatePresence>
      <div
        style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:99999, backgroundColor:'rgba(4,6,10,0.92)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          style={{ backgroundColor:'#0c0e14', border:'1px solid rgba(212,175,55,0.4)', boxShadow:'0 25px 60px -15px rgba(0,0,0,0.95),0 0 30px rgba(212,175,55,0.1)', color:'#f3f4f6', width:'100%', maxWidth:'580px', borderRadius:'16px', padding:'24px', position:'relative', zIndex:100000, maxHeight:'92vh', overflowY:'auto' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor:'rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber/10 border border-amber/30 text-amber">
                <Printer size={22} />
              </div>
              <div>
                <h2 className="font-display text-lg tracking-wider text-primary uppercase">INTEL REPORT & DATA EXPORT</h2>
                <p className="font-mono text-xs text-muted">Generate tactical performance reports with all your data</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-muted hover:text-primary rounded-lg transition-colors"><X size={20} /></button>
          </div>

          <div className="py-5 space-y-5 pr-1">
            {/* Date Range */}
            <div>
              <label className="block font-mono text-xs text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                <Calendar size={14} className="text-amber" /> Select Date Range
              </label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <span className="font-mono text-[10px] text-muted block mb-1">FROM DATE</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-border-color rounded-lg px-3 py-2 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                    style={{ background:'#141824', color:'#f3f4f6' }} />
                </div>
                <div>
                  <span className="font-mono text-[10px] text-muted block mb-1">TO DATE</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-border-color rounded-lg px-3 py-2 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                    style={{ background:'#141824', color:'#f3f4f6' }} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-muted uppercase">PRESETS:</span>
                {[
                  { id:'this_week', label:'This Week' }, { id:'this_month', label:'This Month' },
                  { id:'last_30', label:'Last 30 Days' }, { id:'all', label:'All Time' }
                ].map(p => (
                  <button key={p.id} onClick={() => setPreset(p.id)}
                    className="px-2.5 py-1 border border-border-subtle rounded font-mono text-[10px] text-secondary hover:text-amber transition-colors"
                    style={{ background:'#141824' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Module Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="font-mono text-xs text-secondary uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare size={14} className="text-info" /> Select Modules to Export
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedModules(Object.fromEntries(MODULE_DEFS.map(m => [m.key, true])))}
                    className="font-mono text-[10px] text-amber hover:text-primary transition-colors">ALL</button>
                  <span className="text-muted text-[10px]">/</span>
                  <button onClick={() => setSelectedModules(Object.fromEntries(MODULE_DEFS.map(m => [m.key, false])))}
                    className="font-mono text-[10px] text-muted hover:text-primary transition-colors">NONE</button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {MODULE_DEFS.map(mod => {
                  const Icon = mod.icon
                  const isSelected = selectedModules[mod.key]
                  return (
                    <div key={mod.key} onClick={() => toggleModule(mod.key)}
                      style={{ background: isSelected ? '#1a202c' : '#10131c', border: isSelected ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)' }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${isSelected ? '' : 'opacity-55 hover:opacity-90'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon size={16} className={mod.color} />
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-primary font-semibold">{mod.label}</div>
                          <div className="font-mono text-[10px] text-muted truncate">{mod.desc}</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${isSelected ? 'bg-amber border-amber text-black' : 'border-border-color'}`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor:'rgba(255,255,255,0.1)' }}>
            <button onClick={() => generateReport('json')} disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-tertiary border border-border-color hover:border-muted rounded-xl font-mono text-xs text-secondary hover:text-primary transition-colors disabled:opacity-50">
              <FileText size={14} /> Export JSON
            </button>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl font-mono text-xs text-muted hover:text-primary transition-colors">Cancel</button>
              <button onClick={() => generateReport('report')} disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold rounded-xl shadow-lg shadow-amber/20 transition-all active:scale-95 disabled:opacity-50">
                {isExporting ? <span>Generating...</span> : <><Printer size={16} /><span>Download PDF / Report</span></>}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
