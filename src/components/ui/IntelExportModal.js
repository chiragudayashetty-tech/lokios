'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Download, Calendar, CheckSquare, Target, Monitor, 
  Scale, Moon, Crosshair, FileText, Check, Printer, Sparkles, Briefcase,
  BookOpen, Zap, Camera, Brain, ClipboardList, Mic
} from 'lucide-react'
import { useOS } from '@/lib/context/OSContext'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr, parseTaskNotes } from '@/lib/utils/dates'

export default function IntelExportModal({ isOpen, onClose }) {
  const { auth: { user }, profile: { profile }, goals: { goals }, tasks: { tasks }, habits: { habits, stoppedHabits, allHabits, monthLogs } } = useOS()

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
    proof_of_work: true,
    brain_dump: false,
    screen_intel: true,
    weight_recon: true,
    sleep_intel: true,
    speaking_intel: true,
    xp_timeline: true,
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
        screenRes, weightRes, sleepRes,
        workHoursRes, workRes, contentRes,
        habitLogsRes, journalRes, brainDumpRes, speakingRes, xpHistoryRes
      ] = await Promise.all([
        supabase.from('screen_time_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('weight_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('sleep_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('work_hours_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        supabase.from('work_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('content_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('journal_entries').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        supabase.from('brain_dump').select('*').eq('user_id', user.id).gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59.999Z').order('created_at', { ascending: false }),
        supabase.from('speaking_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        supabase.from('xp_history').select('*').eq('user_id', user.id).gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59.999Z').order('created_at', { ascending: false })
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
      const weightLogs = weightRes.data || []
      const sleepLogs = sleepRes.data || []
      let speakingLogs = speakingRes?.data || []
      if (speakingLogs.length === 0 && typeof window !== 'undefined') {
        const cached = localStorage.getItem(`lokios_speaking_logs_${user.id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          speakingLogs = parsed.filter(l => l.date >= startDate && l.date <= endDate)
        }
      }
      const fetchedHabitLogs = (habitLogsRes.data && habitLogsRes.data.length > 0) ? habitLogsRes.data : (monthLogs || [])
      const journalEntries = journalRes.data || []
      const brainDumps = brainDumpRes.data || []

      // Weekly debriefs from work_logs
      const weeklyDebriefs = allWorkLogs.filter(l =>
        l.title && l.title.toLowerCase().startsWith('weekly debrief') &&
        l.date >= startDate && l.date <= endDate
      )

      // Proof of work — work_logs with media_urls
      const proofLogs = allWorkLogs.filter(l =>
        Array.isArray(l.media_urls) && l.media_urls.length > 0 &&
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
          proof_of_work: selectedModules.proof_of_work ? proofLogs : undefined,
          brain_dump: selectedModules.brain_dump ? brainDumps : undefined,
          screen_intel: selectedModules.screen_intel ? screenLogs : undefined,
          weight_recon: selectedModules.weight_recon ? weightLogs : undefined,
          sleep_intel: selectedModules.sleep_intel ? sleepLogs : undefined,
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
      let sectionsHTML = ''

      // 0. WORK & CONTENT INTELLIGENCE
      if (selectedModules.work_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">💼 WORK & CONTENT INTELLIGENCE LOGS</h2>
            <h3 style="font-size: 13px; color: #D4AF37; margin-top: 10px; margin-bottom: 8px;">⏱️ WORK LOGS (${workLogs.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Worked</th>
                  <th>Beyond Tatva</th>
                  <th>Focused</th>
                  <th>Unfocused</th>
                  <th style="color: #A78BFA;">Type of Work</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${workLogs.map(l => {
                  const typeTagsHTML = l.work_type
                    ? l.work_type.split(',').map(t => t.trim()).filter(Boolean)
                        .map(t => `<span class="work-tag">${t}</span>`).join(' ')
                    : '—'
                  return `
                    <tr>
                      <td>${l.date}</td>
                      <td><strong style="color: #D4AF37;">${l.total_hours_worked || 0}h</strong></td>
                      <td style="color: #00F0FF;">${l.beyond_tatva_hours || 0}h</td>
                      <td style="color: #10B981;">${l.focused_hours || 0}h</td>
                      <td style="color: #EF4444;">${(l.unfocused_hours ?? l.deep_execution_hours) || 0}h</td>
                      <td>${typeTagsHTML}</td>
                      <td>${l.notes || '—'}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>

            <h3 style="font-size: 13px; color: #00F0FF; margin-top: 18px; margin-bottom: 8px;">🎬 CONTENT OPERATIONS LOGS (${contentLogs.length})</h3>
            <table>
              <thead>
                <tr><th>Date</th><th>Shoot Hrs</th><th>Raw Footage</th><th>Edit Hrs</th><th>Finished Output</th><th>Edit Speed</th><th>Notes</th></tr>
              </thead>
              <tbody>
                ${contentLogs.map(l => {
                  const ratio = l.edit_finished_minutes > 0 ? ((l.edit_hours * 60) / l.edit_finished_minutes).toFixed(1) : '—'
                  return `
                    <tr>
                      <td>${l.date}</td>
                      <td>${l.shoot_hours || 0}h</td>
                      <td>${l.shoot_raw_minutes || 0}m</td>
                      <td><strong style="color: #D4AF37;">${l.edit_hours || 0}h</strong></td>
                      <td><strong style="color: #10B981;">${l.edit_finished_minutes || 0}m</strong></td>
                      <td>${ratio}m per fin. min</td>
                      <td>${l.notes || '—'}</td>
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
            <h2 class="section-title">🎯 MISSIONS & QUESTS (${filteredGoals.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Mission Title</th><th>Type</th><th>Category</th>
                  <th style="color:#60A5FA;">Deployed On</th>
                  <th>Deadline</th>
                  <th style="color:#10B981;">Completed On</th>
                  <th>Accomplishment / Notes</th>
                  <th>Progress</th><th>Reward</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredGoals.map(g => {
                  const deployedStr = g.created_at ? getLocalDateStr(new Date(g.created_at)) : '—'
                  const dueDateStr = g.deadline || g.due_date || 'None'
                  const completedStr = g.completed_at ? getLocalDateStr(new Date(g.completed_at)) : (g.status === 'completed' ? 'Done' : '—')
                  const { completionNote, failureNote } = parseTaskNotes(g.description)
                  const noteText = completionNote || failureNote || '—'
                  return `
                    <tr>
                      <td><strong>${g.title}</strong></td>
                      <td><span class="badge badge-info">${g.type || 'Side Quest'}</span></td>
                      <td>${g.category ? String(g.category).toUpperCase().replace('_', ' ') : 'GENERAL'}</td>
                      <td><strong style="color:#60A5FA;">${deployedStr}</strong></td>
                      <td>${dueDateStr}</td>
                      <td><span style="${g.status === 'completed' ? 'color:#10B981;font-weight:bold;' : 'color:#9CA3AF;'}">${completedStr}</span></td>
                      <td style="max-width:200px;font-size:11px;">${noteText}</td>
                      <td>
                        <div class="progress-bar"><div class="progress-fill" style="width:${g.progress || 0}%"></div></div>
                        <small>${g.progress || 0}%</small>
                      </td>
                      <td class="text-amber">+${g.xp_reward || 100} XP</td>
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
            <h2 class="section-title">⚡ OPERATIONS / TASKS (${filteredTasks.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Operation Title</th><th>Difficulty</th><th>Category</th>
                  <th style="color:#60A5FA;">Deployed On</th>
                  <th>Due Date</th>
                  <th style="color:#10B981;">Completed On</th>
                  <th>Completion / Failure Notes</th>
                  <th>Reward</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTasks.map(t => {
                  const deployedStr = t.created_at ? getLocalDateStr(new Date(t.created_at)) : '—'
                  const dueDateStr = t.due_date || 'None'
                  const completedStr = t.completed_at ? getLocalDateStr(new Date(t.completed_at)) : (t.status === 'completed' ? 'Done' : '—')
                  const diffLabel = (t.difficulty || t.priority || 'MEDIUM').toUpperCase()
                  const { completionNote, failureNote } = parseTaskNotes(t.description)
                  const noteHtml = completionNote 
                    ? `<span style="color:#10B981;">${completionNote}</span>` 
                    : failureNote 
                    ? `<span style="color:#EF4444;">${failureNote}</span>` 
                    : '—'

                  const isTaskFailed = t.status === 'failed' || t.status === 'cancelled'
                  const isWeeklyGoal = t.category === 'weekly_goal' || (t.description || '').includes('[Weekly Goal]')
                  const xpAmount = isWeeklyGoal ? 25 : (t.xp_reward || 30)
                  const xpDisplay = isTaskFailed ? `-${xpAmount} XP` : `+${xpAmount} XP`
                  const xpColorStyle = isTaskFailed ? 'color:#EF4444;font-weight:bold;' : 'color:#D4AF37;font-weight:bold;'

                  return `
                    <tr>
                      <td><strong>${t.title}</strong></td>
                      <td><span class="badge ${t.difficulty === 'HARD' || t.difficulty === 'EXTREME' ? 'badge-danger' : t.difficulty === 'EASY' ? 'badge-info' : 'badge-warning'}">${diffLabel}</span></td>
                      <td>${t.category ? String(t.category).toUpperCase().replace('_', ' ') : (t.stat_category || 'GENERAL')}</td>
                      <td><strong style="color:#60A5FA;">${deployedStr}</strong></td>
                      <td>${dueDateStr}</td>
                      <td><span style="${t.status === 'completed' ? 'color:#10B981;font-weight:bold;' : 'color:#9CA3AF;'}">${completedStr}</span></td>
                      <td style="max-width:200px;font-size:11px;">${noteHtml}</td>
                      <td><span style="${xpColorStyle}">${xpDisplay}</span></td>
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
                  ${(allHabits && allHabits.length > 0 ? allHabits : habits).map(h => {
                    let doneCount = 0; let goalCount = 0
                    const rawCreatedAt = h.created_at || h.created_date
                    let createdDateStr = null
                    if (rawCreatedAt && (rawCreatedAt.startsWith('2026-01-01') || rawCreatedAt.startsWith('2026-01-02'))) {
                      const logsForHabit = filteredHabitLogs.filter(l => l.habit_id === h.id && l.date)
                      if (logsForHabit.length > 0) { const sorted = [...logsForHabit].sort((a, b) => a.date.localeCompare(b.date)); createdDateStr = sorted[0].date }
                      else createdDateStr = getLocalDateStr()
                    } else if (rawCreatedAt) { const p = new Date(rawCreatedAt); if (!isNaN(p.getTime())) createdDateStr = getLocalDateStr(p) }
                    else createdDateStr = getLocalDateStr()

                    const stoppedDateStr = h.stopped_at ? getLocalDateStr(new Date(h.stopped_at)) : null
                    const freqDays = h.frequency_days || [0, 1, 2, 3, 4, 5, 6]

                    const dayCellsHTML = chunk.map(dItem => {
                      const { dateStr, dayOfWeek } = dItem
                      const explicitStatus = logMap.get(`${h.id}::${dateStr}`)
                      let status = 'none'

                      if (createdDateStr && dateStr < createdDateStr) {
                        status = 'blocked'
                      } else if (stoppedDateStr && dateStr > stoppedDateStr) {
                        status = 'blocked'
                      } else if (!freqDays.includes(dayOfWeek)) {
                        status = 'blocked'
                      } else if (explicitStatus) {
                        status = explicitStatus
                      }

                      if (freqDays.includes(dayOfWeek) && (!createdDateStr || dateStr >= createdDateStr) && (!stoppedDateStr || dateStr <= stoppedDateStr)) {
                        goalCount++
                      }

                      if (status === 'completed') { doneCount++; return `<td class="cell cell-done">✓</td>` }
                      else if (status === 'failed') return `<td class="cell cell-fail">✗</td>`
                      else if (status === 'blocked') { return `<td class="cell cell-blocked" title="Pre-creation / Stopped / Off-day">▨</td>` }
                      return `<td class="cell cell-empty"></td>`
                    }).join('')
                    const safeGoal = Math.max(0, goalCount)
                    const pct = safeGoal === 0 ? 0 : Math.round((doneCount / safeGoal) * 100)
                    return `<tr>
                      <td style="text-align:left;">
                        <strong>${h.title}</strong>
                        ${h.is_active === false ? '<span style="font-size:9px;color:#EF4444;margin-left:4px;font-family:monospace;">[STOPPED]</span>' : ''}
                      </td>
                      <td style="text-align:center;" class="text-amber">${h.xp_per_completion || 25}</td>
                      ${dayCellsHTML}
                      <td style="text-align:center;color:var(--green);font-weight:bold;">${doneCount}</td>
                      <td style="text-align:center;color:var(--muted);">${safeGoal}</td>
                      <td style="text-align:center;font-weight:bold;color:${pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--accent)' : 'var(--red)'}">${pct}%</td>
                    </tr>`
                  }).join('')}
                </tbody>
              </table>
            </div>
          `
        })
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🔥 HABITS & DAILY OPS MATRIX (${(allHabits && allHabits.length > 0 ? allHabits : habits).length} Routines) · ${startDate} TO ${endDate}</h2>
            ${habitTablesHTML}
          </div>
        `
      }

      // 4. JOURNAL ENTRIES
      if (selectedModules.journal) {
        const moodEmoji = { great: '🟢 GREAT', good: '🟡 GOOD', okay: '🟠 OKAY', bad: '🔴 BAD', terrible: '⚫ TERRIBLE' }
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">📓 JOURNAL ENTRIES (${journalEntries.length})</h2>
            ${journalEntries.length === 0 ? '<p style="color:var(--muted);font-size:13px;">No journal entries in this range.</p>' : `
              <div class="journal-entries">
                ${journalEntries.map(e => {
                  const content = e.content || e.what_did_i_do || e.reflection || e.description || ''
                  const moodLabel = moodEmoji[e.mood] || (e.mood ? e.mood.toUpperCase() : '—')
                  const words = content ? content.split(/\s+/).filter(Boolean).length : (e.word_count || 0)
                  return `
                    <div class="journal-entry">
                      <div class="journal-header">
                        <span class="journal-date">${e.date}</span>
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
            <h2 class="section-title">📋 WEEKLY DEBRIEFS (${weeklyDebriefs.length})</h2>
            ${weeklyDebriefs.length === 0 ? '<p style="color:var(--muted);font-size:13px;">No weekly debriefs in this range.</p>' : `
              <div class="journal-entries">
                ${weeklyDebriefs.map(d => {
                  const content = d.description || d.notes || d.content || ''
                  return `
                    <div class="journal-entry" style="border-left-color:#A78BFA;">
                      <div class="journal-header">
                        <span class="journal-date" style="color:#A78BFA;">${d.date}</span>
                        <span class="journal-mood" style="color:#A78BFA;">${d.title}</span>
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

      // 6. PROOF OF WORK / PORTFOLIO LOG
      if (selectedModules.proof_of_work) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🏆 PROOF OF WORK / PORTFOLIO LOG (${proofLogs.length} entries)</h2>
            ${proofLogs.length === 0 ? '<p style="color:var(--muted);font-size:13px;">No proof of work entries in this range.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Title</th><th>Description</th><th>Proof Links</th>
                  </tr>
                </thead>
                <tbody>
                  ${proofLogs.map(l => `
                    <tr>
                      <td>${l.date || '—'}</td>
                      <td><strong>${l.title || '—'}</strong></td>
                      <td>${l.description || l.notes || '—'}</td>
                      <td>
                        ${(l.media_urls || []).map((url, i) => `
                          <a href="${url}" style="color:#D4AF37;display:block;font-size:11px;" target="_blank">🔗 Proof #${i + 1}</a>
                        `).join('')}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        `
      }

      // 7. BRAIN DUMP (optional)
      if (selectedModules.brain_dump) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🧠 BRAIN DUMP LOG (${brainDumps.length})</h2>
            ${brainDumps.length === 0 ? '<p style="color:var(--muted);font-size:13px;">No brain dump entries in this range.</p>' : `
              <table>
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Content</th></tr>
                </thead>
                <tbody>
                  ${brainDumps.map(b => `
                    <tr>
                      <td>${b.created_at ? b.created_at.slice(0, 10) : '—'}</td>
                      <td><span class="badge badge-info">${b.type || 'thought'}</span></td>
                      <td>${(b.content || '').replace(/\n/g, ' ')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        `
      }

      // 8. SCREEN INTEL
      if (selectedModules.screen_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">📱 SCREEN INTEL LOGS (${screenLogs.length})</h2>
            <table>
              <thead><tr><th>Date</th><th>Screen Time</th><th>Doomscroll</th><th>Streaming</th><th>Status</th></tr></thead>
              <tbody>
                ${screenLogs.map(l => `
                  <tr>
                    <td>${l.date}</td>
                    <td><strong>${l.total_hours || 0}hrs</strong></td>
                    <td>${l.doom_scroll_minutes || l.doomscroll_minutes || 0}m</td>
                    <td>${l.streaming_hours || 0}hrs</td>
                    <td><span class="badge ${parseFloat(l.total_hours) < 6 ? 'badge-success' : 'badge-danger'}">${parseFloat(l.total_hours) < 6 ? 'CLEAN' : 'OVER LIMIT'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 9. WEIGHT RECON
      if (selectedModules.weight_recon) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">⚖️ WEIGHT RECON LOGS (${weightLogs.length})</h2>
            <table>
              <thead><tr><th>Date</th><th>Weight (kg)</th><th>Body Fat %</th><th>Notes</th></tr></thead>
              <tbody>
                ${weightLogs.map(l => `
                  <tr>
                    <td>${l.date}</td>
                    <td><strong class="text-amber">${l.weight_kg ?? l.weight ?? '—'}kg</strong></td>
                    <td>${l.body_fat_percentage ? `${l.body_fat_percentage}%` : '—'}</td>
                    <td>${l.notes || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 10. SLEEP INTEL
      if (selectedModules.sleep_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🌙 SLEEP INTEL LOGS (${sleepLogs.length})</h2>
            <table>
              <thead><tr><th>Date</th><th>Bedtime</th><th>Wake Time</th><th>Duration</th><th>Quality</th></tr></thead>
              <tbody>
                ${sleepLogs.map(l => `
                  <tr>
                    <td>${l.date}</td>
                    <td>${l.bedtime || '—'}</td>
                    <td>${l.wake_time || '—'}</td>
                    <td><strong>${l.duration_hours || 0}hrs</strong></td>
                    <td><span class="badge ${l.quality_score >= 8 ? 'badge-success' : l.quality_score >= 5 ? 'badge-warning' : 'badge-danger'}">${l.quality_score || 5}/10</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 11. SPEAKING PRACTICE
      if (selectedModules.speaking_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🎙️ SPEAKING PRACTICE & CAMERA CHALLENGE (${speakingLogs.length})</h2>
            <table>
              <thead><tr><th>Date</th><th>Topic / Title</th><th>Prep Time</th><th>Drive Link / Video Proof</th><th>Notes</th></tr></thead>
              <tbody>
                ${speakingLogs.map(l => `
                  <tr>
                    <td>${l.date}</td>
                    <td><strong>${l.day_number ? `Day ${l.day_number}: ` : ''}${l.topic || 'Speaking Practice'}</strong></td>
                    <td>${l.prep_duration_minutes || 10} min</td>
                    <td>${l.drive_link ? `<a href="${l.drive_link}" target="_blank" style="color: var(--cyan); text-decoration: underline;">${l.drive_link}</a>` : '—'}</td>
                    <td>${l.notes || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      const xpHistoryLogs = xpHistoryRes?.data || []

      // 12. XP TIMELINE AUDIT TRAIL
      if (selectedModules.xp_timeline) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">⚡ XP TIMELINE AUDIT TRAIL (${xpHistoryLogs.length} Events)</h2>
            <table>
              <thead><tr><th>Timestamp</th><th>Description</th><th>Stat Category</th><th>Source</th><th>XP Amount</th></tr></thead>
              <tbody>
                ${xpHistoryLogs.map(x => {
                  const isPos = (x.amount || 0) > 0
                  const isNeg = (x.amount || 0) < 0
                  const dtStr = x.created_at ? new Date(x.created_at).toLocaleString() : '—'
                  const color = isPos ? 'var(--green)' : isNeg ? 'var(--red)' : 'var(--muted)'
                  const sign = isPos ? '+' : ''
                  return `
                    <tr>
                      <td style="font-family:monospace;font-size:11px;color:var(--muted);">${dtStr}</td>
                      <td><strong>${x.description || 'XP Event'}</strong></td>
                      <td><span class="badge badge-warning">${(x.stat_category || 'GENERAL').toUpperCase()}</span></td>
                      <td style="font-family:monospace;font-size:11px;">${x.source_type || 'system'}</td>
                      <td><strong style="color:${color};font-family:monospace;">${sign}${x.amount || 0} XP</strong></td>
                    </tr>
                  `
                }).join('')}
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
          <title>Loki OS — Tactical Performance Report</title>
          <style>
            :root {
              --bg: #090A0F; --card: #12151E; --border: #262B3D;
              --text: #F3F4F6; --muted: #9CA3AF; --accent: #D4AF37;
              --cyan: #00F0FF; --green: #10B981; --red: #EF4444; --amber: #D4AF37;
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; background: var(--bg); color: var(--text); padding: 40px; margin: 0; }
            .header { border-bottom: 2px solid var(--accent); padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 28px; font-weight: 800; letter-spacing: 2px; color: var(--accent); margin: 0; }
            .subtitle { color: var(--muted); font-size: 13px; margin-top: 5px; }
            .section { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 25px; }
            .section-title { font-size: 16px; letter-spacing: 1px; color: var(--cyan); margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
            th { color: var(--muted); font-weight: 600; text-transform: uppercase; font-size: 11px; }
            .matrix-table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .matrix-table th, .matrix-table td { padding: 6px 4px; border: 1px solid var(--border); text-align: center; }
            .cell-done { background: rgba(16,185,129,0.25); color: #10B981; font-weight: bold; }
            .cell-fail { background: rgba(239,68,68,0.25); color: #EF4444; font-weight: bold; }
            .cell-blocked { color: #6B7280; opacity: 0.5; }
            .cell-empty { background: rgba(255,255,255,0.02); }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
            .badge-success { background: rgba(16,185,129,0.2); color: var(--green); border: 1px solid var(--green); }
            .badge-warning { background: rgba(212,175,55,0.2); color: var(--accent); border: 1px solid var(--accent); }
            .badge-danger { background: rgba(239,68,68,0.2); color: var(--red); border: 1px solid var(--red); }
            .badge-info { background: rgba(0,240,255,0.2); color: var(--cyan); border: 1px solid var(--cyan); }
            .text-amber { color: var(--accent); font-weight: bold; }
            .progress-bar { width: 80px; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle; }
            .progress-fill { height: 100%; background: var(--accent); }
            .work-tag { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; background: rgba(167,139,250,0.2); color: #A78BFA; border: 1px solid rgba(167,139,250,0.4); margin: 1px 2px; }
            /* Journal Styles */
            .journal-entries { display: flex; flex-direction: column; gap: 14px; }
            .journal-entry { border-left: 3px solid var(--accent); padding: 12px 16px; background: rgba(255,255,255,0.03); border-radius: 0 8px 8px 0; }
            .journal-header { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; flex-wrap: wrap; }
            .journal-date { font-weight: 700; font-size: 12px; color: var(--accent); letter-spacing: 1px; }
            .journal-mood { font-size: 12px; color: var(--cyan); }
            .journal-meta { font-size: 11px; color: var(--muted); }
            .journal-body { font-size: 13px; color: var(--text); line-height: 1.7; white-space: pre-wrap; }
            @media print {
              body { background: #fff; color: #000; padding: 20px; }
              .section { background: #fff; border: 1px solid #ccc; color: #000; }
              .section-title { color: #000; border-bottom-color: #ccc; }
              th, td { border-bottom-color: #eee; } th { color: #555; }
              .badge { border: 1px solid #999; }
              .journal-entry { border-left: 3px solid #999; background: #f9f9f9; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">LOKI OS // TACTICAL PERFORMANCE REPORT</h1>
              <div class="subtitle">OPERATOR: ${profile?.full_name || 'CHIRAG'} | PERIOD: ${startDate} → ${endDate}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;color:var(--muted);">GENERATED ON</div>
              <div style="font-weight:bold;font-size:14px;color:var(--cyan);">${new Date().toLocaleString()}</div>
            </div>
          </div>
          ${sectionsHTML || '<p style="color:var(--muted);text-align:center;">No modules selected.</p>'}
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
    { key: 'missions',        icon: Target,          label: 'Missions & Quests',        color: 'text-amber',   desc: 'Goals with lifecycle dates' },
    { key: 'operations',      icon: CheckSquare,     label: 'Operations & Tasks',       color: 'text-info',    desc: 'Tasks with deployed/completed dates' },
    { key: 'habits',          icon: Crosshair,       label: 'Habits Matrix',            color: 'text-danger',  desc: 'Daily ops completion grid' },
    { key: 'journal',         icon: BookOpen,        label: 'Journal Entries',          color: 'text-success', desc: 'Daily reflections & mood' },
    { key: 'weekly_debrief',  icon: ClipboardList,   label: 'Weekly Debriefs',          color: 'text-purple-400', desc: 'Wins, fails, next week goals' },
    { key: 'proof_of_work',   icon: Camera,          label: 'Proof of Work / Portfolio',color: 'text-amber',   desc: 'Portfolio log with media links' },
    { key: 'brain_dump',      icon: Brain,           label: 'Brain Dump Log',           color: 'text-info',    desc: 'Raw thoughts & ideas' },
    { key: 'screen_intel',    icon: Monitor,         label: 'Screen Intel',             color: 'text-success', desc: 'Screen time logs' },
    { key: 'weight_recon',    icon: Scale,           label: 'Weight Recon',             color: 'text-amber',   desc: 'Weight & body fat logs' },
    { key: 'sleep_intel',     icon: Moon,            label: 'Sleep Intel',              color: 'text-info',    desc: 'Bedtime, wake, quality' },
    { key: 'speaking_intel',  icon: Mic,             label: 'Speaking Practice',        color: 'text-amber',   desc: '30-day camera challenge & video links' },
    { key: 'xp_timeline',     icon: Zap,             label: 'XP Timeline Audit Log',    color: 'text-amber',   desc: 'Minute-to-minute XP additions, deductions & auto-penalties' },
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
