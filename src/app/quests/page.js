'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useHabits } from '@/lib/hooks/useHabits'
import { QUEST_CATEGORIES } from '@/lib/constants'

export default function DailyQuests() {
  const { habits, todayLogs, toggleHabit, addHabit } = useHabits()
  const [expandedCats, setExpandedCats] = useState(
    QUEST_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {})
  )
  const [showAddForm, setShowAddForm] = useState(false)
  const [newQuest, setNewQuest] = useState({ title: '', category: 'founder' })

  const toggleCategory = (id) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!newQuest.title) return
    await addHabit(newQuest)
    setNewQuest({ title: '', category: 'founder' })
    setShowAddForm(false)
  }

  return (
    <AppShell>
      <div className="page-container">
        <header className="page-header">
          <h1 className="page-title">Daily Quests</h1>
          <p className="page-subtitle">Build habits, maintain streaks, level up your stats.</p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {QUEST_CATEGORIES.map(category => {
            const categoryHabits = habits.filter(h => h.category === category.id)
            if (categoryHabits.length === 0) return null

            const completedCount = categoryHabits.filter(h => todayLogs.some(l => l.habit_id === h.id && l.completed)).length
            const totalCount = categoryHabits.length
            const isExpanded = expandedCats[category.id]

            return (
              <div key={category.id} className="card card-flat" style={{ padding: 0, overflow: 'hidden' }}>
                <div 
                  onClick={() => toggleCategory(category.id)}
                  style={{ 
                    padding: 'var(--space-4)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: category.color ? `${category.color}15` : 'var(--bg-secondary)',
                    borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: '24px' }}>{category.icon}</span>
                    <h3 style={{ fontSize: 'var(--text-lg-size)' }}>{category.name}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <span className="badge" style={{ background: completedCount === totalCount ? 'var(--success-subtle)' : 'var(--bg-tertiary)' }}>
                      {completedCount} / {totalCount}
                    </span>
                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: 'var(--space-3)' }}>
                    {categoryHabits.map(habit => {
                      const isCompleted = todayLogs.some(l => l.habit_id === habit.id && l.completed)
                      return (
                        <div key={habit.id} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: 'var(--space-3)',
                          borderBottom: '1px solid var(--border-color)',
                          gap: 'var(--space-4)'
                        }}>
                          <input 
                            type="checkbox" 
                            checked={isCompleted}
                            onChange={() => toggleHabit(habit.id, !isCompleted)}
                            style={{ width: '22px', height: '22px', accentColor: category.color || 'var(--accent-primary)', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 'var(--text-base)', color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                              {habit.title}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {habit.current_streak > 0 && (
                              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                                🔥 {habit.current_streak}
                              </span>
                            )}
                            <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>+{habit.xp_per_completion} XP</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ marginTop: 'var(--space-4)' }}>
            {!showAddForm ? (
              <button 
                className="btn btn-secondary btn-full" 
                onClick={() => setShowAddForm(true)}
                style={{ borderStyle: 'dashed' }}
              >
                + Add Custom Quest
              </button>
            ) : (
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>New Custom Quest</h3>
                <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Quest Title</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={newQuest.title} 
                      onChange={e => setNewQuest({...newQuest, title: e.target.value})}
                      placeholder="e.g., Meditate for 10 minutes"
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Category</label>
                    <select 
                      className="select" 
                      value={newQuest.category}
                      onChange={e => setNewQuest({...newQuest, category: e.target.value})}
                    >
                      {QUEST_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add Quest</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
