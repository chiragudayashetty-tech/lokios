'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useHabits } from '@/lib/hooks/useHabits'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, Dumbbell, BookOpen, Sparkles, Target, ChevronDown, ChevronUp, Plus, Check, Flame, Shield, Trash2, Edit2 } from 'lucide-react'

const ICON_MAP = { Rocket, Dumbbell, BookOpen, Sparkles, Target, Shield, Flame }

export default function DailyOps() {
  const { habits, todayLogs, loading, toggleHabit, addHabit } = useHabits()
  const [expanded, setExpanded] = useState(QUEST_CATEGORIES.map(c => c.id))
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState(QUEST_CATEGORIES[0].id)

  const toggleCategory = (id) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await addHabit({ title: newTitle, category: newCategory, frequency: 'daily' })
    setNewTitle('')
    setShowAddForm(false)
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING OPS...</span></div></AppShell>

  // Stats calculation
  const totalRoutines = habits.length
  const completedCount = habits.filter(h => todayLogs.some(log => log.habit_id === h.id)).length
  const completionPercentage = totalRoutines === 0 ? 0 : Math.round((completedCount / totalRoutines) * 100)

  // Separate active vs completed
  const activeHabits = habits.filter(h => !todayLogs.some(log => log.habit_id === h.id))
  const completedHabits = habits.filter(h => todayLogs.some(log => log.habit_id === h.id))

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header flex-between">
          <div>
            <h1 className="page-title">DAILY OPS</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Complete daily operations to build stats and maintain streaks.</p>
          </div>
          <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> ADD ROUTINE
          </button>
        </header>

        {/* Completion Ring & Stats */}
        <HudPanel glow scanLine className="mb-8 flex items-center gap-6 p-6">
          <div className="relative w-24 h-24 shrink-0 flex-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border-strong)" strokeWidth="6" />
              <circle 
                cx="50" cy="50" r="45" fill="none" 
                stroke="var(--accent-primary)" strokeWidth="6" 
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - completionPercentage / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex-center flex-col">
              <span className="font-display text-2xl text-amber">{completionPercentage}%</span>
            </div>
          </div>
          <div className="flex-col">
            <h2 className="font-display text-2xl uppercase tracking-wider text-primary">DAILY TARGETS</h2>
            <div className="flex gap-4 mt-2">
              <div className="font-mono text-sm text-amber">{completedCount} / {totalRoutines} COMPLETED</div>
              <div className="w-px h-4 bg-border-color" />
              <div className="font-mono text-sm text-success">{activeHabits.length} ACTIVE</div>
            </div>
          </div>
        </HudPanel>

        <div className="flex-col gap-8">
          
          {/* ACTIVE ROUTINES */}
          <div>
            <h3 className="font-display text-lg uppercase text-amber tracking-widest mb-4">ACTIVE OPERATIONS</h3>
            <div className="flex-col gap-3">
              <AnimatePresence>
                {activeHabits.map(habit => {
                  const cat = QUEST_CATEGORIES.find(c => c.id === habit.category) || QUEST_CATEGORIES[0]
                  const Icon = ICON_MAP[habit.icon] || ICON_MAP[cat.icon] || Target
                  return (
                    <motion.div key={habit.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.95}}>
                      <HudPanel className="p-4 flex items-center gap-4 group hover:border-amber transition-colors">
                        <button 
                          onClick={() => toggleHabit(habit.id)}
                          className="flex-center shrink-0 w-6 h-6 border border-border-strong rounded-sm hover:border-amber transition-colors"
                        />
                        <Icon size={18} color={cat.color} className="shrink-0" />
                        <div className="flex-1 flex-col">
                          <span className="font-mono text-sm text-primary">{habit.title}</span>
                          <span className="font-mono text-[10px] text-muted uppercase tracking-widest">{cat.name}</span>
                        </div>
                        <div className="flex gap-3 items-center">
                          <span className="badge badge-amber gap-1"><Flame size={12} /> {habit.current_streak || 0}</span>
                          <span className="font-mono text-xs text-muted">+5 XP</span>
                        </div>
                      </HudPanel>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              {activeHabits.length === 0 && (
                <div className="empty-state text-success border border-success-subtle bg-success-subtle">ALL DAILY OPERATIONS COMPLETED</div>
              )}
            </div>
          </div>

          {/* COMPLETED ROUTINES */}
          {completedHabits.length > 0 && (
            <div className="opacity-60">
              <h3 className="font-display text-lg uppercase text-muted tracking-widest mb-4">COMPLETED (DEBRIEFED)</h3>
              <div className="flex-col gap-2">
                <AnimatePresence>
                  {completedHabits.map(habit => {
                    const cat = QUEST_CATEGORIES.find(c => c.id === habit.category) || QUEST_CATEGORIES[0]
                    const Icon = ICON_MAP[habit.icon] || ICON_MAP[cat.icon] || Target
                    return (
                      <motion.div key={habit.id} layout initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}>
                        <div className="p-3 bg-tertiary border border-border-color flex items-center gap-4">
                          <button 
                            onClick={() => toggleHabit(habit.id)}
                            className="flex-center shrink-0 w-6 h-6 border rounded-sm bg-amber-subtle border-amber"
                          >
                            <Check size={14} className="text-amber" />
                          </button>
                          <Icon size={16} color={cat.color} className="shrink-0 opacity-50" />
                          <span className="font-mono text-sm text-muted line-through flex-1">{habit.title}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

        </div>

        {/* Add Form Modal */}
        <AnimatePresence>
          {showAddForm && (
            <div className="modal-overlay">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
                <HudPanel className="modal-content">
                  <div className="font-display text-xl uppercase text-amber mb-4 border-b border-border-color pb-2">Add Daily Operation</div>
                  <form onSubmit={handleAdd} className="flex-col gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">OPERATION TITLE</label>
                      <input type="text" className="input" value={newTitle} onChange={e=>setNewTitle(e.target.value)} required autoFocus />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted mb-1 block">CATEGORY</label>
                      <select className="select font-mono" value={newCategory} onChange={e=>setNewCategory(e.target.value)}>
                        {QUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button type="submit" className="btn btn-primary flex-1">DEPLOY</button>
                      <button type="button" className="btn btn-ghost" onClick={()=>setShowAddForm(false)}>ABORT</button>
                    </div>
                  </form>
                </HudPanel>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </AppShell>
  )
}
