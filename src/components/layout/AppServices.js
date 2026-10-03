'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useOSSlice } from '@/lib/context/OSContext'
import { getLocalDateStr } from '@/lib/utils/dates'
import { habitsScheduledOn } from '@/lib/utils/xpRules'
import { getSettings, onSettingsChange } from '@/lib/settings'
import { getQueue, onQueueChange, flushQueue } from '@/lib/utils/offlineQueue'
import { showNotification, msUntil } from '@/lib/utils/notifications'
import { runSubscriptionAutopilotDaily } from '@/lib/utils/subscriptions'

/** Service worker, offline status pill and the evening habit reminder. */
export default function AppServices() {
  const { habits = [], todayLogs = [] } = useOSSlice('habits')
  const { user } = useOSSlice('auth')
  const [online, setOnline] = useState(true)
  const [queued, setQueued] = useState(0)
  const [settings, setSettings] = useState(null)

  // Service worker (production only: in dev it would cache hot-reloaded code)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW registration failed:', e))
  }, [])

  // Online / offline + queued changes
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    setQueued(getQueue().length)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    const off = onQueueChange(setQueued)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); off() }
  }, [])

  // While the pill is showing, re-read the stored queue so the count can't go stale
  useEffect(() => {
    if (online && queued === 0) return
    const t = setInterval(() => { setOnline(navigator.onLine); setQueued(getQueue().length) }, 1500)
    return () => clearInterval(t)
  }, [online, queued])

  // Subscription autopilot (#25): log due charges once per day per device
  useEffect(() => {
    if (!user?.id || !navigator.onLine) return
    const t = setTimeout(() => { runSubscriptionAutopilotDaily(user.id).catch(e => console.warn('Subscription autopilot failed:', e)) }, 2500)
    return () => clearTimeout(t)
  }, [user?.id])

  useEffect(() => {
    setSettings(getSettings())
    return onSettingsChange(setSettings)
  }, [])

  // Evening reminder: once per day at the chosen time, only if habits are still open
  useEffect(() => {
    if (!settings?.reminderEnabled) return
    const today = getLocalDateStr()
    const key = `lokios_reminder_${today}`
    const fire = () => {
      try { if (localStorage.getItem(key)) return } catch {}
      const scheduled = habitsScheduledOn(habits.filter(h => h.is_active !== false), today)
      const done = new Set(todayLogs.filter(l => !l.status || ['completed', 'rest', 'blocked', 'skipped'].includes(l.status)).map(l => l.habit_id))
      const left = scheduled.filter(h => !done.has(h.id))
      if (!left.length) return
      showNotification(`${left.length} habit${left.length === 1 ? '' : 's'} left today`, {
        body: `${left.slice(0, 3).map(h => h.title).join(', ')}${left.length > 3 ? '…' : ''} — keep the streak alive`,
        tag: 'evening-reminder',
      })
      try { localStorage.setItem(key, '1') } catch {}
    }
    const wait = msUntil(settings.reminderTime)
    if (wait <= 0) { fire(); return }
    const t = setTimeout(fire, wait)
    return () => clearTimeout(t)
  }, [settings?.reminderEnabled, settings?.reminderTime, habits, todayLogs])

  return (
    <AnimatePresence>
      {(!online || queued > 0) && (
        <motion.button
          type="button"
          className="offline-pill"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          onClick={() => online && flushQueue()}
        >
          {online ? <RefreshCw size={13} /> : <WifiOff size={13} />}
          {online ? `Syncing ${queued} change${queued === 1 ? '' : 's'}…` : `Offline${queued ? ` · ${queued} change${queued === 1 ? '' : 's'} will sync` : ' · changes will sync'}`}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
