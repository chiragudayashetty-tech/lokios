'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOS } from '@/lib/context/OSContext'
import { getLocalDateStr } from '@/lib/utils/dates'
import { buildStreakModel, fetchAllLogs, shiftDate, LOOKBACK_DAYS } from '@/lib/utils/streakCalc'
import {
  computeBoss, applyBossReward, computeSeason, applySeasonRewards, findBet, resolveBet,
  computeRecords, checkDayRecord, weekStartOf, computeWeekRecap,
} from '@/lib/utils/gamification'

// One shared store so every widget reads the same snapshot with a single fetch.
let snapshot = null
let loading = null
const listeners = new Set()
const publish = () => listeners.forEach(fn => fn(snapshot))

async function fetchAllXp(supabase, userId) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('xp_history')
      .select('id, amount, source_type, source_id, description, created_at')
      .eq('user_id', userId).order('created_at', { ascending: true }).range(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return rows
}

const hasRow = (rows, sid) => rows.some(r => r.source_id === sid || String(r.description || '').endsWith(`[#${sid}]`))

async function load(userId) {
  const supabase = createClient()
  const today = getLocalDateStr()
  const [{ data: habits }, logs, xpRows, { data: screenLogs }] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', userId),
    fetchAllLogs(supabase, userId, shiftDate(today, -LOOKBACK_DAYS)),
    fetchAllXp(supabase, userId),
    supabase.from('screen_time_logs').select('date, doom_scroll_minutes').eq('user_id', userId),
  ])
  const model = buildStreakModel(habits || [], logs, today)
  const weekStart = weekStartOf(today)
  const lastWeekStart = shiftDate(weekStart, -7)
  const boss = computeBoss(model, habits || [], today)
  const season = computeSeason(xpRows)
  const bet = findBet(xpRows, weekStart)
  const lastBet = findBet(xpRows, lastWeekStart)
  const records = computeRecords(xpRows, model, screenLogs || [], today)

  // Settle rewards, but only when the ledger doesn't already reflect them
  // (each award fires lokios:xp-changed, which reloads this store).
  let changed = false
  if (boss?.defeated && !hasRow(xpRows, `boss_${boss.weekStart}`)) { await applyBossReward(userId, boss); changed = true }
  if (boss && !boss.defeated && hasRow(xpRows, `boss_${boss.weekStart}`)) { await applyBossReward(userId, boss); changed = true }
  for (let i = 0; i < season.tier; i++) {
    if (!hasRow(xpRows, `season_${season.id}_tier_${i + 1}`)) { await applySeasonRewards(userId, season, xpRows); changed = true; break }
  }
  for (const b of [bet, lastBet]) {
    if (b && !b.paid) {
      const before = b.paid
      await resolveBet(userId, b, model)
      changed = changed || before !== b.paid
    }
  }
  checkDayRecord(records)

  return {
    today, habits: habits || [], model, xpRows, boss, season, bet, lastBet, records, weekStart, changed,
    weekRecap: (ws = weekStart) => computeWeekRecap(xpRows, model, habits || [], ws),
  }
}

function refresh(userId) {
  if (loading) return loading
  loading = load(userId)
    .then(s => { snapshot = s; publish() })
    .catch(e => console.warn('Game state load failed:', e))
    .finally(() => { loading = null })
  return loading
}

let wiredFor = null
function wire(userId) {
  if (wiredFor === userId || typeof window === 'undefined') return
  wiredFor = userId
  let t = null
  window.addEventListener('lokios:xp-changed', () => {
    clearTimeout(t)
    t = setTimeout(() => refresh(userId), 1200)
  })
}

/** Shared, lazily loaded game state (streak model, boss, season, bets, records). */
export function useGameState() {
  const { auth: { user } = {} } = useOS() || {}
  const [state, setState] = useState(snapshot)

  useEffect(() => {
    if (!user?.id) return
    listeners.add(setState)
    wire(user.id)
    if (!snapshot) refresh(user.id)
    return () => listeners.delete(setState)
  }, [user?.id])

  return { ...(state || {}), ready: !!state, refresh: () => user?.id && refresh(user.id), userId: user?.id }
}
