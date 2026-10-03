// Evening reminder notifications.
// Shown through the service worker while the app is open or backgrounded.
// (Notifications while the app is fully closed would need server-side web push.)

export function notificationStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function requestReminderPermission() {
  if (notificationStatus() === 'unsupported') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try { return await Notification.requestPermission() } catch { return 'denied' }
}

export async function showNotification(title, options = {}) {
  if (notificationStatus() !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) await reg.showNotification(title, { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', ...options })
    else new Notification(title, { icon: '/icons/icon-192.png', ...options })
    return true
  } catch {
    return false
  }
}

/** Milliseconds from now until today's HH:MM (negative if already passed). */
export function msUntil(hhmm) {
  const [h, m] = String(hhmm || '21:00').split(':').map(Number)
  const at = new Date()
  at.setHours(h || 0, m || 0, 0, 0)
  return at.getTime() - Date.now()
}
