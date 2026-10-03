'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isMissingSchema } from '@/lib/utils/schema'

/**
 * Owner rows of a round-2 table with simple CRUD. missing = the table isn't
 * there yet (migration not run). order = [column, ascending].
 */
export function useTable(table, userId, { order = ['created_at', true] } = {}) {
  const [state, setState] = useState({ rows: [], loading: true, missing: false })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    createClient().from(table).select('*').eq('user_id', userId).order(order[0], { ascending: order[1] })
      .then(({ data, error }) => { if (!cancelled) setState({ rows: error ? [] : data || [], loading: false, missing: isMissingSchema(error) }) })
    return () => { cancelled = true }
  }, [table, userId, order[0], order[1], version]) // eslint-disable-line react-hooks/exhaustive-deps

  const insert = useCallback(async (row) => {
    const { data, error } = await createClient().from(table).insert({ ...row, user_id: userId }).select().single()
    if (error) return { error }
    setState((s) => ({ ...s, rows: [...s.rows, data] }))
    return { data }
  }, [table, userId])

  const update = useCallback(async (id, patch) => {
    const { data, error } = await createClient().from(table).update(patch).eq('id', id).eq('user_id', userId).select().single()
    if (error) return { error }
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? data : r)) }))
    return { data }
  }, [table, userId])

  const remove = useCallback(async (id) => {
    const { error } = await createClient().from(table).delete().eq('id', id).eq('user_id', userId)
    if (error) return { error }
    setState((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) }))
    return { ok: true }
  }, [table, userId])

  return { ...state, insert, update, remove, reload: () => setVersion((v) => v + 1) }
}
