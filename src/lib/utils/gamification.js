// Game layer: chests, critical hits, first win, mastery, weekly boss, season pass,
// bets, personal records and the weekly debrief reward.
// Every reward uses a stable source id, so awards are idempotent and revocable.

import { getLocalDateStr, getStartOfWeek } from '@/lib/utils/dates'
import { robustAwardXP, robustRemoveXP } from '@/lib/utils/xpFallback'
import {
  GAME_START_DATE, CHEST_CHANCE, CHEST_BASE_XP, CHEST_MIN_MULT, CHEST_MAX_MULT, CRIT_CHANCE,
  BOSS_XP, BOSS_HITS, MASTERY_TIERS, SEASON, DEBRIEF_XP, seededRoll, habitsScheduledOn,
} from '@/lib/utils/xpRules'

// ── Events (UI listens: ChestReveal, GameToasts, gold confetti) ──────────────

export function emitGame(type, detail = {}) {
  if (typeof window === 'undefined') return
  try { window.dispatchEvent(new CustomEvent('lokios:game', { detail: { type, ...detail } })) } catch {}
}

const shift = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return getLocalDateStr(d)
}
export const weekStartOf = (dateStr = getLocalDateStr()) => getLocalDateStr(getStartOfWeek(new Date(`${dateStr}T12:00:00`)))
const inGameEra = (dateStr) => dateStr >= GAME_START_DATE
const backdate = (dateStr) => (dateStr === getLocalDateStr() ? null : `${dateStr}T12:00:00`)

// ── Mystery chest (Perfect Days) ─────────────────────────────────────────────

/** Deterministic per date: a re-tick never re-rolls. */
export function chestRoll(dateStr) {
  const hit = seededRoll(`chest_${dateStr}`) < CHEST_CHANCE
  const mult = Math.round((CHEST_MIN_MULT + seededRoll(`chest_mult_${dateStr}`) * (CHEST_MAX_MULT - CHEST_MIN_MULT)) * 10) / 10
  return { hit, mult, xp: Math.round(CHEST_BASE_XP * mult) }
}

export async function applyChestReward(userId, dateStr, isPerfect) {
  if (!inGameEra(dateStr)) return
  const roll = chestRoll(dateStr)
  const sourceId = `chest_${dateStr}`
  if (isPerfect && roll.hit) {
    await robustAwardXP(userId, roll.xp, 'mystery_chest', sourceId, `🎁 Mystery chest ×${roll.mult} — Perfect day bonus`, 'discipline', backdate(dateStr))
    const seenKey = `lokios_chest_seen_${dateStr}`
    let seen = false
    try { seen = !!localStorage.getItem(seenKey); localStorage.setItem(seenKey, '1') } catch {}
    if (!seen) emitGame('chest', { xp: roll.xp, mult: roll.mult, date: dateStr })
  } else if (isPerfect) {
    emitGame('toast', { icon: 'trophy', title: 'Perfect day!', sub: 'No chest this time — tomorrow is a new roll', tone: 'gold' })
    await robustRemoveXP(userId, 'mystery_chest', sourceId)
  } else {
    await robustRemoveXP(userId, 'mystery_chest', sourceId)
  }
}

// ── Per-completion rewards: first win, critical hit, mastery tier-up ────────

function baseXpOf(habit) {
  return habit?.xp_per_completion ? Math.max(5, parseInt(habit.xp_per_completion, 10)) : 25
}

/**
 * Called after a habit toggle with the fresh streak model.
 * completed / wasCompleted describe the habit's status for dateStr.
 */
