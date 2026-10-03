'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isMissingSchema } from '@/lib/utils/schema'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { emitGame } from '@/lib/utils/gamification'

export const REVIEW_XP = 10

/** Today's end-of-day review (daily_reviews). Saving again the same day edits it; XP pays once. */
export function useDailyReview(userId, date) {
  const [state, setState] = useState({ review: null, loading: true, missing: false, date })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    createClient().from('daily_reviews').select('*').eq('user_id', userId).eq('date', date).maybeSingle()
      .then(({ data, error }) => { if (!cancelled) setState({ review: error ? null : data, loading: false, missing: isMissingSchema(error), date }) })
    return () => { cancelled = true }
  }, [userId, date])

  const save = useCallback(async (fields) => {
    const isNew = !state.review
    const { data, error } = await createClient().from('daily_reviews')
      .upsert({ user_id: userId, date, ...fields }, { onConflict: 'user_id,date' }).select().single()
    if (error) { if (isMissingSchema(error)) setState((s) => ({ ...s, missing: true })); return { error } }
    setState((s) => ({ ...s, review: data }))
    await robustAwardXP(userId, REVIEW_XP, 'daily_review', `review_${date}`, `🌙 End-of-day review (${date})`, 'learning')
    if (isNew) emitGame('toast', { icon: 'moon', title: 'Day reviewed', sub: `+${REVIEW_XP} XP · see you tomorrow`, tone: 'accent' })
    return { data }
  }, [userId, date, state.review])

  // A stale snapshot from another date reads as "loading"
  return state.date === date ? { ...state, save } : { review: null, loading: true, missing: false, save }
}
