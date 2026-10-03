'use client'

import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, getSettings, onSettingsChange } from '@/lib/settings'

// getSettings() returns a fresh object each call, so cache by the raw string.
let cacheRaw = null
let cacheVal = DEFAULT_SETTINGS
function snapshot() {
  let raw = ''
  try { raw = localStorage.getItem('lokios_settings') || '' } catch {}
  if (raw !== cacheRaw) { cacheRaw = raw; cacheVal = getSettings() }
  return cacheVal
}
const subscribe = (fn) => onSettingsChange(fn)
const serverSnapshot = () => DEFAULT_SETTINGS

/** Live settings; re-renders when saveSettings() runs anywhere in the app. */
export function useSettings() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
