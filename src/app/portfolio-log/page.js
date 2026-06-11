'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, Code, Terminal, Database, Shield, Plus, ExternalLink } from 'lucide-react'

export default function ProofOfWork() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('timeline')
  const [logs, setLogs] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
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
    fetchData()
  }, [user])

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
                    <HudPanel className="p-4 ml-4">
                      <div className="flex-between mb-2">
                        <span className="badge badge-amber">{log.category}</span>
                        <span className="font-mono text-xs text-muted">{log.date}</span>
                      </div>
                      <h3 className="font-display text-xl uppercase tracking-wide text-primary">{log.title}</h3>
                      <p className="text-sm text-secondary mt-1 font-mono">{log.description}</p>
                      {log.duration_minutes && (
                        <div className="mt-3 font-mono text-xs text-amber">DURATION: {log.duration_minutes}m</div>
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
                      <h3 className="font-display text-2xl uppercase tracking-wide text-primary">{proj.name}</h3>
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
