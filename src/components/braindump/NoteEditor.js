'use client'

import { useState } from 'react'
import { Trash2, Inbox, StickyNote, Lightbulb, Archive } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import { parseCapture, tagsOf, textOf, kindOf } from '@/lib/utils/brainDump'

const KIND_OPTS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'note', label: 'Note', icon: StickyNote },
  { id: 'idea', label: 'Idea', icon: Lightbulb },
  { id: 'archived', label: 'Archive', icon: Archive },
]

/** Edit an item's text, #tags and kind. */
export default function NoteEditor({ item, hasKind, onClose, onSave, onDelete }) {
  const initial = `${textOf(item)}${tagsOf(item).length ? `\n${tagsOf(item).map((t) => `#${t}`).join(' ')}` : ''}`
  const [value, setValue] = useState(initial)
  const [kind, setKind] = useState(kindOf(item))
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const { text, tags } = parseCapture(value)
    const patch = hasKind === false ? { content: value.trim() } : { content: text || value.trim(), tags, kind }
    if (kind === 'inbox') patch.status = 'inbox'
    const res = await onSave(item.id, patch)
    setBusy(false)
    if (!res?.error) onClose()
  }

  return (
    <Sheet open={!!item} onClose={onClose} title="Edit capture" subtitle={item?.converted_to?.startsWith('task:') ? 'Converted to a task' : item?.converted_to?.startsWith('goal:') ? 'Converted to a mission' : null}>
      <div className="td">
        <textarea className="textarea ne-text" rows={8} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Text" autoFocus />
        {hasKind !== false && (
          <div className="td-field">
            <span className="td-label">Keep it in</span>
            <div className="td-seg ne-kinds">
              {KIND_OPTS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" className={kind === id ? 'is-on' : ''} style={{ '--pr': 'var(--accent-primary)' }} onClick={() => setKind(id)}><Icon size={12} /> {label}</button>
              ))}
            </div>
          </div>
        )}
        <button type="button" className="btn btn-primary td-submit" onClick={save} disabled={busy || !value.trim()}>{busy ? 'Saving…' : 'Save'}</button>
        <div className="td-danger-row">
          <button type="button" className="td-link is-danger" onClick={() => onDelete(item)}><Trash2 size={14} /> Delete forever</button>
        </div>
      </div>
    </Sheet>
  )
}
