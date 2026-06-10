'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useGoals } from '@/lib/hooks/useGoals'

export default function Goals() {
  const { mainQuest, sideQuests, longTermGoals, weeklyGoals, addGoal, completeGoal } = useGoals()
  const [activeTab, setActiveTab] = useState('main')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newGoal, setNewGoal] = useState({ title: '', description: '', type: 'side_quest', category: 'personal' })

  const tabs = [
    { id: 'main', label: 'Main Quest', data: mainQuest ? [mainQuest] : [] },
    { id: 'weekly', label: 'Weekly Goals', data: weeklyGoals },
    { id: 'side', label: 'Side Quests', data: sideQuests },
    { id: 'long', label: 'Long Term', data: longTermGoals },
  ]

  const activeData = tabs.find(t => t.id === activeTab)?.data || []

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newGoal.title) return
    await addGoal(newGoal)
    setShowAddForm(false)
    setNewGoal({ title: '', description: '', type: 'side_quest', category: 'personal' })
  }

  return (
    <AppShell>
      <div className="page-container">
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Goals</h1>
            <p className="page-subtitle">Track your long-term vision and weekly targets.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ New Goal</button>
        </header>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: activeTab === tab.id ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                border: activeTab === tab.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                fontSize: 'var(--text-sm-size)',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label} {tab.data.length > 0 && `(${tab.data.length})`}
            </button>
          ))}
        </div>

        {/* Grid */}
        {activeData.length > 0 ? (
          <div className="grid-auto">
            {activeData.map(goal => (
              <div key={goal.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{goal.category}</span>
                  {goal.status === 'completed' ? (
                    <span className="badge" style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}>Completed</span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(108, 92, 231, 0.1)', color: 'var(--accent-secondary)' }}>+{goal.xp_reward || 100} XP</span>
                  )}
                </div>
                
                <h3 style={{ fontSize: 'var(--text-lg-size)', marginBottom: 'var(--space-2)' }}>{goal.title}</h3>
                {goal.description && (
                  <p style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', flex: 1 }}>
                    {goal.description}
                  </p>
                )}
                
                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
                    <span>Progress</span>
                    <span>{goal.progress || 0}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', marginBottom: 'var(--space-4)' }}>
                    <div style={{ width: `${goal.progress || 0}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: '3px' }}></div>
                  </div>
                  
                  {goal.status !== 'completed' && (
                    <button 
                      className="btn btn-secondary btn-full"
                      onClick={() => completeGoal(goal.id)}
                    >
                      Complete Goal
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 'var(--space-12) 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🎯</div>
            <p>No goals found in this category.</p>
          </div>
        )}

        {/* Add Modal */}
        {showAddForm && (
          <div className="modal-overlay" onClick={() => setShowAddForm(false)} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal)', backdropFilter: 'blur(4px)' }}>
            <div className="card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px' }}>
              <h2 style={{ marginBottom: 'var(--space-4)' }}>New Goal</h2>
              <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Title</label>
                  <input type="text" className="input" value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} required autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Description</label>
                  <textarea className="textarea" value={newGoal.description} onChange={e => setNewGoal({...newGoal, description: e.target.value})} />
                </div>
                <div className="grid-2">
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Type</label>
                    <select className="select" value={newGoal.type} onChange={e => setNewGoal({...newGoal, type: e.target.value})}>
                      <option value="main_quest">Main Quest</option>
                      <option value="weekly">Weekly Goal</option>
                      <option value="side_quest">Side Quest</option>
                      <option value="long_term">Long Term</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Category</label>
                    <select className="select" value={newGoal.category} onChange={e => setNewGoal({...newGoal, category: e.target.value})}>
                      <option value="personal">Personal</option>
                      <option value="business">Business</option>
                      <option value="health">Health</option>
                      <option value="learning">Learning</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create Goal</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
