'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { useBrainDump } from '@/lib/hooks/useBrainDump'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, CheckSquare, Target, FileText, Shuffle, Plus, ArrowRight, Trash2 } from 'lucide-react'

const TYPE_ICONS = {
  idea: Lightbulb,
  task: CheckSquare,
  goal: Target,
  note: FileText,
  random: Shuffle
}

const TYPE_LABELS = {
  idea: 'STARTUP / BIG IDEA',
  task: 'SMALL CHORE (e.g. Bills)',
  goal: 'LONG TERM GOAL',
  note: 'QUICK NOTE',
  random: 'RANDOM THOUGHT'
}

export default function IntelDrop() {
  const { items, loading, addItem, organizeItem, discardItem, convertItem } = useBrainDump()
  const [content, setContent] = useState('')
  const [selectedType, setSelectedType] = useState('note')
  const [activeTab, setActiveTab] = useState('inbox')

  const handleCapture = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    await addItem(content, selectedType)
    setContent('')
  }

  const TABS = [
    { id: 'inbox', label: 'INBOX' },
    { id: 'organized', label: 'ORGANIZED' },
    { id: 'discarded', label: 'DISCARDED' }
  ]

  const filteredItems = items.filter(item => {
    if (activeTab === 'inbox') return item.status === 'inbox'
    if (activeTab === 'organized') return item.status === 'organized' || item.status === 'converted'
    if (activeTab === 'discarded') return item.status === 'discarded'
    return true
  })

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">ACCESSING INTEL...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">INTEL DROP</h1>
          <p className="page-subtitle font-mono uppercase text-xs">Unstructured data capture and processing.</p>
        </header>

        <HudPanel glow className="mb-8" style={{ padding: 0 }}>
          <form onSubmit={handleCapture}>
            <textarea 
              className="brain-dump-input w-full bg-transparent border-0" 
              placeholder="Awaiting intel transmission..." 
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
            />
            <div className="p-4 border-t border-border-color bg-secondary flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPE_ICONS).map(([type, Icon]) => (
                  <button 
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-mono transition-all ${selectedType === type ? 'bg-amber-subtle text-amber border border-amber' : 'bg-black text-muted hover:text-secondary border border-border-color'}`}
                  >
                    <Icon size={14} /> {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              <button type="submit" className="btn btn-primary w-full flex justify-center items-center gap-2" disabled={!content.trim()}>
                CAPTURE INTEL <Plus size={16} />
              </button>
            </div>
          </form>
        </HudPanel>

        <div className="tab-list">
          {TABS.map(tab => (
            <button 
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-col gap-4">
          <AnimatePresence>
            {filteredItems.map(item => {
              const Icon = TYPE_ICONS[item.type] || FileText
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <HudPanel glow={item.status === 'inbox'} className={item.status === 'discarded' ? 'opacity-50' : ''}>
                    <div className="flex-between mb-2">
                      <div className="flex items-center gap-2 text-amber">
                        <Icon size={16} />
                        <span className="font-mono text-xs font-bold">{TYPE_LABELS[item.type] || item.type.toUpperCase()}</span>
                      </div>
                      <span className="font-mono text-xs text-muted">{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <p className="font-mono text-sm whitespace-pre-wrap">{item.content}</p>
                    
                    {item.status === 'inbox' && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-border-color">
                        <button onClick={async () => {
                          const res = await organizeItem(item.id);
                          if (res?.error) alert(`Error: ${res.error.message || res.error}`);
                        }} className="btn btn-secondary btn-sm flex-1">
                          ORGANIZE
                        </button>
                        <div className="flex gap-2">
                          <button onClick={async () => {
                            const res = await convertItem(item.id, 'task');
                            if (res?.error) alert(`Error: ${res.error.message || res.error}`);
                          }} className="btn btn-ghost btn-sm" title="Convert to Task"><CheckSquare size={14} /></button>
                          <button onClick={() => discardItem(item.id)} className="btn btn-ghost btn-sm text-danger" title="Discard"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    )}
                  </HudPanel>
                </motion.div>
              )
            })}
          </AnimatePresence>
          
          {filteredItems.length === 0 && (
            <div className="empty-state">NO INTEL IN THIS DIRECTORY</div>
          )}
        </div>

      </div>
    </AppShell>
  )
}
