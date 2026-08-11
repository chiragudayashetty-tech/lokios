'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import ConfirmModal from '@/components/ui/ConfirmModal'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useGoals } from '@/lib/hooks/useGoals'
import { getLocalDateStr, parseTaskNotes } from '@/lib/utils/dates'
import { useOS } from '@/lib/context/OSContext'
import { Target, Flag, Star, Clock, Plus, Check, Trash2, Pause, Play, Edit2, ChevronDown, ChevronUp, X, RotateCcw, AlertTriangle, CheckSquare, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Missions() {
  const { mainQuest, mainQuests, sideQuests, longTermGoals, weeklyGoals, completedGoals, failedGoals, loading, error, fetchGoals, addGoal, completeGoal, undoCompleteGoal, deleteGoal, togglePauseGoal, updateGoal, updateProgress } = useGoals()
  const { failMission, undoFailMission, deleteMission, tasks: { tasks = [], completeOperation, deleteTask } = {} } = useOS() || {}
  const [activeTab, setActiveTab] = useState('main')
  const [showForm, setShowForm] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState(null)
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', danger: false, onConfirm: null, onCancel: null, confirmText: 'CONFIRM' })
  const [proofModal, setProofModal] = useState({ show: false, goal: null, url: '', note: '' })
  const [failMissionModal, setFailMissionModal] = useState({ show: false, goal: null, reason: '' })
  
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const [formData, setFormData] = useState({ title: '', description: '', type: 'side_quest', difficulty: 'HARD', deadline: '', category: 'personal', customCategory: '' })

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const TABS = [
    { id: 'main', label: 'PRIMARY', icon: Flag, items: mainQuests || (mainQuest ? [mainQuest] : []) },
    { id: 'side', label: 'SIDE OPS', icon: Target, items: sideQuests },
    { id: 'long', label: 'LONG RANGE', icon: Star, items: longTermGoals },
    { id: 'weekly', label: 'WEEKLY', icon: Clock, items: weeklyGoals },
    { id: 'completed', label: 'COMPLETED', icon: Check, items: completedGoals },
    { id: 'failed', label: 'FAILED', icon: AlertTriangle, items: failedGoals }
  ]

  const activeData = TABS.find(t => t.id === activeTab)?.items || []

  const DIFFICULTY_CONFIG = {
    EASY: { label: 'EASY', color: 'var(--info)' },
    MEDIUM: { label: 'MEDIUM', color: 'var(--accent-primary)' },
    HARD: { label: 'HARD', color: 'var(--warning)' },
    EXTREME: { label: 'EXTREME', color: 'var(--danger)' }
  }

  // Helper to group archived goals by Month -> Subheading (Category)
  const groupArchivedGoals = (goalList) => {
    const monthsMap = {}
    goalList.forEach(goal => {
      const dateStr = goal.completed_at || goal.updated_at || goal.deadline || goal.created_at
      const d = dateStr ? new Date(dateStr) : new Date()
      const monthLabel = d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
      
      let cat = goal.category || goal.type || 'GENERAL'
      if (cat === 'personal') cat = 'PERSONAL MISSION'
      else if (cat === 'business') cat = 'BEYOND TATVA (BUSINESS)'
      else if (cat === 'health') cat = 'FITNESS / HEALTH'
      else if (cat === 'learning') cat = 'LEARNING / SKILLS'
      else cat = String(cat).toUpperCase().replace('_', ' ')

      if (!monthsMap[monthLabel]) monthsMap[monthLabel] = { total: 0, subheadings: {} }
      monthsMap[monthLabel].total++
      if (!monthsMap[monthLabel].subheadings[cat]) monthsMap[monthLabel].subheadings[cat] = []
      monthsMap[monthLabel].subheadings[cat].push(goal)
    })
    return monthsMap
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (formData.type === 'long_term' && !formData.deadline) {
      alert("LONG RANGE MISSIONS REQUIRE A STRICT DEADLINE.")
      return
    }
    let finalDesc = formData.description || ''
    if (formData.category === 'other' && formData.customCategory) {
      finalDesc = `[Category: ${formData.customCategory}]\n\n${finalDesc}`.trim()
    }
    const payload = {
      title: formData.title,
      description: finalDesc || null,
      type: formData.type,
      difficulty: formData.difficulty,
      deadline: formData.deadline || null,
      category: formData.category === 'other' ? 'other' : formData.category
    }
    const result = await addGoal(payload)
    if (result && result.error) {
      alert(`DEPLOYMENT FAILED: ${result.error.message || result.error}\n\nPlease let the AI know what this error says!`)
      return
    }
    
    setFormData({ title: '', description: '', type: 'side_quest', difficulty: 'HARD', deadline: '', category: 'personal', customCategory: '' })
    setShowForm(false)
  }

  const startEdit = (goal) => {
    setEditingId(goal.id)
    setEditForm({
      title: goal.title,
      description: goal.description || '',
      difficulty: goal.difficulty || 'HARD',
      type: goal.type || 'side_quest',
      category: goal.category || 'personal',
      customCategory: '',
      deadline: goal.deadline ? getLocalDateStr(new Date(goal.deadline)) : ''
    })
  }

  const saveEdit = async (id) => {
    const payload = { ...editForm }
    if (payload.category === 'other' && payload.customCategory) {
      payload.description = `[Category: ${payload.customCategory}]\n\n${payload.description || ''}`.trim()
    }
    delete payload.customCategory
    await updateGoal(id, payload)
    setEditingId(null)
  }

  const handleDeleteGoal = async (goal) => {
    setConfirmModal({
      isOpen: true,
      title: 'DELETE MISSION',
      message: `Are you sure you want to delete "${goal.title}"?`,
      danger: true,
      confirmText: 'DELETE',
      onConfirm: async () => {
        let revokeXp = true
        if (goal.status === 'completed' || goal.status === 'failed') {
          setConfirmModal({
            isOpen: true,
            title: 'REVOKE XP?',
            message: 'Do you want to revoke/refund the XP associated with this mission?\n\nREVOKE = XP will be deducted\nKEEP = You keep the XP',
            danger: true,
            confirmText: 'REVOKE XP',
            cancelText: 'KEEP XP',
            onConfirm: async () => {
              await deleteMission(goal.id, true)
              setConfirmModal({ isOpen: false })
            },
            onCancel: async () => {
              await deleteMission(goal.id, false)
              setConfirmModal({ isOpen: false })
            }
          })
          return
        }
        await deleteMission(goal.id, revokeXp)
        setConfirmModal({ isOpen: false })
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    })
  }

  const handleCompleteGoal = (goal) => {
    setProofModal({ show: true, goal, url: '', note: '' })
  }

  const submitMissionCompletion = async (skipNotes = false) => {
    if (!proofModal.goal) return
    const urlToSend = skipNotes ? null : (proofModal.url.trim() || null)
    const noteToSend = skipNotes ? null : (proofModal.note.trim() || null)
    await completeGoal(proofModal.goal.id, urlToSend, false, noteToSend)
    setProofModal({ show: false, goal: null, url: '', note: '' })
  }

  const failGoal = (goal) => {
    setFailMissionModal({ show: true, goal, reason: '' })
  }

  const submitMissionFailure = async () => {
    if (!failMissionModal.goal) return
    await failMission(failMissionModal.goal.id, failMissionModal.reason.trim() || null)
    setFailMissionModal({ show: false, goal: null, reason: '' })
  }

  const renderGoalCard = (goal, i) => {
    const isPaused = goal.status === 'paused'
    const isEditing = editingId === goal.id
    const isExpanded = expandedGoal === goal.id
    const hasLinked = tasks.some(t => t.goal_id === goal.id)
    const linkedCount = tasks.filter(t => t.goal_id === goal.id).length
    const linkedCompleted = tasks.filter(t => t.goal_id === goal.id && t.status === 'completed').length
    const displayProgress = hasLinked 
      ? Math.round((linkedCompleted / linkedCount) * 100) 
      : (goal.progress || 0)

    // ── THIN STRIP LAYOUT FOR COMPLETED & FAILED MISSIONS ──
    if (goal.status === 'completed' || goal.status === 'failed') {
      const isCompleted = goal.status === 'completed'
      const dateStr = goal.completed_at 
        ? new Date(goal.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
        : (goal.updated_at ? new Date(goal.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null)

      return (
        <motion.div
          key={goal.id}
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="col-span-1"
        >
          <div className={`p-3 rounded-lg border transition-all ${
            isCompleted ? 'bg-success/5 border-success/30 hover:border-success/60' : 'bg-danger/5 border-danger/30 hover:border-danger/60'
          }`}>
            <div 
              onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
              className="flex items-center justify-between gap-3 cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCompleted ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                }`}>
                  {isCompleted ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                </span>
                <span className={`font-mono text-sm font-semibold truncate ${isCompleted ? 'text-muted line-through opacity-80' : 'text-danger line-through'}`}>
                  {goal.title}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {dateStr && (
                  <span className="font-mono text-[10px] text-muted hidden sm:inline">
                    {isCompleted ? `COMPLETED ${dateStr}` : `FAILED ${dateStr}`}
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
                const { cleanDesc, completionNote: itemCompNote, failureNote: itemFailNote } = parseTaskNotes(goal.description)
                return (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-3 pt-3 border-t border-border-color/40 flex flex-col gap-3 font-mono text-xs">
                      {cleanDesc && (
                        <p className="text-secondary whitespace-pre-wrap">{cleanDesc}</p>
                      )}

                      {itemCompNote && (
                        <div className="p-3 rounded-lg border border-success/40 bg-success/10 font-mono text-xs my-1">
                          <div className="text-success font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5">
                            <CheckCircle2 size={13} /> Mission Accomplishment Reflection:
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

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted pt-1">
                        <div>
                          <span className="uppercase">TYPE: {goal.type?.replace('_', ' ')}</span>
                          {goal.category && <span className="ml-3 uppercase">CAT: {goal.category}</span>}
                          {goal.created_at && <span className="ml-3 text-info">DEPLOYED: {new Date(goal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                          {goal.completed_at && <span className="ml-3 text-success font-semibold">COMPLETED: {new Date(goal.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompleted && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); undoCompleteGoal(goal.id); }} className="btn btn-ghost btn-xs text-info flex items-center gap-1 font-mono">
                              <RotateCcw size={12} /> RE-OPEN MISSION
                            </button>
                          )}
                          {!isCompleted && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); undoFailMission(goal.id); }} className="btn btn-ghost btn-xs text-info flex items-center gap-1 font-mono">
                              <RotateCcw size={12} /> RESTORE MISSION
                            </button>
                          )}
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal); }} className="btn btn-ghost btn-xs text-danger p-1" title="Delete">
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

    // ── CLEAN CARD LAYOUT FOR ACTIVE MISSIONS ──
    return (
      <motion.div
        key={goal.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: i * 0.05 }}
      >
        <HudPanel glow={activeTab === 'main' && !isPaused} scanLine={activeTab === 'main' && !isPaused} className={isPaused ? 'opacity-50' : ''}>
          
          {/* Header Tag Row: Flex wrap ensures tags NEVER collide or overlap */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-border-color">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider ${
                isPaused ? 'bg-secondary text-muted border border-border-color' : 'bg-amber/10 text-amber border border-amber/30'
              }`}>
                {isPaused ? 'PAUSED' : goal.type.replace('_', ' ')}
              </span>

              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border" 
                    style={{ color: DIFFICULTY_CONFIG[goal.difficulty || 'HARD'].color, borderColor: `${DIFFICULTY_CONFIG[goal.difficulty || 'HARD'].color}40`, background: `${DIFFICULTY_CONFIG[goal.difficulty || 'HARD'].color}10` }}>
                {DIFFICULTY_CONFIG[goal.difficulty || 'HARD'].label}
              </span>

              {goal.category && (
                <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase text-muted bg-bg-primary border border-border-color">
                  {goal.category}
                </span>
              )}
            </div>
            
            {/* Top-Right Control Buttons */}
            <div className="flex items-center gap-1 opacity-80 sm:opacity-60 hover:opacity-100 transition-opacity">
              <button type="button" onClick={(e) => { e.stopPropagation(); togglePauseGoal(goal.id, goal.status); }} className="btn btn-ghost p-1.5" title={isPaused ? 'Resume' : 'Pause'}>
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(goal); }} className="btn btn-ghost p-1.5 hover:text-amber" title="Edit">
                <Edit2 size={14} />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal); }} className="btn btn-ghost p-1.5 hover:text-danger" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          
          {/* Content */}
          {isEditing ? (
            <div className="flex-col gap-3 mb-4" onClick={(e) => e.stopPropagation()}>
              <input type="text" className="input font-mono text-lg py-1 border-amber" value={editForm.title} onChange={e=>setEditForm({...editForm, title: e.target.value})} />
              <textarea className="textarea font-mono text-sm py-1" value={editForm.description} onChange={e=>setEditForm({...editForm, description: e.target.value})} rows={2} />
              <div className="grid-2 gap-3 mt-3">
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">DIFFICULTY</label>
                  <select className="select font-mono text-sm py-1" value={editForm.difficulty} onChange={e=>setEditForm({...editForm, difficulty: e.target.value})}>
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                    <option value="EXTREME">EXTREME</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">DEADLINE</label>
                  <input type="date" className="input font-mono text-sm py-1" value={editForm.deadline || ''} onChange={e=>setEditForm({...editForm, deadline: e.target.value})} />
                </div>
              </div>
              <div className="grid-2 gap-3 mt-3">
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">CLASSIFICATION</label>
                  <select className="select font-mono text-sm py-1" value={editForm.type} onChange={e=>setEditForm({...editForm, type: e.target.value})}>
                    <option value="main_quest">PRIMARY MISSION</option>
                    <option value="side_quest">SIDE OPERATION</option>
                    <option value="weekly">WEEKLY TARGET</option>
                    <option value="long_term">LONG RANGE GOAL</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                  <select className="select font-mono text-sm py-1" value={editForm.category} onChange={e=>setEditForm({...editForm, category: e.target.value})}>
                    <option value="personal">PERSONAL MISSION</option>
                    <option value="business">BEYOND TATVA (BUSINESS)</option>
                    <option value="health">FITNESS / HEALTH</option>
                    <option value="learning">LEARNING / SKILLS</option>
                    <option value="other">OTHER</option>
                  </select>
                </div>
                {editForm.category === 'other' && (
                  <div className="col-span-2 sm:col-span-1">
                    <label className="font-mono text-xs text-muted mb-1 block">CUSTOM CATEGORY</label>
                    <input type="text" className="input font-mono text-sm py-1" placeholder="e.g. Finance" value={editForm.customCategory} onChange={e=>setEditForm({...editForm, customCategory: e.target.value})} />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => saveEdit(goal.id)} className="btn btn-primary btn-sm">SAVE</button>
                <button type="button" onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">CANCEL</button>
              </div>
            </div>
          ) : (
            <div onClick={() => setExpandedGoal(isExpanded ? null : goal.id)} className="cursor-pointer group">
              <div className="flex-between">
                <h3 className="font-display text-2xl uppercase tracking-wide text-primary group-hover:text-amber transition-colors">
                  {goal.title}
                </h3>
                {isExpanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
              </div>
              {goal.description && (
                <p 
                  className={`text-sm text-secondary mt-2 font-mono cursor-pointer overflow-hidden transition-all ${isExpanded ? 'whitespace-pre-wrap' : 'whitespace-normal line-clamp-2'}`}
                  onClick={(e) => {
                     e.stopPropagation();
                     setExpandedGoal(isExpanded ? null : goal.id);
                  }}
                  title={isExpanded ? "Click to collapse" : "Click to expand"}
                >
                  {goal.description}
                </p>
              )}
            </div>
          )}
          
          {/* Progress Bar Preview on Main Card */}
          <div className="mt-3" onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}>
            <TacticalProgress value={displayProgress} color={isPaused ? 'var(--text-muted)' : 'var(--accent-primary)'} label="COMPLETION" />
          </div>
          
          {/* Expanded Dropdown Accordion: Progress Slider & Milestones */}
          <AnimatePresence>
            {isExpanded && !isEditing && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-border-color flex flex-col gap-4">
                  {/* Dynamic / Manual Progress Slider */}
                  <div onClick={(e) => e.stopPropagation()} className="bg-bg-primary/60 p-3 rounded-lg border border-border-color/60">
                    <div className="flex-between mb-2">
                      <label className="font-mono text-xs text-amber font-semibold">
                        {hasLinked ? `DYNAMIC PROGRESS (LINKED OPS): ${displayProgress}%` : `MANUAL PROGRESS SLIDER: ${displayProgress}%`}
                      </label>
                      <span className="font-mono text-xs font-bold text-primary">{displayProgress}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={displayProgress} 
                      onChange={(e) => !hasLinked && updateProgress(goal.id, parseInt(e.target.value))}
                      className={`w-full ${hasLinked ? 'accent-success opacity-50 cursor-not-allowed' : 'accent-amber-500'}`}
                      disabled={hasLinked}
                    />
                    {hasLinked && (
                      <span className="font-mono text-[10px] text-muted mt-1 block">
                        Progress automatically calculates from linked milestones below.
                      </span>
                    )}
                  </div>

                  {/* Linked Milestones */}
                  {tasks.filter(t => t.goal_id === goal.id).length > 0 && (
                    <div className="pt-2 border-t border-border-color" onClick={(e) => e.stopPropagation()}>
                      <label className="font-mono text-xs text-info mb-2 block font-semibold">MISSION MILESTONES (LINKED OPS)</label>
                      <div className="flex flex-col gap-2">
                        {tasks.filter(t => t.goal_id === goal.id).map(task => {
                          const isCompleted = task.status === 'completed'
                          return (
                            <div key={task.id} className={`flex items-center gap-3 p-2 rounded border ${isCompleted ? 'bg-success/5 border-success/30' : 'bg-tertiary border-border-color'}`}>
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); if (!isCompleted) completeOperation(task.id) }}
                                className={`${isCompleted ? 'text-success cursor-default' : 'text-muted hover:text-amber'}`}
                                disabled={isCompleted}
                              >
                                {isCompleted ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                              <span className={`font-mono text-sm flex-1 ${isCompleted ? 'text-muted line-through' : 'text-primary'}`}>
                                {task.title}
                              </span>
                              <button type="button" onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }} className="text-muted hover:text-danger p-1 opacity-50 hover:opacity-100 transition-opacity" title="Delete Linked Operation">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Primary Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-border-color" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              {goal.created_at && (
                <span className="font-mono text-xs text-info flex items-center gap-1">
                  <Clock size={12} /> DEPLOYED: {new Date(goal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {goal.deadline && (
                <span className="font-mono text-xs text-muted flex items-center gap-1">
                  <Clock size={12} /> DEADLINE: {new Date(goal.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); handleCompleteGoal(goal); }} 
                className="btn btn-primary btn-sm flex-1 sm:flex-none flex items-center justify-center gap-1.5 font-bold"
              >
                <Check size={14} strokeWidth={2.5} /> COMPLETE MISSION
              </button>
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); failGoal(goal); }} 
                className="btn btn-ghost btn-sm text-danger flex items-center justify-center gap-1 font-mono"
              >
                <X size={14} /> FAIL
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
          <button type="button" onClick={() => fetchGoals()} className="btn btn-primary mt-4">RETRY CONNECTION</button>
        </div>
      </AppShell>
    )
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING MISSIONS...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header flex-between">
          <div>
            <h1 className="page-title">MISSIONS</h1>
            <p className="page-subtitle font-mono uppercase text-xs text-amber glow-amber">Strategic objectives and long-term targets.</p>
          </div>
          <button className="btn btn-primary btn-sm flex items-center gap-2 tracking-widest" onClick={() => setShowForm(true)}>
            <Plus size={16} /> NEW MISSION
          </button>
        </header>

        <div className="tab-list mb-8 hide-scrollbar" style={{ overflowX: 'auto', whiteSpace: 'nowrap', display: 'flex', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button 
                key={tab.id}
                className={`tab-item flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={14} />
                {tab.label}
                <span className="badge ml-1" style={{ fontSize: '9px' }}>{tab.items.length}</span>
              </button>
            )
          })}
        </div>

        {(activeTab === 'completed' || activeTab === 'failed') ? (
          <div className="flex flex-col gap-6">
            {Object.keys(groupArchivedGoals(activeData)).length === 0 ? (
              <div className="text-center py-16">
                <div className="font-mono text-sm text-muted mb-4">
                  {activeTab === 'completed' ? 'NO COMPLETED MISSIONS YET.' : 'NO FAILED MISSIONS YET.'}
                </div>
                <button type='button' onClick={() => setShowForm(true)} className="btn btn-primary btn-sm">DEPLOY MISSION</button>
              </div>
            ) : (
              Object.entries(groupArchivedGoals(activeData)).map(([monthLabel, { total, subheadings }]) => (
                <div key={monthLabel} className="mb-4">
                  <div className="flex items-center gap-2 p-3 rounded-sm bg-bg-secondary border border-border-color mb-4">
                    <Clock size={14} className="text-amber" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold text-amber">{monthLabel}</span>
                    <span className="font-mono text-[9px] text-muted ml-auto font-bold">({total} {total === 1 ? 'MISSION' : 'MISSIONS'})</span>
                  </div>

                  {Object.entries(subheadings).map(([subheading, subheadingGoals]) => (
                    <div key={subheading} className="mb-5 pl-2 sm:pl-4 border-l-2 border-border-color">
                      <div className="flex items-center gap-2 mb-3">
                        <Target size={11} className="text-info" />
                        <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-info">{subheading}</span>
                        <span className="font-mono text-[9px] text-muted">({subheadingGoals.length})</span>
                      </div>
                      <div className="flex flex-col gap-4">
                        <AnimatePresence mode="popLayout">
                          {subheadingGoals.map((goal, i) => renderGoalCard(goal, i))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <AnimatePresence mode="popLayout">
              {activeData.map((goal, i) => renderGoalCard(goal, i))}
            </AnimatePresence>
            {activeData.length === 0 && (
              <div className="text-center py-16">
                <div className="font-mono text-sm text-muted mb-4">
                  NO MISSIONS IN THIS CATEGORY.
                </div>
                <button type='button' onClick={() => setShowForm(true)} className="btn btn-primary btn-sm">DEPLOY MISSION</button>
              </div>
            )}
          </div>
        )}

        {/* Modal Form */}
        <AnimatePresence>
          {showForm && (
            <div className="modal-overlay">
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="w-full sm:w-auto p-4">
                <HudPanel className="modal-content">
                  <div className="font-display text-xl uppercase text-amber mb-4 border-b border-border-color pb-2 flex items-center gap-2"><Target size={18} /> Initialize Mission</div>
                  <form onSubmit={handleAdd} className="flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">MISSION TITLE</label>
                      <input type="text" className="input" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} required autoFocus />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">CLASSIFICATION</label>
                      <select className="select font-mono" value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value})}>
                        <option value="main_quest">PRIMARY MISSION</option>
                        <option value="side_quest">SIDE OPERATION</option>
                        <option value="weekly">WEEKLY TARGET</option>
                        <option value="long_term">LONG RANGE GOAL</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">DIFFICULTY</label>
                      <select className="select font-mono" value={formData.difficulty} onChange={e=>setFormData({...formData, difficulty: e.target.value})}>
                        <option value="EASY">EASY</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HARD">HARD</option>
                        <option value="EXTREME">EXTREME</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                      <select className="select font-mono w-full" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})}>
                        <option value="personal">PERSONAL MISSION</option>
                        <option value="business">BEYOND TATVA (BUSINESS)</option>
                        <option value="health">FITNESS / HEALTH</option>
                        <option value="learning">LEARNING / SKILLS</option>
                        <option value="other">OTHER</option>
                      </select>
                    </div>
                    {formData.category === 'other' && (
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">CUSTOM CATEGORY</label>
                        <input type="text" className="input" placeholder="e.g. Finance, Family" value={formData.customCategory} onChange={e=>setFormData({...formData, customCategory: e.target.value})} />
                      </div>
                    )}
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">
                        {formData.type === 'long_term' ? 'STRICT DEADLINE (REQUIRED)' : 'DEADLINE (OPTIONAL)'}
                      </label>
                      <input type="date" className="input" value={formData.deadline} onChange={e=>setFormData({...formData, deadline: e.target.value})} required={formData.type === 'long_term'} />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">BRIEFING (OPTIONAL)</label>
                      <textarea className="textarea" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button type="submit" className="btn btn-primary flex-1">DEPLOY</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>ABORT</button>
                    </div>
                  </form>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MISSION ACCOMPLISHED REPORT MODAL */}
        <AnimatePresence>
          {proofModal.show && proofModal.goal && (
            <div className="modal-overlay">
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="w-full sm:w-auto p-4">
                <HudPanel glow label="MISSION ACCOMPLISHED" className="modal-content w-full max-w-lg border-success">
                  <div className="p-4 flex flex-col gap-4">
                    <div>
                      <span className="font-mono text-[10px] text-muted uppercase block">MISSION TITLE</span>
                      <p className="font-mono text-base font-bold text-primary">{proofModal.goal.title}</p>
                    </div>

                    <div>
                      <label className="font-mono text-xs text-amber font-semibold mb-1 block">
                        WHAT WAS ACCOMPLISHED? (ACCOMPLISHMENT REFLECTION / NOTES)
                      </label>
                      <textarea 
                        className="textarea font-mono text-xs w-full p-2.5 bg-bg-primary border border-border-color focus:border-success focus:outline-none" 
                        rows={3}
                        placeholder="Describe key outcomes, milestones achieved, deliverables..."
                        value={proofModal.note} 
                        onChange={(e) => setProofModal({ ...proofModal, note: e.target.value })} 
                        autoFocus 
                      />
                    </div>

                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">ATTACH PROOF LINK / IMAGE URL (OPTIONAL)</label>
                      <input 
                        type="url" 
                        className="input font-mono text-xs w-full px-3 py-2 bg-bg-primary border border-border-color" 
                        value={proofModal.url} 
                        onChange={(e) => setProofModal({ ...proofModal, url: e.target.value })} 
                        placeholder="https://..." 
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-2">
                      <button className="btn btn-primary w-full py-2.5 font-bold flex items-center justify-center gap-2" onClick={() => submitMissionCompletion(false)}>
                        <Check size={16} /> CONFIRM & LOG MISSION
                      </button>
                      <button className="btn btn-ghost btn-xs text-muted font-mono" onClick={() => submitMissionCompletion(true)}>
                        QUICK COMPLETE (SKIP NOTES)
                      </button>
                    </div>
                  </div>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MISSION FAILURE REASON MODAL */}
        <AnimatePresence>
          {failMissionModal.show && failMissionModal.goal && (
            <div className="modal-overlay">
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="w-full sm:w-auto p-4">
                <HudPanel label="FAIL MISSION" className="modal-content w-full max-w-md border-danger">
                  <div className="p-4 flex flex-col gap-4">
                    <div>
                      <span className="font-mono text-[10px] text-muted uppercase block">MISSION TITLE</span>
                      <p className="font-mono text-base font-bold text-primary">{failMissionModal.goal.title}</p>
                      <p className="font-mono text-xs text-danger mt-1">XP penalty will be applied based on mission difficulty.</p>
                    </div>

                    <div>
                      <label className="font-mono text-xs text-secondary font-semibold mb-1 block">REASON FOR FAILURE / LESSONS (OPTIONAL)</label>
                      <textarea 
                        className="textarea font-mono text-xs w-full p-2.5 bg-bg-primary border border-border-color focus:border-danger focus:outline-none" 
                        rows={3}
                        placeholder="Why was this mission failed or aborted? Key lessons or bottlenecks..."
                        value={failMissionModal.reason} 
                        onChange={(e) => setFailMissionModal({ ...failMissionModal, reason: e.target.value })} 
                        autoFocus 
                      />
                    </div>

                    <div className="flex justify-end gap-3 mt-2">
                      <button className="btn btn-ghost font-mono" onClick={() => setFailMissionModal({ show: false, goal: null, reason: '' })}>CANCEL</button>
                      <button className="btn btn-primary bg-danger hover:bg-danger/80 border-danger font-bold flex items-center gap-1.5" onClick={submitMissionFailure}>
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