export async function applyHabitRewards({ userId, habit, dateStr, completed, wasCompleted, model }) {
  if (!userId || !habit || !model || !inGameEra(dateStr)) return
  const today = getLocalDateStr()
  const base = baseXpOf(habit)
  const stats = model.dayStats(dateStr)

  // First win of the day ×2 (today only)
  if (dateStr === today) {
    const firstId = `first_win_${dateStr}`
    if (completed && !wasCompleted && stats.totalDone === 1) {
      await robustAwardXP(userId, base, 'first_win', firstId, `⚡ First win of the day ×2 — ${habit.title}`, habit.stat_category || 'discipline')
      emitGame('toast', { icon: 'zap', title: 'First win ×2', sub: `${habit.title} · +${base} bonus`, tone: 'accent' })
    } else if (!completed && stats.totalDone === 0) {
      await robustRemoveXP(userId, 'first_win', firstId)
    }
  }

  // Critical hit: 1 in 20, deterministic per habit + date
  const critId = `crit_${habit.id}_${dateStr}`
  if (seededRoll(critId) < CRIT_CHANCE) {
    if (completed && !wasCompleted) {
      await robustAwardXP(userId, base, 'critical_hit', critId, `💥 Critical hit ×2 — ${habit.title}`, habit.stat_category || 'discipline', backdate(dateStr))
      emitGame('crit', { title: habit.title, xp: base })
    } else if (!completed) {
      await robustRemoveXP(userId, 'critical_hit', critId)
    }
  }

  // Mastery tier-up (paid only when crossing a tier from now on)
  if (completed && !wasCompleted) {
    const count = model.doneCountByHabit.get(habit.id) || 0
    const tier = MASTERY_TIERS.find(t => t.at === count)
    if (tier) {
      await robustAwardXP(userId, tier.xp, 'mastery', `mastery_${habit.id}_${tier.id}`, `🏅 ${tier.label} mastery — ${habit.title} (${tier.at} completions)`, habit.stat_category || 'discipline')
      emitGame('toast', { icon: 'medal', title: `${tier.label} mastery!`, sub: `${habit.title} · ${tier.at} completions · +${tier.xp} XP`, tone: 'gold' })
    }
  }
}

// ── Weekly boss ──────────────────────────────────────────────────────────────

/** The week's boss: the habit with the lowest completion rate over the 14 days before the week. */
export function computeBoss(model, habits, today = getLocalDateStr()) {
  const weekStart = weekStartOf(today)
  const active = (habits || []).filter(h => h.is_active !== false && (!h.created_at || String(h.created_at).slice(0, 10) < weekStart))
  if (!active.length) return null

  let worst = null
  for (const h of active) {
    let scheduled = 0, done = 0
    for (let i = 1; i <= 14; i++) {
      const d = shift(weekStart, -i)
      if (!habitsScheduledOn([h], d).length) continue
      scheduled++
      if (model.doneByDate.get(d)?.has(h.id)) done++
    }
    if (!scheduled) continue
    const rate = done / scheduled
    const tie = seededRoll(`${h.id}_${weekStart}`)
    if (!worst || rate < worst.rate || (rate === worst.rate && tie < worst.tie)) worst = { habit: h, rate, tie }
  }
  if (!worst) return null

  const h = worst.habit
  const days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i))
  const scheduledDays = days.filter(d => habitsScheduledOn([h], d).length)
  const target = Math.min(BOSS_HITS, scheduledDays.length)
  const hits = days.filter(d => model.doneByDate.get(d)?.has(h.id)).length
  return {
    weekStart,
    habit: h,
    priorRate: worst.rate,
    target,
    hits,
    hp: Math.max(0, target - hits),
    defeated: hits >= target && target > 0,
    days: days.map(d => ({ date: d, hit: !!model.doneByDate.get(d)?.has(h.id), future: d > today })),
  }
}

export async function applyBossReward(userId, boss) {
  if (!boss || !inGameEra(shift(boss.weekStart, 6))) return
  const id = `boss_${boss.weekStart}`
  if (boss.defeated) {
    const key = `lokios_boss_won_${boss.weekStart}`
    let seen = false
    try { seen = !!localStorage.getItem(key); localStorage.setItem(key, '1') } catch {}
    await robustAwardXP(userId, BOSS_XP, 'weekly_boss', id, `⚔️ Weekly boss defeated — ${boss.habit.title}`, boss.habit.stat_category || 'discipline')
    if (!seen) emitGame('toast', { icon: 'swords', title: 'Boss defeated!', sub: `${boss.habit.title} · +${BOSS_XP} XP · trophy earned`, tone: 'gold', big: true })
  } else {
    await robustRemoveXP(userId, 'weekly_boss', id)
  }
}

