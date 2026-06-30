'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { getLocalDateStr } from '@/lib/utils/dates'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, Calendar, Trash2, Edit2, RotateCcw, Repeat, X, Target, Clock, AlertTriangle, CheckCircle2, Layers, Zap, XCircle } from 'lucide-react'

export default function Operations() {
  const { tasks: { tasks, todayTasks, loading, error, fetchTasks, addTask, editTask, undoCompleteTask, deleteTask }, completeOperation, deleteOperation, failOperation, undoFailOperation, goals: { goals } } = useOS()

  const [activeTab, setActiveTab] = useState('today')
  const [showDeploy, setShowDeploy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Deploy form
  const [deployForm, setDeployForm] = useState({ title: '', description: '', difficulty: 'MEDIUM', category: 'beyond_tatva', recurrence_type: '', customCategory: '', due_date: getLocalDateStr(), goal_id: '' })

  // Proof state
  const [proofTask, setProofTask] = useState(null)
  const [proofUrl, setProofUrl] = useState('')

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

    const result = await addTask({
      title: deployForm.title,
      description: deployForm.description || null,
      due_date: deployForm.due_date || today, 
      difficulty: deployForm.difficulty,
      category: deployForm.category === 'other' ? (deployForm.customCategory || 'Other') : deployForm.category,
      type: deployForm.recurrence_type ? 'recurring' : 'custom',
      recurrence_type: deployForm.recurrence_type || null,
      recurrence_days: deployForm.recurrence_type === 'daily' 
        ? [0, 1, 2, 3, 4, 5, 6] 
        : (deployForm.recurrence_type === 'weekly' ? [new Date().getDay()] : null),
      goal_id: deployForm.goal_id || null,
    })

    if (result && result.error) {
      alert(`DEPLOYMENT FAILED: ${result.error.message || result.error}\n\nPlease let the AI know what this error says!`)
      return
    }

    setDeployForm({ title: '', description: '', difficulty: 'MEDIUM', category: 'beyond_tatva', recurrence_type: '', customCategory: '', due_date: today })
    setShowDeploy(false)
  }

  const pushToTomorrow = async (task) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await editTask(task.id, { due_date: getLocalDateStr(tomorrow) })
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
          // Check if user wants to revoke XP
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

  const failTask = async (task) => {
    setConfirmModal({
      isOpen: true,
      title: 'FAIL OPERATION',
      message: 'Are you sure? This will permanently fail the operation and apply a negative XP penalty based on difficulty.',
      danger: true,
      confirmText: 'FAIL',
      onConfirm: async () => {
        await failOperation(task.id)
        setConfirmModal({ isOpen: false })
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    })
  }

  const handleComplete = (task) => {
    setProofTask(task)
    setProofUrl('')
  }

  const submitCompletion = async (skipProof = false) => {
    if (!proofTask) return
    await completeOperation(proofTask.id, skipProof ? null : proofUrl)
    setProofTask(null)
    setProofUrl('')
  }

  const startEdit = (task) => {
    setEditingId(task.id)
    setEditForm({
      title: task.title, due_date: task.due_date || '', difficulty: task.difficulty || 'MEDIUM',
      type: task.type || 'custom', recurrence_type: task.recurrence_type || '', description: task.description || ''
    })
  }

  const saveEdit = async (id) => {
    const payload = { ...editForm }
    if (payload.due_date === '') payload.due_date = null
    await editTask(id, payload)
    setEditingId(null)
  }

  // Which list to show based on active tab
  const getActiveList = () => {
    switch (activeTab) {
      case 'today': return [...overdue, ...dueToday]
      case 'upcoming': return upcoming
      case 'completed': return completed.slice(0, 20)
      case 'failed': return failedOps.slice(0, 20)
      case 'all': return pending
      default: return dueToday
    }
  }

  const activeList = getActiveList()

  const DIFFICULTY_CONFIG = {
    EASY: { label: 'EASY', color: 'var(--info)', xp: 15 },
    MEDIUM: { label: 'MEDIUM', color: 'var(--accent-primary)', xp: 30 },
    HARD: { label: 'HARD', color: 'var(--warning)', xp: 60 },
    EXTREME: { label: 'EXTREME', color: 'var(--danger)', xp: 120 }
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
        <header className="flex-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="page-title flex items-center gap-3"><Target className="text-amber" /> OPERATIONS</h1>
            <p className="page-subtitle font-mono text-xs uppercase">Deploy morning work goals. Execute. Complete. Prove.</p>
          </div>
          <button type='button' className="btn btn-primary flex items-center gap-2" onClick={() => setShowDeploy(true)}>
            <Plus size={18} /> DEPLOY OPERATION
          </button>
        </header>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:flex md:flex-row gap-2 md:gap-4 mb-6">
          <HudPanel className="p-3 md:p-4 flex-col items-center justify-center text-center w-full md:flex-1 md:min-w-[75px]">
            <div className="font-display text-2xl md:text-3xl text-primary">{pending.length}</div>
            <div className="font-mono text-[9px] md:text-[10px] text-muted uppercase tracking-widest">PENDING</div>
          </HudPanel>
          <HudPanel className="p-3 md:p-4 flex-col items-center justify-center text-center border-danger w-full md:flex-1 md:min-w-[75px]">
            <div className="font-display text-2xl md:text-3xl text-danger">{overdue.length}</div>
            <div className="font-mono text-[9px] md:text-[10px] text-muted uppercase tracking-widest">OVERDUE</div>
          </HudPanel>
          <HudPanel className="p-3 md:p-4 flex-col items-center justify-center text-center border-amber w-full md:flex-1 md:min-w-[75px]">
            <div className="font-display text-2xl md:text-3xl text-amber">{dueToday.length}</div>
            <div className="font-mono text-[9px] md:text-[10px] text-muted uppercase tracking-widest">DUE TODAY</div>
          </HudPanel>
          <HudPanel className="p-3 md:p-4 flex-col items-center justify-center text-center w-full md:flex-1 md:min-w-[75px]">
            <div className="font-display text-2xl md:text-3xl text-success">{completionRate}%</div>
            <div className="font-mono text-[9px] md:text-[10px] text-muted uppercase tracking-widest">COMPLETION</div>
          </HudPanel>
        </div>

        {/* TABS */}
        <div className="tabs mb-6 flex-wrap">
          {[
            { id: 'today', label: `TODAY (${overdue.length + dueToday.length})` },
            { id: 'upcoming', label: `UPCOMING (${upcoming.length})` },
            { id: 'all', label: `ALL PENDING (${pending.length})` },
            { id: 'completed', label: `COMPLETED (${completed.length})` },
            { id: 'failed', label: `FAILED (${failedOps.length})` }
          ].map(tab => (
            <button type='button' key={tab.id} className={`tab-item ${activeTab === tab.id ? 'tab-active' : ''} ${tab.id === 'failed' ? 'text-danger' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* OPERATIONS GRID */}
        <div className="grid-2 gap-4">
          <AnimatePresence mode="popLayout">
            {activeList.map((task) => {
              const isCompleted = task.status === 'completed'
              const isFailed = task.status === 'cancelled' || task.status === 'failed'
              const isEditing = editingId === task.id
              const isOverdue = !isCompleted && !isFailed && task.due_date && task.due_date < today
              const diffConfig = DIFFICULTY_CONFIG[task.difficulty] || DIFFICULTY_CONFIG.MEDIUM
              const dynamicXp = isOverdue ? Math.floor(diffConfig.xp * 0.5) : diffConfig.xp

              if (isEditing) {
                return (
                  <motion.div key={task.id} layout className="col-span-1">
                    <HudPanel className="p-5 border-amber">
                      <div className="flex-col gap-3">
                        <input type="text" className="input font-mono" value={editForm.title}
                          onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                        <textarea className="textarea font-mono text-sm h-16" value={editForm.description}
                          onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description..." />
                        <div className="grid-3 gap-3">
                          <div>
                            <label className="font-mono text-[10px] text-muted mb-1 block">DUE DATE</label>
                            <input type="date" className="input font-mono text-xs" value={editForm.due_date}
                              onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} />
                          </div>
                          <div>
                            <label className="font-mono text-[10px] text-muted mb-1 block">DIFFICULTY</label>
                            <select className="select font-mono text-xs" value={editForm.difficulty}
                              onChange={e => setEditForm({ ...editForm, difficulty: e.target.value })}>
                              <option value="EASY">EASY</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="HARD">HARD</option>
                              <option value="EXTREME">EXTREME</option>
                            </select>
                          </div>
                          <div>
                            <label className="font-mono text-[10px] text-muted mb-1 block">RECURRENCE</label>
                            <select className="select font-mono text-xs" value={editForm.recurrence_type}
                              onChange={e => setEditForm({ ...editForm, recurrence_type: e.target.value, type: e.target.value ? 'recurring' : 'custom' })}>
                              <option value="">ONE TIME</option>
                              <option value="daily">DAILY</option>
                              <option value="weekly">WEEKLY</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end mt-2">
                          <button type='button' onClick={() => saveEdit(task.id)} className="btn btn-primary btn-sm">SAVE</button>
                          <button type='button' onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">CANCEL</button>
                        </div>
                      </div>
                    </HudPanel>
                  </motion.div>
                )
              }

              return (
                <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="col-span-1"
                >
                  <div className={`relative bg-tertiary border p-5 transition-all duration-200 group ${isFailed ? 'border-danger opacity-50' : isOverdue ? 'border-danger hover:border-danger' : isCompleted ? 'border-border-color opacity-60' : 'border-border-color hover:border-amber'}`}
                    style={{ borderLeftWidth: '3px', borderLeftColor: diffConfig.color }}>

                    {/* Top row: Difficulty + Actions */}
                    <div className="flex-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border"
                          style={{ color: diffConfig.color, borderColor: diffConfig.color, opacity: 0.8 }}>
                          {diffConfig.label}
                        </span>
                        {isOverdue && (
                          <span className="font-mono text-[9px] text-danger flex items-center gap-1">
                            <AlertTriangle size={10} /> OVERDUE
                          </span>
                        )}
                        {task.recurrence_type && (
                          <span className="font-mono text-[9px] text-info flex items-center gap-1">
                            <Repeat size={10} /> {task.recurrence_type.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {!isCompleted && <button type='button' onClick={() => startEdit(task)} className="p-1.5 text-muted hover:text-amber transition-colors"><Edit2 size={13} /></button>}
                        {isCompleted && <button type='button' onClick={() => undoCompleteTask(task.id)} className="p-1.5 text-muted hover:text-info transition-colors" title="Undo"><RotateCcw size={13} /></button>}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className={`font-display text-xl uppercase tracking-wider mb-1 ${isCompleted ? 'line-through text-muted' : 'text-primary'}`}>
                      {task.title}
                    </h3>
                    {task.description && <p className="font-mono text-xs text-secondary mb-3 line-clamp-2 truncate-mobile-wrap">{task.description}</p>}

                    {/* Bottom row */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mt-4 pt-3 border-t border-border-subtle gap-4 sm:gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {task.due_date && (
                          <span className="font-mono text-[10px] text-muted flex items-center gap-1">
                            <Calendar size={10} /> {task.due_date}
                          </span>
                        )}
                        {task.media_urls && task.media_urls.length > 0 && (
                          <span className="font-mono text-[10px] text-amber">[{task.media_urls.length} PROOF]</span>
                        )}
                        {!isCompleted && (
                          <span className={`font-mono text-[10px] ${isOverdue ? 'text-danger line-through' : 'text-success'}`}>
                            +{diffConfig.xp} XP
                          </span>
                        )}
                        {!isCompleted && isOverdue && (
                          <span className="font-mono text-[10px] text-danger">+{dynamicXp} XP (PENALTY)</span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {!isCompleted && !isFailed && (
                          <>
                            <button type='button' onClick={() => handleComplete(task)}
                              className="btn btn-primary flex-1 sm:flex-none py-3 sm:py-2 flex items-center justify-center gap-1.5 px-4 touch-ripple">
                              <Zap size={14} /> EXECUTE
                            </button>
                            <button type='button' className="btn btn-ghost p-3 sm:p-2 sm:btn-sm touch-ripple bg-bg-secondary" onClick={() => setEditingId(task.id)} title="Edit">
                              <Edit2 size={16} className="sm:w-[14px] sm:h-[14px]" />
                            </button>
                            <button type='button' className="btn btn-ghost p-3 sm:p-2 sm:btn-sm text-amber touch-ripple bg-bg-secondary" onClick={() => pushToTomorrow(task)} title="Push to Tomorrow">
                              <RotateCcw size={16} className="sm:w-[14px] sm:h-[14px]" />
                            </button>
                            <button type='button' className="btn btn-ghost p-3 sm:p-2 sm:btn-sm text-danger touch-ripple bg-bg-secondary" onClick={() => failTask(task)} title="Fail Operation">
                              <X size={16} className="sm:w-[14px] sm:h-[14px]" />
                            </button>
                            <button type='button' className="btn btn-ghost p-3 sm:p-2 sm:btn-sm text-muted hover:text-danger touch-ripple bg-bg-secondary" onClick={() => handleDeleteOperation(task)} title="Delete Operation">
                              <Trash2 size={16} className="sm:w-[14px] sm:h-[14px]" />
                            </button>
                          </>
                        )}
                        {(isCompleted || isFailed) && (
                          <>
                            <button type="button" className="btn btn-ghost p-3 sm:p-2 sm:btn-sm text-danger touch-ripple bg-bg-secondary" onClick={() => handleDeleteOperation(task)} title="Delete Operation">
                              <Trash2 size={16} className="sm:w-[14px] sm:h-[14px]" />
                            </button>
                            {isCompleted && (
                              <div className="flex-1 flex items-center justify-between ml-2">
                                <span className="font-mono text-[10px] text-success flex items-center gap-1">
                                  <CheckCircle2 size={12} /> COMPLETED
                                </span>
                                <button type='button' className="btn btn-ghost btn-sm text-info touch-ripple" onClick={() => undoCompleteTask(task.id)} title="Undo Operation">
                                  <RotateCcw size={14} /> UNDO
                                </button>
                              </div>
                            )}
                            {isFailed && (
                              <div className="flex-1 flex items-center justify-between ml-2">
                                <span className="font-mono text-[10px] text-danger flex items-center gap-1">
                                  <XCircle size={12} /> FAILED
                                </span>
                                <button type='button' className="btn btn-ghost btn-sm text-info touch-ripple" onClick={() => undoFailOperation(task.id)} title="Restore Operation">
                                  <RotateCcw size={14} /> RESTORE
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {activeList.length === 0 && (
          <div className="text-center py-16">
            <div className="font-mono text-sm text-muted mb-4">
              {activeTab === 'completed' ? 'NO COMPLETED OPERATIONS YET.' : 'NO OPERATIONS IN THIS VIEW.'}
            </div>
            <button type='button' onClick={() => setShowDeploy(true)} className="btn btn-primary btn-sm">DEPLOY OPERATION</button>
          </div>
        )}

        {/* DEPLOY MODAL */}
        <AnimatePresence>
          {showDeploy && (
            <div className="modal-overlay bottom-sheet-mobile">
              <motion.div 
                drag 
                dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }} 
                dragElastic={0} 
                dragMomentum={false} 
                initial={{ opacity: 0, y: 50, x: deployDrag.x }} 
                animate={{ opacity: 1, y: deployDrag.y, x: deployDrag.x }} 
                exit={{ opacity: 0, y: 50 }} 
                onDragEnd={(e, info) => setDeployDrag({ x: deployDrag.x + info.offset.x, y: deployDrag.y + info.offset.y })}
                className="w-full sm:w-auto"
              >
                <HudPanel className="modal-content bottom-sheet-content border-amber cursor-move" style={{ width: '520px', maxWidth: '100%' }}>
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
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">DUE DATE</label>
                      <input type="date" className="input font-mono text-sm py-1 w-full" value={deployForm.due_date} onChange={e=>setDeployForm({...deployForm, due_date: e.target.value})} />
                    </div>
                    <div className="grid-2 gap-3 mt-3">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">DIFFICULTY</label>
                        <select className="select font-mono text-sm py-1" value={deployForm.difficulty} onChange={e=>setDeployForm({...deployForm, difficulty: e.target.value})}>
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

        {/* PROOF MODAL */}
        <AnimatePresence>
          {proofTask && (
            <div className="modal-overlay bottom-sheet-mobile">
              <motion.div 
                drag 
                dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }} 
                dragElastic={0} 
                dragMomentum={false} 
                initial={{ opacity: 0, y: 50, x: proofDrag.x }} 
                animate={{ opacity: 1, y: proofDrag.y, x: proofDrag.x }} 
                exit={{ opacity: 0, y: 50 }} 
                onDragEnd={(e, info) => setProofDrag({ x: proofDrag.x + info.offset.x, y: proofDrag.y + info.offset.y })}
                className="w-full sm:w-auto"
              >
                <HudPanel className="modal-content bottom-sheet-content border-success cursor-move" style={{ width: '440px', maxWidth: '100%' }}>
                  <div className="flex-between mb-4 border-b border-border-color pb-3">
                    <span className="font-display text-xl uppercase text-success tracking-widest">OPERATION COMPLETE</span>
                    <button type='button' onClick={() => setProofTask(null)} className="text-muted hover:text-danger"><X size={18} /></button>
                  </div>
                  <p className="font-mono text-sm text-primary mb-4 truncate">{proofTask.title}</p>
                  <div className="flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">ATTACH PROOF (URL)</label>
                      <input type="url" className="input font-mono text-sm w-full" placeholder="https://screenshot.link or drive.google.com/..."
                        value={proofUrl} onChange={e => setProofUrl(e.target.value)} autoFocus />
                    </div>
                    <div className="flex-col gap-3 mt-4">
                      <button type='button' className="btn btn-primary w-full py-2 flex items-center justify-center gap-2" onClick={() => submitCompletion(false)}>
                        <Check size={16} /> CONFIRM EXECUTION
                      </button>
                      <div className="flex flex-wrap justify-center gap-2">
                        <button type='button' className="btn btn-ghost btn-sm" onClick={() => setEditingId(proofTask.id)}>
                          <Edit2 size={14} /> EDIT
                        </button>
                        <button type='button' className="btn btn-ghost btn-sm text-amber" onClick={() => pushToTomorrow(proofTask)}>
                          <RotateCcw size={14} /> PUSH
                        </button>
                        <button type='button' className="btn btn-ghost btn-sm text-danger" onClick={() => failTask(proofTask)}>
                          <X size={14} /> FAIL
                        </button>
                      </div>
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
