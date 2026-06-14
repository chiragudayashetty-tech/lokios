'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr } from '@/lib/utils/dates'
import { XP_REWARDS } from '@/lib/constants'

export function useBrainDumpInternal() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('brain_dump')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Error fetching brain dump items:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const addItem = useCallback(async (content, type = 'thought') => {
    if (!user) return null

    try {
      const { data: newItem, error } = await supabase
        .from('brain_dump')
        .insert({
          user_id: user.id,
          content,
          type: type,
        })
        .select()
        .single()

      if (error) throw error
      setItems((prev) => [newItem, ...prev])

      // Award small XP for brain dump
      await supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_amount: XP_REWARDS.brain_dump_capture,
        p_source_type: 'brain_dump',
        p_source_id: newItem.id,
        p_description: 'Brain dump entry',
        p_stat_category: 'discipline',
      })

      return newItem
    } catch (error) {
      console.error('Error adding brain dump item:', error)
      return null
    }
  }, [user])

  const organizeItem = useCallback(async (id) => {
    if (!user) return null

    try {
      const { data: updated, error } = await supabase
        .from('brain_dump')
        .update({ status: 'organized' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
      return { data: updated }
    } catch (error) {
      console.error('Error organizing brain dump item:', error)
      return { error }
    }
  }, [user])

  const discardItem = useCallback(async (id) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('brain_dump')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setItems((prev) => prev.filter((item) => item.id !== id))
      return true
    } catch (error) {
      console.error('Error discarding brain dump item:', error)
      return false
    }
  }, [user])

  const convertItem = useCallback(async (id, convertTo) => {
    if (!user) return null

    try {
      const item = items.find((i) => i.id === id)
      if (!item) return null

      // Create the target entity based on convertTo type
      let newEntity = null
      if (convertTo === 'task') {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: item.content,
            type: 'custom',
            due_date: getLocalDateStr(),
            category: 'other',
            difficulty: 'MEDIUM'
          })
          .select()
          .single()

        if (error) throw error
        newEntity = data
      } else if (convertTo === 'goal') {
        const { data, error } = await supabase
          .from('goals')
          .insert({
            user_id: user.id,
            title: item.content,
            type: 'side_quest',
          })
          .select()
          .single()

        if (error) throw error
        newEntity = data
      }

      // Mark the brain dump item as organized
      const orgResult = await organizeItem(id)
      if (orgResult?.error) throw orgResult.error

      return { data: newEntity }
    } catch (error) {
      console.error('Error converting brain dump item:', error)
      return { error }
    }
  }, [user, items, organizeItem])

  return { items, loading, addItem, organizeItem, discardItem, convertItem }
}
