'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Tiny per-device preference store (view toggles, remembered tabs) backed by
// localStorage. Server render and first paint use the fallback.
const listeners = new Set()
const subscribe = (fn) => {
  listeners.add(fn)
  const onStorage = (e) => { if (e.key?.startsWith('lokios_')) fn() }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage) }
}
const read = (key) => { try { return localStorage.getItem(key) } catch { return null } }

/** [value, setValue] — value is always one of `allowed` (or the fallback). */
export function useLocalPref(key, fallback, allowed = null) {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null)
  const value = raw == null || (allowed && !allowed.includes(raw)) ? fallback : raw
  const setValue = useCallback((v) => {
    try { localStorage.setItem(key, v) } catch {}
    listeners.forEach((fn) => fn())
  }, [key])
  return [value, setValue]
}
