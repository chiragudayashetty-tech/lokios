'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useGoals } from '@/lib/hooks/useGoals'
import { getLocalDateStr } from '@/lib/utils/dates'
import { useOS } from '@/lib/context/OSContext'
import { Target, Flag, Star, Clock, Plus, Check, Trash2, Pause, Play, Edit2, ChevronDown, ChevronUp, X, RotateCcw, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Missions() {
  const { mainQuest, sideQuests, longTermGoals, weeklyGoals, completedGoals, failedGoals, loading, error, fetchGoals, addGoal, completeGoal, undoCompleteGoal, deleteGoal, togglePauseGoal, updateGoal, updateProgress } = useGoals()
  const { failMission, undoFailMission } = useOS()
  const [activeTab, setActiveTab] = useState('main')
  const [showForm, setShowForm] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState(null)
  
  const [proofModal, setProofModal] = useState({ show: false, goal: null, url: '' })
  
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
    { id: 'main', label: 'PRIMARY', icon: Flag, items: mainQuest ? [mainQuest] : [] },
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

  const handleAdd = async (e) => {
    e.preventDefault()
    if (formData.type === 'long_term' && !formData.deadline) {
      alert("LONG RANGE MISSIONS REQUIRE A STRICT DEADLINE.")
      return
    }
    const payload = {
      title: formData.title,
      description: formData.description,
      type: formData.type,
      difficulty: formData.difficulty,
      deadline: formData.deadline || null,
      category: formData.category
    }
    const result = await addGoal(payload)
    if (result && result.error) {
      alert(`DEPLOYMENT FAILED: ${result.error.message || result.error}\n\nPlease let the AI know what this error says!`)
      return
    }
    
    setShowForm(false)
    setFormData({ title: '', description: '', type: 'side_quest', difficulty: 'HARD', deadline: '', category: 'personal', customCategory: '' })
  }

  const startEdit = (goal) => {
    setEditingId(goal.id)
    setEditForm({
      title: goal.title,
      description: goal.description || '',
      difficulty: goal.difficulty || 'HARD',
      type: goal.type || 'side_quest',
      category: goal.category || 'personal',
      deadline: goal.deadline ? getLocalDateStr(new Date(goal.deadline)) : ''
    })
  }

  const saveEdit = async (id) => {
    await updateGoal(id, editForm)
    setEditingId(null)
  }

  const handleDeleteGoal = async (goal) => {
    if (!window.confirm('Are you sure you want to permanently delete this mission?')) return
    let revokeXp = true
    if (goal.status === 'completed' || goal.status === 'cancelled') {
      revokeXp = window.confirm('Do you want to revoke/refund the XP associated with this mission?\n\nOK = Revoke XP\nCancel = Keep XP')
    }
    await deleteGoal(goal.id, revokeXp)
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

        <div className="flex-col gap-6">
          <AnimatePresence mode="popLayout">
            {activeData.map((goal, i) => {
              const isPaused = goal.status === 'paused'
              const isEditing = editingId === goal.id
              const isExpanded = expandedGoal === goal.id

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
                    
                    {/* Header */}
                    <div className="flex-between mb-4 border-b border-border-color pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${isPaused ? 'bg-secondary text-muted' : 'badge-amber'}`}>
                          {isPaused ? 'PAUSED' : goal.type.replace('_', ' ')}
                        </span>
                        {goal.status !== 'completed' && (
                          <span className="font-mono text-[9px] px-2 py-0.5 border uppercase" 
                                style={{ color: DIFFICULTY_CONFIG[goal.difficulty || 'HARD'].color, borderColor: DIFFICULTY_CONFIG[goal.difficulty || 'HARD'].color }}>
                            {DIFFICULTY_CONFIG[goal.difficulty || 'HARD'].label}
                          </span>
                        )}
                      </div>
                      
                      {/* Controls */}
                      <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                        <button onClick={() => togglePauseGoal(goal.id, goal.status)} className="btn btn-ghost p-1.5" title={isPaused ? 'Resume' : 'Pause'}>
                          {isPaused ? <Play size={14} /> : <Pause size={14} />}
                        </button>
                        <button onClick={() => startEdit(goal)} className="btn btn-ghost p-1.5 hover:text-amber" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteGoal(goal)} className="btn btn-ghost p-1.5 hover:text-danger" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Content */}
                    {isEditing ? (
                      <div className="flex-col gap-3 mb-4">
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
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => saveEdit(goal.id)} className="btn btn-primary btn-sm">SAVE</button>
                          <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">CANCEL</button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => setExpandedGoal(isExpanded ? null : goal.id)} className="cursor-pointer group">
                        <div className="flex-between">
                          <h3 className={`font-display text-2xl uppercase tracking-wide ${goal.status === 'completed' ? 'text-muted line-through' : 'text-primary group-hover:text-amber transition-colors'}`}>
                            {goal.title}
                          </h3>
                          {isExpanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                        </div>
                        {goal.description && (
                          <p className="text-sm text-secondary mt-2 font-mono line-clamp-2">{goal.description}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Expanded Controls: Progress & Milestones */}
                    <AnimatePresence>
                      {isExpanded && !isEditing && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="mt-6 pt-4 border-t border-border-color flex-col gap-4">
                            
                            <div>
                              <div className="flex-between mb-2">
                                <label className="font-mono text-xs text-amber">MANUAL PROGRESS: {goal.progress}%</label>
                              </div>
                              <input 
                                type="range" 
                                min="0" max="100" 
                                value={goal.progress} 
                                onChange={(e) => updateProgress(goal.id, parseInt(e.target.value))}
                                className="w-full accent-amber-500"
                              />
                            </div>

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    <div className="mt-6">
                      <TacticalProgress value={goal.progress} color={isPaused ? 'var(--text-muted)' : 'var(--accent-primary)'} label="COMPLETION" />
                    </div>
                    
                    {goal.status !== 'completed' && goal.status !== 'cancelled' && (
                      <div className="mt-4 flex justify-end gap-2">
                        <button onClick={async () => {
                          if (window.confirm('Are you sure? This will permanently fail the mission and apply a massive negative XP penalty based on difficulty.')) {
                            await failMission(goal.id)
                          }
                        }} className="btn btn-ghost text-danger btn-sm" disabled={isPaused}>
                          <X size={14} /> MISSION FAILED
                        </button>
                        <button onClick={() => setProofModal({ show: true, goal, url: '' })} className="btn btn-secondary btn-sm" disabled={isPaused}>
                          <Check size={14} /> COMPLETE MISSION
                        </button>
                      </div>
                    )}
                    
                    {goal.status === 'completed' && (
                      <div className="mt-4 flex justify-between gap-2">
                        <div className="text-success font-mono text-xs uppercase tracking-widest flex items-center gap-1">
                          <Check size={14} /> COMPLETED
                        </div>
                        <button onClick={() => undoCompleteGoal(goal.id)} className="btn btn-ghost text-amber btn-sm">
                          <RotateCcw size={14} /> UNDO COMPLETION
                        </button>
                      </div>
                    )}
                    
                    {goal.status === 'cancelled' && (
                      <div className="mt-4 flex justify-between gap-2">
                        <div className="text-danger font-mono text-xs uppercase tracking-widest flex items-center gap-1">
                          <AlertTriangle size={14} /> MISSION FAILED
                        </div>
                        <button onClick={() => undoFailMission(goal.id)} className="btn btn-ghost text-info btn-sm">
                          <RotateCcw size={14} /> RESTORE MISSION
                        </button>
                      </div>
                    )}
                  </HudPanel>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {activeData.length === 0 && (
            <div className="empty-state py-12">
              <Target size={48} className="text-muted mb-4 opacity-20" />
              <p>NO MISSIONS IN THIS CATEGORY</p>
            </div>
          )}
        </div>

        {/* Modal Form */}
        <AnimatePresence>
          {showForm && (
            <div className="modal-overlay bottom-sheet-mobile">
              <motion.div drag={!isMobile} dragMomentum={false} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="w-full sm:w-auto">
                <HudPanel className="modal-content bottom-sheet-content cursor-move">
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
                      </select>
                    </div>
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

        {/* Proof of Work Modal */}
        <AnimatePresence>
          {proofModal.show && (
            <div className="modal-overlay bottom-sheet-mobile">
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="w-full sm:w-auto">
                <HudPanel glow label="MISSION ACCOMPLISHED" className="modal-content bottom-sheet-content w-full max-w-md">
                  <div className="p-4">
                    <p className="font-mono text-sm text-secondary mb-4">Would you like to attach Proof of Work? This will automatically log to your Portfolio Engine.</p>
                    <label className="font-mono text-xs text-muted mb-1 block">ATTACH LINK / IMAGE URL (OPTIONAL)</label>
                    <input type="url" className="input font-mono text-sm mb-6 w-full" value={proofModal.url} onChange={(e) => setProofModal({ ...proofModal, url: e.target.value })} placeholder="https://..." />
                    
                    <div className="flex justify-end gap-3">
                      <button className="btn btn-ghost" onClick={() => setProofModal({ show: false, goal: null, url: '' })}>CANCEL</button>
                      <button className="btn btn-primary" onClick={async () => {
                        await completeGoal(proofModal.goal.id, proofModal.url)
                        setProofModal({ show: false, goal: null, url: '' })
                      }}>CONFIRM COMPLETION</button>
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
