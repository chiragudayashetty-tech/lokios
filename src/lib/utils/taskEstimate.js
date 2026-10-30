// Task estimates: label ("90m", "2–5h") and the last similar finished task, for a sanity check.
export const estimateLabel = (t) => { const f = (m) => (m >= 60 ? `${+(m / 60).toFixed(1)}h` : `${m}m`); return t?.estimate_minutes ? (t.estimate_max_minutes > t.estimate_minutes ? `${f(t.estimate_minutes)}–${f(t.estimate_max_minutes)}` : f(t.estimate_minutes)) : null }

/** Last finished task that looks like this one (shared words in the title) with a real time. */
export function similarTask(task, tasks) {
  const words = (s) => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w)))
  const mine = words(task?.title)
  if (!mine.size) return null
  let best = null
  for (const t of tasks || []) {
    if (t.id === task.id || t.status !== 'completed' || !(t.actual_minutes > 0)) continue
    const shared = [...words(t.title)].filter((w) => mine.has(w)).length
    if (shared >= 2 || (shared === 1 && mine.size === 1)) if (!best || shared > best.shared || (shared === best.shared && String(t.completed_at) > String(best.t.completed_at))) best = { t, shared }
  }
  return best?.t || null
}
