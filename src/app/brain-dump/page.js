'use client'

import { useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useBrainDump } from '@/lib/hooks/useBrainDump'
import { TOPIC_COLORS } from '@/lib/hooks/useBrainDumpInternal'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, CheckCircle2, Trash2, RotateCcw, Flag, ChevronDown,
  ChevronRight, Search, Plus, X, Pencil, Tag, Settings2, Target
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getNextColor(topics) {
  const used = topics.map(t => t.color)
  return TOPIC_COLORS.find(c => !used.includes(c.value))?.value || TOPIC_COLORS[Math.floor(Math.random() * TOPIC_COLORS.length)].value
}

// ─── Topic Badge ──────────────────────────────────────────────────────────────
function TopicBadge({ name, color }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-widest font-bold"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {name}
    </span>
  )
}

// ─── Intel Card ───────────────────────────────────────────────────────────────
function IntelCard({ item, onDone, onDiscard, onRestore, onDelete, onConvertMission, isInbox, isDone }) {
  const color = item.topic_color || '#94a3b8'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-sm mb-3"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderLeft: `3px solid ${color}`,
        opacity: item.status === 'discarded' ? 0.6 : 1,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <TopicBadge name={item.topic || 'General'} color={color} />
          <span className="font-mono text-[9px] text-muted shrink-0">{timeAgo(item.created_at)}</span>
        </div>
        <p className="font-mono text-sm text-primary leading-relaxed whitespace-pre-wrap">{item.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          {isInbox && (
            <>
              <button
                onClick={() => onDone(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-all hover:opacity-80"
                style={{ background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e40' }}
              >
                <CheckCircle2 size={12} /> Done
              </button>
              <button
                onClick={() => onConvertMission(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-all hover:opacity-80"
                style={{ background: '#38bdf820', color: '#38bdf8', border: '1px solid #38bdf840' }}
              >
                <Target size={12} /> Mission
              </button>
              <button
                onClick={() => onDiscard(item.id)}
                className="ml-auto flex items-center gap-1.5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-all hover:opacity-80"
                style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
          {isDone && (
            <button
              onClick={() => onRestore(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-all hover:opacity-80 ml-auto"
              style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}
            >
              <RotateCcw size={12} /> Restore
            </button>
          )}
          {!isInbox && !isDone && (
            <>
              <button
                onClick={() => onRestore(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-all hover:opacity-80"
                style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}
              >
                <RotateCcw size={12} /> Restore
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="ml-auto flex items-center gap-1.5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-all hover:opacity-80"
                style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
              >
                <Trash2 size={12} /> Delete
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
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-sm mb-2 transition-all hover:opacity-80"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span className="font-mono text-xs uppercase tracking-widest font-bold" style={{ color }}>{topic}</span>
        <span className="font-mono text-[9px] text-muted ml-1">({items.length})</span>
        <span className="ml-auto" style={{ color }}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
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
  const [editing, setEditing] = useState(null) // { name, newName }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-sm"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <Settings2 size={14} className="text-amber" />
            <span className="font-mono text-xs uppercase tracking-widest text-amber">Topic Management</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary"><X size={14} /></button>
        </div>
        <div className="p-4 flex flex-col gap-2 max-h-80 overflow-y-auto">
          {topics.filter(t => t.name !== 'General').map(topic => (
            <div key={topic.name} className="flex items-center gap-3 p-2 rounded-sm" style={{ border: '1px solid var(--border-color)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: topic.color, flexShrink: 0 }} />
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
                <span className="flex-1 font-mono text-xs text-primary">{topic.name}</span>
              )}
              <div className="flex gap-1">
                {editing?.name === topic.name ? (
                  <button onClick={() => { onRename(editing.name, editing.newName); setEditing(null) }} className="text-success hover:opacity-80"><CheckCircle2 size={12} /></button>
                ) : (
                  <button onClick={() => setEditing({ name: topic.name, newName: topic.name })} className="text-muted hover:text-primary"><Pencil size={12} /></button>
                )}
                <button onClick={() => { if (confirm(`Delete topic "${topic.name}"? All intel will move to General.`)) onDelete(topic.name) }} className="text-muted hover:text-danger"><X size={12} /></button>
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

  const [content, setContent]           = useState('')
  const [selectedTopic, setSelectedTopic] = useState(null) // null = not chosen yet
  const [freeTypeTopic, setFreeTypeTopic] = useState('')
  const [isFreeType, setIsFreeType]     = useState(false)
  const [activeTab, setActiveTab]       = useState('inbox')
  const [search, setSearch]             = useState('')
  const [showTopicMgr, setShowTopicMgr] = useState(false)

  // Resolve the effective topic for submission
  const effectiveTopic = isFreeType
    ? freeTypeTopic.trim()
    : selectedTopic?.name || ''

  const effectiveColor = isFreeType
    ? (topics.find(t => t.name === freeTypeTopic.trim())?.color || getNextColor(topics))
    : selectedTopic?.color || '#94a3b8'

  const canSubmit = content.trim() && effectiveTopic

  const handleCapture = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    await addItem(content.trim(), effectiveTopic, effectiveColor)
    setContent('')
    // keep topic selected for fast re-entry
  }

  // Filter items by tab + search
  const tabItems = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(item => {
      const statusMatch =
        activeTab === 'inbox'     ? item.status === 'inbox' :
        activeTab === 'done'      ? item.status === 'done' :
        item.status === 'discarded'
      if (!statusMatch) return false
      if (!q) return true
      return item.content.toLowerCase().includes(q) || (item.topic || '').toLowerCase().includes(q)
    })
  }, [items, activeTab, search])

  // Group by topic
  const grouped = useMemo(() => {
    const map = {}
    tabItems.forEach(item => {
      const t = item.topic || 'General'
      if (!map[t]) map[t] = { color: item.topic_color || '#94a3b8', items: [] }
      map[t].items.push(item)
    })
    return map
  }, [tabItems])

  const TABS = [
    { id: 'inbox', label: 'INBOX', count: items.filter(i => i.status === 'inbox').length },
    { id: 'done',  label: 'DONE',  count: items.filter(i => i.status === 'done').length },
    { id: 'discarded', label: 'DISCARDED', count: items.filter(i => i.status === 'discarded').length },
  ]

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center h-full">
        <span className="font-mono text-xs uppercase tracking-widest text-muted animate-pulse">ACCESSING INTEL...</span>
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

      <div className="page-container narrow">
        {/* Header */}
        <header className="page-header mb-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="page-title flex items-center gap-2"><Zap size={20} className="text-amber" /> INTEL DROP</h1>
              <p className="page-subtitle font-mono uppercase text-xs">Capture. Classify. Execute.</p>
            </div>
            <button
              onClick={() => setShowTopicMgr(true)}
              className="flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-all hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
            >
              <Settings2 size={12} /> Topics
            </button>
          </div>
        </header>

        {/* ── Capture Form ── */}
        <div className="rounded-sm mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <form onSubmit={handleCapture}>
            <textarea
              className="w-full bg-transparent p-4 font-mono text-sm text-primary resize-none outline-none"
              style={{ minHeight: 80, caretColor: 'var(--amber)', borderBottom: '1px solid var(--border-color)' }}
              placeholder="Awaiting intel transmission..."
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleCapture(e) }}
            />

            {/* Topic Selector */}
            <div className="p-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag size={10} className="text-muted" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">Topic</span>
                <button
                  type="button"
                  onClick={() => { setIsFreeType(v => !v); setFreeTypeTopic(''); setSelectedTopic(null) }}
                  className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-widest transition-all"
                  style={{
                    background: isFreeType ? '#f59e0b20' : 'var(--bg-primary)',
                    color: isFreeType ? '#f59e0b' : 'var(--text-muted)',
                    border: `1px solid ${isFreeType ? '#f59e0b50' : 'var(--border-color)'}`,
                  }}
                >
                  <Plus size={9} /> New Topic
                </button>
              </div>

              {isFreeType ? (
                <input
                  autoFocus
                  className="w-full bg-transparent font-mono text-sm text-primary outline-none px-2 py-1.5 rounded-sm"
                  style={{ border: '1px solid #f59e0b60', caretColor: '#f59e0b' }}
                  placeholder="Type new topic name..."
                  value={freeTypeTopic}
                  onChange={e => setFreeTypeTopic(e.target.value)}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topics.map(topic => (
                    <button
                      key={topic.name}
                      type="button"
                      onClick={() => setSelectedTopic(topic)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest transition-all"
                      style={{
                        background: selectedTopic?.name === topic.name ? `${topic.color}25` : 'var(--bg-primary)',
                        color: selectedTopic?.name === topic.name ? topic.color : 'var(--text-muted)',
                        border: `1px solid ${selectedTopic?.name === topic.name ? topic.color : 'var(--border-color)'}`,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: topic.color, flexShrink: 0 }} />
                      {topic.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 flex items-center gap-2">
              {effectiveTopic && (
                <TopicBadge name={effectiveTopic} color={effectiveColor} />
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="ml-auto flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest rounded-sm transition-all"
                style={{
                  background: canSubmit ? '#f59e0b' : 'var(--bg-primary)',
                  color: canSubmit ? '#000' : 'var(--text-muted)',
                  border: `1px solid ${canSubmit ? '#f59e0b' : 'var(--border-color)'}`,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                }}
              >
                <Zap size={13} /> TRANSMIT
              </button>
            </div>
          </form>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-all relative"
              style={{
                color: activeTab === tab.id ? '#f59e0b' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full font-bold" style={{ fontSize: 8, background: activeTab === tab.id ? '#f59e0b' : 'var(--bg-secondary)', color: activeTab === tab.id ? '#000' : 'var(--text-muted)' }}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div layoutId="tabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#f59e0b' }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <Search size={12} className="text-muted shrink-0" />
          <input
            className="flex-1 bg-transparent font-mono text-xs text-primary outline-none"
            placeholder="Search intel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="text-muted hover:text-primary"><X size={12} /></button>}
        </div>

        {/* ── Intel List ── */}
        <AnimatePresence mode="wait">
          {Object.keys(grouped).length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <Zap size={24} className="text-muted mx-auto mb-3" />
              <p className="font-mono text-xs text-muted uppercase tracking-widest">
                {search ? 'No intel matches your search.' : 'No intel in this directory.'}
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
