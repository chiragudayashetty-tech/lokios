'use client'

import { useState, useSyncExternalStore } from 'react'
import { Bell } from 'lucide-react'
import { Section, Row, Toggle } from './controls'
import { requestReminderPermission, notificationStatus } from '@/lib/utils/notifications'

const noop = () => () => {}

/** Reminders are scheduled by AppServices while the app is open or backgrounded. */
export default function NotificationsSection({ s, update }) {
  const live = useSyncExternalStore(noop, notificationStatus, () => 'default')
  const [asked, setPerm] = useState(null)
  const perm = asked || live
  const enable = (key) => async (on) => {
    if (on) {
      const result = await requestReminderPermission()
      setPerm(result)
      if (result !== 'granted') return
    }
    update({ [key]: on })
  }
  const blocked = perm === 'denied' ? 'Notifications are blocked in your browser settings' : perm === 'unsupported' ? 'This browser does not support notifications' : null
  return (
    <Section id="notifications" icon={Bell} color="var(--info)" title="Notifications" hint="Shown while ChiragOS is open or in the background. Per-habit reminders live under Habits.">
      <Row label="Evening reminder" hint={blocked || 'A nudge when habits are still open — "2 left today"'}>
        <Toggle label="Evening reminder" checked={!!s.reminderEnabled && perm === 'granted'} onChange={enable('reminderEnabled')} />
        {s.reminderEnabled && perm === 'granted' && <input type="time" className="input settings-date" value={s.reminderTime} onChange={(e) => e.target.value && update({ reminderTime: e.target.value })} aria-label="Reminder time" />}
      </Row>
      <Row label="Streak at risk" hint={blocked || 'Warns you when today is still below the streak threshold'}>
        <Toggle label="Streak at risk" checked={!!s.streakNudge && perm === 'granted'} onChange={enable('streakNudge')} />
        {s.streakNudge && perm === 'granted' && <input type="time" className="input settings-date" value={s.streakNudgeTime} onChange={(e) => e.target.value && update({ streakNudgeTime: e.target.value })} aria-label="Streak nudge time" />}
      </Row>
      <Row label="Sunday scorecard" hint="Your weekly grade and focus for next week on the first open each Sunday">
        <Toggle label="Sunday scorecard" checked={!!s.sundayRecap} onChange={(v) => update({ sundayRecap: v })} />
      </Row>
    </Section>
  )
}