// ── Ledger-derived state ─────────────────────────────────────────────────────

const localDay = (iso) => getLocalDateStr(new Date(iso))

/** Season pass progress from XP gained (positive amounts) since the season start. */
export function computeSeason(xpRows) {
  const gained = (xpRows || []).reduce((sum, r) => {
    if (r.amount > 0 && localDay(r.created_at) >= SEASON.start && !/^season_/.test(r.source_type || '')) return sum + r.amount
    return sum
  }, 0)
  const reached = SEASON.tiers.filter(t => gained >= t.at)
  const next = SEASON.tiers.find(t => gained < t.at) || null
  const prevAt = reached.length ? reached[reached.length - 1].at : 0
  return {
    ...SEASON,
    gained,
    tier: reached.length,
    title: reached.length ? reached[reached.length - 1].title : null,
    next,
    progress: next ? (gained - prevAt) / (next.at - prevAt) : 1,
  }
}

const ledgerHas = (rows, sid) => (rows || []).some(r => r.source_id === sid || String(r.description || '').endsWith(`[#${sid}]`))

/** Award every reached tier missing from the ledger; toast only the newest one. */
export async function applySeasonRewards(userId, season, xpRows) {
  let newest = null
  for (let i = 0; i < season.tier; i++) {
    const t = season.tiers[i]
    const sid = `season_${season.id}_tier_${i + 1}`
    if (ledgerHas(xpRows, sid)) continue
    await robustAwardXP(userId, t.xp, `season_${season.id}`, sid, `❄️ ${season.name} tier ${i + 1}: ${t.title}`, 'discipline')
    newest = { n: i + 1, t }
  }
  if (!newest) return
  const key = `lokios_season_${season.id}_toast_${newest.n}`
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1') } catch {}
  emitGame('toast', { icon: 'snowflake', title: `Season tier ${newest.n}: ${newest.t.title}`, sub: `${season.name} pass · +${newest.t.xp} XP`, tone: 'accent', big: newest.n === season.tiers.length })
}

// ── Bets ─────────────────────────────────────────────────────────────────────

const BET_TAG = /\[bet:(\d{4}-\d{2}-\d{2}):(\d+):(\d+)\]/

export function findBet(xpRows, weekStart) {
  const stake = (xpRows || []).find(r => r.source_type === 'bet_stake' && BET_TAG.exec(r.description || '')?.[1] === weekStart)
  if (!stake) return null
  const [, , target, amount] = BET_TAG.exec(stake.description)
  const paid = (xpRows || []).some(r => r.source_type === 'bet_payout' && (r.description || '').includes(`[bet:${weekStart}]`))
  return { weekStart, target: Number(target), stake: Number(amount), paid }
}

export async function placeBet(userId, weekStart, stake, target) {
  await robustAwardXP(userId, -Math.abs(stake), 'bet_stake', `bet_${weekStart}`,
    `🎲 Bet placed: ${target} streak days this week · stake ${stake} XP [bet:${weekStart}:${target}:${stake}]`, 'discipline')
  emitGame('toast', { icon: 'dice', title: 'Bet placed', sub: `${target} streak days this week · win ${stake * 2} XP`, tone: 'accent' })
}

/** Days this week at >= 90% (from the streak model). */
export function weekStreakDays(model, weekStart) {
  return Array.from({ length: 7 }, (_, i) => shift(weekStart, i)).filter(d => model.dayStats(d).qualifies).length
}

export async function resolveBet(userId, bet, model) {
  if (!bet || bet.paid) return
  const days = weekStreakDays(model, bet.weekStart)
  if (days >= bet.target) {
    await robustAwardXP(userId, bet.stake * 2, 'bet_payout', `bet_payout_${bet.weekStart}`,
      `🎲 Bet won ×2: ${days}/${bet.target} streak days [bet:${bet.weekStart}]`, 'discipline')
    emitGame('toast', { icon: 'dice', title: 'Bet won!', sub: `+${bet.stake * 2} XP — you hit ${bet.target} streak days`, tone: 'gold', big: true })
  }
}

// ── Personal records ─────────────────────────────────────────────────────────

