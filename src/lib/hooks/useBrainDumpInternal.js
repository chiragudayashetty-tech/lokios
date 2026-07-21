'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { XP_REWARDS } from '@/lib/constants'

// 10-color palette for topics
export const TOPIC_COLORS = [
  { name: 'Cyan',   value: '#22d3ee' },
  { name: 'Amber',  value: '#f59e0b' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Green',  value: '#22c55e' },
  { name: 'Red',    value: '#ef4444' },
  { name: 'Sky',    value: '#38bdf8' },
  { name: 'Pink',   value: '#ec4899' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Slate',  value: '#94a3b8' },
  { name: 'Bronze', value: '#cd7f32' },
]

const DEFAULT_TOPICS = [
  { name: 'General',       color: '#94a3b8' },
  { name: 'Startup Ideas', color: '#22d3ee' },
  { name: 'Business',      color: '#f59e0b' },
  { name: 'Health',        color: '#22c55e' },
  { name: 'Learning',      color: '#38bdf8' },
]

export function useBrainDumpInternal(user) {
  const [items, setItems]   = useState([])
  const [topics, setTopics] = useState(DEFAULT_TOPICS)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // ── Fetch items ──────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return }
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('brain_dump')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setItems(data || [])

      // Derive unique topics from existing data and merge with defaults
      const existingTopics = Array.from(
        new Map((data || []).map(i => [i.topic || 'General', i.topic_color || '#94a3b8'])).entries()
      ).map(([name, color]) => ({ name, color }))

      // Merge: defaults first, then any extra topics from DB
      const merged = [...DEFAULT_TOPICS]
      existingTopics.forEach(et => {
        if (!merged.find(m => m.name === et.name)) merged.push(et)
      })
      setTopics(merged)
    } catch (err) {
      console.error('Error fetching brain dump:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchItems() }, [fetchItems])

  // ── Add item ─────────────────────────────────────────────────────────────
  const addItem = useCallback(async (content, topic = 'General', topicColor = '#94a3b8') => {
    if (!user) return null
    try {
      const { data: newItem, error } = await supabase
        .from('brain_dump')
        .insert({ user_id: user.id, content, topic, topic_color: topicColor, status: 'inbox' })
        .select().single()
      if (error) throw error
      setItems(prev => [newItem, ...prev])

      // Ensure topic is saved in local list
      setTopics(prev => prev.find(t => t.name === topic) ? prev : [...prev, { name: topic, color: topicColor }])

      // Award XP
      await supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_amount: XP_REWARDS.brain_dump_capture || 5,
        p_source_type: 'brain_dump',
        p_source_id: newItem.id,
        p_description: `Intel Drop: ${topic}`,
        p_stat_category: 'discipline',
      })
      return newItem
    } catch (err) {
      console.error('Error adding brain dump item:', err)
      return null
    }
  }, [user])

  // ── Mark Done ────────────────────────────────────────────────────────────
  const doneItem = useCallback(async (id) => {
    if (!user) return false
    try {
      const { data: updated, error } = await supabase
        .from('brain_dump')
        .update({ status: 'done', done_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', user.id)
        .select().single()
      if (error) throw error
      setItems(prev => prev.map(i => i.id === id ? updated : i))
      return true
    } catch (err) {
      console.error('Error marking done:', err)
      return false
    }
  }, [user])

  // ── Discard (soft) ───────────────────────────────────────────────────────
  const discardItem = useCallback(async (id) => {
    if (!user) return false
    try {
      const { data: updated, error } = await supabase
        .from('brain_dump')
        .update({ status: 'discarded' })
        .eq('id', id).eq('user_id', user.id)
        .select().single()
      if (error) throw error
      setItems(prev => prev.map(i => i.id === id ? updated : i))
      return true
    } catch (err) {
      console.error('Error discarding item:', err)
      return false
    }
  }, [user])

  // ── Restore to inbox ─────────────────────────────────────────────────────
  const restoreItem = useCallback(async (id) => {
    if (!user) return false
    try {
      const { data: updated, error } = await supabase
        .from('brain_dump')
        .update({ status: 'inbox', done_at: null })
        .eq('id', id).eq('user_id', user.id)
        .select().single()
      if (error) throw error
      setItems(prev => prev.map(i => i.id === id ? updated : i))
      return true
    } catch (err) {
      console.error('Error restoring item:', err)
      return false
    }
  }, [user])

  // ── Delete Forever ───────────────────────────────────────────────────────
  const deleteItem = useCallback(async (id) => {
    if (!user) return false
    try {
      const { error } = await supabase
        .from('brain_dump').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
      setItems(prev => prev.filter(i => i.id !== id))
      return true
    } catch (err) {
      console.error('Error deleting item:', err)
      return false
    }
  }, [user])

  // ── Convert to Mission (Goal) ────────────────────────────────────────────
  const convertToMission = useCallback(async (id) => {
    if (!user) return null
    try {
      const item = items.find(i => i.id === id)
      if (!item) return null
      const { data, error } = await supabase
        .from('goals')
        .insert({ user_id: user.id, title: item.content, type: 'side_quest' })
        .select().single()
      if (error) throw error

      // Mark as done
      await doneItem(id)
      return { data }
    } catch (err) {
      console.error('Error converting to mission:', err)
      return { error: err }
    }
  }, [user, items, doneItem])

  // ── Rename topic (local only for now) ────────────────────────────────────
  const renameTopic = useCallback(async (oldName, newName) => {
    if (!user || !newName.trim()) return
    try {
      // Update all items with old topic name
      const { error } = await supabase
        .from('brain_dump')
        .update({ topic: newName })
        .eq('user_id', user.id)
        .eq('topic', oldName)
      if (error) throw error
      setTopics(prev => prev.map(t => t.name === oldName ? { ...t, name: newName } : t))
      setItems(prev => prev.map(i => i.topic === oldName ? { ...i, topic: newName } : i))
    } catch (err) {
      console.error('Error renaming topic:', err)
    }
  }, [user])

  // ── Delete topic ─────────────────────────────────────────────────────────
  const deleteTopic = useCallback(async (topicName) => {
    if (!user) return
    try {
      // Move all items under this topic to 'General'
      const { error } = await supabase
        .from('brain_dump')
        .update({ topic: 'General', topic_color: '#94a3b8' })
        .eq('user_id', user.id)
        .eq('topic', topicName)
      if (error) throw error
      setTopics(prev => prev.filter(t => t.name !== topicName))
      setItems(prev => prev.map(i => i.topic === topicName ? { ...i, topic: 'General', topic_color: '#94a3b8' } : i))
    } catch (err) {
      console.error('Error deleting topic:', err)
    }
  }, [user])

  return {
    items, topics, loading,
    addItem, doneItem, discardItem, restoreItem, deleteItem,
    convertToMission, renameTopic, deleteTopic,
    // legacy compat
    organizeItem: doneItem,
  }
}
