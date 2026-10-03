'use client'

import { useState } from 'react'
import { Plus, ExternalLink, Code2, Video, Link2, Pencil, Trash2, ImagePlus, X, TrendingUp, Briefcase } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import SchemaHint from '@/components/ui/SchemaHint'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'

const LINK_KINDS = [
  { id: 'live', label: 'Live', icon: ExternalLink },
  { id: 'repo', label: 'Repo', icon: Code2 },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'other', label: 'Link', icon: Link2 },
]
const linkIcon = (kind) => (LINK_KINDS.find((k) => k.id === kind) || LINK_KINDS[3]).icon

async function uploadCover(userId, file) {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  const path = `${userId}/work-${Date.now()}.jpg`
  const sb = createClient()
  const { error } = await sb.storage.from('portfolio').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  return sb.storage.from('portfolio').getPublicUrl(path).data.publicUrl
}

function WorkForm({ userId, item, goals, onSave, onClose }) {
  const [f, setF] = useState(() => ({
    title: item?.title || '',
    impact: item?.impact || '',
    description: item?.description || '',
    cover_url: item?.cover_url || '',
    tags: (item?.tags || []).join(', '),
    shipped_on: item?.shipped_on || getLocalDateStr(),
    goal_id: item?.goal_id || '',
    links: item?.links?.length ? item.links : [{ kind: 'live', label: '', url: '' }],
  }))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))
  const setLink = (i, patch) => setF((x) => ({ ...x, links: x.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))

  const onFile = async (file) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try { const url = await uploadCover(userId, file); setF((x) => ({ ...x, cover_url: url })) } catch (e) { setError(/bucket|not found/i.test(e?.message || '') ? 'The portfolio storage bucket is missing — run the round-2 migration.' : `Upload failed: ${e?.message || e}`) }
    setUploading(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!f.title.trim()) return
    setBusy(true)
    const res = await onSave({
      title: f.title.trim(),
      impact: f.impact.trim() || null,
      description: f.description.trim() || null,
      cover_url: f.cover_url || null,
      tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      shipped_on: f.shipped_on || null,
      goal_id: f.goal_id || null,
      links: f.links.filter((l) => l.url.trim()).map((l) => ({ kind: l.kind, label: l.label.trim() || null, url: l.url.trim() })),
    })
    setBusy(false)
    if (res?.error) setError(res.error.message); else onClose()
  }

  return (
    <form className="td" onSubmit={submit}>
      <label className={`wg-cover-drop ${f.cover_url ? 'has-img' : ''}`}>
        {f.cover_url ? <img src={f.cover_url} alt="" /> : <span><ImagePlus size={22} /> {uploading ? 'Uploading…' : 'Add a cover image'}</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {f.cover_url && <button type="button" className="td-link" onClick={() => set('cover_url')('')}><X size={13} /> Remove image</button>}
      <input className="input" value={f.title} onChange={set('title')} placeholder="What did you ship?" autoFocus aria-label="Title" />
      <input className="input" value={f.impact} onChange={set('impact')} placeholder="Impact, e.g. +12% conversions, 40 students trained" aria-label="Impact" />
      <textarea className="textarea" rows={3} value={f.description} onChange={set('description')} placeholder="What it is and your role" aria-label="Description" />
      <div className="td-grid">
        <div className="td-field"><label className="td-label" htmlFor="wf-date">Shipped</label><input id="wf-date" className="input" type="date" value={f.shipped_on} onChange={set('shipped_on')} /></div>
        <div className="td-field"><label className="td-label" htmlFor="wf-goal">Mission</label><select id="wf-goal" className="select" value={f.goal_id} onChange={set('goal_id')}><option value="">None</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></div>
      </div>
      <input className="input" value={f.tags} onChange={set('tags')} placeholder="Tags, comma separated" aria-label="Tags" />
      <div className="td-field">
        <span className="td-label">Links</span>
        {f.links.map((l, i) => (
          <div key={i} className="wf-link">
            <select className="select" value={l.kind} onChange={(e) => setLink(i, { kind: e.target.value })} aria-label="Link type">{LINK_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
            <input className="input" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://" aria-label="URL" />
            <button type="button" className="td-icon-btn" onClick={() => setF((x) => ({ ...x, links: x.links.filter((_, j) => j !== i) }))} aria-label="Remove link"><X size={14} /></button>
          </div>
        ))}
        <button type="button" className="td-link" onClick={() => setF((x) => ({ ...x, links: [...x.links, { kind: 'other', label: '', url: '' }] }))}><Plus size={13} /> Add link</button>
      </div>
      {error && <p className="tm-warn">{error}</p>}
      <button type="submit" className="btn btn-primary td-submit" disabled={busy || uploading || !f.title.trim()}>{busy ? 'Saving…' : item ? 'Save' : 'Add to portfolio'}</button>
    </form>
  )
}

/** Portfolio → Work (#38): masonry gallery of shipped work. */
export default function WorkGallery({ userId, items, missing, goals, onInsert, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(null) // item | 'new'
  if (missing) return <SchemaHint feature="The work gallery" />
  const sorted = [...items].sort((a, b) => String(b.shipped_on || b.created_at).localeCompare(String(a.shipped_on || a.created_at)))
  return (
    <div className="wgal">
      <div className="wgal-bar"><button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={14} /> Add work</button></div>
      {sorted.length === 0 ? (
        <div className="tb-empty"><div className="tb-empty-art"><Briefcase size={22} /></div><p>Show what you shipped — a cover, an impact line and links.</p><button type="button" className="tb-empty-cta" onClick={() => setEditing('new')}><Plus size={13} /> Add your first piece</button></div>
      ) : (
        <div className="wgal-masonry">
          {sorted.map((it) => (
            <article key={it.id} className="wgal-card">
              {it.cover_url && <img className="wgal-cover" src={it.cover_url} alt="" loading="lazy" />}
              <div className="wgal-body">
                <div className="wgal-top">
                  <b className="wgal-title">{it.title}</b>
                  <span className="wgal-date">{it.shipped_on ? new Date(`${it.shipped_on}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}</span>
                </div>
                {it.impact && <span className="wgal-impact"><TrendingUp size={12} /> {it.impact}</span>}
                {it.description && <p className="wgal-desc">{it.description}</p>}
                {(it.tags || []).length > 0 && <div className="wgal-tags">{it.tags.map((t) => <span key={t} className="tb-chip">{t}</span>)}</div>}
                <div className="wgal-foot">
                  {(it.links || []).map((l) => { const Icon = linkIcon(l.kind); return <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="wgal-link"><Icon size={13} /> {l.label || LINK_KINDS.find((k) => k.id === l.kind)?.label || 'Link'}</a> })}
                  <span className="wgal-actions">
                    <button type="button" className="tl-icon" onClick={() => setEditing(it)} aria-label={`Edit ${it.title}`}><Pencil size={13} /></button>
                    <button type="button" className="tl-icon is-danger" onClick={() => { if (window.confirm(`Remove "${it.title}" from your portfolio?`)) onRemove(it.id) }} aria-label={`Delete ${it.title}`}><Trash2 size={13} /></button>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add work' : 'Edit work'}>
        {editing && <WorkForm key={editing === 'new' ? 'new' : editing.id} userId={userId} item={editing === 'new' ? null : editing} goals={goals} onClose={() => setEditing(null)} onSave={(row) => (editing === 'new' ? onInsert(row) : onUpdate(editing.id, row))} />}
      </Sheet>
    </div>
  )
}
