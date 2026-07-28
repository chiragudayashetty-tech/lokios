// ── Loki OS Phone & Web Notification Engine (iPhone iOS & Web Push Compatible) ───────────────────

const STORAGE_KEY = 'lokios_notification_prefs'

export const DEFAULT_NOTIF_PREFS = {
  enabled: false,
  morningAlert: true,    // 07:30 AM
  middayAlert: true,     // 13:00 / 1:00 PM
  hydrationAlert: true,  // 16:00 / 4:00 PM
  screenTimeAlert: true, // 19:00 / 7:00 PM
  dailyOpsAlert: true,   // 21:00 / 9:00 PM
  bedtimeAlert: true,    // 23:15 / 11:15 PM
  debriefAlert: true,    // Sun 18:00 / 6:00 PM
}

export function getStoredNotifPrefs() {
  if (typeof window === 'undefined') return DEFAULT_NOTIF_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) } : DEFAULT_NOTIF_PREFS
  } catch (e) {
    return DEFAULT_NOTIF_PREFS
  }
}

export function saveStoredNotifPrefs(prefs) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch (e) {}
}

export function isNotificationSupported() {
  if (typeof window === 'undefined') return false
  return 'Notification' in window
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission // 'granted', 'denied', or 'default'
}

export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (e) {
    console.error('Service worker registration error:', e)
    return null
  }
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    throw new Error('Notifications are not supported on this browser context. On iPhone, add to Home Screen first.')
  }

  // Register SW first for iOS Web Push
  await registerServiceWorker()

  let permission = 'default'
  if (typeof Notification.requestPermission === 'function') {
    permission = await Notification.requestPermission()
  }

  if (permission === 'granted') {
    const prefs = getStoredNotifPrefs()
    prefs.enabled = true
    saveStoredNotifPrefs(prefs)

    // Trigger confirmation notification
    await sendLocalNotification('LOKI OS // NOTIFICATIONS ENABLED 🛡️', {
      body: 'iPhone & Phone Web Push active. Tactical directives activated for Morning, Mid-day, Screen Intel, & Sleep.',
      tag: 'lokios-system',
      url: '/dashboard'
    })
  }

  return permission
}

export async function sendLocalNotification(title, options = {}) {
  if (!isNotificationSupported()) return false
  if (Notification.permission !== 'granted') return false

  try {
    // 1. Try active Service Worker (Best for iPhone iOS & Android Web Push)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options.body || '',
          icon: options.icon || '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: options.tag || 'lokios-local',
          data: { url: options.url || '/dashboard' },
          vibrate: [100, 50, 100],
          actions: [
            { action: 'open', title: 'VIEW IN APP' },
            { action: 'close', title: 'DISMISS' }
          ]
        })
        return true
      } else if (reg && reg.active) {
        reg.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body: options.body || '',
          icon: options.icon || '/icons/icon-192.png',
          tag: options.tag || 'lokios-local',
          url: options.url || '/dashboard'
        })
        return true
      }
    }

    // 2. Fallback to standard web Notification constructor
    new Notification(title, {
      body: options.body || '',
      icon: options.icon || '/icons/icon-192.png',
      tag: options.tag || 'lokios-local',
      data: { url: options.url || '/dashboard' }
    })
    return true
  } catch (e) {
    console.error('Failed to dispatch notification:', e)
    return false
  }
}

export async function testPhoneNotification() {
  const perm = getNotificationPermission()
  if (perm !== 'granted') {
    await requestNotificationPermission()
  } else {
    await sendLocalNotification('TEST DIRECTIVE // LOKI OS ⚡', {
      body: 'Phone & iPhone Notifications functional! All tactical alerts ready.',
      tag: 'lokios-test',
      url: '/dashboard'
    })
  }
}

// ── BACKGROUND REMINDER SCHEDULER ──────────────────────────────
let intervalId = null

