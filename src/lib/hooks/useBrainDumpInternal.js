'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { XP_REWARDS } from '@/lib/constants'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import { isMissingSchema } from '@/lib/utils/schema'
import { parseCapture, kindOf } from '@/lib/utils/brainDump'

// 10-color palette for topics (kept for older screens / exports)
export const TOPIC_COLORS = [
  { name: 'Cyan', value: '#22d3ee' }, { name: 'Amber', value: '#f59e0b' }, { name: 'Purple', value: '#a855f7' },
  { name: 'Green', value: '#22c55e' }, { name: 'Red', value: '#ef4444' }, { name: 'Sky', value: '#38bdf8' },
  { name: 'Pink', value: '#ec4899' }, { name: 'Yellow', value: '#eab308' }, { name: 'Slate', value: '#94a3b8' },
  { name: 'Bronze', value: '#cd7f32' },
]
export const DEFAULT_TOPICS = [
  { name: 'General', color: '#94a3b8' }, { name: 'Startup Ideas', color: '#22d3ee' }, { name: 'Business', color: '#f59e0b' },
  { name: 'Health', color: '#22c55e' }, { name: 'Learning', color: '#38bdf8' },
]
export function getTopicColor(name) {
  if (!name) return '#94a3b8'
  const match = DEFAULT_TOPICS.find(t => t.name.toLowerCase() === name.toLowerCase())
  if (match) return match.color
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return TOPIC_COLORS[Math.abs(hash) % TOPIC_COLORS.length].value
}

/** Status values the legacy schema accepts for each kind (round-2 kind column absent). */
const LEGACY_STATUS = { inbox: 'inbox', note: 'done', idea: 'done', archived: 'done' }

