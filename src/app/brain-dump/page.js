'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useBrainDump } from '@/lib/hooks/useBrainDump'
import { getRelativeTime } from '@/lib/utils/dates'

export default function BrainDump() {
  const { items, addItem, organizeItem, discardItem, convertItem } = useBrainDump()
  const [content, setContent] = useState('')
  const [type, setType] = useState('idea')
  const [filter, setFilter] = useState('inbox')

  const types = [
    { id: 'idea', icon: '💡', label: 'Idea' },
    { id: 'task', icon: '✅', label: 'Task' },
    { id: 'goal', icon: '🎯', label: 'Goal' },
    { id: 'note', icon: '📝', label: 'Note' },
    { id: 'random', icon: '🎲', label: 'Random' }
  ]

  const filters = ['inbox', 'organized', 'discarded', 'all']

  const handleCapture = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    await addItem(content.trim(), type)
    setContent('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCapture(e)
    }
  }

  const filteredItems = items.filter(item => filter === 'all' ? true : item.status === filter)

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">Brain Dump</h1>
          <p className="page-subtitle">Quick capture system. Instantly log your thoughts.</p>
        </header>

        {/* Capture Input */}
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-8)', borderColor: 'var(--accent-primary)' }}>
          <form onSubmit={handleCapture}>
            <textarea 
              className="textarea"
              placeholder="Dump your thoughts here... (Press Enter to capture)"
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, minHeight: '60px', fontSize: 'var(--text-lg-size)' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto' }}>
                {types.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    style={{
                      padding: 'var(--space-1) var(--space-3)',
                      background: type === t.id ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      color: type === t.id ? '#fff' : 'var(--text-secondary)',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-sm-size)',
                      border: type === t.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                    }}
                  >
                    <span>{t.icon}</span> <span className="hidden-mobile">{t.label}</span>
                  </button>
                ))}
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!content.trim()}>
                Capture <span style={{ opacity: 0.7, fontSize: '0.8em', marginLeft: '4px' }}>+2 XP</span>
              </button>
            </div>
          </form>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--border-color)' }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: 'var(--space-2) 0',
                background: 'none',
                color: filter === f ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: filter === f ? '2px solid var(--accent-primary)' : '2px solid transparent',
                textTransform: 'capitalize',
                fontWeight: filter === f ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {filteredItems.length > 0 ? (
            filteredItems.map(item => {
              const itemType = types.find(t => t.id === item.type) || types[4]
              return (
                <div key={item.id} className="card card-flat" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{getRelativeTime(item.created_at)}</span>
                    <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{itemType.icon} {itemType.label}</span>
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--space-4)' }}>{item.content}</p>
                  
                  {item.status === 'inbox' && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)' }}>
                      <button onClick={() => convertItem(item.id, 'task')} className="btn btn-ghost btn-sm">Convert to Task</button>
                      <button onClick={() => convertItem(item.id, 'goal')} className="btn btn-ghost btn-sm">Convert to Goal</button>
                      <div style={{ flex: 1 }}></div>
                      <button onClick={() => discardItem(item.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }}>Discard</button>
                      <button onClick={() => organizeItem(item.id)} className="btn btn-secondary btn-sm">Mark Organized</button>
                    </div>
                  )}
                  {item.status !== 'inbox' && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)' }}>
                      {item.status === 'discarded' ? 'Discarded' : `Organized ${item.converted_to ? `as ${item.converted_to}` : ''}`}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="empty-state" style={{ textAlign: 'center', padding: 'var(--space-12) 0', color: 'var(--text-muted)' }}>
              Empty. Nothing here right now.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
