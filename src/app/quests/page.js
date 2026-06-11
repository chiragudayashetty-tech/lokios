'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import { useHabits } from '@/lib/hooks/useHabits'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, Dumbbell, BookOpen, Sparkles, Target, ChevronDown, ChevronUp, Plus, Check, Flame } from 'lucide-react'

const ICON_MAP = { Rocket, Dumbbell, BookOpen, Sparkles, Target }

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

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">DAILY OPS</h1>
          <p className="page-subtitle font-mono uppercase text-xs">Complete daily operations to build stats and maintain streaks.</p>
        </header>

        <div className="flex-col gap-6">
          {QUEST_CATEGORIES.map((category) => {
            const catHabits = habits.filter(h => h.category === category.id)
            if (catHabits.length === 0) return null

            const isExpanded = expanded.includes(category.id)
            const completedCount = catHabits.filter(h => todayLogs.some(log => log.habit_id === h.id)).length
            const Icon = ICON_MAP[category.icon] || Target

            return (
              <HudPanel key={category.id} className="p-0" style={{ padding: 0 }}>
                <button 
                  className="w-full flex-between p-4 bg-secondary transition-all hover:bg-hover border-b border-border-color"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} color={category.color} />
                    <span className="font-display uppercase tracking-wide text-primary text-lg">{category.name}</span>
                    <span className="badge font-mono" style={{ backgroundColor: `${category.color}22`, color: category.color }}>
                      {completedCount}/{catHabits.length}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 flex-col gap-2">
                        {catHabits.map(habit => {
                          const isCompleted = todayLogs.some(log => log.habit_id === habit.id)
                          return (
                            <div key={habit.id} className={`task-item ${isCompleted ? 'completed' : ''} m-0`}>
                              <button 
                                onClick={() => toggleHabit(habit.id)}
                                className="flex-center shrink-0 w-6 h-6 border rounded-sm"
                                style={{ borderColor: isCompleted ? category.color : 'var(--border-color)', backgroundColor: isCompleted ? `${category.color}22` : 'transparent' }}
                              >
                                {isCompleted && <Check size={14} color={category.color} />}
                              </button>
                              <div className="flex-1 flex-between">
                                <span className="task-title font-sans text-sm">{habit.title}</span>
                                <div className="flex gap-2">
                                  <span className="badge badge-amber gap-1"><Flame size={10} /> {habit.current_streak || 0}</span>
                                  <span className="font-mono text-xs text-muted">+5 XP</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="px-4 pb-4 pt-2">
                  <TacticalProgress value={completedCount} max={catHabits.length} color={category.color} height={2} showValue={false} />
                </div>
              </HudPanel>
            )
          })}
        </div>

        <div className="mt-8">
          {!showAddForm ? (
            <button className="btn btn-secondary btn-full" onClick={() => setShowAddForm(true)}>
              <Plus size={16} /> ADD NEW OPERATION
            </button>
          ) : (
            <HudPanel glow>
              <form onSubmit={handleAdd} className="flex-col gap-4">
                <div className="font-display uppercase text-sm text-amber">Configure New Operation</div>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Operation name..." 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  autoFocus
                />
                <select className="select font-mono" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                  {QUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1">DEPLOY</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>CANCEL</button>
                </div>
              </form>
            </HudPanel>
          )}
        </div>

      </div>
    </AppShell>
  )
}
