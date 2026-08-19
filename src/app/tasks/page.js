'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { getLocalDateStr, parseTaskNotes } from '@/lib/utils/dates'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, Calendar, Trash2, Edit2, RotateCcw, Repeat, X, Target, Clock, AlertTriangle, CheckCircle2, Layers, Zap, XCircle, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'

export default function Operations() {
  const { tasks: { tasks = [], todayTasks = [], loading = false, error = null, fetchTasks, addTask, editTask, pushTaskToTomorrow, undoCompleteTask, deleteTask } = {}, completeOperation, deleteOperation, failOperation, undoFailOperation, goals: { goals = [] } = {} } = useOS() || {}

  const [activeTab, setActiveTab] = useState('today')
  const [showDeploy, setShowDeploy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [expandedDescId, setExpandedDescId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Deploy form
  const [deployForm, setDeployForm] = useState({ 
    title: '', description: '', difficulty: 'MEDIUM', category: 'beyond_tatva', 
    recurrence_type: '', customCategory: '', due_date: getLocalDateStr(), goal_id: '',
    weeklyDays: [new Date().getDay()], weeklyDuration: 0
  })

  const DAYS_OF_WEEK = [
    { label: 'MON', value: 1 },
    { label: 'TUE', value: 2 },
    { label: 'WED', value: 3 },
    { label: 'THU', value: 4 },
    { label: 'FRI', value: 5 },
    { label: 'SAT', value: 6 },
    { label: 'SUN', value: 0 }
  ]

  // Proof and Completion state
  const [proofTask, setProofTask] = useState(null)
  const [proofUrl, setProofUrl] = useState('')
  const [completionNote, setCompletionNote] = useState('')

  // Failure modal state
  const [failModalObj, setFailModalObj] = useState(null)
  const [failReason, setFailReason] = useState('')

  // Drag states
  const [deployDrag, setDeployDrag] = useState({ x: 0, y: 0 })
  const [proofDrag, setProofDrag] = useState({ x: 0, y: 0 })

  const [isMobile, setIsMobile] = useState(false)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', danger: false, onConfirm: null, onCancel: null, confirmText: 'CONFIRM' })
  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const today = getLocalDateStr()
  const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed')
  const overdue = pending.filter(t => t.due_date && t.due_date < today)
  const dueToday = pending.filter(t => t.due_date === today)
  const upcoming = pending.filter(t => !t.due_date || t.due_date > today)
  const completed = tasks.filter(t => t.status === 'completed')
  const failedOps = tasks.filter(t => t.status === 'cancelled' || t.status === 'failed')

  const completionRate = tasks.length === 0 ? 0 : Math.round((completed.length / tasks.length) * 100)

  const handleDeploy = async (e) => {
    e.preventDefault()
    if (!deployForm.title.trim()) return

    let finalDesc = deployForm.description || ''
    if (deployForm.category === 'other' && deployForm.customCategory) {
      finalDesc = `[Category: ${deployForm.customCategory}]\n\n${finalDesc}`.trim()
    }
    
    let finalDueDate = deployForm.due_date || today
    let finalRecurrenceDays = deployForm.recurrence_type === 'daily' ? [0,1,2,3,4,5,6] : null

    if (deployForm.recurrence_type === 'weekly') {
      finalRecurrenceDays = deployForm.weeklyDays.length > 0 ? deployForm.weeklyDays : [new Date().getDay()]
      if (deployForm.weeklyDuration > 0) {
        finalDesc = `[Duration: ${deployForm.weeklyDuration}]\n\n${finalDesc}`.trim()
      }
      // Calculate first due date
      const fromDate = new Date()
      const currentDay = fromDate.getDay()
      const sortedDays = [...finalRecurrenceDays].sort((a, b) => a - b)
      let nextDay = sortedDays.find(d => d >= currentDay)
      let daysToAdd = 0
      if (nextDay !== undefined) {
        daysToAdd = nextDay - currentDay
      } else {
        daysToAdd = (7 - currentDay) + sortedDays[0]
      }
      fromDate.setDate(fromDate.getDate() + daysToAdd + parseInt(deployForm.weeklyDuration || 0))
      finalDueDate = fromDate.toISOString().split('T')[0]
    }

    const result = await addTask({
      title: deployForm.title,
      description: finalDesc || null,
      due_date: finalDueDate, 
      difficulty: deployForm.difficulty,
      category: deployForm.category === 'other' ? 'other' : deployForm.category,
      type: deployForm.recurrence_type ? 'recurring' : 'custom',
      recurrence_type: deployForm.recurrence_type || null,
      recurrence_days: finalRecurrenceDays,
      goal_id: deployForm.goal_id || null,
    })

    if (result && result.error) {
      alert(`DEPLOYMENT FAILED: ${result.error.message || result.error}\n\nPlease let the AI know what this error says!`)
      return
    }

    setDeployForm({ 
      title: '', description: '', difficulty: 'MEDIUM', category: 'beyond_tatva', 
      recurrence_type: '', customCategory: '', due_date: today, goal_id: '',
      weeklyDays: [new Date().getDay()], weeklyDuration: 0 
    })
    setShowDeploy(false)
  }

  const pushToTomorrow = async (task) => {
    await pushTaskToTomorrow(task.id)
  }

  const handleDeleteOperation = async (task) => {
    setConfirmModal({
      isOpen: true,
      title: 'DELETE OPERATION',
      message: 'Are you sure you want to permanently delete this operation?',
      danger: true,
      confirmText: 'DELETE',
      onConfirm: async () => {
        let revokeXp = true
        if (task.status === 'completed' || task.status === 'cancelled') {
          setConfirmModal({
            isOpen: true,
            title: 'REVOKE XP?',
            message: 'Do you want to revoke/refund the XP associated with this operation?\n\nREVOKE = XP will be deducted\nKEEP = You keep the XP',
            danger: true,
            confirmText: 'REVOKE XP',
            cancelText: 'KEEP XP',
            onConfirm: async () => {
              await deleteOperation(task.id, true)
              setConfirmModal({ isOpen: false })
            },
            onCancel: async () => {
              await deleteOperation(task.id, false)
              setConfirmModal({ isOpen: false })
            }
          })
          return
        }
        await deleteOperation(task.id, revokeXp)
        setConfirmModal({ isOpen: false })
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    })
  }

  const failTask = (task) => {
    setFailModalObj(task)
    setFailReason('')
  }

  const submitFailure = async () => {
    if (!failModalObj) return
    await failOperation(failModalObj.id, failReason)
    setFailModalObj(null)
    setFailReason('')
  }

  const handleComplete = (task) => {
    setProofTask(task)
    setProofUrl('')
    setCompletionNote('')
  }

  const submitCompletion = async (skipNotes = false) => {
    if (!proofTask) return
    const urlToSend = skipNotes ? null : (proofUrl.trim() || null)
    const noteToSend = skipNotes ? null : (completionNote.trim() || null)
    await completeOperation(proofTask.id, urlToSend, noteToSend)
    setProofTask(null)
    setProofUrl('')
    setCompletionNote('')
  }

  const startEdit = (task) => {
    setEditingId(task.id)
    
    let customCat = ''
    let cleanDesc = task.description || ''
    if (cleanDesc.startsWith('[Category:')) {
      const match = cleanDesc.match(/^\[Category:\s*([^\]]+)\]\n\n?/)
      if (match) {
        customCat = match[1]
        cleanDesc = cleanDesc.replace(/^\[Category:\s*([^\]]+)\]\n\n?/, '')
      }
    }

    setEditForm({
      title: task.title || '',
      description: cleanDesc || '',
      due_date: task.due_date || '',
      difficulty: task.difficulty || 'MEDIUM',
      category: task.category || 'beyond_tatva',
      customCategory: customCat,
      recurrence_type: task.recurrence_type || '',
      type: task.type || 'custom',
      goal_id: task.goal_id || ''
    })
  }

  const saveEdit = async (id) => {
    let finalDesc = editForm.description || ''
    if (editForm.category === 'other' && editForm.customCategory) {
      finalDesc = `[Category: ${editForm.customCategory}]\n\n${finalDesc}`.trim()
    }

    const payload = {
      title: editForm.title,
      description: finalDesc || null,
      due_date: editForm.due_date || null,
      difficulty: editForm.difficulty || 'MEDIUM',
      category: editForm.category === 'other' ? 'other' : editForm.category,
      type: editForm.recurrence_type ? 'recurring' : 'custom',
      recurrence_type: editForm.recurrence_type || null,
      goal_id: editForm.goal_id || null,
    }

    await editTask(id, payload)
    setEditingId(null)
  }

  const handleDeleteTask = async (id) => {
    if (confirm("Are you sure you want to delete this operation? If it is a recurring series, this will end the series.")) {
      await deleteTask(id)
      setEditingId(null)
    }
  }

  // Which list to show based on active tab
  const getActiveList = () => {
    switch (activeTab) {
      case 'today': return [...overdue, ...dueToday]
      case 'upcoming': return upcoming
      case 'completed': return completed
      case 'failed': return failedOps
      case 'all': return pending
      default: return dueToday
    }
  }

  const activeList = getActiveList()

  // Helper to group archived tasks by Month -> Subheading (Category)
  const groupArchivedTasks = (taskList) => {
    const monthsMap = {}
    taskList.forEach(task => {
      const dateStr = task.completed_at || task.updated_at || task.due_date || task.created_at
      const d = dateStr ? new Date(dateStr) : new Date()
      const monthLabel = d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
      
      let cat = task.category || 'GENERAL'
      if (cat === 'beyond_tatva') cat = 'BEYOND TATVA'
      else if (cat === 'personal_mission' || cat === 'personal') cat = 'PERSONAL MISSION'
      else if (cat === 'learning') cat = 'LEARNING'
      else cat = String(cat).toUpperCase().replace('_', ' ')

      if (!monthsMap[monthLabel]) monthsMap[monthLabel] = { total: 0, subheadings: {} }
      monthsMap[monthLabel].total++
      if (!monthsMap[monthLabel].subheadings[cat]) monthsMap[monthLabel].subheadings[cat] = []
      monthsMap[monthLabel].subheadings[cat].push(task)
    })
    return monthsMap
  }

  const DIFFICULTY_CONFIG = {
    NONE: { label: 'NONE', color: 'var(--muted)', xp: 0 },
    EASY: { label: 'EASY', color: 'var(--info)', xp: 15 },
    MEDIUM: { label: 'MEDIUM', color: 'var(--accent-primary)', xp: 30 },
    HARD: { label: 'HARD', color: 'var(--warning)', xp: 60 },
    EXTREME: { label: 'EXTREME', color: 'var(--danger)', xp: 120 }
  }

  const renderTaskCard = (task) => {
    const isCompleted = task.status === 'completed'
    const isFailed = task.status === 'cancelled' || task.status === 'failed'
    const isEditing = editingId === task.id
    const cleanDueDate = task.due_date ? task.due_date.substring(0, 10) : null
    const isOverdue = !isCompleted && !isFailed && cleanDueDate && cleanDueDate < today
    const diffKey = (task.difficulty || 'MEDIUM').toUpperCase()
    const diffConfig = DIFFICULTY_CONFIG[diffKey] || DIFFICULTY_CONFIG.MEDIUM
    let daysOverdue = 0
    let penaltyAmount = 0
    let dynamicXp = diffConfig.xp

    if (isOverdue && cleanDueDate) {
      const [tY, tM, tD] = today.split('-').map(Number)
      const [dY, dM, dD] = cleanDueDate.split('-').map(Number)
      const todayUtc = Date.UTC(tY, tM - 1, tD)
      const dueUtc = Date.UTC(dY, dM - 1, dD)
      daysOverdue = Math.max(1, Math.round((todayUtc - dueUtc) / (1000 * 60 * 60 * 24)))
      penaltyAmount = daysOverdue * 5
      dynamicXp = Math.max(0, diffConfig.xp - penaltyAmount)
    }
    const isExpanded = expandedDescId === task.id

    if (isEditing) {
      return (
        <motion.div key={task.id} layout className="col-span-1">
          <HudPanel className="p-4 sm:p-5 border-amber space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-2">
              <span className="font-display text-sm uppercase text-amber tracking-widest font-bold flex items-center gap-2">
                <Edit2 size={14} /> EDIT OPERATION
              </span>
              <button type="button" onClick={() => setEditingId(null)} className="text-muted hover:text-danger">
                <X size={16} />
              </button>
            </div>

            <div className="flex-col gap-3">
              <div>
                <label className="font-mono text-[10px] text-muted mb-1 block">OPERATION TITLE *</label>
                <input
                  type="text"
                  className="input font-mono text-sm w-full"
                  value={editForm.title || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="font-mono text-[10px] text-muted mb-1 block">DESCRIPTION</label>
                <textarea
                  className="textarea font-mono text-xs h-20 w-full"
                  value={editForm.description || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Operation details..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-muted mb-1 block">DUE DATE</label>
                  <input
                    type="date"
                    className="input font-mono text-xs py-1.5 w-full"
                    value={editForm.due_date || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted mb-1 block">DIFFICULTY</label>
                  <select
                    className="select font-mono text-xs py-1.5 w-full"
                    value={editForm.difficulty || 'MEDIUM'}
                    onChange={e => setEditForm(prev => ({ ...prev, difficulty: e.target.value }))}
                  >
                    <option value="NONE">NONE (0 XP)</option>
                    <option value="EASY">EASY (15 XP)</option>
                    <option value="MEDIUM">MEDIUM (30 XP)</option>
                    <option value="HARD">HARD (60 XP)</option>
                    <option value="EXTREME">EXTREME (120 XP)</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted mb-1 block">RECURRENCE</label>
                  <select
                    className="select font-mono text-xs py-1.5 w-full"
                    value={editForm.recurrence_type || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, recurrence_type: e.target.value, type: e.target.value ? 'recurring' : 'custom' }))}
                  >
                    <option value="">ONE TIME</option>
                    <option value="daily">DAILY</option>
                    <option value="weekly">WEEKLY</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-muted mb-1 block">CATEGORY</label>
                  <select
                    className="select font-mono text-xs py-1.5 w-full"
                    value={editForm.category || 'beyond_tatva'}
                    onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="beyond_tatva">BEYOND TATVA</option>
                    <option value="personal_mission">PERSONAL MISSION</option>
                    <option value="learning">LEARNING</option>
                    <option value="other">OTHER</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted mb-1 block">LINK TO MISSION</label>
                  <select
                    className="select font-mono text-xs py-1.5 w-full"
                    value={editForm.goal_id || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, goal_id: e.target.value }))}
                  >
                    <option value="">NO MISSION LINKED</option>
                    {goals?.filter(g => g.status !== 'completed' && g.status !== 'cancelled' && g.status !== 'failed').map(goal => (
                      <option key={goal.id} value={goal.id}>{goal.title.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editForm.category === 'other' && (
                <div>
                  <label className="font-mono text-[10px] text-muted mb-1 block">CUSTOM CATEGORY</label>
                  <input
                    type="text"
                    className="input font-mono text-xs py-1.5 w-full"
                    placeholder="e.g. Finance, Health"
                    value={editForm.customCategory || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, customCategory: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-3 border-t border-border-color/50">
                <button type='button' onClick={() => handleDeleteTask(task.id)} className="btn btn-ghost btn-sm text-danger mr-auto font-mono">
                  DELETE
                </button>
                <button type='button' onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm font-mono">
                  CANCEL
                </button>
                <button type='button' onClick={() => saveEdit(task.id)} className="btn btn-primary btn-sm font-mono font-bold">
                  SAVE CHANGES
                </button>
              </div>
            </div>
          </HudPanel>
        </motion.div>
      )
    }

    // ── THIN STRIP ACCORDION FOR COMPLETED & FAILED OPERATIONS ──
    if (isCompleted || isFailed) {
      const dateStr = task.completed_at 
        ? new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
        : (task.due_date ? task.due_date : null)

      return (
        <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="col-span-1">
          <div className={`p-3 rounded-lg border transition-all ${
            isCompleted ? 'bg-success/5 border-success/30 hover:border-success/60' : 'bg-danger/5 border-danger/30 hover:border-danger/60'
          }`}>
            <div 
              onClick={() => setExpandedDescId(isExpanded ? null : task.id)}
              className="flex items-center justify-between gap-3 cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCompleted ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                }`}>
                  {isCompleted ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                </span>
                <span className={`font-mono text-sm font-semibold truncate ${isCompleted ? 'text-muted line-through opacity-80' : 'text-danger line-through'}`}>
                  {task.title}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {dateStr && (
                  <span className="font-mono text-[10px] text-muted hidden sm:inline">
                    {isCompleted ? `DONE ${dateStr}` : `FAILED ${dateStr}`}
                  </span>
                )}
                <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                  isCompleted ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'
                }`}>
                  {isCompleted ? 'DONE' : 'FAILED'}
                </span>
                <button type="button" className="p-1 text-muted hover:text-primary transition-colors">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
              {isExpanded && (() => {
                const { cleanDesc, completionNote: itemCompNote, failureNote: itemFailNote } = parseTaskNotes(task.description)
                return (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-3 pt-3 border-t border-border-color/40 flex flex-col gap-3 font-mono text-xs">
                      {cleanDesc && (
                        <p className="text-secondary whitespace-pre-wrap">{cleanDesc}</p>
                      )}

                      {itemCompNote && (
                        <div className="p-3 rounded-lg border border-success/40 bg-success/10 font-mono text-xs my-1">
                          <div className="text-success font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5">
                            <CheckCircle2 size={13} /> Accomplishment / Completion Reflection:
                          </div>
                          <div className="text-primary whitespace-pre-wrap">{itemCompNote}</div>
                        </div>
                      )}

                      {itemFailNote && (
                        <div className="p-3 rounded-lg border border-danger/40 bg-danger/10 font-mono text-xs my-1">
                          <div className="text-danger font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5">
                            <AlertTriangle size={13} /> Reason for Failure:
                          </div>
                          <div className="text-primary whitespace-pre-wrap">{itemFailNote}</div>
                        </div>
                      )}

                      {task.media_urls && task.media_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2 my-1">
                          {task.media_urls.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-2.5 py-1 rounded bg-amber/10 border border-amber/30 text-amber hover:underline text-[11px] font-mono flex items-center gap-1">
                              🔗 Proof Attachment #{idx + 1}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted pt-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="uppercase">CAT: {task.category || 'GENERAL'}</span>
                          {task.created_at && <span className="text-info">DEPLOYED: {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                          {task.due_date && <span>DUE: {task.due_date}</span>}
                          {task.completed_at && <span className="text-success font-semibold">COMPLETED: {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompleted && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); undoCompleteTask(task.id); }} className="btn btn-ghost btn-xs text-info flex items-center gap-1 font-mono">
                              <RotateCcw size={12} /> UNDO / RE-OPEN OP
                            </button>
                          )}
                          {isFailed && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); undoFailOperation(task.id); }} className="btn btn-ghost btn-xs text-info flex items-center gap-1 font-mono">
                              <RotateCcw size={12} /> RESTORE OP
                            </button>
                          )}
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteOperation(task); }} className="btn btn-ghost btn-xs text-danger p-1" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
          </div>
        </motion.div>
      )
    }

    // ── CLEAN CARD LAYOUT FOR ACTIVE OPERATIONS ──
    return (
      <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="col-span-1"
      >
        <HudPanel glow className="p-4">
          
          {/* Header Tag Row: Flex wrap ensures tags NEVER collide or overlap */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-border-color">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider bg-amber/10 text-amber border border-amber/30 shrink-0">
                {task.category ? task.category.replace('_', ' ') : 'GENERAL'}
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border shrink-0"
                    style={{ color: diffConfig.color, borderColor: `${diffConfig.color}40`, background: `${diffConfig.color}10` }}>
                {diffConfig.label}
              </span>
              {isOverdue && (
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-danger/15 text-danger border border-danger/40 flex items-center gap-1 shrink-0 animate-pulse">
                  <AlertTriangle size={10} /> {daysOverdue}D OVERDUE (-{penaltyAmount} XP)
                </span>
              )}
              {task.recurrence_type && (
                <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase text-info bg-info/10 border border-info/30 flex items-center gap-1 shrink-0">
                  <Repeat size={10} /> {task.recurrence_type}
                </span>
              )}
            </div>

            {task.goal_id && (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono text-muted bg-bg-primary border border-border-color flex items-center gap-1 truncate max-w-[180px]">
                <Target size={10} className="text-info shrink-0" />
                <span className="truncate">{goals.find(g => g.id === task.goal_id)?.title || 'Mission'}</span>
              </span>
            )}
          </div>

          <h3 className="font-mono text-base font-bold text-primary">
            {task.title}
          </h3>

          {task.description && (
            <p className="font-mono text-xs text-muted mt-2 whitespace-pre-wrap">
              {task.description}
            </p>
          )}

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mt-4 pt-3 border-t border-border-subtle gap-3">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted">
              {task.created_at && (
                <span className="flex items-center gap-1 text-info">
                  <Clock size={10} /> DEPLOYED: {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {task.due_date && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-danger font-bold' : ''}`}>
                  <Calendar size={10} /> DUE: {cleanDueDate}
                </span>
              )}
              {task.media_urls && task.media_urls.length > 0 && (
                <span className="text-amber">[{task.media_urls.length} PROOF]</span>
              )}
              {isOverdue ? (
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="text-muted line-through">+{diffConfig.xp} XP</span>
                  <span className="text-danger font-mono">+{dynamicXp} XP (NET)</span>
                </span>
              ) : (
                <span className="text-success font-semibold">
                  +{diffConfig.xp} XP
                </span>
              )}
            </div>
            
            {/* Primary Action Button Group: Execute, Edit, Push, Fail, Delete */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <button type='button' onClick={() => handleComplete(task)}
                className="btn btn-primary btn-sm flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 font-bold">
                <Zap size={14} /> EXECUTE
              </button>
              <button type='button' className="p-2 rounded border border-border-color hover:bg-bg-tertiary text-muted hover:text-amber transition-colors" onClick={() => startEdit(task)} title="Edit">
                <Edit2 size={14} />
              </button>
              <button type='button' className="p-2 rounded border border-border-color hover:bg-bg-tertiary text-muted hover:text-amber transition-colors" onClick={() => pushToTomorrow(task)} title="Push to Tomorrow">
                <RotateCcw size={14} />
              </button>
              <button type='button' className="p-2 rounded border border-border-color hover:bg-bg-tertiary text-muted hover:text-danger transition-colors" onClick={() => failTask(task)} title="Fail Operation">
                <X size={14} />
              </button>
              <button type='button' className="p-2 rounded border border-border-color hover:bg-bg-tertiary text-muted hover:text-danger transition-colors" onClick={() => handleDeleteOperation(task)} title="Delete Operation">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </HudPanel>
      </motion.div>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex-center h-full flex-col gap-4 text-center">
          <AlertTriangle size={48} className="text-danger mb-2" />
          <h2 className="font-display text-xl text-danger uppercase tracking-widest">SYSTEM ERROR</h2>
          <p className="font-mono text-sm text-muted max-w-md">{error}</p>
          <button type="button" onClick={fetchTasks} className="btn btn-primary mt-4">RETRY CONNECTION</button>
        </div>
      </AppShell>
    )
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING OPERATIONS...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container" style={{ maxWidth: '1400px' }}>

        {/* HEADER */}
        <header className="flex-between flex-wrap gap-4 mb-6 tasks-header">
          <div>
            <h1 className="page-title flex items-center gap-3"><Target className="text-amber" /> OPERATIONS</h1>
            <p className="page-subtitle font-mono text-xs uppercase">Deploy morning work goals. Execute. Complete. Prove.</p>
          </div>
          <button type='button' className="btn btn-primary flex items-center gap-2" onClick={() => setShowDeploy(true)}>
            <Plus size={18} /> DEPLOY OPERATION
          </button>
        </header>

        {/* METRICS STRIP — Single bar, 4 divisions */}
        <div className="mb-6 flex items-stretch overflow-hidden" style={{
          border: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          borderRadius: '10px',
        }}>
          {/* PENDING */}
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Clock size={14} className="text-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[8px] text-muted uppercase tracking-widest">Pending</div>
              <div className="font-display text-lg text-primary font-bold leading-tight">{pending.length}</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'var(--border-color)', flexShrink: 0 }} />

          {/* OVERDUE */}
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0" style={{ background: overdue.length > 0 ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
            <div className="w-7 h-7 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={14} className="text-danger" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[8px] text-muted uppercase tracking-widest">Overdue</div>
              <div className={`font-display text-lg font-bold leading-tight ${overdue.length > 0 ? 'text-danger' : 'text-primary'}`}>{overdue.length}</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'var(--border-color)', flexShrink: 0 }} />

          {/* DUE TODAY */}
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
              <Calendar size={14} className="text-amber" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[8px] text-muted uppercase tracking-widest">Due Today</div>
              <div className="font-display text-lg text-amber font-bold leading-tight">{dueToday.length}</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'var(--border-color)', flexShrink: 0 }} />

          {/* COMPLETION */}
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <TrendingUp size={14} className="text-success" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[8px] text-muted uppercase tracking-widest">Completion</div>
              <div className="font-display text-lg text-success font-bold leading-tight">{completionRate}%</div>
            </div>
          </div>
        </div>


        {/* TABS */}
        <div className="tabs mb-6 flex-wrap tasks-tab-row">
          {[
            { id: 'today', label: `TODAY (${overdue.length + dueToday.length})` },
            { id: 'upcoming', label: `UPCOMING (${upcoming.length})` },
            { id: 'all', label: `ALL PENDING (${pending.length})` },
            { id: 'completed', label: `COMPLETED (${completed.length})` },
            { id: 'failed', label: `FAILED (${failedOps.length})` }
          ].map(tab => (
            <button type='button' key={tab.id} className={`tab-item ${activeTab === tab.id ? 'active tab-active' : ''} ${tab.id === 'failed' ? 'text-danger' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* OPERATIONS GRID */}
        {(activeTab === 'completed' || activeTab === 'failed') ? (
          <div className="flex flex-col gap-6">
            {Object.keys(groupArchivedTasks(activeTab === 'completed' ? completed : failedOps)).length === 0 ? (
              <div className="text-center py-16">
                <div className="font-mono text-sm text-muted mb-4">
                  {activeTab === 'completed' ? 'NO COMPLETED OPERATIONS YET.' : 'NO FAILED OPERATIONS YET.'}
                </div>
                <button type='button' onClick={() => setShowDeploy(true)} className="btn btn-primary btn-sm">DEPLOY OPERATION</button>
              </div>
            ) : (
              Object.entries(groupArchivedTasks(activeTab === 'completed' ? completed : failedOps)).map(([monthLabel, { total, subheadings }]) => (
                <div key={monthLabel} className="mb-4">
                  <div className="flex items-center gap-2 p-3 rounded-sm bg-bg-secondary border border-border-color mb-4">
                    <Calendar size={14} className="text-amber" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold text-amber">{monthLabel}</span>
                    <span className="font-mono text-[9px] text-muted ml-auto font-bold">({total} {total === 1 ? 'OPERATION' : 'OPERATIONS'})</span>
                  </div>

                  {Object.entries(subheadings).map(([subheading, subheadingTasks]) => (
                    <div key={subheading} className="mb-5 pl-2 sm:pl-4 border-l-2 border-border-color">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers size={11} className="text-info" />
                        <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-info">{subheading}</span>
                        <span className="font-mono text-[9px] text-muted">({subheadingTasks.length})</span>
                      </div>
                      <div className="grid-2 gap-4 tasks-grid">
                        <AnimatePresence mode="popLayout">
                          {subheadingTasks.map((task) => renderTaskCard(task))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid-2 gap-4 tasks-grid">
            <AnimatePresence mode="popLayout">
              {activeList.map((task) => renderTaskCard(task))}
            </AnimatePresence>
          </div>
        )}

        {activeList.length === 0 && activeTab !== 'completed' && activeTab !== 'failed' && (
          <div className="text-center py-16">
            <div className="font-mono text-sm text-muted mb-4">
              NO OPERATIONS IN THIS VIEW.
            </div>
            <button type='button' onClick={() => setShowDeploy(true)} className="btn btn-primary btn-sm">DEPLOY OPERATION</button>
          </div>
        )}

        {/* DEPLOY MODAL */}
        <AnimatePresence>
          {showDeploy && (
            <div className="modal-overlay">
              <motion.div 
                initial={{ opacity: 0, y: 50 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: 50 }} 
                className="w-full sm:w-auto p-4"
              >
                <HudPanel className="modal-content border-amber" style={{ width: '520px', maxWidth: '100%' }}>
                  <div className="flex-between mb-5 border-b border-border-color pb-3">
                    <span className="font-display text-xl uppercase text-amber tracking-widest">DEPLOY OPERATION</span>
                    <button type='button' onClick={() => setShowDeploy(false)} className="text-muted hover:text-danger"><X size={18} /></button>
                  </div>
                  <form onSubmit={handleDeploy} className="flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">OPERATION TITLE *</label>
                      <input type="text" className="input font-mono" value={deployForm.title}
                        onChange={e => setDeployForm({ ...deployForm, title: e.target.value })} required autoFocus
                        placeholder="e.g. Complete Module 3 of Beyond Tatva" />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">DESCRIPTION</label>
                      <textarea className="textarea font-mono text-sm h-20" value={deployForm.description}
                        onChange={e => setDeployForm({ ...deployForm, description: e.target.value })}
                        placeholder="What needs to be done..." />
                    </div>
                    {deployForm.recurrence_type !== 'weekly' && (
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">DUE DATE</label>
                        <input type="date" className="input font-mono text-sm py-1 w-full" value={deployForm.due_date} onChange={e=>setDeployForm({...deployForm, due_date: e.target.value})} />
                      </div>
                    )}
                    <div className="grid-2 gap-3 mt-3">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">DIFFICULTY</label>
                        <select className="select font-mono text-sm py-1" value={deployForm.difficulty} onChange={e=>setDeployForm({...deployForm, difficulty: e.target.value})}>
                          <option value="NONE">NONE (0 XP)</option>
                          <option value="EASY">EASY</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HARD">HARD</option>
                          <option value="EXTREME">EXTREME</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                        <select className="select font-mono text-sm py-1" value={deployForm.category} onChange={e=>setDeployForm({...deployForm, category: e.target.value})}>
                          <option value="beyond_tatva">BEYOND TATVA</option>
                          <option value="personal_mission">PERSONAL MISSION</option>
                          <option value="learning">LEARNING</option>
                          <option value="other">OTHER</option>
                        </select>
                      </div>
                    </div>
                    {deployForm.category === 'other' && (
                      <div className="mt-3 mb-3">
                        <label className="font-mono text-xs text-muted mb-1 block">CUSTOM CATEGORY</label>
                        <input type="text" className="input font-mono text-sm py-1" placeholder="e.g. Finance, Family" value={deployForm.customCategory} onChange={e=>setDeployForm({...deployForm, customCategory: e.target.value})} />
                      </div>
                    )}
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">LINK TO MISSION (OPTIONAL)</label>
                      <select className="select font-mono text-sm py-1 w-full" value={deployForm.goal_id} onChange={e=>setDeployForm({...deployForm, goal_id: e.target.value})}>
                        <option value="">NO MISSION LINKED</option>
                        {goals?.filter(g => g.status !== 'completed' && g.status !== 'cancelled' && g.status !== 'failed').map(goal => (
                          <option key={goal.id} value={goal.id}>{goal.title.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">RECURRENCE</label>
                      <select className="select font-mono" value={deployForm.recurrence_type}
                        onChange={e => setDeployForm({ ...deployForm, recurrence_type: e.target.value })}>
                        <option value="">ONE TIME</option>
                        <option value="daily">DAILY</option>
                        <option value="weekly">WEEKLY</option>
                      </select>
                    </div>
                    {deployForm.recurrence_type === 'weekly' && (
                      <div className="mt-3 p-3 border border-border/50 bg-bg-secondary rounded-lg">
                        <label className="font-mono text-xs text-info mb-2 block">RECURRENCE DAYS</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {DAYS_OF_WEEK.map(day => (
                            <button key={day.value} type="button" 
                              className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${deployForm.weeklyDays.includes(day.value) ? 'bg-info/20 border-info text-info' : 'border-border text-muted hover:border-info/50'}`}
                              onClick={() => {
                                const newDays = deployForm.weeklyDays.includes(day.value) 
                                  ? deployForm.weeklyDays.filter(d => d !== day.value)
                                  : [...deployForm.weeklyDays, day.value]
                                setDeployForm({...deployForm, weeklyDays: newDays})
                              }}>
                              {day.label}
                            </button>
                          ))}
                        </div>
                        <label className="font-mono text-xs text-info mb-1 block">DAYS TO COMPLETE (DURATION)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" max="14" className="input font-mono text-sm py-1 w-24" value={deployForm.weeklyDuration} onChange={e=>setDeployForm({...deployForm, weeklyDuration: parseInt(e.target.value) || 0})} />
                          <span className="text-xs text-muted font-mono">Days</span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button type="submit" className="btn btn-primary flex-1 py-3">DEPLOY</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowDeploy(false)}>ABORT</button>
                    </div>
                  </form>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* OPERATION COMPLETION / EXECUTION REPORT MODAL */}
        <AnimatePresence>
          {proofTask && (
            <div className="modal-overlay">
              <motion.div 
                initial={{ opacity: 0, y: 50 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: 50 }} 
                className="w-full sm:w-auto p-4"
              >
                <HudPanel className="modal-content border-success" style={{ width: '480px', maxWidth: '100%' }}>
                  <div className="flex-between mb-3 border-b border-border-color pb-3">
                    <span className="font-display text-xl uppercase text-success tracking-widest flex items-center gap-2">
                      <CheckCircle2 size={20} /> OPERATION COMPLETE
                    </span>
                    <button type='button' onClick={() => setProofTask(null)} className="text-muted hover:text-danger"><X size={18} /></button>
                  </div>
                  
                  <div className="mb-4">
                    <span className="font-mono text-[10px] text-muted uppercase block">TASK TITLE</span>
                    <p className="font-mono text-base font-bold text-primary truncate">{proofTask.title}</p>
                    
                    {(() => {
                      const cleanDueDate = proofTask.due_date ? proofTask.due_date.substring(0, 10) : null
                      const isTaskOverdue = cleanDueDate && cleanDueDate < today && proofTask.category !== 'weekly_goal'
                      if (!isTaskOverdue) return null

                      const [tY, tM, tD] = today.split('-').map(Number)
                      const [dY, dM, dD] = cleanDueDate.split('-').map(Number)
                      const daysOverdue = Math.max(1, Math.round((Date.UTC(tY, tM - 1, tD) - Date.UTC(dY, dM - 1, dD)) / (1000 * 60 * 60 * 24)))
                      const diffKey = (proofTask.difficulty || 'MEDIUM').toUpperCase()
                      const baseXP = DIFFICULTY_CONFIG[diffKey]?.xp || 30
                      const penalty = daysOverdue * 5
                      const netXP = Math.max(0, baseXP - penalty)

                      return (
                        <div className="mt-2 p-2.5 rounded-lg bg-danger/10 border border-danger/30 font-mono text-xs flex items-center justify-between text-danger">
                          <span className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle size={13} /> {daysOverdue}D OVERDUE PENALTY
                          </span>
                          <span>-{penalty} XP (Net: +{netXP} XP)</span>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-amber font-semibold mb-1 flex items-center gap-1.5 block">
                        <span>WHAT WAS ACCOMPLISHED? (NOTES / REFLECTION)</span>
                      </label>
                      <textarea 
                        className="textarea font-mono text-xs w-full p-2.5 rounded-lg bg-bg-primary border border-border-color focus:border-success focus:outline-none" 
                        rows={3} 
                        placeholder="Describe key outcomes, what was achieved, or execution details..."
                        value={completionNote} 
                        onChange={e => setCompletionNote(e.target.value)} 
                        autoFocus 
                      />
                    </div>

                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">ATTACH PROOF LINK / IMAGE URL (OPTIONAL)</label>
                      <input 
                        type="url" 
                        className="input font-mono text-xs w-full px-3 py-2 rounded-lg bg-bg-primary border border-border-color" 
                        placeholder="https://screenshot.link or drive link..."
                        value={proofUrl} 
                        onChange={e => setProofUrl(e.target.value)} 
                      />
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <button type='button' className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 font-bold" onClick={() => submitCompletion(false)}>
                        <Check size={16} /> SUBMIT REPORT & COMPLETE
                      </button>
                      
                      <button type='button' className="btn btn-ghost btn-xs text-muted font-mono" onClick={() => submitCompletion(true)}>
                        QUICK COMPLETE (SKIP NOTES)
                      </button>
                    </div>
                  </div>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* OPERATION FAILURE REASON MODAL */}
        <AnimatePresence>
          {failModalObj && (
            <div className="modal-overlay">
              <motion.div 
                initial={{ opacity: 0, y: 50 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: 50 }} 
                className="w-full sm:w-auto p-4"
              >
                <HudPanel className="modal-content border-danger" style={{ width: '440px', maxWidth: '100%' }}>
                  <div className="flex-between mb-3 border-b border-border-color pb-3">
                    <span className="font-display text-xl uppercase text-danger tracking-widest flex items-center gap-2">
                      <AlertTriangle size={20} /> FAIL OPERATION
                    </span>
                    <button type='button' onClick={() => setFailModalObj(null)} className="text-muted hover:text-danger"><X size={18} /></button>
                  </div>
                  
                  <div className="mb-4">
                    <span className="font-mono text-[10px] text-muted uppercase block">TASK TITLE</span>
                    <p className="font-mono text-base font-bold text-primary truncate">{failModalObj.title}</p>
                    <p className="font-mono text-xs text-danger mt-1">XP penalty will be applied based on difficulty.</p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-secondary font-semibold mb-1 block">REASON FOR FAILURE / LESSONS (OPTIONAL)</label>
                      <textarea 
                        className="textarea font-mono text-xs w-full p-2.5 rounded-lg bg-bg-primary border border-border-color focus:border-danger focus:outline-none" 
                        rows={3} 
                        placeholder="Why did this operation fail? Bottlenecks, distractions, or missing prerequisites..."
                        value={failReason} 
                        onChange={e => setFailReason(e.target.value)} 
                        autoFocus 
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-2">
                      <button type='button' className="btn btn-ghost btn-sm font-mono" onClick={() => setFailModalObj(null)}>CANCEL</button>
                      <button type='button' className="btn btn-primary bg-danger hover:bg-danger/80 border-danger py-2 px-4 flex items-center gap-2 font-bold" onClick={submitFailure}>
                        <X size={16} /> CONFIRM FAILURE (-XP)
                      </button>
                    </div>
                  </div>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <ConfirmModal {...confirmModal} />
      </div>
    </AppShell>
  )
}