export function computeRecords(xpRows, model, screenLogs = [], today = getLocalDateStr()) {
  const byDay = new Map()
  for (const r of xpRows || []) {
    if (/^bet_/.test(r.source_type || '')) continue
    const d = localDay(r.created_at)
    byDay.set(d, (byDay.get(d) || 0) + (r.amount || 0))
  }
  const best = (entries) => entries.reduce((b, e) => (!b || e[1] > b[1] ? e : b), null)
  const pastDays = [...byDay.entries()].filter(([d]) => d < today)
  const bestDay = best(pastDays)
  const byWeek = new Map()
  for (const [d, v] of byDay) { const w = weekStartOf(d); byWeek.set(w, (byWeek.get(w) || 0) + v) }
  const bestWeek = best([...byWeek.entries()])

  let mostHabits = null
  for (const [d, set] of model.doneByDate) if (!mostHabits || set.size > mostHabits[1]) mostHabits = [d, set.size]

  const doom = (screenLogs || []).filter(l => l.doom_scroll_minutes != null && l.date < today)
    .reduce((b, l) => (!b || Number(l.doom_scroll_minutes) < b[1] ? [l.date, Number(l.doom_scroll_minutes)] : b), null)

  return {
    todayXp: byDay.get(today) || 0,
    bestDay: bestDay && { date: bestDay[0], value: bestDay[1] },
    bestWeek: bestWeek && { date: bestWeek[0], value: bestWeek[1] },
    mostHabits: mostHabits && { date: mostHabits[0], value: mostHabits[1] },
    lowestDoom: doom && { date: doom[0], value: doom[1] },
    longestStreak: model.longest,
  }
}

/** "New best day!" once per day when today's XP passes the previous record. */
export function checkDayRecord(records) {
  if (!records?.bestDay || records.todayXp <= records.bestDay.value) return
  const key = `lokios_pr_day_${getLocalDateStr()}`
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1') } catch {}
  emitGame('toast', { icon: 'trophy', title: 'New best day!', sub: `${records.todayXp} XP today (old record ${records.bestDay.value})`, tone: 'gold', big: true })
}

// ── Weekly debrief ───────────────────────────────────────────────────────────

/** Week recap used by the debrief: XP, streak days, perfect days, best and weakest habits. */
export function computeWeekRecap(xpRows, model, habits, weekStart) {
  const days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i))
  const inWeek = (xpRows || []).filter(r => days.includes(localDay(r.created_at)) && !/^bet_/.test(r.source_type || ''))
  const gained = inWeek.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0)
  const lost = inWeek.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0)
  const stats = days.map(d => ({ date: d, ...model.dayStats(d) }))
  const tracked = stats.filter(s => s.ratio !== null && s.date <= getLocalDateStr())

  const perHabit = (habits || []).filter(h => h.is_active !== false).map(h => {
    const sched = days.filter(d => d <= getLocalDateStr() && habitsScheduledOn([h], d).length)
    const done = sched.filter(d => model.doneByDate.get(d)?.has(h.id)).length
    return { habit: h, done, scheduled: sched.length, rate: sched.length ? done / sched.length : null }
  }).filter(x => x.rate !== null)
  perHabit.sort((a, b) => b.rate - a.rate)

  return {
    weekStart,
    gained,
    lost,
    net: gained + lost,
    streakDays: tracked.filter(s => s.qualifies).length,
    perfectDays: tracked.filter(s => s.perfect).length,
    avgCompletion: tracked.length ? Math.round(tracked.reduce((s, x) => s + x.ratio, 0) / tracked.length * 100) : 0,
    best: perHabit.slice(0, 3),
    worst: perHabit.slice(-3).reverse(),
    days: stats,
  }
}

export async function awardDebrief(userId, weekStart) {
  await robustAwardXP(userId, DEBRIEF_XP, 'weekly_debrief', `debrief_${weekStart}`, `📝 Weekly debrief completed (week of ${weekStart})`, 'learning')
  emitGame('toast', { icon: 'scroll', title: 'Debrief logged', sub: `+${DEBRIEF_XP} XP · reflection is a rep too`, tone: 'accent' })
}
