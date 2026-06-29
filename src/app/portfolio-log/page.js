'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { getLocalDateStr } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProfile } from '@/lib/hooks/useProfile'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, Code, Terminal, Database, Shield, Plus, ExternalLink, Image as ImageIcon, Link as LinkIcon, Edit2, Save, FileText, Clock } from 'lucide-react'

export default function ProofOfWork() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [activeTab, setActiveTab] = useState('timeline') // timeline | projects | resume | reviews

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab')) {
      setActiveTab(params.get('tab'))
    }
  }, [])
  const [logs, setLogs] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [newMediaUrl, setNewMediaUrl] = useState('')

  // New Log Form State
  const [showAddLog, setShowAddLog] = useState(false)
  const [newLog, setNewLog] = useState({ title: '', description: '', type: 'project_work', duration: '', duration_unit: 'hours', mediaUrl: '' })

  // New Project Form State
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProj, setNewProj] = useState({ title: '', description: '', status: 'active', tech_stack: '' })

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user])

  const fetchData = async () => {
    const supabase = createClient()
    const [logsRes, projRes] = await Promise.all([
      supabase.from('work_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ])
    if (logsRes.data) setLogs(logsRes.data)
    if (projRes.data) setProjects(projRes.data)
    setLoading(false)
  }

  const handleAddMedia = async (logId, currentMedia) => {
    if (!newMediaUrl.trim()) return
    const supabase = createClient()
    const updatedMedia = [...(currentMedia || []), newMediaUrl]
    
    const { error } = await supabase.from('work_logs').update({ media_urls: updatedMedia }).eq('id', logId)
    if (!error) {
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, media_urls: updatedMedia } : l))
      setNewMediaUrl('')
      setEditingId(null)
    }
  }

  const handleCreateLog = async (e) => {
    e.preventDefault()
    if (!newLog.title.trim()) return
    const supabase = createClient()
    const parsedDuration = newLog.duration ? parseFloat(newLog.duration) : null
    const duration_hours = parsedDuration ? (newLog.duration_unit === 'days' ? parsedDuration * 24 : parsedDuration) : null

    const payload = {
      user_id: user.id,
      title: newLog.title,
      description: newLog.description,
      type: newLog.type,
      duration_hours: duration_hours,
      date: getLocalDateStr()
    }

    if (newLog.mediaUrl.trim()) {
      payload.media_urls = [newLog.mediaUrl.trim()]
    }

    const { data, error } = await supabase.from('work_logs').insert([payload]).select()
    
    if (error) {
      alert(`UPLOAD FAILED: ${error.message}\n\nPlease let the AI know what this error says!`)
      return
    }

    if (data) {
      setLogs([data[0], ...logs])
      setShowAddLog(false)
      setNewLog({ title: '', description: '', type: 'project_work', duration: '', duration_unit: 'hours', mediaUrl: '' })
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!newProj.title.trim()) return
    const supabase = createClient()
    const { data, error } = await supabase.from('projects').insert([{
      user_id: user.id,
      title: newProj.title,
      description: newProj.description,
      status: newProj.status,
      tech_stack: newProj.tech_stack.split(',').map(s => s.trim()).filter(Boolean)
    }]).select()
    
    if (data) {
      setProjects([data[0], ...projects])
      setShowAddProject(false)
      setNewProj({ title: '', description: '', status: 'active', tech_stack: '' })
    }
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">ACCESSING ARCHIVES...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container max-w-5xl">
        <header className="page-header flex-between flex-wrap gap-4">
          <div>
            <h1 className="page-title flex items-center gap-3"><Terminal className="text-amber" /> PORTFOLIO ENGINE</h1>
            <p className="page-subtitle">Proof of work, project history, and auto-generated resume.</p>
          </div>
        </header>

        {/* TABS */}
        <div className="tabs mb-6">
          <button className={`tab-item ${activeTab === 'timeline' ? 'tab-active' : ''}`} onClick={() => setActiveTab('timeline')}>
            TIMELINE LOGS
          </button>
          <button className={`tab-item ${activeTab === 'reviews' ? 'tab-active' : ''}`} onClick={() => setActiveTab('reviews')}>
            WEEKLY REVIEWS
          </button>
          <button className={`tab-item ${activeTab === 'projects' ? 'tab-active' : ''}`} onClick={() => setActiveTab('projects')}>
            PROJECTS
          </button>
          <button className={`tab-item ${activeTab === 'resume' ? 'tab-active' : ''}`} onClick={() => setActiveTab('resume')}>
            RESUME (AUTO-GEN)
          </button>
        </div>

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="flex-col gap-6">
            <div className="flex justify-end">
              <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setShowAddLog(!showAddLog)}>
                <Plus size={16} /> ADD LOG
              </button>
            </div>

            <AnimatePresence>
              {showAddLog && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <HudPanel label="NEW WORK LOG" className="border-amber mb-6">
                    <form onSubmit={handleCreateLog} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">TITLE</label>
                        <input type="text" className="input font-mono text-sm" value={newLog.title} onChange={e => setNewLog({...newLog, title: e.target.value})} required />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">TYPE</label>
                        <select className="select font-mono text-sm" value={newLog.type} onChange={e => setNewLog({...newLog, type: e.target.value})}>
                          <option value="project_work">PROJECT WORK</option>
                          <option value="content">CONTENT CREATION</option>
                          <option value="meeting">MEETING / SALES</option>
                          <option value="learning">LEARNING</option>
                          <option value="other">OTHER</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-mono text-xs text-muted mb-1 block">DESCRIPTION</label>
                        <textarea className="textarea font-mono text-sm h-20" value={newLog.description} onChange={e => setNewLog({...newLog, description: e.target.value})} />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">DURATION</label>
                        <div className="flex gap-2">
                          <input type="number" step="0.5" className="input font-mono text-sm flex-1" value={newLog.duration} onChange={e => setNewLog({...newLog, duration: e.target.value})} placeholder="0" />
                          <select className="select font-mono text-sm w-24" value={newLog.duration_unit} onChange={e => setNewLog({...newLog, duration_unit: e.target.value})}>
                            <option value="hours">HOURS</option>
                            <option value="days">DAYS</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">ATTACH LINK / IMAGE URL</label>
                        <input type="url" className="input font-mono text-sm" value={newLog.mediaUrl} onChange={e => setNewLog({...newLog, mediaUrl: e.target.value})} placeholder="https://..." />
                      </div>
                      <div className="flex items-end justify-end md:col-span-2 mt-2">
                        <button type="submit" className="btn btn-primary w-full md:w-auto">SAVE LOG</button>
                      </div>
                    </form>
                  </HudPanel>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-col gap-0 border-l border-border-strong ml-4 pl-6 relative">
              {logs.filter(l => l.type !== 'weekly_review').map((log) => (
                <div key={log.id} className="relative pb-8 group">
                  <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-border-color border border-border-strong group-hover:bg-amber transition-colors z-10" />
                  
                  <div className="bg-tertiary border border-border-color p-4 hover:border-amber transition-colors">
                    <div className="flex-between mb-2">
                      <span className="font-mono text-xs text-amber">{String(log.date || '')}</span>
                      <span className="badge">{String(log.type || 'OTHER').replace('_', ' ').toUpperCase()}</span>
                    </div>
                    
                    <h3 className="font-display text-xl uppercase tracking-wider text-primary mb-2 break-words">{log.title}</h3>
                    {log.description && <p className="font-mono text-sm text-secondary mb-3 break-words whitespace-pre-wrap">{log.description}</p>}
                    
                    <div className="font-mono text-[10px] text-muted flex items-center gap-1 mb-4">
                      <Clock size={10} />
                      {log.duration_hours ? (log.duration_hours >= 24 && log.duration_hours % 24 === 0 ? `DURATION: ${log.duration_hours / 24} DAYS` : `DURATION: ${log.duration_hours} HOURS`) : 'NO DURATION LOGGED'}
                    </div>
                    
                    {Array.isArray(log.media_urls) && log.media_urls.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {log.media_urls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-mono text-[10px] text-amber hover:text-primary transition-colors bg-bg-primary border border-amber px-2 py-1">
                            <ExternalLink size={10} /> PROOF {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-border-color pt-3 mt-2">
                      <span className="font-mono text-xs text-muted">
                        {log.duration_hours ? `DURATION: ${log.duration_hours}H` : 'NO DURATION LOGGED'}
                      </span>
                      <button onClick={() => setEditingId(editingId === log.id ? null : log.id)} className="font-mono text-[10px] text-muted hover:text-primary flex items-center gap-1">
                        <Plus size={10} /> ADD PROOF
                      </button>
                    </div>

                    {editingId === log.id && (
                      <div className="mt-4 flex gap-2">
                        <input type="url" placeholder="https://..." className="input font-mono text-xs flex-1 py-1" value={newMediaUrl} onChange={e => setNewMediaUrl(e.target.value)} />
                        <button onClick={() => handleAddMedia(log.id, log.media_urls)} className="btn btn-primary btn-sm flex items-center gap-1">
                          <Save size={12} /> SAVE
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {logs.filter(l => l.type !== 'weekly_review').length === 0 && <div className="font-mono text-sm text-muted py-8">NO WORK LOGS ARCHIVED.</div>}
            </div>
          </div>
        )}

        {/* WEEKLY REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <div className="flex-col gap-6">
            <div className="flex-col gap-0 border-l border-border-strong ml-4 pl-6 relative">
              {logs.filter(l => l.type === 'weekly_review').map((log) => (
                <div key={log.id} className="relative pb-8 group">
                  <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-border-color border border-border-strong group-hover:bg-amber transition-colors z-10" />
                  
                  <div className="bg-tertiary border border-border-color p-4 hover:border-amber transition-colors">
                    <div className="flex-between mb-2">
                      <span className="font-mono text-xs text-amber">{String(log.date || '')}</span>
                      <span className="badge badge-amber">WEEKLY DEBRIEF</span>
                    </div>
                    
                    <h3 className="font-display text-xl uppercase tracking-wider text-primary mb-4">{log.title}</h3>
                    
                    {log.description && (
                      <div className="prose prose-invert prose-sm max-w-none font-mono text-sm text-secondary">
                        {log.description.split('\n').map((line, i) => {
                          if (line.startsWith('### ')) {
                            return <h4 key={i} className="text-amber mt-4 mb-2 font-display tracking-widest uppercase">{line.replace('### ', '')}</h4>
                          }
                          return <div key={i} className="min-h-[1.5em]">{line}</div>
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {logs.filter(l => l.type === 'weekly_review').length === 0 && <div className="font-mono text-sm text-muted py-8">NO WEEKLY REVIEWS ARCHIVED YET.</div>}
            </div>
          </div>
        )}

        {/* PROJECTS TAB */}
        {activeTab === 'projects' && (
          <div className="flex-col gap-6">
            <div className="flex justify-end">
              <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setShowAddProject(!showAddProject)}>
                <Plus size={16} /> ADD PROJECT
              </button>
            </div>

            <AnimatePresence>
              {showAddProject && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <HudPanel label="NEW PROJECT" className="border-info mb-6">
                    <form onSubmit={handleCreateProject} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">PROJECT TITLE</label>
                        <input type="text" className="input font-mono text-sm" value={newProj.title} onChange={e => setNewProj({...newProj, title: e.target.value})} required />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">STATUS</label>
                        <select className="select font-mono text-sm" value={newProj.status} onChange={e => setNewProj({...newProj, status: e.target.value})}>
                          <option value="idea">IDEA</option>
                          <option value="active">ACTIVE</option>
                          <option value="paused">PAUSED</option>
                          <option value="completed">COMPLETED</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-mono text-xs text-muted mb-1 block">DESCRIPTION</label>
                        <textarea className="textarea font-mono text-sm h-20" value={newProj.description} onChange={e => setNewProj({...newProj, description: e.target.value})} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-mono text-xs text-muted mb-1 block">TECH STACK / SKILLS (COMMA SEPARATED)</label>
                        <input type="text" className="input font-mono text-sm" value={newProj.tech_stack} onChange={e => setNewProj({...newProj, tech_stack: e.target.value})} placeholder="React, Node.js, Marketing..." />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="btn btn-primary w-full md:w-auto">SAVE PROJECT</button>
                      </div>
                    </form>
                  </HudPanel>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((proj) => (
                <div key={proj.id} className="bg-tertiary border border-border-color p-5 hover:border-info transition-colors flex-col h-full group">
                  <div className="flex-between mb-3">
                    <h3 className="font-display text-2xl uppercase tracking-wider text-primary group-hover:text-info transition-colors">{proj.title}</h3>
                    <span className={`badge ${proj.status === 'active' ? 'badge-amber' : proj.status === 'completed' ? 'badge-success' : ''}`}>
                      {String(proj.status || 'UNKNOWN').toUpperCase()}
                    </span>
                  </div>
                  <p className="font-mono text-sm text-secondary mb-4 flex-1">{proj.description}</p>
                  
                  {Array.isArray(proj.tech_stack) && proj.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto">
                      {proj.tech_stack.map((tech, idx) => (
                        <span key={idx} className="font-mono text-[10px] text-muted bg-bg-primary px-2 py-1 border border-border-strong">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {projects.length === 0 && <div className="font-mono text-sm text-muted col-span-2 py-8 text-center">NO PROJECTS ARCHIVED.</div>}
            </div>
          </div>
        )}

        {/* RESUME TAB (AUTO-GEN) */}
        {activeTab === 'resume' && (
          <HudPanel className="bg-bg-primary border-amber" style={{ padding: '3rem 2rem' }}>
            <div className="max-w-3xl mx-auto flex-col gap-10">
              
              {/* Header */}
              <div className="text-center border-b border-border-color pb-8">
                <h1 className="font-display text-5xl uppercase tracking-widest text-primary mb-2">{profile?.full_name || 'CHIRAG SHETTY'}</h1>
                <p className="font-mono text-sm text-amber uppercase tracking-widest">FOUNDER & OPERATOR</p>
                <div className="flex justify-center gap-4 mt-4 font-mono text-xs text-muted">
                  <span>LEVEL {profile?.level || 1}</span>
                  <span>•</span>
                  <span>{profile?.current_rank || 'E'} RANK</span>
                </div>
              </div>

              {/* Experience Summary */}
              <div>
                <h2 className="font-display text-2xl uppercase tracking-wider text-amber mb-4 border-b border-border-color pb-2 flex items-center gap-2">
                  <Briefcase size={20} /> EXPERIENCE LOG
                </h2>
                <div className="flex-col gap-6">
                  {logs.slice(0, 5).map(log => (
                    <div key={log.id}>
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-mono text-sm text-primary uppercase">{log.title}</h3>
                        <span className="font-mono text-[10px] text-muted">{log.date}</span>
                      </div>
                      <p className="font-mono text-xs text-secondary leading-relaxed">{log.description || 'Executed operational directive.'}</p>
                    </div>
                  ))}
                  {logs.length === 0 && <p className="font-mono text-xs text-muted">Awaiting operational data.</p>}
                </div>
              </div>

              {/* Projects */}
              <div>
                <h2 className="font-display text-2xl uppercase tracking-wider text-amber mb-4 border-b border-border-color pb-2 flex items-center gap-2">
                  <Database size={20} /> KEY PROJECTS
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {projects.map(proj => (
                    <div key={proj.id} className="border border-border-color p-4 bg-tertiary">
                      <h3 className="font-mono text-sm text-primary uppercase mb-2">{proj.title}</h3>
                      <p className="font-mono text-[10px] text-secondary mb-3">{proj.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(proj.tech_stack) && proj.tech_stack.map((t, i) => (
                          <span key={i} className="font-mono text-[8px] border border-border-strong px-1 text-muted">{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && <p className="font-mono text-xs text-muted">Awaiting project data.</p>}
                </div>
              </div>

              {/* Stats Footer */}
              <div className="border-t border-border-color pt-6 mt-4 flex justify-between">
                <div className="font-mono text-[10px] text-muted">AUTO-GENERATED BY CHIRAGOS</div>
                <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => window.print()}>
                  <FileText size={14} /> EXPORT PDF
                </button>
              </div>

            </div>
          </HudPanel>
        )}

      </div>
    </AppShell>
  )
}
