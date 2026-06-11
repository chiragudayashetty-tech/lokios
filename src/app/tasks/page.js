'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { useTasks } from '@/lib/hooks/useTasks'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, Calendar, Trash2, Edit2, RotateCcw, Repeat, X, Target, Clock, AlertTriangle, CheckCircle2, Layers, Zap } from 'lucide-react'

export default function Operations() {
  const { tasks, todayTasks, loading, addTask, editTask, completeTask, undoCompleteTask, deleteTask } = useTasks()

  const [activeTab, setActiveTab] = useState('today')
  const [showDeploy, setShowDeploy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Deploy form
  const [deployForm, setDeployForm] = useState({
    title: '', description: '', due_date: new Date().toISOString().split('T')[0],
    difficulty: 'MEDIUM', category: 'personal', recurrence_type: ''
  })

  // Proof state
  const [proofTask, setProofTask] = useState(null)
  const [proofUrl, setProofUrl] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const overdue = pending.filter(t => t.due_date && t.due_date < today)
  const dueToday = pending.filter(t => t.due_date === today)
  const upcoming = pending.filter(t => !t.due_date || t.due_date > today)
  const completed = tasks.filter(t => t.status === 'completed')

  const completionRate = tasks.length === 0 ? 0 : Math.round((completed.length / tasks.length) * 100)

  const handleDeploy = async (e) => {
    e.preventDefault()
    if (!deployForm.title.trim()) return
    await addTask({
      title: deployForm.title,
      description: deployForm.description || null,
      due_date: deployForm.due_date || null,
      difficulty: deployForm.difficulty,
      category: deployForm.category,
      type: deployForm.recurrence_type ? 'recurring' : 'custom',
      recurrence_type: deployForm.recurrence_type || null,
    })
    setDeployForm({ title: '', description: '', due_date: new Date().toISOString().split('T')[0], difficulty: 'MEDIUM', category: 'personal', recurrence_type: '' })
    setShowDeploy(false)
  }

  const handleComplete = (task) => {
    setProofTask(task)
    setProofUrl('')
  }

  const submitCompletion = async (skipProof = false) => {
    if (!proofTask) return
    await completeTask(proofTask.id, skipProof ? null : proofUrl)
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
    await editTask(id, editForm)
    setEditingId(null)
  }

  // Which list to show based on active tab
  const getActiveList = () => {
    switch (activeTab) {
      case 'today': return [...overdue, ...dueToday]
      case 'upcoming': return upcoming
      case 'completed': return completed.slice(0, 20)
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
          <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowDeploy(true)}>
            <Plus size={18} /> DEPLOY OPERATION
          </button>
        </header>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <HudPanel className="p-4 flex-col items-center justify-center text-center">
            <div className="font-display text-3xl text-primary">{pending.length}</div>
            <div className="font-mono text-[10px] text-muted uppercase tracking-widest">PENDING</div>
          </HudPanel>
          <HudPanel className="p-4 flex-col items-center justify-center text-center border-danger">
            <div className="font-display text-3xl text-danger">{overdue.length}</div>
            <div className="font-mono text-[10px] text-muted uppercase tracking-widest">OVERDUE</div>
          </HudPanel>
          <HudPanel className="p-4 flex-col items-center justify-center text-center border-amber">
            <div className="font-display text-3xl text-amber">{dueToday.length}</div>
            <div className="font-mono text-[10px] text-muted uppercase tracking-widest">DUE TODAY</div>
          </HudPanel>
          <HudPanel className="p-4 flex-col items-center justify-center text-center">
            <div className="font-display text-3xl text-success">{completionRate}%</div>
            <div className="font-mono text-[10px] text-muted uppercase tracking-widest">COMPLETION</div>
          </HudPanel>
        </div>

        {/* TABS */}
        <div className="tabs mb-6">
          {[
            { id: 'today', label: `TODAY (${overdue.length + dueToday.length})` },
            { id: 'upcoming', label: `UPCOMING (${upcoming.length})` },
            { id: 'all', label: `ALL PENDING (${pending.length})` },
            { id: 'completed', label: `COMPLETED (${completed.length})` }
          ].map(tab => (
            <button key={tab.id} className={`tab-item ${activeTab === tab.id ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* OPERATIONS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {activeList.map((task) => {
              const isCompleted = task.status === 'completed'
              const isEditing = editingId === task.id
              const isOverdue = !isCompleted && task.due_date && task.due_date < today
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
                        <div className="grid grid-cols-3 gap-3">
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
                          <button onClick={() => saveEdit(task.id)} className="btn btn-primary btn-sm">SAVE</button>
                          <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">CANCEL</button>
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
                  <div className={`relative bg-tertiary border p-5 transition-all duration-200 group ${isOverdue ? 'border-danger hover:border-danger' : isCompleted ? 'border-border-color opacity-60' : 'border-border-color hover:border-amber'}`}
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
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isCompleted && <button onClick={() => startEdit(task)} className="p-1.5 text-muted hover:text-amber transition-colors"><Edit2 size={13} /></button>}
                        {isCompleted && <button onClick={() => undoCompleteTask(task.id)} className="p-1.5 text-muted hover:text-info transition-colors" title="Undo"><RotateCcw size={13} /></button>}
                        <button onClick={() => deleteTask(task.id)} className="p-1.5 text-muted hover:text-danger transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className={`font-display text-xl uppercase tracking-wider mb-1 ${isCompleted ? 'line-through text-muted' : 'text-primary'}`}>
                      {task.title}
                    </h3>
                    {task.description && <p className="font-mono text-xs text-secondary mb-3 line-clamp-2">{task.description}</p>}

                    {/* Bottom row */}
                    <div className="flex-between mt-4 pt-3 border-t border-border-subtle">
                      <div className="flex items-center gap-3">
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
                      {!isCompleted && (
                        <button onClick={() => handleComplete(task)}
                          className="btn btn-primary btn-sm flex items-center gap-1.5 px-4">
                          <Zap size={12} /> EXECUTE
                        </button>
                      )}
                      {isCompleted && (
                        <span className="font-mono text-[10px] text-success flex items-center gap-1">
                          <CheckCircle2 size={12} /> COMPLETED
                        </span>
                      )}
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
            <button onClick={() => setShowDeploy(true)} className="btn btn-primary btn-sm">DEPLOY OPERATION</button>
          </div>
        )}

        {/* DEPLOY MODAL */}
        <AnimatePresence>
          {showDeploy && (
            <div className="modal-overlay">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
                <HudPanel className="modal-content border-amber" style={{ width: '520px', maxWidth: '95vw' }}>
                  <div className="flex-between mb-5 border-b border-border-color pb-3">
                    <span className="font-display text-xl uppercase text-amber tracking-widest">DEPLOY OPERATION</span>
                    <button onClick={() => setShowDeploy(false)} className="text-muted hover:text-danger"><X size={18} /></button>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">DUE DATE</label>
                        <input type="date" className="input font-mono" value={deployForm.due_date}
                          onChange={e => setDeployForm({ ...deployForm, due_date: e.target.value })} />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">DIFFICULTY</label>
                        <select className="select font-mono" value={deployForm.difficulty}
                          onChange={e => setDeployForm({ ...deployForm, difficulty: e.target.value })}>
                          <option value="EASY">EASY (+15 XP)</option>
                          <option value="MEDIUM">MEDIUM (+30 XP)</option>
                          <option value="HARD">HARD (+60 XP)</option>
                          <option value="EXTREME">EXTREME (+120 XP)</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                        <select className="select font-mono" value={deployForm.category}
                          onChange={e => setDeployForm({ ...deployForm, category: e.target.value })}>
                          <option value="personal">PERSONAL</option>
                          <option value="business">BUSINESS</option>
                          <option value="health">HEALTH</option>
                          <option value="learning">LEARNING</option>
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
            <div className="modal-overlay">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
                <HudPanel className="modal-content border-success" style={{ width: '440px', maxWidth: '95vw' }}>
                  <div className="flex-between mb-4 border-b border-border-color pb-3">
                    <span className="font-display text-xl uppercase text-success tracking-widest">OPERATION COMPLETE</span>
                    <button onClick={() => setProofTask(null)} className="text-muted hover:text-danger"><X size={18} /></button>
                  </div>
                  <p className="font-mono text-sm text-primary mb-4 truncate">{proofTask.title}</p>
                  <div className="flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">ATTACH PROOF (URL)</label>
                      <input type="url" className="input font-mono text-sm w-full" placeholder="https://screenshot.link or drive.google.com/..."
                        value={proofUrl} onChange={e => setProofUrl(e.target.value)} autoFocus />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => submitCompletion(false)} className="btn btn-primary flex-1" disabled={!proofUrl.trim()}>
                        UPLOAD & COMPLETE
                      </button>
                      <button onClick={() => submitCompletion(true)} className="btn btn-ghost">
                        SKIP PROOF
                      </button>
                    </div>
                  </div>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </AppShell>
  )
}
