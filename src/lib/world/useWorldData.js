'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PAGE = 1000
async function paged(q) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await q().range(from, from + PAGE - 1)
    if (error) return rows
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return rows
  }
}

// Last good load per user, so the island draws instantly on the next visit.
const cacheKey = (uid) => `lokios_world_${uid}`

/** Everything the island is built from — all already-logged data, nothing new. */
export function useWorldData(userId) {
  const [state, setState] = useState({ data: null, loading: true })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey(userId)) || 'null')
      if (cached) setState({ data: cached, loading: true }) // eslint-disable-line react-hooks/set-state-in-effect
    } catch {}
    const sb = createClient()
    const mine = (t, sel) => () => sb.from(t).select(sel).eq('user_id', userId)
    Promise.all([
      paged(mine('habits', '*')),
      paged(() => mine('habit_logs', 'habit_id, date, status')().order('date')),
      paged(mine('tasks', 'id, title, status, completed_at, goal_id')),
      paged(mine('goals', 'id, title, status, created_at, completed_at, deadline, progress')),
      paged(mine('screen_time_logs', 'date, total_hours, categories, focus_hours, doom_scroll_minutes, streaming_hours')),
    ]).then(([habits, habitLogs, tasks, goals, screenLogs]) => {
      if (cancelled) return
      const data = { habits, habitLogs, tasks, goals, screenLogs }
      setState({ data, loading: false })
      try { localStorage.setItem(cacheKey(userId), JSON.stringify(data)) } catch {}
    })
    return () => { cancelled = true }
  }, [userId])

  return state
}
