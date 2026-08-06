// ── Loki OS Phone & Web Notification Engine (iPhone iOS & Web Push Compatible) ───────────────────

import { createClient } from '@/lib/supabase/client'

const STORAGE_KEY = 'lokios_notification_prefs'

export const DEFAULT_NOTIF_PREFS = {
  enabled: false,
  morningAlert: true,        // 07:30 AM
  middayAlert: true,         // 13:00 / 1:00 PM
  hydrationAlert: true,      // 16:00 / 4:00 PM
  screenTimeAlert: true,     // 19:00 / 7:00 PM
  dailyOpsAlert: true,       // 21:00 / 9:00 PM
  bedtimeAlert: true,        // 23:15 / 11:15 PM
  debriefAlert: true,        // Sun 18:00 / 6:00 PM
  pendingTasksAlert: true,   // Pending Operations Alerts
  pendingHabitsAlert: true,  // Pending Routine Matrix Alerts
  calendarEventsAlert: true, // Calendar Event 15m Reminders
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
      body: 'iPhone & Web Push active. Reminders live for pending operations, routines, & calendar events.',
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
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 1000))
        ])
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
        }
      } catch (swErr) {
        console.warn('SW notification fallback active:', swErr)
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
      body: 'Phone & iPhone Notifications functional! Pending tasks, habits, and calendar alerts active.',
      tag: 'lokios-test',
      url: '/dashboard'
    })
  }
}

// ── DYNAMIC DATA REMINDER SENTINEL (TASKS, HABITS, CALENDAR) ────────────────
async function checkDynamicReminders(prefs, now) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const userId = session.user.id

    const todayStr = now.toISOString().split('T')[0]
    const currentMs = now.getTime()
    const hours = now.getHours()
    const mins = now.getMinutes()
    const timeKey = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`

    // ── 1. CALENDAR EVENT REMINDERS (15 Minutes Before Start Time) ──
    if (prefs.calendarEventsAlert) {
      const { data: calEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', `${todayStr}T00:00:00`)
        .lte('start_time', `${todayStr}T23:59:59`)

      if (calEvents && calEvents.length > 0) {
        calEvents.forEach(event => {
          if (!event.start_time) return
          const eventTime = new Date(event.start_time).getTime()
          const diffMins = (eventTime - currentMs) / (1000 * 60)

          // Fire notification if event starts within 15 minutes (between 0 and 15 mins)
          if (diffMins >= 0 && diffMins <= 15) {
            const firedKey = `lokios_notif_cal_${event.id}`
            if (!localStorage.getItem(firedKey)) {
              const formattedTime = new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              sendLocalNotification(`📅 CALENDAR EVENT IN 15M: ${event.title.toUpperCase()}`, {
                body: `Starts at ${formattedTime}${event.location ? ` — Location: ${event.location}` : ''}`,
                tag: `cal-${event.id}`,
                url: '/calendar'
              })
              localStorage.setItem(firedKey, 'true')
            }
          }
        })
      }
    }

    // ── 2. PENDING OPERATIONS / TASKS REMINDERS (11:00 AM & 16:30 PM) ──
    if (prefs.pendingTasksAlert && (timeKey === '11:00' || timeKey === '16:30')) {
      const firedKey = `lokios_notif_tasks_${todayStr}_${timeKey}`
      if (!localStorage.getItem(firedKey)) {
        const { data: pendingTasks } = await supabase
          .from('tasks')
          .select('title, due_date, priority')
          .eq('user_id', userId)
          .neq('status', 'completed')
          .lte('due_date', todayStr)

        if (pendingTasks && pendingTasks.length > 0) {
          const topTask = pendingTasks[0]
          sendLocalNotification(`📋 PENDING OPERATION: ${topTask.title.toUpperCase()}`, {
            body: `You have ${pendingTasks.length} pending operation${pendingTasks.length > 1 ? 's' : ''} due today. Complete in Operations!`,
            tag: `tasks-${todayStr}-${timeKey}`,
            url: '/tasks'
          })
          localStorage.setItem(firedKey, 'true')
        }
      }
    }

    // ── 3. PENDING HABITS / ROUTINES REMINDERS (12:30 PM & 20:00 PM) ──
    if (prefs.pendingHabitsAlert && (timeKey === '12:30' || timeKey === '20:00')) {
      const firedKey = `lokios_notif_habits_${todayStr}_${timeKey}`
      if (!localStorage.getItem(firedKey)) {
        const { data: habits } = await supabase.from('habits').select('id, title, frequency_days').eq('user_id', userId).eq('is_archived', false)
        const { data: todayLogs } = await supabase.from('habit_logs').select('habit_id, status').eq('user_id', userId).eq('date', todayStr)

        if (habits && habits.length > 0) {
          const dayOfWeek = now.getDay()
          const scheduledHabits = habits.filter(h => !h.frequency_days || h.frequency_days.includes(dayOfWeek))
          const completedHabitIds = new Set((todayLogs || []).filter(l => l.status === 'completed').map(l => l.habit_id))

          const remainingHabits = scheduledHabits.filter(h => !completedHabitIds.has(h.id))
          if (remainingHabits.length > 0) {
            const firstTitles = remainingHabits.slice(0, 2).map(h => h.title).join(', ')
            sendLocalNotification(`⚔️ PENDING ROUTINES: ${remainingHabits.length} REMAINING`, {
              body: `Remaining today: ${firstTitles}${remainingHabits.length > 2 ? '...' : ''}. Tap to audit Daily Ops!`,
              tag: `habits-${todayStr}-${timeKey}`,
              url: '/quests'
            })
            localStorage.setItem(firedKey, 'true')
          }
        }
      }
    }

  } catch (e) {
    console.error('Error checking dynamic notifications:', e)
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

    // ── FIXED SCHEDULE TIME ALERTS ──
    if (lastFired !== fireId) {
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

    // ── DYNAMIC REAL-TIME CHECKS (CALENDAR EVENTS, PENDING TASKS, PENDING HABITS) ──
    checkDynamicReminders(prefs, now)
  }

  // Check every 30 seconds
  intervalId = setInterval(checkReminders, 30000)
  checkReminders() // Initial check
}
