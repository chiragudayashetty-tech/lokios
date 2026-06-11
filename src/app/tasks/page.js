'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useTasks } from '@/lib/hooks/useTasks'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, Calendar, AlertCircle, Trash2, Edit2, RotateCcw, Repeat, MoreVertical, X } from 'lucide-react'

export default function Operations() {
  const { tasks, todayTasks, loading, addTask, editTask, completeTask, undoCompleteTask, deleteTask } = useTasks()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    await addTask({ title: newTaskTitle, due_date: new Date().toISOString().split('T')[0], type: 'custom' })
    setNewTaskTitle('')
  }

  const startEdit = (task) => {
    setEditingId(task.id)
    setEditForm({
      title: task.title,
      due_date: task.due_date || '',
      type: task.type || 'custom',
      recurrence_type: task.recurrence_type || ''
    })
  }

  const saveEdit = async (id) => {
    await editTask(id, editForm)
    setEditingId(null)
  }

  const today = new Date().toISOString().split('T')[0]
  const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const overdue = pending.filter(t => t.due_date && t.due_date < today)
  const dueToday = pending.filter(t => t.due_date === today)
  const upcoming = pending.filter(t => !t.due_date || t.due_date > today)
  const completed = tasks.filter(t => t.status === 'completed')

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">LOADING OPERATIONS...</span></div></AppShell>

  const TaskItem = ({ task, borderClass }) => {
    const isCompleted = task.status === 'completed'
    const isEditing = editingId === task.id

    if (isEditing) {
      return (
        <div className="p-4 bg-tertiary border border-amber flex-col gap-3 mb-2">
          <input 
            type="text" 
            className="input font-mono text-sm py-1" 
            value={editForm.title} 
            onChange={e => setEditForm({...editForm, title: e.target.value})} 
          />
          <div className="grid-2">
            <div>
              <label className="font-mono text-xs text-muted mb-1 block">DUE DATE</label>
              <input type="date" className="input font-mono py-1" value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})} />
            </div>
            <div>
              <label className="font-mono text-xs text-muted mb-1 block">RECURRENCE</label>
              <select className="select font-mono py-1" value={editForm.recurrence_type || ''} onChange={e => {
                const val = e.target.value;
                setEditForm({...editForm, recurrence_type: val, type: val ? 'recurring' : 'custom'})
              }}>
                <option value="">ONE TIME</option>
                <option value="daily">DAILY</option>
                <option value="weekly">WEEKLY</option>
                <option value="monthly">MONTHLY</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => saveEdit(task.id)} className="btn btn-primary btn-sm">SAVE</button>
            <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">CANCEL</button>
          </div>
        </div>
      )
    }

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
        className={`task-item ${isCompleted ? 'completed' : ''} group`}
        style={{ borderLeftColor: borderClass }}
      >
        <button 
          onClick={() => isCompleted ? undoCompleteTask(task.id) : completeTask(task.id)}
          className="flex-center shrink-0 w-5 h-5 border rounded-sm mt-1 hover:border-amber transition-colors"
          style={{ borderColor: isCompleted ? 'var(--text-muted)' : borderClass }}
        >
          {isCompleted && <Check size={12} />}
        </button>
        <div className="flex-1 flex-col gap-1">
          <span className={`task-title font-mono ${isCompleted ? 'line-through text-muted' : ''}`}>{task.title}</span>
          <div className="flex items-center gap-3">
            {task.due_date && (
              <span className="font-mono text-xs flex items-center gap-1 text-muted">
                <Calendar size={10} /> {task.due_date}
              </span>
            )}
            {task.type === 'recurring' && task.recurrence_type && (
              <span className="font-mono text-[10px] flex items-center gap-1 text-amber">
                <Repeat size={10} /> {task.recurrence_type.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {!isCompleted && <button onClick={() => startEdit(task)} className="btn btn-ghost p-1.5 hover:text-amber" title="Edit"><Edit2 size={14} /></button>}
          {isCompleted && <button onClick={() => undoCompleteTask(task.id)} className="btn btn-ghost p-1.5 hover:text-primary" title="Undo"><RotateCcw size={14} /></button>}
          <button onClick={() => deleteTask(task.id)} className="btn btn-ghost p-1.5 hover:text-danger" title="Delete"><Trash2 size={14} /></button>
        </div>
      </motion.div>
    )
  }

  const TaskList = ({ title, items, colorClass, borderClass }) => {
    if (items.length === 0) return null
    return (
      <div className="mb-8">
        <h2 className={`font-display text-lg uppercase tracking-wider mb-3 ${colorClass}`}>{title} [{items.length}]</h2>
        <div className="flex-col gap-2">
          <AnimatePresence>
            {items.map(task => <TaskItem key={task.id} task={task} borderClass={borderClass} />)}
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
            className="input font-mono bg-secondary border-hud-border hover:border-amber focus:border-amber transition-colors" 
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
            <TaskList title="DEBRIEFED (COMPLETED)" items={completed.slice(0, 10)} colorClass="text-muted" borderClass="var(--border-color)" />
          </div>
        )}

      </div>
    </AppShell>
  )
}
