'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { XP_REWARDS } from '@/lib/constants'

export function useJournalInternal() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setEntries([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) throw error
      setEntries(data || [])
    } catch (error) {
      console.error('Error fetching journal entries:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const todayEntry = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    return entries.find((e) => e.date === todayStr) || null
  }, [entries])

  const saveEntry = useCallback(async (data) => {
    if (!user) return null

    const todayStr = new Date().toISOString().split('T')[0]
    const entryDate = data.date || todayStr

    try {
      // Check if entry already exists for this date
      const existing = entries.find((e) => e.date === entryDate)

      let result
      if (existing) {
        // Update existing entry
        const { data: updated, error } = await supabase
          .from('journal_entries')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error
        result = updated
        setEntries((prev) => prev.map((e) => (e.id === existing.id ? updated : e)))
      } else {
        // Create new entry
        const { data: newEntry, error } = await supabase
          .from('journal_entries')
          .insert({ ...data, user_id: user.id, date: entryDate })
          .select()
          .single()

        if (error) throw error
        result = newEntry
        setEntries((prev) => [newEntry, ...prev])

        // Award XP only for new entries
        const isFull = data.content && data.content.length >= 100 && data.mood
        const xpAmount = isFull ? XP_REWARDS.journal_full : XP_REWARDS.journal_partial

        await supabase.rpc('award_xp', {
          p_user_id: user.id,
          p_amount: xpAmount,
          p_source_type: 'journal_entry',
          p_source_id: result.id,
          p_description: `Journal entry for ${entryDate}`,
          p_stat_category: 'discipline',
        })
      }

      return result
    } catch (error) {
      console.error('Error saving journal entry:', error)
      return null
    }
  }, [user, entries])

  return { entries, todayEntry, loading, saveEntry }
}
