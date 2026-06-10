'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export function useCalendar(year, month) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Build date range for the given month
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
    }
  }, [user, year, month])

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
      return updated
    } catch (error) {
      console.error('Error updating calendar event:', error)
      return null
    }
  }, [user])

  const deleteEvent = useCallback(async (id) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setEvents((prev) => prev.filter((e) => e.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting calendar event:', error)
      return false
    }
  }, [user])

  return { events, loading, addEvent, updateEvent, deleteEvent }
}
