// Achievements (#29): build stats, evaluate, persist unlocks, pay XP once.
// One shared store so the gallery, the profile trophy case and the unlock
// service all read the same result.

import { createClient } from '@/lib/supabase/client'
import { isMissingSchema } from '@/lib/utils/schema'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { emitGame } from '@/lib/utils/gamification'
import { calculateLevel } from '@/lib/utils/xp'
import { shiftDate } from '@/lib/utils/streakCalc'
import { isExcludedFromDaily, getLocalDailyBudget } from '@/lib/utils/budget'
import { evaluateAchievements, achievementXp, RARITY } from '@/lib/achievements'

/**
 * Save new unlocks. Older achievements tables may lack the (user_id, achievement_id)
 * unique key the batch upsert needs; then rows go in one by one (a duplicate is fine).
 * Returns an error message, or null when everything was saved.
 */
async function saveUnlocks(sb, rows) {
  const { error } = await sb.from('achievements').upsert(rows, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true })
  if (!error) return null
  if (!/on conflict|unique or exclusion/i.test(error.message || '')) return error.message
  for (const r of rows) {
    const res = await sb.from('achievements').insert(r)
    if (res.error && res.error.code !== '23505') return res.error.message
  }
  return null
}

/** earned_at placeholder for achievements earned but not yet saved (achievements table missing). */
export const PENDING = 'pending'

let state = { list: [], earned: new Map(), stats: null, missing: false, ready: false, userId: null }
const listeners = new Set()
const publish = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)) }
export const achievementSnapshot = () => state
export function subscribeAchievements(fn) { listeners.add(fn); return () => listeners.delete(fn) }

const countRows = (rows, re) => (rows || []).filter((r) => re.test(r.source_type || '') && (r.amount || 0) > 0).length
const distinctDays = (rows) => new Set((rows || []).map((r) => r.date)).size

