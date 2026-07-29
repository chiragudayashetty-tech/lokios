'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Download, Calendar, CheckSquare, Target, Monitor, 
  Scale, Moon, Crosshair, FileText, Check, Printer, Sparkles
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
      const [screenRes, weightRes, sleepRes] = await Promise.all([
        supabase.from('screen_time_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('weight_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
        supabase.from('sleep_logs').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: true })
      ])

      const screenLogs = screenRes.data || []
      const weightLogs = weightRes.data || []
      const sleepLogs = sleepRes.data || []

      // Filter local state by date range
      const filteredGoals = (goals || []).filter(g => !g.created_at || (getLocalDateStr(new Date(g.created_at)) >= startDate && getLocalDateStr(new Date(g.created_at)) <= endDate))
      const filteredTasks = (tasks || []).filter(t => !t.due_date || (t.due_date >= startDate && t.due_date <= endDate))
      const filteredHabitLogs = (monthLogs || []).filter(l => l.date >= startDate && l.date <= endDate)

      if (format === 'json') {
        const payload = {
          report_metadata: {
            user: profile?.full_name || 'Operator',
            export_date: new Date().toISOString(),
            range: { startDate, endDate }
          },
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
                  <th>Progress</th>
                  <th>Reward</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredGoals.map(g => `
                  <tr>
                    <td><strong>${g.title}</strong></td>
                    <td><span class="badge badge-info">${g.type || 'Side Quest'}</span></td>
                    <td>${g.category || 'TATVA'}</td>
                    <td>
                      <div class="progress-bar">
                        <div class="progress-fill" style="width: ${g.progress || 0}%"></div>
                      </div>
                      <small>${g.progress || 0}%</small>
                    </td>
                    <td class="text-amber">+${g.xp_reward || 100} XP</td>
                    <td><span class="badge ${g.status === 'completed' ? 'badge-success' : 'badge-warning'}">${(g.status || 'active').toUpperCase()}</span></td>
                  </tr>
                `).join('')}
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
                  <th>Priority</th>
                  <th>Category</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTasks.map(t => `
                  <tr>
                    <td><strong>${t.title}</strong></td>
                    <td><span class="badge ${t.priority === 'P1' ? 'badge-danger' : t.priority === 'P2' ? 'badge-warning' : 'badge-info'}">${t.priority || 'P3'}</span></td>
                    <td>${t.stat_category || 'Discipline'}</td>
                    <td>${t.due_date || 'None'}</td>
                    <td><span class="badge ${t.status === 'completed' ? 'badge-success' : 'badge-warning'}">${(t.status || 'pending').toUpperCase()}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      // 3. HABITS MATRIX SECTION
      if (selectedModules.habits) {
        sectionsHTML += `
          <div class="section">
            <h2 class="section-title">🔥 DAILY OPS / HABITS (${habits.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Routine Title</th>
                  <th>XP Value</th>
                  <th>Category</th>
                  <th>Total Completions</th>
                </tr>
              </thead>
              <tbody>
                ${habits.map(h => {
                  const doneCount = filteredHabitLogs.filter(l => l.habit_id === h.id && l.status === 'completed').length
                  return `
                    <tr>
                      <td><strong>${h.title}</strong></td>
                      <td class="text-amber">+${h.xp_per_completion || 25} XP</td>
                      <td>${h.category || 'General'}</td>
                      <td><span class="badge badge-success">${doneCount} Completed</span></td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
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
                ${weightLogs.map(l => `
                  <tr>
                    <td>${l.date}</td>
                    <td><strong class="text-amber">${l.weight} kg</strong></td>
                    <td>${l.body_fat_percentage ? `${l.body_fat_percentage}%` : '—'}</td>
                    <td>${l.notes || '—'}</td>
                  </tr>
                `).join('')}
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
      
      const printWindow = window.open(reportUrl, '_blank')
      if (printWindow) {
        printWindow.focus()
      } else {
        const a = document.createElement('a')
        a.href = reportUrl
        a.download = `LokiOS_Tactical_Report_${startDate}_to_${endDate}.html`
        a.click()
      }
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
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl rounded-2xl p-6 shadow-2xl overflow-hidden"
          style={{ 
            background: 'var(--bg-secondary)', 
            backgroundColor: '#0c0e14', 
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border-color">
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
                    <span>Download Tactical Report</span>
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
