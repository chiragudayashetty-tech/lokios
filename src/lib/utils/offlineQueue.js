// Offline write queue. Actions taken without a connection are stored in
// localStorage and replayed in order when the app is back online.
// Each op type has a handler registered by the module that owns it.

const KEY = 'lokios_offline_queue'
const handlers = new Map()
const listeners = new Set()
let flushing = false

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function getQueue() {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

function setQueue(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)) } catch {}
  listeners.forEach(fn => fn(q.length))
}

export function enqueue(op) {
  const q = getQueue()
  // A newer action on the same habit/day replaces the older queued one
  const filtered = op.key ? q.filter(x => x.key !== op.key) : q
  setQueue([...filtered, { ...op, queuedAt: Date.now() }])
}

export function registerOfflineHandler(type, fn) {
  handlers.set(type, fn)
  if (!isOffline()) flushQueue()
}

export function onQueueChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Replay queued ops in order; ops whose handler isn't registered yet stay queued. */
export async function flushQueue() {
  if (flushing || isOffline()) return
  flushing = true
  try {
    let q = getQueue()
    for (const op of [...q]) {
      const handler = handlers.get(op.type)
      if (!handler) continue
      try {
        await handler(op)
        q = getQueue().filter(x => x.queuedAt !== op.queuedAt || x.key !== op.key)
        setQueue(q)
      } catch (e) {
        console.warn('Offline replay failed; will retry:', e)
        break
      }
    }
  } finally {
    flushing = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushQueue())
}