export function initBackgroundReminders() {
  if (typeof window === 'undefined') return
  if (intervalId) clearInterval(intervalId)

  // Register Service Worker early for iOS
  registerServiceWorker()

  const checkReminders = () => {
    const prefs = getStoredNotifPrefs()
    if (!prefs.enabled || getNotificationPermission() !== 'granted') return

    const now = new Date()
    const hours = now.getHours()
    const mins = now.getMinutes()
    const day = now.getDay() // 0 = Sun
    const timeKey = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`

    const lastFired = localStorage.getItem('lokios_last_notif_fired')
    const todayStr = now.toISOString().split('T')[0]
    const fireId = `${todayStr}_${timeKey}`

    if (lastFired === fireId) return // Already fired this minute

    // 1. Morning Protocol Alert (07:30 AM)
    if (prefs.morningAlert && timeKey === '07:30') {
      sendLocalNotification('🌅 MORNING PROTOCOL // RECON READY', {
        body: 'Initialize daily routines & review today\'s top operational priorities.',
        tag: 'lokios-morning',
        url: '/quests'
      })
      localStorage.setItem('lokios_last_notif_fired', fireId)
    }

    // 2. Mid-Day Focus Sprint Alert (13:00 / 1:00 PM)
    if (prefs.middayAlert && timeKey === '13:00') {
      sendLocalNotification('⚡ MID-DAY PROTOCOL // FOCUS SPRINT', {
        body: 'Audit active tasks and complete high-impact mission items.',
        tag: 'lokios-midday',
        url: '/tasks'
      })
      localStorage.setItem('lokios_last_notif_fired', fireId)
    }

    // 3. Hydration & Mobility Check Alert (16:00 / 4:00 PM)
    if (prefs.hydrationAlert && timeKey === '16:00') {
      sendLocalNotification('💧 HYDRATION & RECON // MOBILITY CHECK', {
        body: 'Hydrate and take a 5-minute movement break for optimal focus.',
        tag: 'lokios-hydration',
        url: '/weight'
      })
      localStorage.setItem('lokios_last_notif_fired', fireId)
    }

    // 4. Digital Addiction Check (19:00 / 7:00 PM)
    if (prefs.screenTimeAlert && timeKey === '19:00') {
      sendLocalNotification('📱 DIGITAL ADDICTION // SCREEN CHECK', {
        body: 'Audit today\'s screen time & doomscroll minutes. Target ≤ 4h.',
        tag: 'lokios-screentime',
        url: '/screen-time'
      })
      localStorage.setItem('lokios_last_notif_fired', fireId)
    }

    // 5. Daily Ops Audit (21:00 / 9:00 PM)
    if (prefs.dailyOpsAlert && timeKey === '21:00') {
      sendLocalNotification('⚔️ DAILY OPS // AUDIT TIME', {
        body: 'Complete today\'s habit matrix & body weight entry before the day closes.',
        tag: 'lokios-dailyops',
        url: '/quests'
      })
      localStorage.setItem('lokios_last_notif_fired', fireId)
    }

    // 6. Bedtime Sentinel Alert (23:15 / 11:15 PM)
    if (prefs.bedtimeAlert && timeKey === '23:15') {
      sendLocalNotification('🌙 SLEEP SENTINEL // WIND-DOWN', {
        body: 'Target bedtime in 45m (12 AM limit). Disconnect devices and log sleep.',
        tag: 'lokios-bedtime',
        url: '/quests'
      })
      localStorage.setItem('lokios_last_notif_fired', fireId)
    }

    // 7. Sunday Debrief (Sun 18:00 / 6:00 PM)
    if (prefs.debriefAlert && day === 0 && timeKey === '18:00') {
      sendLocalNotification('📋 WEEKLY DEBRIEF // SUNDAY AUDIT', {
        body: 'Initialize weekly debrief for +40 XP & plan priorities for next week.',
        tag: 'lokios-debrief',
        url: '/weekly-review'
      })
      localStorage.setItem('lokios_last_notif_fired', fireId)
    }
  }

  // Check every 30 seconds
  intervalId = setInterval(checkReminders, 30000)
  checkReminders() // Initial check
}
