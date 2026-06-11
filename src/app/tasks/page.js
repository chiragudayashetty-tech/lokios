'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useTasks } from '@/lib/hooks/useTasks'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, Calendar, AlertCircle } from 'lucide-react'

export default function Operations() {
  const { tasks, todayTasks, loading, addTask, completeTask, deleteTask } = useTasks()
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    await addTask({ title: newTaskTitle, due_date: new Date().toISOString().split('T')[0] })
    setNewTaskTitle('')
  }

  const today = new Date().toISOString().split('T')[0]
  const pending = tasks.filter(t => t.status !== 'completed')
  const overdue = pending.filter(t => t.due_date && t.due_date < today)
  const dueToday = pending.filter(t => t.due_date === today)
  const upcoming = pending.filter(t => !t.due_date || t.due_date > today)
  const completed = tasks.filter(t => t.status === 'completed')

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING OPERATIONS...</span></div></AppShell>

  const TaskList = ({ title, items, colorClass, borderClass }) => {
    if (items.length === 0) return null
    return (
      <div className="mb-8">
        <h2 className={`font-display text-lg uppercase tracking-wider mb-3 ${colorClass}`}>{title} [{items.length}]</h2>
        <div className="flex-col gap-2">
          <AnimatePresence>
            {items.map(task => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                className={`task-item ${task.status === 'completed' ? 'completed' : ''}`}
                style={{ borderLeftColor: borderClass }}
              >
                <button 
                  onClick={() => completeTask(task.id)}
                  className="flex-center shrink-0 w-5 h-5 border rounded-sm mt-1"
                  style={{ borderColor: task.status === 'completed' ? 'var(--text-muted)' : borderClass }}
                >
                  {task.status === 'completed' && <Check size={12} />}
                </button>
                <div className="flex-1 flex-col gap-1">
                  <span className="task-title font-mono">{task.title}</span>
                  {task.due_date && (
                    <span className="font-mono text-xs flex items-center gap-1 text-muted">
                      <Calendar size={10} /> {task.due_date}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <span className="font-mono text-xs text-amber">+10 XP</span>
                  <button onClick={() => deleteTask(task.id)} className="text-muted hover:text-danger px-2">×</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">OPERATIONS</h1>
          <p className="page-subtitle font-mono uppercase text-xs">Tactical task execution.</p>
        </header>

        <form onSubmit={handleAdd} className="mb-8 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber font-mono">{`>`}</span>
          <input 
            type="text" 
            className="input font-mono bg-secondary border-hud-border" 
            style={{ paddingLeft: '2.5rem', height: '3.5rem', fontSize: '1rem' }}
            placeholder="INPUT NEW OPERATION..." 
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-primary btn-sm">
            DEPLOY
          </button>
        </form>

        <TaskList title="OVERDUE THREATS" items={overdue} colorClass="text-danger" borderClass="var(--danger)" />
        <TaskList title="ACTIVE OPERATIONS (TODAY)" items={dueToday} colorClass="text-amber" borderClass="var(--accent-primary)" />
        <TaskList title="UPCOMING" items={upcoming} colorClass="text-secondary" borderClass="var(--border-color)" />
        
        {completed.length > 0 && (
          <div className="mt-12 opacity-60">
            <TaskList title="DEBRIEFED (COMPLETED)" items={completed.slice(0, 10)} colorClass="text-muted" borderClass="transparent" />
          </div>
        )}

      </div>
    </AppShell>
  )
}
