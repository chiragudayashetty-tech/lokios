'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Download, Calendar, CheckSquare, Target, Monitor, 
  Scale, Moon, Crosshair, FileText, Check, Printer, Sparkles, Briefcase
} from 'lucide-react'
import { useOS } from '@/lib/context/OSContext'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'

export default function IntelExportModal({ isOpen, onClose }) {
  const { auth: { user }, profile: { profile }, goals: { goals }, tasks: { tasks }, habits: { habits, monthLogs } } = useOS()

  // Default to current month range
  const now = new Date()
  const firstDayStr = getLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const todayStr = getLocalDateStr(now)

  const [startDate, setStartDate] = useState(firstDayStr)
  const [endDate, setEndDate] = useState(todayStr)

  // Module selections
  const [selectedModules, setSelectedModules] = useState({
    work_intel: true,
    missions: true,
    operations: true,
    screen_intel: true,
    weight_recon: true,
    sleep_intel: true,
    habits: true
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
      const past = new Date()
      past.setDate(past.getDate() - 30)
      setStartDate(getLocalDateStr(past))
      setEndDate(getLocalDateStr(today))
    } else if (preset === 'this_week') {
      const past = new Date()
      past.setDate(past.getDate() - 7)
      setStartDate(getLocalDateStr(past))
      setEndDate(getLocalDateStr(today))
    } else if (preset === 'all') {
      setStartDate('2026-01-01')
      setEndDate(getLocalDateStr(today))
    }
  }

  // ── Fetch all data and build HTML Report Document ──
  const generateReport = async (format = 'report') => {
    if (!user) return
    setIsExporting(true)

    try {
      const supabase = createClient()

      // Fetch supplementary tables for the date range
      const [screenRes, weightRes, sleepRes, workHoursRes, workRes, contentRes, habitLogsRes] = await Promise.all([
        supabase.from('screen_time_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('weight_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('sleep_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('work_hours_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('work_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('content_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true })
      ])

      let workLogs = (workHoursRes.data && workHoursRes.data.length > 0) ? workHoursRes.data : (workRes.data || [])
      let contentLogs = contentRes.data || []

      // Fallback cache if empty
      if (workLogs.length === 0 && typeof window !== 'undefined') {
        const cached = localStorage.getItem('lokios_work_logs_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          workLogs = parsed.filter(l => l.date >= startDate && l.date <= endDate)
        }
      }

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
      const fetchedHabitLogs = (habitLogsRes.data && habitLogsRes.data.length > 0) ? habitLogsRes.data : (monthLogs || [])

      // Filter local state by date range (by due_date, completed_at, or created_at)
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
        
        if (cDate && cDate >= startDate && cDate <= endDate) return true
        if (dDate && dDate >= startDate && dDate <= endDate) return true
        return !dDate
      })

      const filteredHabitLogs = fetchedHabitLogs.filter(l => l.date >= startDate && l.date <= endDate)

      if (format === 'json') {
        const payload = {
          report_metadata: {
            user: profile?.full_name || 'Operator',
            export_date: new Date().toISOString(),
            range: { startDate, endDate }
          },
          work_intel: selectedModules.work_intel ? { work_logs: workLogs, content_logs: contentLogs } : undefined,
          missions: selectedModules.missions ? filteredGoals : undefined,
          operations: selectedModules.operations ? filteredTasks : undefined,
          screen_intel: selectedModules.screen_intel ? screenLogs : undefined,
          weight_recon: selectedModules.weight_recon ? weightLogs : undefined,
          sleep_intel: selectedModules.sleep_intel ? sleepLogs : undefined,
          habits: selectedModules.habits ? { habits, logs: filteredHabitLogs } : undefined
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

      // Build rich, color-coded HTML Report Document
      let sectionsHTML = ''

      // 0. WORK & CONTENT INTELLIGENCE SECTION
      if (selectedModules.work_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">💼 WORK & CONTENT INTELLIGENCE LOGS</h2>
            <h3 style="font-size: 13px; color: var(--amber); margin-top: 10px; margin-bottom: 8px;">⏱️ WORK LOGS (${workLogs.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Worked</th>
                  <th>Beyond Tatva</th>
                  <th>Focused Hours</th>
                  <th>Unfocused Hours</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${workLogs.map(l => `
                  <tr>
                    <td>${l.date}</td>
                    <td><strong style="color: #D4AF37;">${l.total_hours_worked || 0} h</strong></td>
                    <td>${l.beyond_tatva_hours || 0} h</td>
                    <td>${l.focused_hours || 0} h</td>
                    <td><strong style="color: #EF4444;">${(l.unfocused_hours ?? l.deep_execution_hours) || 0} h</strong></td>
                    <td>${l.notes || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <h3 style="font-size: 13px; color: var(--cyan); margin-top: 18px; margin-bottom: 8px;">🎬 CONTENT OPERATIONS LOGS (${contentLogs.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shoot Hours</th>
                  <th>Raw Footage</th>
                  <th>Edit Hours</th>
                  <th>Finished Output</th>
                  <th>Edit Speed</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${contentLogs.map(l => {
                  const ratio = l.edit_finished_minutes > 0 ? ((l.edit_hours * 60) / l.edit_finished_minutes).toFixed(1) : '—'
                  return `
                    <tr>
                      <td>${l.date}</td>
                      <td>${l.shoot_hours || 0} h</td>
                      <td>${l.shoot_raw_minutes || 0} m</td>
                      <td><strong style="color: #D4AF37;">${l.edit_hours || 0} h</strong></td>
                      <td><strong style="color: #10B981;">${l.edit_finished_minutes || 0} m</strong></td>
                      <td>${ratio} m edit / finished m</td>
                      <td>${l.notes || '—'}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 1. MISSIONS SECTION
      if (selectedModules.missions) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🎯 MISSIONS & QUESTS (${filteredGoals.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Mission Title</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Set Due Date</th>
                  <th>Completed On</th>
                  <th>Progress</th>
                  <th>Reward</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredGoals.map(g => {
                  const dueDateStr = g.deadline || g.due_date || 'None'
                  const completedStr = g.completed_at ? getLocalDateStr(new Date(g.completed_at)) : (g.status === 'completed' ? 'Done' : '—')
                  return `
                    <tr>
                      <td><strong>${g.title}</strong></td>
                      <td><span class="badge badge-info">${g.type || 'Side Quest'}</span></td>
                      <td>${g.category ? String(g.category).toUpperCase().replace('_', ' ') : 'GENERAL'}</td>
                      <td><strong style="color: #60A5FA;">${dueDateStr}</strong></td>
                      <td><span style="${g.status === 'completed' ? 'color: #10B981; font-weight: bold;' : 'color: #9CA3AF;'}">${completedStr}</span></td>
                      <td>
                        <div class="progress-bar">
                          <div class="progress-fill" style="width: ${g.progress || 0}%"></div>
                        </div>
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

      // 2. OPERATIONS SECTION
      if (selectedModules.operations) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">⚡ OPERATIONS / TASKS (${filteredTasks.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Operation Title</th>
                  <th>Difficulty</th>
                  <th>Category</th>
                  <th>Set Due Date</th>
                  <th>Completed On</th>
                  <th>Reward</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTasks.map(t => {
                  const dueDateStr = t.due_date || 'None'
                  const completedStr = t.completed_at ? getLocalDateStr(new Date(t.completed_at)) : (t.status === 'completed' ? 'Done' : '—')
                  const diffLabel = (t.difficulty || t.priority || 'MEDIUM').toUpperCase()
                  return `
                    <tr>
                      <td><strong>${t.title}</strong></td>
                      <td><span class="badge ${t.difficulty === 'HARD' || t.difficulty === 'EXTREME' ? 'badge-danger' : t.difficulty === 'EASY' ? 'badge-info' : 'badge-warning'}">${diffLabel}</span></td>
                      <td>${t.category ? String(t.category).toUpperCase().replace('_', ' ') : (t.stat_category || 'GENERAL')}</td>
                      <td><strong style="color: #60A5FA;">${dueDateStr}</strong></td>
                      <td><span style="${t.status === 'completed' ? 'color: #10B981; font-weight: bold;' : 'color: #9CA3AF;'}">${completedStr}</span></td>
                      <td class="text-amber">+${t.xp_reward || 30} XP</td>
                      <td><span class="badge ${t.status === 'completed' ? 'badge-success' : t.status === 'cancelled' || t.status === 'failed' ? 'badge-danger' : 'badge-warning'}">${(t.status || 'pending').toUpperCase()}</span></td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 3. HABITS MATRIX SPREADSHEET CHART SECTION
      if (selectedModules.habits) {
        const rangeStart = new Date(startDate)
        const year = rangeStart.getFullYear()
        const month = rangeStart.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1)
        const logMap = new Map()
        fetchedHabitLogs.forEach(l => {
          if (l.habit_id && l.date) {
            logMap.set(`${l.habit_id}::${l.date}`, l.status || 'completed')
          }
        })

        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🔥 DAILY OPS / HABITS MATRIX SPREADSHEET (${habits.length} Routines) · ${startDate} TO ${endDate}</h2>
            <div style="overflow-x: auto;">
              <table class="matrix-table">
                <thead>
                  <tr>
                    <th style="min-width: 150px; text-align: left;">Routine Title</th>
                    <th style="width: 35px; text-align: center;">XP</th>
                    ${daysArr.map(d => `<th style="width: 20px; text-align: center; font-size: 9px; padding: 2px;">${d}</th>`).join('')}
                    <th style="width: 40px; text-align: center;">DONE</th>
                    <th style="width: 40px; text-align: center;">GOAL</th>
                    <th style="width: 40px; text-align: center;">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${habits.map(h => {
                    let doneCount = 0
                    let goalCount = 0
                    const rawCreatedAt = h.created_at || h.created_date
                    let createdDateStr = null

                    if (rawCreatedAt && (rawCreatedAt.startsWith('2026-01-01') || rawCreatedAt.startsWith('2026-01-02'))) {
                      const logsForHabit = monthLogs.filter(l => l.habit_id === h.id && l.date)
                      if (logsForHabit.length > 0) {
                        const sortedLogs = [...logsForHabit].sort((a, b) => a.date.localeCompare(b.date))
                        createdDateStr = sortedLogs[0].date
                      } else {
                        createdDateStr = getLocalDateStr()
                      }
                    } else if (rawCreatedAt) {
                      const parsedDate = new Date(rawCreatedAt)
                      if (!isNaN(parsedDate.getTime())) {
                        createdDateStr = getLocalDateStr(parsedDate)
                      }
                    } else {
                      createdDateStr = getLocalDateStr()
                    }

                    const freqDays = h.frequency_days || [0, 1, 2, 3, 4, 5, 6]

                    const dayCellsHTML = daysArr.map(d => {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                      const dateObj = new Date(year, month, d)
                      const explicitStatus = logMap.get(`${h.id}::${dateStr}`)

                      let status = 'none'
                      if (explicitStatus) {
                        status = explicitStatus
                      } else if (createdDateStr && dateStr < createdDateStr) {
                        status = 'blocked'
                      } else if (!freqDays.includes(dateObj.getDay())) {
                        status = 'blocked'
                      }

                      if (freqDays.includes(dateObj.getDay())) {
                        goalCount++
                      }

                      if (status === 'completed') {
                        doneCount++
                        return `<td class="cell cell-done">✓</td>`
                      } else if (status === 'failed') {
                        return `<td class="cell cell-fail">✗</td>`
                      } else if (status === 'blocked') {
                        if (freqDays.includes(dateObj.getDay())) goalCount--
                        return `<td class="cell cell-blocked">-</td>`
                      }
                      return `<td class="cell cell-empty"></td>`
                    }).join('')

                    const safeGoal = Math.max(0, goalCount)
                    const pct = safeGoal === 0 ? 0 : Math.round((doneCount / safeGoal) * 100)

                    return `
                      <tr>
                        <td style="text-align: left;"><strong>${h.title}</strong></td>
                        <td style="text-align: center;" class="text-amber">${h.xp_per_completion || 25}</td>
                        ${dayCellsHTML}
                        <td style="text-align: center; color: var(--green); font-weight: bold;">${doneCount}</td>
                        <td style="text-align: center; color: var(--muted);">${safeGoal}</td>
                        <td style="text-align: center; font-weight: bold; color: ${pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--accent)' : 'var(--red)'}">${pct}%</td>
                      </tr>
                    `
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `
      }

      // 4. SCREEN INTEL SECTION
      if (selectedModules.screen_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">📱 SCREEN INTEL LOGS (${screenLogs.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Screen Time</th>
                  <th>Doomscroll</th>
                  <th>Streaming</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${screenLogs.map(l => `
                  <tr>
                    <td>${l.date}</td>
                    <td><strong>${l.total_hours || 0} hrs</strong></td>
                    <td>${l.doom_scroll_minutes || l.doomscroll_minutes || 0} mins</td>
                    <td>${l.streaming_hours || 0} hrs</td>
                    <td><span class="badge ${(parseFloat(l.total_hours) < 6) ? 'badge-success' : 'badge-danger'}">${(parseFloat(l.total_hours) < 6) ? 'CLEAN' : 'OVER LIMIT'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 5. WEIGHT RECON SECTION
      if (selectedModules.weight_recon) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">⚖️ WEIGHT RECON LOGS (${weightLogs.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weight (kg)</th>
                  <th>Body Fat %</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${weightLogs.map(l => {
                  const weightVal = l.weight_kg ?? l.weight ?? '—'
                  return `
                    <tr>
                      <td>${l.date}</td>
                      <td><strong class="text-amber">${weightVal} kg</strong></td>
                      <td>${l.body_fat_percentage ? `${l.body_fat_percentage}%` : '—'}</td>
                      <td>${l.notes || '—'}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 6. SLEEP INTEL SECTION
      if (selectedModules.sleep_intel) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🌙 SLEEP INTEL LOGS (${sleepLogs.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bedtime</th>
                  <th>Wake Time</th>
                  <th>Duration</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                ${sleepLogs.map(l => `
                  <tr>
                    <td>${l.date}</td>
                    <td>${l.bedtime || '—'}</td>
                    <td>${l.wake_time || '—'}</td>
                    <td><strong>${l.duration_hours || 0} hrs</strong></td>
                    <td><span class="badge ${l.quality_score >= 8 ? 'badge-success' : l.quality_score >= 5 ? 'badge-warning' : 'badge-danger'}">${l.quality_score || 5}/10</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      const fullHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Loki OS - Tactical Performance Report</title>
          <style>
            :root {
              --bg: #090A0F;
              --card: #12151E;
              --border: #262B3D;
              --text: #F3F4F6;
              --muted: #9CA3AF;
              --accent: #D4AF37;
              --cyan: #00F0FF;
              --green: #10B981;
              --red: #EF4444;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
              background-color: var(--bg);
              color: var(--text);
              padding: 40px;
              margin: 0;
            }
            .header {
              border-bottom: 2px solid var(--accent);
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title {
              font-size: 28px;
              font-weight: 800;
              letter-spacing: 2px;
              color: var(--accent);
              margin: 0;
            }
            .subtitle {
              color: var(--muted);
              font-size: 13px;
              margin-top: 5px;
            }
            .section {
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 16px;
              letter-spacing: 1px;
              color: var(--cyan);
              margin-top: 0;
              margin-bottom: 15px;
              border-bottom: 1px solid var(--border);
              padding-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            th, td {
              text-align: left;
              padding: 10px 12px;
              border-bottom: 1px solid var(--border);
            }
            th {
              color: var(--muted);
              font-weight: 600;
              text-transform: uppercase;
              font-size: 11px;
            }
            .matrix-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            .matrix-table th, .matrix-table td {
              padding: 6px 4px;
              border: 1px solid var(--border);
              text-align: center;
            }
            .cell-done {
              background: rgba(16, 185, 129, 0.25);
              color: #10B981;
              font-weight: bold;
            }
            .cell-fail {
              background: rgba(239, 68, 68, 0.25);
              color: #EF4444;
              font-weight: bold;
            }
            .cell-blocked {
              color: #6B7280;
              opacity: 0.5;
            }
            .cell-empty {
              background: rgba(255, 255, 255, 0.02);
            }
            .badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: bold;
            }
            .badge-success { background: rgba(16, 185, 129, 0.2); color: var(--green); border: 1px solid var(--green); }
            .badge-warning { background: rgba(212, 175, 55, 0.2); color: var(--accent); border: 1px solid var(--accent); }
            .badge-danger { background: rgba(239, 68, 68, 0.2); color: var(--red); border: 1px solid var(--red); }
            .badge-info { background: rgba(0, 240, 255, 0.2); color: var(--cyan); border: 1px solid var(--cyan); }
            .text-amber { color: var(--accent); font-weight: bold; }
            .progress-bar {
              width: 80px;
              height: 6px;
              background: var(--border);
              border-radius: 3px;
              overflow: hidden;
              display: inline-block;
              vertical-align: middle;
            }
            .progress-fill {
              height: 100%;
              background: var(--accent);
            }
            @media print {
              body { background: #fff; color: #000; padding: 20px; }
              .section { background: #fff; border: 1px solid #ccc; color: #000; }
              .section-title { color: #000; border-bottom-color: #ccc; }
              th, td { border-bottom-color: #eee; }
              th { color: #555; }
              .badge { border: 1px solid #999; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">LOKI OS // TACTICAL PERFORMANCE REPORT</h1>
              <div class="subtitle">OPERATOR: ${profile?.full_name || 'CHIRAG'} | REPORT PERIOD: ${startDate} TO ${endDate}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--muted);">GENERATED ON</div>
              <div style="font-weight: bold; font-size: 14px; color: var(--cyan);">${new Date().toLocaleString()}</div>
            </div>
          </div>

          ${sectionsHTML || '<p style="color: var(--muted); text-align: center;">No modules selected for export.</p>'}
        </body>
        </html>
      `

      // Create blob and trigger download/view
      const reportBlob = new Blob([fullHTML], { type: 'text/html' })
      const reportUrl = URL.createObjectURL(reportBlob)
      
      // Trigger direct PDF print/save dialog using invisible iframe
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

    } catch (e) {
      console.error('Failed to generate intel report:', e)
      alert('Error generating report: ' + (e.message || e))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AnimatePresence>
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999, 
          backgroundColor: 'rgba(4, 6, 10, 0.92)', 
          backdropFilter: 'blur(16px)', 
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          style={{ 
            backgroundColor: '#0c0e14', 
            background: '#0c0e14', 
            border: '1px solid rgba(212, 175, 55, 0.4)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 30px rgba(212, 175, 55, 0.1)',
            color: '#f3f4f6',
            width: '100%',
            maxWidth: '540px',
            borderRadius: '16px',
            padding: '24px',
            position: 'relative',
            zIndex: 100000,
            maxHeight: '88vh',
            overflowY: 'auto'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border-color" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber/10 border border-amber/30 text-amber">
                <Printer size={22} />
              </div>
              <div>
                <h2 className="font-display text-lg tracking-wider text-primary uppercase">INTEL REPORT & DATA EXPORT</h2>
                <p className="font-mono text-xs text-muted">Generate clean, color-formatted tactical reports & exports</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-muted hover:text-primary rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="py-6 space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* 1. Date Range Picker */}
            <div>
              <label className="block font-mono text-xs text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                <Calendar size={14} className="text-amber" />
                Select Date Range
              </label>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <span className="font-mono text-[10px] text-muted block mb-1">FROM DATE</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-border-color rounded-lg px-3 py-2 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                    style={{ background: '#141824', backgroundColor: '#141824', color: '#f3f4f6' }}
                  />
                </div>
                <div>
                  <span className="font-mono text-[10px] text-muted block mb-1">TO DATE</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-border-color rounded-lg px-3 py-2 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                    style={{ background: '#141824', backgroundColor: '#141824', color: '#f3f4f6' }}
                  />
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted uppercase">PRESETS:</span>
                {[
                  { id: 'this_week', label: 'This Week' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_30', label: 'Last 30 Days' },
                  { id: 'all', label: 'All Time' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className="px-2.5 py-1 border border-border-subtle rounded font-mono text-[10px] text-secondary hover:text-amber transition-colors"
                    style={{ background: '#141824', backgroundColor: '#141824' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Select Modules to Include */}
            <div>
              <label className="block font-mono text-xs text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckSquare size={14} className="text-info" />
                Select Modules to Export
              </label>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'work_intel', icon: Briefcase, label: 'Work & Content Logs', color: 'text-amber' },
                  { key: 'missions', icon: Target, label: 'Missions & Quests', color: 'text-amber' },
                  { key: 'operations', icon: CheckSquare, label: 'Operations & Tasks', color: 'text-info' },
                  { key: 'habits', icon: Crosshair, label: 'Habits & Daily Ops Matrix', color: 'text-danger' },
                  { key: 'screen_intel', icon: Monitor, label: 'Screen Intel Charts', color: 'text-success' },
                  { key: 'weight_recon', icon: Scale, label: 'Weight Recon Logs', color: 'text-amber' },
                  { key: 'sleep_intel', icon: Moon, label: 'Sleep Intel Schedule', color: 'text-info' }
                ].map(mod => {
                  const Icon = mod.icon
                  const isSelected = selectedModules[mod.key]
                  return (
                    <div
                      key={mod.key}
                      onClick={() => toggleModule(mod.key)}
                      style={{ 
                        background: isSelected ? '#1a202c' : '#10131c', 
                        backgroundColor: isSelected ? '#1a202c' : '#10131c',
                        border: isSelected ? '1px solid rgba(212, 175, 55, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={mod.color} />
                        <span className="font-mono text-xs text-primary">{mod.label}</span>
                      </div>
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                        isSelected ? 'bg-amber border-amber text-black' : 'border-border-color'
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border-color flex items-center justify-between gap-3">
            <button
              onClick={() => generateReport('json')}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-tertiary border border-border-color hover:border-muted rounded-xl font-mono text-xs text-secondary hover:text-primary transition-colors disabled:opacity-50"
            >
              <FileText size={14} />
              Export JSON
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl font-mono text-xs text-muted hover:text-primary transition-colors"
              >
                Cancel
              </button>
              
              <button
                onClick={() => generateReport('report')}
                disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold rounded-xl shadow-lg shadow-amber/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isExporting ? (
                  <span>Generating Report...</span>
                ) : (
                  <>
                    <Printer size={16} />
                    <span>Download PDF / Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
