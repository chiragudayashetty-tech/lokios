'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Fire-and-forget sync to Google Calendar (non-blocking, never throws)
async function syncToGoogle(action, event, userId) {
  try {
    await fetch('/api/google/sync-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, itemType: 'event', item: event, userId }),
    })
  } catch {
    // Silently fail — Google sync should never break the local app
  }
}

export function useCalendarInternal(user, year = new Date().getFullYear(), month = new Date().getMonth()) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([])
      setLoading(false)
      return
    }

    try {
      if (!initialized) setLoading(true)

      const startDate = new Date(year, month, 1).toISOString()
      const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', startDate)
        .lte('start_time', endDate)
        .order('start_time', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching calendar events:', error)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [user, year, month, initialized])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const addEvent = useCallback(async (data) => {
    if (!user) return null
    try {
      const { data: newEvent, error } = await supabase
        .from('calendar_events')
        .insert({ ...data, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      setEvents((prev) => [...prev, newEvent].sort(
        (a, b) => new Date(a.start_time) - new Date(b.start_time)
      ))
      // Sync to Google Calendar (fire-and-forget)
      syncToGoogle('create', newEvent, user.id)
      return newEvent
    } catch (error) {
      console.error('Error adding calendar event:', error)
      return null
    }
  }, [user])

  const updateEvent = useCallback(async (id, data) => {
    if (!user) return null
    try {
      const { data: updated, error } = await supabase
        .from('calendar_events')
        .update(data)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setEvents((prev) =>
        prev
          .map((e) => (e.id === id ? updated : e))
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      )
      // Sync to Google Calendar (fire-and-forget)
      syncToGoogle('update', updated, user.id)
      return updated
    } catch (error) {
      console.error('Error updating calendar event:', error)
      return null
    }
  }, [user])

  const deleteEvent = useCallback(async (id) => {
    if (!user) return false
    try {
      // Fetch first to get google_event_id before deleting
      const { data: toDelete } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setEvents((prev) => prev.filter((e) => e.id !== id))
      // Sync deletion to Google Calendar (fire-and-forget)
      if (toDelete) syncToGoogle('delete', toDelete, user.id)
      return true
    } catch (error) {
      console.error('Error deleting calendar event:', error)
      return false
    }
  }, [user])

  return { events, loading, fetchEvents, addEvent, updateEvent, deleteEvent }
}
