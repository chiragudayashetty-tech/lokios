'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Brain, Search, X, Hash, Inbox, StickyNote, Lightbulb, Archive, PartyPopper, RotateCcw, Trash2, CheckSquare, Rocket } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import SchemaHint from '@/components/ui/SchemaHint'
import CaptureBar from '@/components/braindump/CaptureBar'
import InboxStack from '@/components/braindump/InboxStack'
import NoteEditor from '@/components/braindump/NoteEditor'
import StaleReview from '@/components/braindump/StaleReview'
import { NewTaskSheet } from '@/components/tasks/TaskModals'
import { useOSSlice } from '@/lib/context/OSContext'
import { getLocalDateStr } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { emitGame } from '@/lib/utils/gamification'
import { celebrateBig } from '@/lib/utils/celebrate'
import { kindOf, tagsOf, textOf, ageLabel, isTrashed, titleOf } from '@/lib/utils/brainDump'

const TABS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'note', label: 'Notes', icon: StickyNote },
  { id: 'idea', label: 'Ideas', icon: Lightbulb },
  { id: 'archived', label: 'Archive', icon: Archive },
]
const INBOX_ZERO_XP = 15

export default function BrainDumpPage() {
  const { user } = useOSSlice('auth')
  const bd = useOSSlice('brainDump')
  const { items = [], loading, hasKind } = bd
  const { goals = [] } = useOSSlice('goals')
  const { addTask, boardSchema } = useOSSlice('tasks')
  const today = getLocalDateStr()
  const [tab, setTab] = useState('inbox')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState(null)
  const [editing, setEditing] = useState(null)
  const [taskFrom, setTaskFrom] = useState(null) // item being turned into a task
  const [now] = useState(() => Date.now())
  const [zero, setZero] = useState(false)
  const prevInbox = useRef(null)

  const inbox = useMemo(() => items.filter((i) => kindOf(i) === 'inbox').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))), [items])
  const allTags = useMemo(() => [...new Set(items.flatMap(tagsOf))].sort(), [items])
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, items.filter((i) => kindOf(i) === t.id).length])), [items])

  // Inbox zero: celebrate when processing empties the inbox (+15 XP once per day)
  useEffect(() => {
    if (loading) return
    const n = inbox.length
    if (prevInbox.current > 0 && n === 0 && user?.id) {
      setZero(true)
      celebrateBig()
      robustAwardXP(user.id, INBOX_ZERO_XP, 'inbox_zero', `inbox_zero_${today}`, '📥 Inbox zero', 'discipline')
      emitGame('toast', { icon: 'inbox', title: 'Inbox zero!', sub: `Everything processed · +${INBOX_ZERO_XP} XP`, tone: 'gold' })
    }
    prevInbox.current = n
  }, [inbox.length, loading, user?.id, today])

  const searching = !!(query.trim() || tag)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (tag && !tagsOf(i).includes(tag)) return false
      if (q && !`${i.content} ${tagsOf(i).join(' ')}`.toLowerCase().includes(q)) return false
      if (!searching && kindOf(i) !== tab) return false
      return true
    })
  }, [items, query, tag, tab, searching])

  const trash = (item) => bd.trashItem(item.id)
  const toMission = async (item) => {
    const res = await bd.convertToMission(item.id, titleOf(item))
    if (!res?.error) emitGame('toast', { icon: 'target', title: 'Mission idea saved', sub: 'Draft mission (paused) — open Missions to shape it', tone: 'accent' })
  }
  const keep = (item, kind) => bd.setKind(item.id, kind)

  if (loading && !items.length) return <AppShell><WinterLoader label="Loading brain dump" /></AppShell>

  return (
    <AppShell>
      <div className="page-container bd-page">
        <header className="tk-head">
          <div>
            <h1 className="page-title flex items-center gap-3"><Brain className="text-amber" /> Brain dump</h1>
            <p className="page-subtitle">Capture fast. Process to zero.</p>
          </div>
        </header>

        <CaptureBar onCapture={(text) => bd.addItem(text, 'inbox')} />
        {hasKind === false && <SchemaHint feature="Notes, ideas, tags and conversions" />}

        <div className="bd-tools">
          <label className="tk-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search everything" aria-label="Search brain dump" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}
          </label>
          {allTags.length > 0 && (
            <div className="tk-chips">
              {allTags.map((t) => <button key={t} type="button" className={`tk-chip ${tag === t ? 'is-on' : ''}`} onClick={() => setTag(tag === t ? null : t)}><Hash size={11} />{t}</button>)}
            </div>
          )}
        </div>

        {!searching && (
          <div className="tl-tabs" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
                <Icon size={13} /> {label} {counts[id] > 0 && <span className={id === 'inbox' ? 'bd-badge' : ''}>{counts[id]}</span>}
              </button>
            ))}
          </div>
        )}

        {!searching && tab === 'inbox' && new Date().getDay() === 0 && <StaleReview />}

        {!searching && tab === 'inbox' ? (
          inbox.length ? (
            <InboxStack items={inbox} now={now} onTask={setTaskFrom} onTrash={trash} onMission={toMission} onOpen={setEditing} onKeep={keep} />
          ) : (
            <div className={`bd-zero ${zero ? 'is-party' : ''}`}>
              <PartyPopper size={34} />
              <h2>Inbox zero</h2>
              <p>{zero ? `Everything processed — +${INBOX_ZERO_XP} XP.` : 'Nothing waiting. Capture the next thought above.'}</p>
            </div>
          )
        ) : (
          <div className="bd-list">
            {results.length === 0 && <div className="tb-empty"><p>{searching ? 'No matches.' : 'Nothing here yet.'}</p></div>}
            {results.map((i) => {
              const k = kindOf(i)
              const conv = i.converted_to || ''
              return (
                <article key={i.id} className={`bd-item ${isTrashed(i) ? 'is-trashed' : ''}`} onClick={() => setEditing(i)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setEditing(i) }}>
                  <div className="bd-item-meta">
                    {searching && <span className="bd-kind">{TABS.find((t) => t.id === k)?.label}</span>}
                    {conv.startsWith('task:') && <span className="bd-kind is-task"><CheckSquare size={10} /> Task</span>}
                    {conv.startsWith('goal:') && <span className="bd-kind is-goal"><Rocket size={10} /> Mission</span>}
                    {isTrashed(i) && <span className="bd-kind is-trash"><Trash2 size={10} /> Trashed</span>}
                    {tagsOf(i).map((t) => <span key={t} className="bd-tag"><Hash size={10} />{t}</span>)}
                    <span className="bd-age">{ageLabel(i, now)}</span>
                  </div>
                  <p className="bd-text">{textOf(i)}</p>
                  {k === 'archived' && (
                    <div className="bd-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="td-link" onClick={() => bd.restoreItem(i.id)}><RotateCcw size={13} /> Back to inbox</button>
                      {isTrashed(i) && <button type="button" className="td-link is-danger" onClick={() => bd.deleteItem(i.id)}><Trash2 size={13} /> Delete forever</button>}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {editing && (
          <NoteEditor
            key={editing.id}
            item={editing}
            hasKind={hasKind}
            onClose={() => setEditing(null)}
            onSave={bd.updateItem}
            onDelete={async (it) => { await bd.deleteItem(it.id); setEditing(null) }}
          />
        )}

        <NewTaskSheet
          key={taskFrom ? `bd_${taskFrom.id}` : 'closed'}
          open={!!taskFrom}
          preset={{ due_date: today }}
          goals={goals}
          today={today}
          schemaReady={boardSchema}
          initialTitle={taskFrom ? titleOf(taskFrom) : ''}
          initialNotes={taskFrom && textOf(taskFrom).includes('\n') ? textOf(taskFrom) : ''}
          onClose={() => setTaskFrom(null)}
          onCreate={async (payload) => {
            const res = await addTask(payload)
            if (!res?.error && taskFrom) {
              await bd.markConverted(taskFrom.id, `task:${res.data.id}`)
              emitGame('toast', { icon: 'check', title: 'Task created', sub: payload.title, tone: 'success' })
            }
            return res
          }}
        />
      </div>
    </AppShell>
  )
}
