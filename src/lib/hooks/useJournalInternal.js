'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr } from '@/lib/utils/dates'
import { XP_REWARDS } from '@/lib/constants'
import { robustAwardXP } from '@/lib/utils/xpFallback'

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
    const todayStr = getLocalDateStr()
    return entries.find((e) => e.date === todayStr) || null
  }, [entries])

  const saveEntry = useCallback(async (data) => {
    if (!user) return null

    const todayStr = getLocalDateStr()
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

        try {
          await robustAwardXP(user.id, xpAmount, 'journal_entry', result.id, `Journal entry for ${entryDate}`, 'discipline')
        } catch (xpErr) {
          console.error("XP Award Failed for journal:", xpErr)
        }
      }

      return result
    } catch (error) {
      console.error('Error saving journal entry:', error)
      if (typeof window !== 'undefined') {
        alert(`SYSTEM ERROR SAVING JOURNAL: ${error.message || JSON.stringify(error)}`)
      }
      return null
    }
  }, [user, entries])

  return { entries, todayEntry, loading, saveEntry }
}
