'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isMissingSchema } from '@/lib/utils/schema'
import { saveSleepAction } from '@/lib/actions/sleepLog'

export const SLEEP_LOG_XP = 10

/** Sleep logs (newest first) + save. missing = sleep_logs table not created yet. */
export function useSleep(userId, days = 120) {
  const [state, setState] = useState({ logs: [], loading: true, missing: false })

  const load = useCallback(async () => {
    if (!userId) return
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const { data, error } = await createClient().from('sleep_logs').select('*').eq('user_id', userId).gte('date', since).order('date', { ascending: false })
    setState({ logs: error ? [] : data || [], loading: false, missing: isMissingSchema(error) })
  }, [userId, days])

  useEffect(() => {
    let cancelled = false
    if (!userId) return
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    createClient().from('sleep_logs').select('*').eq('user_id', userId).gte('date', since).order('date', { ascending: false })
      .then(({ data, error }) => { if (!cancelled) setState({ logs: error ? [] : data || [], loading: false, missing: isMissingSchema(error) }) })
    return () => { cancelled = true }
  }, [userId, days])

  /** Upsert the night ending on `date`; score is computed here and stored. */
  const save = useCallback(async ({ date, bedtime, wake_time, quality }) => {
    const res = await saveSleepAction({ userId, date, bedtime, wake_time, quality, logs: state.logs })
    if (res.error) return res
    setState((s) => ({ ...s, logs: [res.data, ...s.logs.filter((l) => l.date !== date)].sort((a, b) => b.date.localeCompare(a.date)) }))
    return res
  }, [userId, state.logs])

  return { ...state, save, reload: load }
}
