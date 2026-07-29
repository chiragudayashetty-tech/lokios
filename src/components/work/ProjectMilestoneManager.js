'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import useWork from '@/lib/hooks/useWork'
import { Plus, X, ChevronDown, ChevronUp, Edit2, Trash2, Clock, Calendar, AlertCircle, RefreshCw, GripVertical, CheckCircle2, Circle } from 'lucide-react'

export default function ProjectMilestoneManager() {
  const {
    projects, categories, tags, 
    createProject, updateProject, deleteProject,
    getMilestones, createMilestone, updateMilestone, deleteMilestone
  } = useWork()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [expandedProjectId, setExpandedProjectId] = useState(null)
  
  // Project Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    lifecycle_type: 'one_time',
    start_date: '',
    deadline: '',
    priority: 'medium',
    category_ids: [],
    tag_ids: []
  })

  const lifecycleColors = {
    one_time: '#3B82F6',
    recurring: '#8B5CF6',
    continuous: '#10B981'
  }

  const statusColors = {
    planning: '#6B7280',
    active: '#10B981',
    paused: '#F59E0B',
    completed: '#3B82F6',
    cancelled: '#EF4444'
  }

  const priorityColors = {
    low: '#9CA3AF',
    medium: '#3B82F6',
    high: '#F59E0B',
    critical: '#EF4444'
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    await createProject({
      ...formData,
      status: 'planning',
      progress_percentage: 0
    })
    setIsFormOpen(false)
    setFormData({ name: '', description: '', lifecycle_type: 'one_time', start_date: '', deadline: '', priority: 'medium', category_ids: [], tag_ids: [] })
  }

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id)
    }
  }

  return (
    <div style={{ padding: '20px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Projects & Milestones</h2>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--bg-active)', border: '1px solid var(--border-color)',
            color: 'var(--accent-primary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', fontFamily: 'var(--font-display)', textTransform: 'uppercase'
          }}
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreateProject}
            style={{
              background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
              padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <input
                type="text"
                placeholder="Project Name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)'
                }}
              />
              <select
                value={formData.lifecycle_type}
                onChange={e => setFormData({ ...formData, lifecycle_type: e.target.value })}
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)'
                }}
              >
                <option value="one_time">One-Time</option>
                <option value="recurring">Recurring</option>
                <option value="continuous">Continuous</option>
              </select>
            </div>
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)', minHeight: '80px'
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <input
                type="date"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)'
                }}
              />
              <input
                type="date"
                value={formData.deadline}
                onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                disabled={formData.lifecycle_type !== 'one_time'}
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  color: formData.lifecycle_type !== 'one_time' ? 'var(--text-muted)' : 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)',
                  opacity: formData.lifecycle_type !== 'one_time' ? 0.5 : 1
                }}
              />
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)'
                }}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical Priority</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button" onClick={() => setIsFormOpen(false)}
                style={{
                  background: 'transparent', border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  background: 'var(--bg-active)', border: '1px solid var(--accent-secondary)',
                  color: 'var(--accent-primary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(168,85,247,0.2)'
                }}
              >
                Save Project
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <LayoutGroup>
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} layout>
          {projects?.map(project => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              isExpanded={expandedProjectId === project.id}
              onToggleExpand={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
              onDelete={(e) => handleDeleteProject(project.id, e)}
              colors={{lifecycleColors, statusColors, priorityColors}}
              getMilestones={getMilestones}
              createMilestone={createMilestone}
              updateMilestone={updateMilestone}
              deleteMilestone={deleteMilestone}
            />
          ))}
          {(!projects || projects.length === 0) && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No active projects found.
            </div>
          )}
        </motion.div>
      </LayoutGroup>
    </div>
  )
}

