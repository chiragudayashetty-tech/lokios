'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, Code, Terminal, Database, Shield, Plus, ExternalLink, Image as ImageIcon, Link as LinkIcon, Edit2, Save } from 'lucide-react'

export default function ProofOfWork() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('timeline')
  const [logs, setLogs] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [newMediaUrl, setNewMediaUrl] = useState('')

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

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">ACCESSING ARCHIVES...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header flex-between">
          <div>
            <h1 className="page-title">PROOF OF WORK</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Immutable record of execution and value creation.</p>
          </div>
        </header>

        <div className="tab-list">
          <button className={`tab-item ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>TIMELINE</button>
          <button className={`tab-item ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>PROJECTS</button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'timeline' && (
            <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="timeline">
                {logs.map((log, i) => (
                  <motion.div key={log.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="timeline-node">
                    <HudPanel className="p-4 ml-4 group relative">
                      
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingId(editingId === log.id ? null : log.id)} className="btn btn-ghost p-1.5 hover:text-amber">
                          <Edit2 size={14} />
                        </button>
                      </div>

                      <div className="flex-between mb-2">
                        <span className="badge badge-amber">{log.type || 'WORK'}</span>
                        <span className="font-mono text-xs text-muted mr-6">{log.date}</span>
                      </div>
                      
                      <h3 className="font-display text-xl uppercase tracking-wide text-primary">{log.title}</h3>
                      <p className="text-sm text-secondary mt-1 font-mono">{log.description}</p>
                      
                      {log.duration_hours && (
                        <div className="mt-2 font-mono text-xs text-amber">DURATION: {log.duration_hours}h</div>
                      )}

                      {/* Attachments Display */}
                      {log.media_urls && log.media_urls.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border-color">
                          <div className="font-mono text-[10px] text-muted mb-2 tracking-widest">ATTACHMENTS //</div>
                          <div className="flex flex-wrap gap-2">
                            {log.media_urls.map((url, idx) => {
                              const isImage = url.match(/\.(jpeg|jpg|gif|png)$/) != null
                              return isImage ? (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block border border-border-color hover:border-amber transition-colors">
                                  <img src={url} alt="Proof" className="h-20 w-auto object-cover" />
                                </a>
                              ) : (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="badge bg-tertiary flex items-center gap-1 hover:text-amber transition-colors">
                                  <LinkIcon size={12} /> {new URL(url).hostname}
                                </a>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Edit Mode: Add Attachment */}
                      {editingId === log.id && (
                        <div className="mt-4 pt-3 border-t border-amber flex gap-2">
                          <input 
                            type="text" 
                            className="input font-mono text-sm py-1 flex-1" 
                            placeholder="PASTE IMAGE OR RESOURCE URL..."
                            value={newMediaUrl}
                            onChange={e => setNewMediaUrl(e.target.value)}
                          />
                          <button onClick={() => handleAddMedia(log.id, log.media_urls)} className="btn btn-primary btn-sm shrink-0">ATTACH</button>
                        </div>
                      )}

                    </HudPanel>
                  </motion.div>
                ))}
                {logs.length === 0 && <div className="empty-state ml-4">NO WORK LOGS FOUND</div>}
              </div>
            </motion.div>
          )}

          {activeTab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid-2">
                {projects.map((proj, i) => (
                  <motion.div key={proj.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
                    <HudPanel glow>
                      <div className="flex-between mb-2">
                        <span className={`badge ${proj.status === 'completed' ? 'badge-success' : 'badge-amber'}`}>{proj.status}</span>
                      </div>
                      <h3 className="font-display text-2xl uppercase tracking-wide text-primary">{proj.title}</h3>
                      <p className="text-sm text-secondary mt-2 line-clamp-2 font-mono">{proj.description}</p>
                      {proj.tech_stack && proj.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-4">
                          {proj.tech_stack.map(tech => <span key={tech} className="badge bg-tertiary text-[10px]">{tech}</span>)}
                        </div>
                      )}
                    </HudPanel>
                  </motion.div>
                ))}
                {projects.length === 0 && <div className="empty-state col-span-2">NO PROJECTS REGISTERED</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AppShell>
  )
}
