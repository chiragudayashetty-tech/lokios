'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useGoals } from '@/lib/hooks/useGoals'
import { Target, Flag, Star, Clock, Plus, Check, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Missions() {
  const { mainQuest, sideQuests, longTermGoals, weeklyGoals, loading, addGoal, completeGoal } = useGoals()
  const [activeTab, setActiveTab] = useState('main')
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({ title: '', description: '', type: 'side_quest', priority: 3 })

  const TABS = [
    { id: 'main', label: 'PRIMARY', icon: Trophy, items: mainQuest ? [mainQuest] : [] },
    { id: 'side', label: 'SIDE OPS', icon: Target, items: sideQuests },
    { id: 'long', label: 'LONG RANGE', icon: Star, items: longTermGoals },
    { id: 'weekly', label: 'WEEKLY', icon: Clock, items: weeklyGoals },
  ]

  const activeData = TABS.find(t => t.id === activeTab)?.items || []

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!formData.title) return
    await addGoal(formData)
    setShowForm(false)
    setFormData({ title: '', description: '', type: 'side_quest', priority: 3 })
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING MISSIONS...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header flex-between">
          <div>
            <h1 className="page-title">MISSIONS</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Strategic objectives and long-term targets.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> NEW MISSION</button>
        </header>

        <div className="tab-list">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button 
                key={tab.id}
                className={`tab-item flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
                <span className="badge ml-1" style={{ fontSize: '9px' }}>{tab.items.length}</span>
              </button>
            )
          })}
        </div>

        <div className="flex-col gap-6">
          <AnimatePresence mode="popLayout">
            {activeData.map((goal, i) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.1 }}
              >
                <HudPanel glow={activeTab === 'main'} scanLine={activeTab === 'main'}>
                  <div className="flex-between mb-2">
                    <span className="badge badge-amber">{goal.type.replace('_', ' ')}</span>
                    {!goal.is_completed && <span className="font-mono text-xs text-amber">PRIORITY: {goal.priority}</span>}
                  </div>
                  
                  <h3 className={`font-display text-2xl uppercase tracking-wide ${goal.is_completed ? 'text-muted line-through' : 'text-primary'}`}>
                    {goal.title}
                  </h3>
                  
                  {goal.description && (
                    <p className="text-sm text-secondary mt-2 font-mono">{goal.description}</p>
                  )}
                  
                  <div className="mt-6">
                    <TacticalProgress value={goal.progress} color="var(--accent-primary)" label="COMPLETION" />
                  </div>
                  
                  {!goal.is_completed && (
                    <div className="mt-4 flex justify-end">
                      <button onClick={() => completeGoal(goal.id)} className="btn btn-secondary btn-sm">
                        <Check size={14} /> COMPLETE
                      </button>
                    </div>
                  )}
                </HudPanel>
              </motion.div>
            ))}
          </AnimatePresence>

          {activeData.length === 0 && (
            <div className="empty-state">
              <Target size={48} className="text-muted mb-4 opacity-20" />
              <p>NO MISSIONS IN THIS CATEGORY</p>
            </div>
          )}
        </div>

        {/* Modal Form */}
        {showForm && (
          <div className="modal-overlay">
            <HudPanel className="modal-content">
              <div className="font-display text-xl uppercase text-amber mb-4 border-b border-border-color pb-2">Initialize Mission</div>
              <form onSubmit={handleAdd} className="flex-col gap-4">
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">MISSION TITLE</label>
                  <input type="text" className="input" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} required />
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
                  <label className="font-mono text-xs text-muted mb-1 block">BRIEFING (OPTIONAL)</label>
                  <textarea className="textarea" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary flex-1">DEPLOY</button>
                  <button type="button" className="btn btn-ghost" onClick={()=>setShowForm(false)}>ABORT</button>
                </div>
              </form>
            </HudPanel>
          </div>
        )}
      </div>
    </AppShell>
  )
}