function ProjectCard({ project, isExpanded, onToggleExpand, onDelete, colors, getMilestones, createMilestone, updateMilestone, deleteMilestone }) {
  const { lifecycleColors, statusColors, priorityColors } = colors
  
  const [milestones, setMilestones] = useState([])
  const [loadingMilestones, setLoadingMilestones] = useState(false)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  
  const [newMilestone, setNewMilestone] = useState({
    title: '', description: '', target_date: '', progress_percentage: 0
  })

  useEffect(() => {
    if (isExpanded) {
      loadMilestones()
    }
  }, [isExpanded])

  const loadMilestones = async () => {
    setLoadingMilestones(true)
    try {
      const ms = await getMilestones(project.id)
      setMilestones(ms || [])
    } finally {
      setLoadingMilestones(false)
    }
  }

  const handleAddMilestone = async (e) => {
    e.preventDefault()
    await createMilestone({
      ...newMilestone,
      project_id: project.id,
      status: 'pending',
      display_order: milestones.length
    })
    setShowMilestoneForm(false)
    setNewMilestone({ title: '', description: '', target_date: '', progress_percentage: 0 })
    loadMilestones()
  }

  const cycleMilestoneStatus = async (ms) => {
    const statuses = ['pending', 'in_progress', 'completed']
    const nextStatus = statuses[(statuses.indexOf(ms.status) + 1) % statuses.length]
    await updateMilestone(ms.id, { status: nextStatus, progress_percentage: nextStatus === 'completed' ? 100 : ms.progress_percentage })
    loadMilestones()
  }

  const handleDeleteMilestone = async (id) => {
    if (confirm('Delete this milestone?')) {
      await deleteMilestone(id)
      loadMilestones()
    }
  }

  return (
    <motion.div
      layout
      style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        boxShadow: 'var(--shadow-md)', transition: 'var(--transition-base)'
      }}
    >
      <div 
        onClick={onToggleExpand}
        style={{ 
          padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer',
          background: 'var(--bg-secondary)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{ 
                width: '10px', height: '10px', borderRadius: '50%', 
                background: priorityColors[project.priority] || priorityColors.medium,
                boxShadow: project.priority === 'critical' ? `0 0 8px ${priorityColors.critical}` : 'none',
                animation: project.priority === 'critical' ? 'pulse 2s infinite' : 'none'
              }} 
            />
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              {project.name}
            </h3>
            <span style={{ 
              fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px',
              border: `1px solid ${lifecycleColors[project.lifecycle_type]}40`,
              color: lifecycleColors[project.lifecycle_type], background: `${lifecycleColors[project.lifecycle_type]}10`,
              textTransform: 'uppercase', fontFamily: 'var(--font-mono)'
            }}>
              {project.lifecycle_type.replace('_', ' ')}
            </span>
            <span style={{ 
              fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px',
              border: `1px solid ${statusColors[project.status]}40`,
              color: statusColors[project.status], background: `${statusColors[project.status]}10`,
              textTransform: 'uppercase', fontFamily: 'var(--font-mono)'
            }}>
              {project.status}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onDelete} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <Trash2 size={16} />
            </button>
            {isExpanded ? <ChevronUp size={20} color="var(--text-secondary)"/> : <ChevronDown size={20} color="var(--text-secondary)"/>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${project.progress_percentage || 0}%` }}
              style={{ height: '100%', background: 'var(--accent-secondary)' }}
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: '40px' }}>
            {project.progress_percentage || 0}%
          </span>
        </div>

        {project.deadline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Clock size={14} /> Deadline: {new Date(project.deadline).toLocaleDateString()}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
          >
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Milestones</h4>
                <button 
                  onClick={() => setShowMilestoneForm(!showMilestoneForm)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  + Add Milestone
                </button>
              </div>

              {showMilestoneForm && (
                <form onSubmit={handleAddMilestone} style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" placeholder="Milestone Title" required value={newMilestone.title} onChange={e => setNewMilestone({...newMilestone, title: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }} />
                    <input type="date" value={newMilestone.target_date} onChange={e => setNewMilestone({...newMilestone, target_date: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={{ background: 'var(--bg-active)', border: '1px solid var(--accent-secondary)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem' }}>Save</button>
                  </div>
                </form>
              )}

              {loadingMilestones ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Loading...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {milestones.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>No milestones yet.</div>
                  ) : (
                    milestones.map(ms => (
                      <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <div onClick={() => cycleMilestoneStatus(ms)} style={{ cursor: 'pointer', color: ms.status === 'completed' ? 'var(--success)' : ms.status === 'in_progress' ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {ms.status === 'completed' ? <CheckCircle2 size={20} /> : ms.status === 'in_progress' ? <RefreshCw size={20} /> : <Circle size={20} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{ms.title}</span>
                            {ms.target_date && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>{new Date(ms.target_date).toLocaleDateString()}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="range" min="0" max="100" value={ms.progress_percentage || 0}
                              onChange={(e) => updateMilestone(ms.id, { progress_percentage: parseInt(e.target.value) }).then(loadMilestones)}
                              style={{ flex: 1, accentColor: 'var(--accent-secondary)' }}
                            />
                            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{ms.progress_percentage || 0}%</span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteMilestone(ms.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239,68,68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68, 0); }
        }
      `}</style>
    </motion.div>
  )
}
