// Screen time model (v2): judged by WHAT the time was spent on, not the total.
// Productivity on the phone (shooting, editing, work) is rewarded; leisure has daily
// limits (looser at weekends) and only the minutes over a limit are penalised.
// No client imports here — shared by the screen-time page, dashboard and reports.

export const LEISURE_LIMITS = {
  // minutes per day: [weekday, weekend]
  social: { label: 'Social media', limit: [60, 90] },
  video: { label: 'YouTube', limit: [60, 120] },
  games: { label: 'Entertainment', limit: [30, 120] }, // movies, series, games
}

const isWeekend = (dateStr) => {
  const d = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date()
  const day = Number.isNaN(d.getTime()) ? new Date().getDay() : d.getDay()
  return day === 0 || day === 6
}

/**
 * Minutes per bucket for a log. Category minutes win; older logs without categories
 * fall back to focus hours (productivity), doomscroll (social) and streaming (entertainment).
 */
export function screenBreakdown(log) {
  const cats = log?.categories && typeof log.categories === 'object' ? log.categories : null
  const has = cats && Object.keys(cats).length > 0
  const n = (v) => Math.max(0, Number(v) || 0)
  const productive = has ? n(cats.productivity) : n(log?.focus_hours) * 60
  const used = {
    social: has ? n(cats.social) : n(log?.doom_scroll_minutes),
    video: has ? n(cats.video) : 0,
    games: has ? n(cats.games) : n(log?.streaming_hours) * 60,
  }
  const weekend = isWeekend(log?.date)
  const leisure = Object.entries(LEISURE_LIMITS).map(([id, c]) => {
    const limit = c.limit[weekend ? 1 : 0]
    return { id, label: c.label, used: used[id], limit, over: Math.max(0, used[id] - limit) }
  })
  const totalMin = Math.max(n(log?.total_hours) * 60, productive + leisure.reduce((s, l) => s + l.used, 0))
  return { productive, leisure, totalMin, weekend }
}

/**
 * Digital discipline 0–100:
 *   50 pts leisure kept within limits (scaled by total minutes over vs total allowance)
 *   50 pts productive share of screen time (50%+ of the day productive = full marks)
 */
export function disciplineScore(log) {
  if (!log) return null
  const { productive, leisure, totalMin } = screenBreakdown(log)
  const allowance = leisure.reduce((s, l) => s + l.limit, 0)
  const over = leisure.reduce((s, l) => s + l.over, 0)
  const leisurePts = 50 * Math.max(0, 1 - over / allowance)
  const share = totalMin > 0 ? productive / totalMin : 0
  const productivePts = totalMin > 0 ? 50 * Math.min(1, share / 0.5) : 50
  return Math.round(leisurePts + productivePts)
}

/**
 * XP for a day:
 *   productivity > 0 → +5, plus +8 per hour (up to 8h)
 *   each leisure bucket within its limit → +5; over it → −1 XP per 2 minutes over (max −60)
 */
export function calculateScreenTimeXPPure(log) {
  if (!log) return { xpAmount: 0, finalReason: 'Screen time logged' }
  const { productive, leisure } = screenBreakdown(log)
  let xpAmount = 0
  const reasons = []
  const add = (label, v) => { if (v !== 0) { xpAmount += v; reasons.push(`${label}: ${v > 0 ? '+' : ''}${v}`) } }
  if (productive > 0) add(`Productive ${Math.round(productive)}m`, Math.round(5 + (Math.min(productive, 480) / 60) * 8))
  for (const l of leisure) {
    if (l.over > 0) add(`${l.label} +${Math.round(l.over)}m over`, -Math.round(Math.min(120, l.over) / 2))
    else add(`${l.label} within ${l.limit}m`, 5)
  }
  return { xpAmount, finalReason: reasons.join(' | ') || 'Screen time logged' }
}
