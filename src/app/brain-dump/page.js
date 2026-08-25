'use client'

import { useState, useMemo, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useBrainDump } from '@/lib/hooks/useBrainDump'
import { TOPIC_COLORS, DEFAULT_TOPICS, getTopicColor } from '@/lib/hooks/useBrainDumpInternal'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, CheckCircle2, Trash2, RotateCcw, ChevronDown,
  ChevronRight, Search, Plus, X, Pencil, Tag, Settings2, Target
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return 'recently'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Topic Badge ──────────────────────────────────────────────────────────────
function TopicBadge({ name, color }) {
  const displayColor = color || getTopicColor(name)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider font-bold"
      style={{ background: `${displayColor}15`, color: displayColor, border: `1px solid ${displayColor}30` }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: displayColor, display: 'inline-block', flexShrink: 0 }} />
      {name}
    </span>
  )
}

// ─── Intel Card ───────────────────────────────────────────────────────────────
function IntelCard({ item, onDone, onDiscard, onRestore, onDelete, onConvertMission, isInbox, isDone }) {
  const topicName = item.topic || item.type || 'General'
  const color = getTopicColor(topicName)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl mb-3 overflow-hidden transition-all border"
      style={{
        background: 'rgba(14, 17, 24, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderLeft: `4px solid ${color}`,
        opacity: item.status === 'discarded' ? 0.65 : 1,
      }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <TopicBadge name={topicName} color={color} />
          <span className="font-mono text-[10px] text-muted tracking-wider shrink-0">{timeAgo(item.created_at)}</span>
        </div>
        
        <p className="font-mono text-sm text-primary leading-relaxed whitespace-pre-wrap">{item.content}</p>

        {/* Actions Row with clean spacing */}
        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/5">
          {isInbox && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDone(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95 hover:bg-success/20"
                  style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                >
                  <CheckCircle2 size={13} /> Done
                </button>
                <button
                  onClick={() => onConvertMission(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95 hover:bg-info/20"
                  style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}
                >
                  <Target size={13} /> Mission
                </button>
              </div>
              <button
                onClick={() => onDiscard(item.id)}
                className="p-2 font-mono text-[10px] uppercase rounded-lg transition-all active:scale-95 hover:bg-danger/20"
                style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                title="Discard Intel"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {isDone && (
            <button
              onClick={() => onRestore(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95 ml-auto"
              style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
            >
              <RotateCcw size={13} /> Restore
            </button>
          )}
          {!isInbox && !isDone && (
            <>
              <button
                onClick={() => onRestore(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95"
                style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
              >
                <RotateCcw size={13} /> Restore
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95"
                style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Topic Group ──────────────────────────────────────────────────────────────
function TopicGroup({ topic, color, items, onDone, onDiscard, onRestore, onDelete, onConvertMission, isInbox, isDone }) {
  const [open, setOpen] = useState(true)
  const displayColor = color || getTopicColor(topic)
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl mb-2.5 transition-all hover:bg-white/5 active:scale-[0.99] font-mono text-xs border border-white/5 bg-black/40"
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: displayColor, flexShrink: 0 }} />
        <span className="font-bold uppercase tracking-wider" style={{ color: displayColor }}>{topic}</span>
        <span className="text-muted font-bold text-[10px]">({items.length})</span>
        <span className="ml-auto text-muted">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {items.map(item => (
              <IntelCard key={item.id} item={item} onDone={onDone} onDiscard={onDiscard} onRestore={onRestore} onDelete={onDelete} onConvertMission={onConvertMission} isInbox={isInbox} isDone={isDone} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Topic Manager Modal ──────────────────────────────────────────────────────
function TopicManager({ topics, onRename, onDelete, onClose }) {
  const [editing, setEditing] = useState(null)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-xl p-5 border border-border-color shadow-2xl bg-bg-secondary"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-amber" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Topic Management</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          {topics.filter(t => t.name !== 'General').map(topic => (
            <div key={topic.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/10 bg-black/40">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: getTopicColor(topic.name), flexShrink: 0 }} />
              {editing?.name === topic.name ? (
                <input
                  autoFocus
                  className="flex-1 bg-transparent font-mono text-xs text-primary outline-none"
                  value={editing.newName}
                  onChange={e => setEditing(v => ({ ...v, newName: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onRename(editing.name, editing.newName); setEditing(null) }
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <span className="flex-1 font-mono text-xs text-primary font-semibold">{topic.name}</span>
              )}
              <div className="flex gap-1.5">
                {editing?.name === topic.name ? (
                  <button onClick={() => { onRename(editing.name, editing.newName); setEditing(null) }} className="text-success hover:opacity-80"><CheckCircle2 size={14} /></button>
                ) : (
                  <button onClick={() => setEditing({ name: topic.name, newName: topic.name })} className="text-muted hover:text-primary"><Pencil size={14} /></button>
                )}
                <button onClick={() => { if (confirm(`Delete topic "${topic.name}"? All intel will move to General.`)) onDelete(topic.name) }} className="text-muted hover:text-danger"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntelDrop() {
  const {
    items, topics, loading,
    addItem, doneItem, discardItem, restoreItem, deleteItem,
    convertToMission, renameTopic, deleteTopic,
  } = useBrainDump()

  const [content, setContent]               = useState('')
  const [selectedTopic, setSelectedTopic]   = useState(DEFAULT_TOPICS[0])
  const [freeTypeTopic, setFreeTypeTopic]   = useState('')
  const [isFreeType, setIsFreeType]         = useState(false)
  const [activeTab, setActiveTab]           = useState('inbox')
  const [search, setSearch]                 = useState('')
  const [showTopicMgr, setShowTopicMgr]     = useState(false)
  const [saving, setSaving]                 = useState(false)

  // Ensure default topic is selected when topics update
  useEffect(() => {
    if (!selectedTopic && topics && topics.length > 0) {
      setSelectedTopic(topics[0])
    }
  }, [topics, selectedTopic])

  // Resolve effective topic for submission
  const effectiveTopic = isFreeType
    ? freeTypeTopic.trim()
    : (selectedTopic?.name || 'General')

  const effectiveColor = getTopicColor(effectiveTopic)

  const canSubmit = content.trim().length > 0 && (!isFreeType || freeTypeTopic.trim().length > 0)

  const handleCapture = async (e) => {
    if (e) e.preventDefault()
    if (!canSubmit || saving) return
    setSaving(true)
    const topicToUse = effectiveTopic
    const res = await addItem(content.trim(), topicToUse)
    setSaving(false)

    if (res?.error) {
      alert(`Error capturing intel: ${res.error.message || JSON.stringify(res.error)}`)
    } else {
      setContent('')
      if (isFreeType) {
        setIsFreeType(false)
        setFreeTypeTopic('')
        setSelectedTopic({ name: topicToUse, color: getTopicColor(topicToUse) })
      }
    }
  }

  // Filter items by tab + search
  const tabItems = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(item => {
      const statusMatch =
        activeTab === 'inbox'     ? item.status === 'inbox' :
        activeTab === 'done'      ? (item.status === 'done' || item.status === 'organized' || item.status === 'converted') :
        item.status === 'discarded'
      if (!statusMatch) return false
      if (!q) return true
      const topicName = item.topic || item.type || ''
      return item.content.toLowerCase().includes(q) || topicName.toLowerCase().includes(q)
    })
  }, [items, activeTab, search])

  // Group by topic
  const grouped = useMemo(() => {
    const map = {}
    tabItems.forEach(item => {
      const t = item.topic || item.type || 'General'
      if (!map[t]) map[t] = { color: getTopicColor(t), items: [] }
      map[t].items.push(item)
    })
    return map
  }, [tabItems])

  const TABS = [
    { id: 'inbox', label: 'INBOX', count: items.filter(i => i.status === 'inbox').length },
    { id: 'done',  label: 'DONE',  count: items.filter(i => i.status === 'done' || i.status === 'organized' || i.status === 'converted').length },
    { id: 'discarded', label: 'DISCARDED', count: items.filter(i => i.status === 'discarded').length },
  ]

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center h-full flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted animate-pulse">ACCESSING INTEL...</span>
        <span className="font-mono text-xs text-cyan-400 font-bold tracking-widest uppercase animate-pulse flex items-center gap-1.5">
          <span>❄️</span> WINTER IS COMING <span>❄️</span>
        </span>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <AnimatePresence>
        {showTopicMgr && (
          <TopicManager topics={topics} onRename={renameTopic} onDelete={deleteTopic} onClose={() => setShowTopicMgr(false)} />
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <header className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h1 className="text-xl sm:text-2xl font-mono font-bold text-primary flex items-center gap-2">
              <Zap size={22} className="text-amber" /> INTEL DROP
            </h1>
          </div>
          <button
            onClick={() => setShowTopicMgr(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider rounded-lg transition-colors border border-white/10 bg-black/40 text-muted hover:text-primary hover:border-amber/40"
          >
            <Settings2 size={13} /> Topics
          </button>
        </header>

        {/* ── Capture Form ── */}
        <div className="rounded-xl overflow-hidden border border-white/10 bg-bg-secondary/90 backdrop-blur-md shadow-xl">
          <form onSubmit={handleCapture}>
            <textarea
              className="w-full bg-black/30 p-4 font-mono text-sm text-primary resize-none outline-none placeholder:text-muted/40 border-b border-white/10 focus:bg-black/50 transition-colors"
              style={{ minHeight: 95, caretColor: '#f59e0b' }}
              placeholder="Type your thought or intel here..."
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleCapture(e) }}
            />

            {/* Topic Selector */}
            <div className="p-4 border-b border-white/10 bg-black/20">
              <div className="flex items-center justify-between mb-3 font-mono text-xs">
                <span className="text-muted font-bold tracking-wider uppercase text-[10px]">TOPIC</span>
                <button
                  type="button"
                  onClick={() => {
                    if (isFreeType) {
                      setIsFreeType(false)
                      setFreeTypeTopic('')
                      if (!selectedTopic && topics.length > 0) setSelectedTopic(topics[0])
                    } else {
                      setIsFreeType(true)
                      setFreeTypeTopic('')
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[10px] uppercase font-bold transition-all border"
                  style={{
                    background: isFreeType ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: isFreeType ? '#f59e0b' : 'var(--text-muted)',
                    borderColor: isFreeType ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Plus size={11} /> {isFreeType ? 'Cancel' : 'New Topic'}
                </button>
              </div>

              {isFreeType ? (
                <input
                  autoFocus
                  className="w-full font-mono text-xs text-primary outline-none px-3 py-2 rounded-lg bg-black/50 border border-amber/50"
                  style={{ caretColor: '#f59e0b' }}
                  placeholder="Enter new topic name..."
                  value={freeTypeTopic}
                  onChange={e => setFreeTypeTopic(e.target.value)}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topics.map(topic => {
                    const isSelected = selectedTopic?.name === topic.name
                    const color = getTopicColor(topic.name)
                    return (
                      <button
                        key={topic.name}
                        type="button"
                        onClick={() => { setSelectedTopic(topic); setIsFreeType(false) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-wider transition-all cursor-pointer border"
                        style={{
                          background: isSelected ? `${color}20` : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? color : 'var(--text-muted)',
                          borderColor: isSelected ? color : 'rgba(255, 255, 255, 0.08)',
                          fontWeight: isSelected ? 700 : 500
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        {topic.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bottom Transmit Button Row */}
            <div className="p-3 sm:p-4 flex items-center justify-end bg-black/40">
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="flex items-center gap-2 px-6 py-2.5 font-mono text-xs uppercase tracking-widest rounded-lg transition-all shadow-lg font-bold"
                style={{
                  background: canSubmit ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                  color: canSubmit ? '#000' : 'var(--text-muted)',
                  border: `1px solid ${canSubmit ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                  cursor: canSubmit && !saving ? 'pointer' : 'not-allowed',
                  opacity: saving ? 0.7 : 1
                }}
              >
                <Zap size={14} /> {saving ? 'TRANSMITTING...' : 'TRANSMIT'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold tracking-wider transition-all border ${
                activeTab === tab.id
                  ? 'bg-amber/15 border-amber/40 text-amber'
                  : 'bg-black/30 border-white/5 text-muted hover:text-primary'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-amber/20 text-amber' : 'bg-white/10 text-muted'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Search Bar (Clean Dark Styling) ── */}
        <div className="relative w-full">
          <input
            type="text"
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 pl-10 font-mono text-xs text-primary placeholder:text-muted focus:outline-none focus:border-amber transition-colors"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#f3f4f6' }}
            placeholder="Search intel transmissions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary font-mono text-xs">
              ×
            </button>
          )}
        </div>

        {/* ── Intel List ── */}
        <AnimatePresence mode="wait">
          {Object.keys(grouped).length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 rounded-xl border border-dashed border-white/10 bg-black/20">
              <Zap size={24} className="text-muted mx-auto mb-2 opacity-40" />
              <p className="font-mono text-xs text-muted uppercase tracking-widest">
                {search ? 'No intel matches your search query.' : 'No intel entries found.'}
              </p>
            </motion.div>
          ) : (
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {Object.entries(grouped).map(([topic, { color, items: groupItems }]) => (
                <TopicGroup
                  key={topic}
                  topic={topic}
                  color={color}
                  items={groupItems}
                  isInbox={activeTab === 'inbox'}
                  isDone={activeTab === 'done'}
                  onDone={doneItem}
                  onDiscard={discardItem}
                  onRestore={restoreItem}
                  onDelete={deleteItem}
                  onConvertMission={convertToMission}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
