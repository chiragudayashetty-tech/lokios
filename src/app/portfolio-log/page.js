'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export default function PortfolioLog() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('work')
  const [workLogs, setWorkLogs] = useState([])
  const [projects, setProjects] = useState([])
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      setLoading(true)
      const [workRes, projRes, skillRes] = await Promise.all([
        supabase.from('work_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('skills').select('*').eq('user_id', user.id).order('level', { ascending: false })
      ])
      if (workRes.data) setWorkLogs(workRes.data)
      if (projRes.data) setProjects(projRes.data)
      if (skillRes.data) setSkills(skillRes.data)
      setLoading(false)
    }
    fetchData()
  }, [user, supabase])

  const [showForm, setShowForm] = useState(false)
  
  // Work Log Form State
  const [workForm, setWorkForm] = useState({ title: '', type: 'project_work', description: '', date: new Date().toISOString().split('T')[0], duration_hours: 1, is_public: true })

  const handleAddWorkLog = async (e) => {
    e.preventDefault()
    const { data } = await supabase.from('work_logs').insert({ user_id: user.id, ...workForm }).select().single()
    if (data) setWorkLogs([data, ...workLogs])
    setShowForm(false)
    setWorkForm({ title: '', type: 'project_work', description: '', date: new Date().toISOString().split('T')[0], duration_hours: 1, is_public: true })
  }

  return (
    <AppShell>
      <div className="page-container">
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Portfolio Log</h1>
            <p className="page-subtitle">Record your achievements for your public portfolio.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Entry</button>
        </header>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-2)' }}>
          {['work', 'projects', 'skills'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: 'none',
                color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div>
            {activeTab === 'work' && (
              <div className="grid-auto">
                {workLogs.length > 0 ? workLogs.map(log => (
                  <div key={log.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{log.type.replace('_', ' ')}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleDateString()}</span>
                    </div>
                    <h3 style={{ fontSize: 'var(--text-lg-size)', marginBottom: 'var(--space-2)' }}>{log.title}</h3>
                    <p style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>{log.description}</p>
                    {log.duration_hours > 0 && (
                      <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        ⏱ {log.duration_hours} hours
                      </div>
                    )}
                  </div>
                )) : <p style={{ color: 'var(--text-muted)' }}>No work logs yet.</p>}
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="grid-auto">
                {projects.length > 0 ? projects.map(proj => (
                  <div key={proj.id} className="card">
                    <h3 style={{ fontSize: 'var(--text-lg-size)' }}>{proj.title}</h3>
                    <p style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{proj.tagline}</p>
                    <span className="badge" style={{ background: proj.status === 'active' ? 'var(--success-subtle)' : 'var(--bg-tertiary)', color: proj.status === 'active' ? 'var(--success)' : 'var(--text-muted)' }}>{proj.status}</span>
                  </div>
                )) : <p style={{ color: 'var(--text-muted)' }}>No projects yet.</p>}
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="grid-auto">
                {skills.length > 0 ? skills.map(skill => (
                  <div key={skill.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{ fontSize: '32px' }}>{skill.icon || '🎓'}</div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 'var(--text-base)' }}>{skill.name}</h3>
                      <div className="progress-bar" style={{ height: '4px', background: 'var(--bg-tertiary)', marginTop: 'var(--space-2)' }}>
                        <div style={{ width: `${(skill.level / 10) * 100}%`, height: '100%', background: 'var(--accent-gradient)' }}></div>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>Lv.{skill.level}</div>
                    </div>
                  </div>
                )) : <p style={{ color: 'var(--text-muted)' }}>No skills added yet.</p>}
              </div>
            )}
          </div>
        )}

        {/* Add Work Log Modal */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal)', backdropFilter: 'blur(4px)' }}>
            <div className="card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px' }}>
              <h2 style={{ marginBottom: 'var(--space-4)' }}>Add Work Log</h2>
              <form onSubmit={handleAddWorkLog} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label className="text-muted text-sm" style={{display: 'block', marginBottom: '8px'}}>Title</label>
                  <input type="text" className="input" value={workForm.title} onChange={e => setWorkForm({...workForm, title: e.target.value})} required autoFocus />
                </div>
                <div className="grid-2">
                  <div>
                    <label className="text-muted text-sm" style={{display: 'block', marginBottom: '8px'}}>Type</label>
                    <select className="select" value={workForm.type} onChange={e => setWorkForm({...workForm, type: e.target.value})}>
                      <option value="project_work">Project Work</option>
                      <option value="video">Video</option>
                      <option value="workshop">Workshop</option>
                      <option value="design">Design</option>
                      <option value="code">Code</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-muted text-sm" style={{display: 'block', marginBottom: '8px'}}>Date</label>
                    <input type="date" className="input" value={workForm.date} onChange={e => setWorkForm({...workForm, date: e.target.value})} required />
                  </div>
                </div>
                <div>
                  <label className="text-muted text-sm" style={{display: 'block', marginBottom: '8px'}}>Description</label>
                  <textarea className="textarea" value={workForm.description} onChange={e => setWorkForm({...workForm, description: e.target.value})} style={{ minHeight: '80px' }} />
                </div>
                <div>
                  <label className="text-muted text-sm" style={{display: 'block', marginBottom: '8px'}}>Duration (Hours)</label>
                  <input type="number" step="0.5" className="input" value={workForm.duration_hours} onChange={e => setWorkForm({...workForm, duration_hours: parseFloat(e.target.value)})} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Log</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
