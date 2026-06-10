'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useTasks } from '@/lib/hooks/useTasks'

export default function Tasks() {
  const { tasks, todayTasks, addTask, completeTask } = useTasks()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  const handleQuickAdd = async (e) => {
    if (e.key === 'Enter' && newTaskTitle.trim()) {
      await addTask({ title: newTaskTitle.trim(), due_date: new Date().toISOString().split('T')[0] })
      setNewTaskTitle('')
    }
  }

  const upcomingTasks = tasks.filter(t => t.status !== 'completed' && (!t.due_date || new Date(t.due_date) > new Date()))
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date).toDateString() !== new Date().toDateString() && new Date(t.due_date) < new Date())

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Action items and to-dos.</p>
        </header>

        {/* Quick Add */}
        <div style={{ marginBottom: 'var(--space-6)', position: 'relative' }}>
          <input 
            type="text" 
            className="input" 
            placeholder="+ Add a new task for today... (Press Enter)"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleQuickAdd}
            style={{ padding: 'var(--space-4)', fontSize: 'var(--text-lg-size)', borderRadius: 'var(--radius-lg)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <section>
              <h3 style={{ fontSize: 'var(--text-sm-size)', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 'var(--space-3)' }}>Overdue</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {overdueTasks.map(task => (
                  <TaskItem key={task.id} task={task} onComplete={() => completeTask(task.id)} />
                ))}
              </div>
            </section>
          )}

          {/* Today */}
          <section>
            <h3 style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 'var(--space-3)' }}>Today</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {todayTasks.filter(t => t.status !== 'completed').map(task => (
                <TaskItem key={task.id} task={task} onComplete={() => completeTask(task.id)} />
              ))}
              {todayTasks.filter(t => t.status !== 'completed').length === 0 && (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  All caught up for today!
                </div>
              )}
            </div>
          </section>

          {/* Upcoming */}
          {upcomingTasks.length > 0 && (
            <section>
              <h3 style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 'var(--space-3)' }}>Upcoming</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {upcomingTasks.map(task => (
                  <TaskItem key={task.id} task={task} onComplete={() => completeTask(task.id)} />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completedTasks.length > 0 && (
            <section>
              <button 
                onClick={() => setShowCompleted(!showCompleted)}
                style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
              >
                <span>{showCompleted ? '▼' : '▶'}</span> Completed ({completedTasks.length})
              </button>
              
              {showCompleted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'var(--space-3)', opacity: 0.7 }}>
                  {completedTasks.map(task => (
                    <TaskItem key={task.id} task={task} readOnly />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function TaskItem({ task, onComplete, readOnly = false }) {
  const priorityColors = { 1: 'var(--text-muted)', 2: 'var(--info)', 3: 'var(--success)', 4: 'var(--warning)', 5: 'var(--danger)' }
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: 'var(--space-3) var(--space-4)', 
      background: 'var(--bg-secondary)', 
      borderRadius: 'var(--radius-md)',
      gap: 'var(--space-3)'
    }}>
      <input 
        type="checkbox" 
        checked={task.status === 'completed'}
        onChange={readOnly ? undefined : onComplete}
        disabled={readOnly}
        style={{ width: '20px', height: '20px', accentColor: 'var(--success)', cursor: readOnly ? 'default' : 'pointer' }}
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ 
          color: task.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
          textDecoration: task.status === 'completed' ? 'line-through' : 'none'
        }}>
          {task.title}
        </span>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColors[task.priority || 2] }} title={`Priority ${task.priority || 2}`} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {task.due_date && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-secondary)' }}>
          +{task.xp_reward || 15} XP
        </span>
      </div>
    </div>
  )
}
