/**
 * Derive a temporary momentum state from XP history.
 * This is intentionally pure: it never creates, updates, or deletes XP.
 */
export function calculateDailyMomentum(history = [], now = new Date()) {
  const today = new Date(now)
  const todayStr = localDate(today)
  const threeDayStart = new Date(today)
  threeDayStart.setDate(threeDayStart.getDate() - 2)
  const threeDayStartStr = localDate(threeDayStart)

  const recent = history.filter(entry => {
    const date = new Date(entry.created_at)
    return !Number.isNaN(date.getTime()) && localDate(date) >= threeDayStartStr && localDate(date) <= todayStr
  })

  const todayEntries = recent.filter(entry => localDate(new Date(entry.created_at)) === todayStr)
  const todayNet = sum(todayEntries)
  const threeDayNet = sum(recent)
  const positiveEntriesToday = todayEntries.filter(entry => Number(entry.amount) > 0).length
  const negativeEntriesToday = todayEntries.filter(entry => Number(entry.amount) < 0).length

  // Recovery has priority: the user is rebuilding after a meaningful recent loss.
  const isRecovery = threeDayNet <= -100 && todayNet > 0
  const isAtRisk = todayNet < 0 || threeDayNet <= -100 || negativeEntriesToday >= 2
  const isSurging = todayNet >= 100 && positiveEntriesToday >= 2

  const state = isRecovery ? 'RECOVERY' : isAtRisk ? 'AT RISK' : isSurging ? 'SURGING' : 'STEADY'
  const color = {
    SURGING: 'var(--success)',
    STEADY: 'var(--warning)',
    'AT RISK': 'var(--danger)',
    RECOVERY: 'var(--info)',
  }[state]

  return {
    state,
    todayNet,
    threeDayNet,
    positiveEntriesToday,
    negativeEntriesToday,
    color,
    accentIntensity: state === 'SURGING' ? 1 : state === 'RECOVERY' ? 0.8 : state === 'AT RISK' ? 0.65 : 0.5,
    message: state === 'RECOVERY'
      ? 'Momentum is rebuilding. Protect the next execution.'
      : state === 'AT RISK'
        ? 'Stabilize the day with one clean execution.'
        : state === 'SURGING'
          ? 'Keep the streak alive. Convert momentum into proof.'
          : 'Positive or neutral execution. Keep moving.',
  }
}

function sum(entries) {
  return entries.reduce((total, entry) => total + (Number(entry.amount) || 0), 0)
}

function localDate(date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}
