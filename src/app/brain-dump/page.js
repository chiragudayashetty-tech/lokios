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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-widest font-bold"
      style={{ background: `${displayColor}20`, color: displayColor, border: `1px solid ${displayColor}40` }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: displayColor, display: 'inline-block', flexShrink: 0 }} />
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl mb-3 overflow-hidden shadow-sm"
      style={{
        background: 'rgba(12, 15, 22, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: `4px solid ${color}`,
        opacity: item.status === 'discarded' ? 0.65 : 1,
      }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <TopicBadge name={topicName} color={color} />
          <span className="font-mono text-[10px] text-muted tracking-wider shrink-0">{timeAgo(item.created_at)}</span>
        </div>
        <p className="font-mono text-sm text-primary leading-relaxed whitespace-pre-wrap">{item.content}</p>

        {/* Actions Row with clean spacing & touch buttons */}
        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/10">
          {isInbox && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDone(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95"
                  style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.35)' }}
                >
                  <CheckCircle2 size={13} /> Done
                </button>
                <button
                  onClick={() => onConvertMission(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95"
                  style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)' }}
                >
                  <Target size={13} /> Mission
                </button>
              </div>
              <button
                onClick={() => onDiscard(item.id)}
                className="p-2 font-mono text-[10px] uppercase rounded-lg transition-all active:scale-95 hover:opacity-80"
                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.35)' }}
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
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.35)' }}
            >
              <RotateCcw size={13} /> Restore
            </button>
          )}
          {!isInbox && !isDone && (
            <>
              <button
                onClick={() => onRestore(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95"
                style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.35)' }}
              >
                <RotateCcw size={13} /> Restore
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all active:scale-95"
                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.35)' }}
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
    <div className="mb-5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg mb-3 transition-all hover:opacity-90 active:scale-[0.99]"
        style={{ background: `${displayColor}12`, border: `1px solid ${displayColor}35` }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: displayColor, flexShrink: 0 }} />
        <span className="font-mono text-xs uppercase tracking-widest font-bold" style={{ color: displayColor }}>{topic}</span>
        <span className="font-mono text-[10px] text-muted font-bold ml-1">({items.length})</span>
        <span className="ml-auto" style={{ color: displayColor }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
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
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: getTopicColor(topic.name), flexShrink: 0 }} />
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
        <div className="rounded-xl mb-6 overflow-hidden shadow-sm" style={{ background: 'rgba(12, 15, 22, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <form onSubmit={handleCapture}>
            <textarea
              className="w-full bg-transparent p-4 font-mono text-sm text-primary resize-none outline-none placeholder:text-muted/50"
              style={{ minHeight: 90, caretColor: '#f59e0b', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
              placeholder="Awaiting intel transmission..."
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleCapture(e) }}
            />

            {/* Topic Selector */}
            <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Tag size={12} className="text-muted" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted font-bold">Topic</span>
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
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[9px] uppercase tracking-wider font-bold transition-all active:scale-95"
                  style={{
                    background: isFreeType ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-primary)',
                    color: isFreeType ? '#f59e0b' : 'var(--text-muted)',
                    border: `1px solid ${isFreeType ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                  }}
                >
                  <Plus size={10} /> New Topic
                </button>
              </div>

              {isFreeType ? (
                <input
                  autoFocus
                  className="w-full bg-transparent font-mono text-sm text-primary outline-none px-3 py-1.5 rounded-md"
                  style={{ border: '1px solid rgba(245, 158, 11, 0.6)', caretColor: '#f59e0b' }}
                  placeholder="Type new topic name..."
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                        style={{
                          background: isSelected ? `${color}25` : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? color : 'var(--text-muted)',
                          border: `1px solid ${isSelected ? color : 'rgba(255, 255, 255, 0.08)'}`,
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

            <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
              {effectiveTopic ? (
                <TopicBadge name={effectiveTopic} color={effectiveColor} />
              ) : <div />}
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="flex items-center gap-2 px-5 py-2 font-mono text-xs uppercase tracking-widest rounded-lg transition-all active:scale-95"
                style={{
                  background: canSubmit ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                  color: canSubmit ? '#000' : 'var(--text-muted)',
                  border: `1px solid ${canSubmit ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                  cursor: canSubmit && !saving ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                  opacity: saving ? 0.7 : 1
                }}
              >
                <Zap size={13} /> {saving ? 'TRANSMITTING...' : 'TRANSMIT'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-4 mb-5 border-b border-white/10 pb-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 py-2 px-1 font-mono text-xs uppercase tracking-widest transition-all relative shrink-0"
              style={{
                color: activeTab === tab.id ? '#f59e0b' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                fontWeight: activeTab === tab.id ? 700 : 500
              }}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span 
                  className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold inline-flex items-center justify-center" 
                  style={{ 
                    background: activeTab === tab.id ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)', 
                    color: activeTab === tab.id ? '#f59e0b' : 'var(--text-muted)',
                    border: `1px solid ${activeTab === tab.id ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`
                  }}
                >
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div layoutId="tabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#f59e0b' }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="flex items-center gap-2.5 mb-6 px-4 py-2.5 rounded-xl border border-white/10" style={{ background: 'rgba(12, 15, 22, 0.8)' }}>
          <Search size={14} className="text-muted shrink-0" />
          <input
            className="flex-1 bg-transparent font-mono text-xs text-primary outline-none placeholder:text-muted/60"
            placeholder="Search intel transmissions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="text-muted hover:text-primary"><X size={14} /></button>}
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
