'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isMissingSchema } from '@/lib/utils/schema'

// Fire-and-forget mirror to Google Calendar (never blocks or throws)
function syncToGoogle(action, event, userId) {
  fetch('/api/google/sync-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, itemType: 'event', item: event, userId }),
  }).catch(() => {})
}

/**
 * Calendar events + habit logs for an arbitrary date range (week / 3-day /
 * month views can cross months, unlike the month-scoped context slice).
 * blockColumns = whether calendar_events has task_id / category / completed.
 */
export function useCalendarRange(userId, fromStr, toStr) {
  const [state, setState] = useState({ events: [], logs: [], loading: true, key: null, blockColumns: null })
  const key = `${userId}_${fromStr}_${toStr}`
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const sb = createClient()
    const from = new Date(`${fromStr}T00:00:00`).toISOString()
    const to = new Date(`${toStr}T23:59:59`).toISOString()
    Promise.all([
      sb.from('calendar_events').select('*').eq('user_id', userId).gte('start_time', from).lte('start_time', to).order('start_time'),
      sb.from('habit_logs').select('habit_id, date, status').eq('user_id', userId).gte('date', fromStr).lte('date', toStr),
    ]).then(([ev, lg]) => {
      if (cancelled) return
      const events = ev.data || []
      setState((s) => ({
        events,
        logs: lg.data || [],
        loading: false,
        key,
        blockColumns: events.length ? 'task_id' in events[0] : s.blockColumns,
      }))
    })
    return () => { cancelled = true }
  }, [userId, fromStr, toStr, key, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  const addEvent = useCallback(async (data) => {
    const { data: row, error } = await createClient().from('calendar_events').insert({ ...data, user_id: userId }).select().single()
    if (error) {
      if (isMissingSchema(error)) setState((s) => ({ ...s, blockColumns: false }))
      return { error, missing: isMissingSchema(error) }
    }
    setState((s) => ({ ...s, events: [...s.events, row], blockColumns: s.blockColumns ?? 'task_id' in row }))
    syncToGoogle('create', row, userId)
    return { data: row }
  }, [userId])

  const updateEvent = useCallback(async (id, patch) => {
    let prev = null
    setState((s) => ({ ...s, events: s.events.map((e) => { if (e.id !== id) return e; prev = e; return { ...e, ...patch } }) }))
    const { data: row, error } = await createClient().from('calendar_events').update(patch).eq('id', id).eq('user_id', userId).select().single()
    if (error) {
      if (prev) setState((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? prev : e)) }))
      return { error }
    }
    setState((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? row : e)) }))
    syncToGoogle('update', row, userId)
    return { data: row }
  }, [userId])

  const deleteEvent = useCallback(async (id) => {
    let removed = null
    setState((s) => ({ ...s, events: s.events.filter((e) => { if (e.id === id) removed = e; return e.id !== id }) }))
    const { error } = await createClient().from('calendar_events').delete().eq('id', id).eq('user_id', userId)
    if (error) {
      if (removed) setState((s) => ({ ...s, events: [...s.events, removed] }))
      return { error }
    }
    if (removed) syncToGoogle('delete', removed, userId)
    return { ok: true }
  }, [userId])

  const current = state.key === key
  return { events: current ? state.events : [], logs: current ? state.logs : [], loading: !current, blockColumns: state.blockColumns, addEvent, updateEvent, deleteEvent, reload }
}