export function useBrainDumpInternal(user) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasKind, setHasKind] = useState(null) // round-2 columns (kind, tags, converted_to)
  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return }
    const { data, error } = await supabase.from('brain_dump').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (!error) {
      setItems(data || [])
      if (data?.length) setHasKind('kind' in data[0])
    } else console.error('Error fetching brain dump:', error)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchItems() }, [fetchItems])

  const patchLocal = (id, patch) => setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))

  /** Update an item; round-2 fields are dropped (and remembered) when the columns don't exist. */
  const updateItem = useCallback(async (id, patch) => {
    if (!user) return { error: 'Not signed in' }
    let body = { ...patch }
    if (hasKind === false) {
      if (body.kind) body.status = body.converted_to === 'trash' ? 'discarded' : LEGACY_STATUS[body.kind]
      delete body.kind; delete body.tags; delete body.converted_to
    }
    const prev = items.find(i => i.id === id)
    patchLocal(id, patch)
    let { data, error } = await supabase.from('brain_dump').update(body).eq('id', id).eq('user_id', user.id).select().single()
    if (error && isMissingSchema(error) && ('kind' in body || 'tags' in body || 'converted_to' in body)) {
      setHasKind(false)
      if (body.kind) body.status = body.converted_to === 'trash' ? 'discarded' : LEGACY_STATUS[body.kind]
      delete body.kind; delete body.tags; delete body.converted_to
      ;({ data, error } = await supabase.from('brain_dump').update(body).eq('id', id).eq('user_id', user.id).select().single())
    }
    if (error) {
      // status check constraints differ between installs: retry with a safe value
      if (body.status && (error.code === '23514' || /status_check/.test(error.message || ''))) {
        ;({ data, error } = await supabase.from('brain_dump').update({ ...body, status: body.status === 'discarded' ? 'discarded' : 'organized' }).eq('id', id).eq('user_id', user.id).select().single())
      }
      if (error) { if (prev) patchLocal(id, prev); return { error } }
    }
    setItems(p => p.map(i => (i.id === id ? { ...data, ...(hasKind === false ? { kind: patch.kind, converted_to: patch.converted_to } : {}) } : i)))
    return { data }
  }, [user, items, hasKind])

  /** Capture: "#tags" are parsed out of the text. */
  const addItem = useCallback(async (raw, kind = 'inbox') => {
    if (!user) return { error: 'Not signed in' }
    const { text, tags } = parseCapture(raw)
    if (!text && !tags.length) return { error: 'Empty' }
    const base = { user_id: user.id, topic: 'General', type: 'note', status: 'inbox' }
    let payload = hasKind === false ? { ...base, content: raw.trim() } : { ...base, content: text || raw.trim(), tags, kind }
    let { data, error } = await supabase.from('brain_dump').insert(payload).select().single()
    if (error && isMissingSchema(error)) {
      setHasKind(false)
      payload = { ...base, content: raw.trim() } // keep #tags inline so nothing is lost
      ;({ data, error } = await supabase.from('brain_dump').insert(payload).select().single())
      if (error && /topic/.test(error.message || '')) { delete payload.topic; ({ data, error } = await supabase.from('brain_dump').insert(payload).select().single()) }
    }
    if (error && (error.code === '23514' || /type_check/.test(error.message || ''))) {
      delete payload.type
      ;({ data, error } = await supabase.from('brain_dump').insert(payload).select().single())
    }
    if (error) { console.error('Error adding brain dump item:', error); return { error } }
    if (hasKind === null) setHasKind('kind' in data)
    setItems(prev => [data, ...prev])
    return { data }
  }, [user, hasKind])

  // XP only for finishing an item (done / converted to a task or mission), never for capturing,
  // and it is taken back if the item is moved back out of the archive.
  const doneXp = useCallback((id) => user && robustAwardXP(user.id, XP_REWARDS.brain_dump_capture || 2, 'brain_dump', `bd_done_${id}`, 'Brain dump item done', 'discipline').catch(() => {}), [user])
  const undoXp = useCallback((id) => user && robustRemoveXP(user.id, 'brain_dump', `bd_done_${id}`).catch(() => {}), [user])
  const setKind = useCallback(async (id, kind) => {
    const res = await updateItem(id, { kind, ...(kind === 'inbox' ? { status: 'inbox', converted_to: null } : {}) })
    if (kind === 'archived') doneXp(id)
    if (kind === 'inbox') undoXp(id)
    return res
  }, [updateItem, doneXp, undoXp])
  const trashItem = useCallback((id) => updateItem(id, { kind: 'archived', converted_to: 'trash', status: 'discarded' }), [updateItem])
  const restoreItem = useCallback(async (id) => {
    const res = await updateItem(id, { kind: 'inbox', converted_to: null, status: 'inbox' })
    undoXp(id)
    return res
  }, [updateItem, undoXp])
  const markConverted = useCallback(async (id, ref) => {
    const res = await updateItem(id, { kind: 'archived', converted_to: ref, status: 'converted' })
    doneXp(id)
    return res
  }, [updateItem, doneXp])

  const deleteItem = useCallback(async (id) => {
    if (!user) return false
    const { error } = await supabase.from('brain_dump').delete().eq('id', id).eq('user_id', user.id)
    if (error) { console.error('Error deleting item:', error); return false }
    setItems(prev => prev.filter(i => i.id !== id))
    return true
  }, [user])

  /** Draft mission from an idea; the item is archived with converted_to = goal:<id>. */
  const convertToMission = useCallback(async (id, title) => {
    if (!user) return { error: 'Not signed in' }
    const item = items.find(i => i.id === id)
    if (!item) return { error: 'Not found' }
    const { data, error } = await supabase.from('goals').insert({ user_id: user.id, title: title || item.content.slice(0, 140), type: 'side_quest', status: 'paused', description: `[Draft from brain dump]\n\n${item.content}` }).select().single()
    if (error) return { error }
    await markConverted(id, `goal:${data.id}`)
    return { data }
  }, [user, items, markConverted])

  return {
    items, loading, hasKind, fetchItems,
    addItem, updateItem, setKind, trashItem, restoreItem, deleteItem, markConverted, convertToMission,
    inboxCount: items.filter(i => kindOf(i) === 'inbox').length,
    // legacy names
    topics: DEFAULT_TOPICS, doneItem: (id) => setKind(id, 'archived'), discardItem: trashItem,
  }
}
