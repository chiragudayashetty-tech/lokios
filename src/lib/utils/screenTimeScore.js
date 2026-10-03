// Screen time XP rule shared by the client sync and the import API (no client imports here).
export function calculateScreenTimeXPPure(log) {
  if (!log) return { xpAmount: 0, finalReason: 'Screen Time logged' }
  const tHours = parseFloat(log.total_hours) || 0
  const fHours = parseFloat(log.focus_hours) || 0
  const dMins = parseInt(log.doom_scroll_minutes) || 0
  const sHours = parseFloat(log.streaming_hours) || 0
  let xpAmount = 0
  const reasons = []
  const add = (label, v) => { if (v !== 0) { xpAmount += v; reasons.push(`${label}: ${v > 0 ? '+' : ''}${v}`) } }
  add('Total Time', Math.round((6 - tHours) * 10))
  add('Doomscroll', Math.round((60 - dMins) * 0.5))
  add('Focus', Math.round((fHours - 3) * 15))
  add('Streaming', Math.round((1 - sHours) * 10))
  return { xpAmount, finalReason: reasons.join(' | ') || 'Screen Time logged' }
}