/** Small extra queries the game state doesn't cover. Missing tables count as 0. */
async function fetchExtras(userId) {
  const sb = createClient()
  const safe = (p) => p.then((r) => (r.error ? { data: [], count: 0 } : r)).catch(() => ({ data: [], count: 0 }))
  const [journal, budget, screen, sleep, reviews, tasks, goals, portfolio, jars, profile] = await Promise.all([
    safe(sb.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safe(sb.from('budget_logs').select('date, amount, category, description, exclude_daily, custom_category').eq('user_id', userId)),
    safe(sb.from('screen_time_logs').select('date, doom_scroll_minutes, focus_hours').eq('user_id', userId)),
    safe(sb.from('sleep_logs').select('date, score').eq('user_id', userId)),
    safe(sb.from('daily_reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safe(sb.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed')),
    safe(sb.from('goals').select('type, status').eq('user_id', userId).eq('status', 'completed')),
    safe(sb.from('portfolio_items').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safe(sb.from('savings_goals').select('id').eq('user_id', userId).not('completed_at', 'is', null)),
    safe(sb.from('profiles').select('total_xp, longest_streak').eq('id', userId).single()),
  ])
  return { journal, budget, screen, sleep, reviews, tasks, goals, portfolio, jars, profile }
}

export function buildAchievementStats(game, x, userId) {
  const { model, xpRows = [], season } = game
  // Perfect days / weeks over the streak model's lookback
  let perfectDays = 0
  const perfectByWeek = new Map()
  for (let i = 0; i < 400; i++) {
    const d = shiftDate(game.today, -i)
    const st = model.dayStats(d)
    if (st.perfect) {
      perfectDays++
      const dow = (new Date(`${d}T12:00:00`).getDay() + 6) % 7
      const wk = shiftDate(d, -dow)
      perfectByWeek.set(wk, (perfectByWeek.get(wk) || 0) + 1)
    }
  }
  // Weekly XP records broken (beat every earlier week, after 2 weeks of history)
  const weekXp = new Map()
  for (const r of xpRows) {
    if (/^(bet_|achievement$)/.test(r.source_type || '')) continue
    const d = new Date(r.created_at)
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dow = (d.getDay() + 6) % 7
    const wk = shiftDate(ds, -dow)
    weekXp.set(wk, (weekXp.get(wk) || 0) + (r.amount || 0))
  }
  // Best single day, ignoring bets and achievement XP (so badges can't unlock each other)
  const dayXp = new Map()
  for (const r of xpRows) {
    if (/^(bet_|achievement$)/.test(r.source_type || '')) continue
    const d = new Date(r.created_at)
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    dayXp.set(ds, (dayXp.get(ds) || 0) + (r.amount || 0))
  }
  let best = -Infinity, broken = 0
  ;[...weekXp.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([, v], i) => { if (i >= 2 && v > best) broken++; best = Math.max(best, v) })

  // Budget: days with spend logged, days within the allowance
  const limit = getLocalDailyBudget(userId)
  const spendByDay = new Map()
  for (const l of x.budget.data || []) {
    if (!spendByDay.has(l.date)) spendByDay.set(l.date, 0)
    if (!isExcludedFromDaily(l)) spendByDay.set(l.date, spendByDay.get(l.date) + (parseFloat(l.amount) || 0))
  }
  const masteryRows = xpRows.filter((r) => r.source_type === 'mastery')
  const goalsDone = x.goals.data || []

  return {
    longestStreak: Math.max(model.longest || 0, x.profile.data?.longest_streak || 0),
    perfectDays,
    perfectWeeks: [...perfectByWeek.values()].filter((n) => n >= 7).length,
    freezesUsed: model.frozenDates?.size || 0,
    habitDone: [...(model.doneCountByHabit?.values() || [])].reduce((s, n) => s + n, 0),
    masteryGold: masteryRows.filter((r) => /Gold|Diamond/.test(r.description || '')).length,
    masteryDiamond: masteryRows.filter((r) => /Diamond/.test(r.description || '')).length,
    fullChains: countRows(xpRows, /^habit_chain_full$/),
    crits: countRows(xpRows, /^critical_hit$/),
    chests: countRows(xpRows, /^mystery_chest$/),
    tasksDone: x.tasks.count || 0,
    blocksHonored: countRows(xpRows, /^time_block$/),
    inboxZero: countRows(xpRows, /^inbox_zero$/),
    missionsDone: goalsDone.length,
    mainDone: goalsDone.filter((g) => g.type === 'main_quest').length,
    milestones: countRows(xpRows, /^milestone$/),
    portfolio: x.portfolio.count || 0,
    level: calculateLevel(x.profile.data?.total_xp || 0),
    bestDayXp: Math.max(0, ...dayXp.values()),
    weekRecordsBroken: broken,
    bosses: countRows(xpRows, /^weekly_boss$/),
    betsWon: countRows(xpRows, /^bet_payout$/),
    bigBetWon: xpRows.some((r) => r.source_type === 'bet_payout' && (r.amount || 0) >= 1000),
    budgetDays: spendByDay.size,
    underBudgetDays: [...spendByDay.values()].filter((v) => v <= limit).length,
    jarsDone: (x.jars.data || []).length,
    journal: x.journal.count || 0,
    reviews: x.reviews.count || 0,
    debriefs: countRows(xpRows, /^weekly_debrief$/),
    screenDays: distinctDays(x.screen.data),
    lowDoomDays: (x.screen.data || []).filter((l) => l.doom_scroll_minutes != null && Number(l.doom_scroll_minutes) <= 60).length,
    focusDays: (x.screen.data || []).filter((l) => Number(l.focus_hours) >= 3).length,
    sleepLogs: (x.sleep.data || []).length,
    goodSleep: (x.sleep.data || []).filter((l) => Number(l.score) >= 70).length,
    seasonTier: season?.tier || 0,
  }
}

let running = null
/**
 * Evaluate after the game state loads (idempotent). New unlocks are stored,
 * pay XP once (ach_<id>) and toast; the very first sync on an account
 * unlocks history silently with one summary toast.
 */
export function syncAchievements(userId, game) {
  if (!userId || !game?.ready || running) return running
  running = (async () => {
    const sb = createClient()
    const [extras, earnedRes] = await Promise.all([fetchExtras(userId), sb.from('achievements').select('achievement_id, earned_at').eq('user_id', userId)])
    const stats = buildAchievementStats(game, extras, userId)
    const list = evaluateAchievements(stats)
    if (earnedRes.error) {
      // Can't save yet (table missing): still show what the history has earned, marked pending (no XP until saved)
      const pending = new Map(list.filter((a) => a.earned).map((a) => [a.id, PENDING]))
      publish({ list, stats, earned: pending, missing: isMissingSchema(earnedRes.error), ready: true, userId })
      return
    }
    const earned = new Map((earnedRes.data || []).map((r) => [r.achievement_id, r.earned_at]))
    const firstSync = earned.size === 0
    const fresh = list.filter((a) => a.earned && !earned.has(a.id))
    let saveError = null
    if (fresh.length) {
      const now = new Date().toISOString()
      saveError = await saveUnlocks(sb, fresh.map((a) => ({ user_id: userId, achievement_id: a.id, earned_at: now })))
      if (!saveError) {
        for (const a of fresh) {
          earned.set(a.id, now)
          await robustAwardXP(userId, achievementXp(a), 'achievement', `ach_${a.id}`, `🏆 Achievement: ${a.name} (${RARITY[a.rarity].label})`, 'discipline')
        }
        emitGame('achievement-unlocked', { ids: fresh.map((a) => a.id), history: firstSync && fresh.length > 3 })
      } else {
        // Still show them as earned; XP is paid on the first sync that manages to save
        for (const a of fresh) earned.set(a.id, PENDING)
        console.warn('Saving achievements failed:', saveError)
      }
    }
    publish({ list, stats, earned, missing: false, saveError, ready: true, userId })
  })().catch((e) => console.warn('Achievements sync failed:', e)).finally(() => { running = null })
  return running
}
