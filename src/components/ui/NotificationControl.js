'use client'

import { useState, useEffect } from 'react'
import HudPanel from '@/components/ui/HudPanel'
import {
  getNotificationPermission,
  requestNotificationPermission,
  testPhoneNotification,
  getStoredNotifPrefs,
  saveStoredNotifPrefs,
  isNotificationSupported
} from '@/lib/utils/notifications'
import { Smartphone, Bell, CheckCircle, AlertTriangle, Send, Moon, Shield, Calendar, Clock, Sun, Zap, Droplet, Share, CheckSquare, Target } from 'lucide-react'

export default function NotificationControl() {
  const [permission, setPermission] = useState('default')
  const [supported, setSupported] = useState(true)
  const [prefs, setPrefs] = useState(getStoredNotifPrefs())
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState('')
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    setSupported(isNotificationSupported())
    setPermission(getNotificationPermission())
    setPrefs(getStoredNotifPrefs())
    if (typeof window !== 'undefined') {
      const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
      setIsIos(iosDevice)
    }
  }, [])

  const handleEnable = async () => {
    setMsg('')
    try {
      const p = await requestNotificationPermission()
      setPermission(p)
      setPrefs(getStoredNotifPrefs())
      if (p === 'granted') {
        setMsg('✓ Notifications enabled on your device!')
      } else if (p === 'denied') {
        setMsg('⚠ Permission denied in browser settings. Please allow notifications in device settings.')
      }
    } catch (e) {
      setMsg(`⚠ Note: ${e.message}`)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setMsg('')
    try {
      await testPhoneNotification()
      setMsg('⚡ Test directive sent to phone!')
    } catch (e) {
      setMsg(`⚠ Failed: ${e.message}`)
    }
    setTesting(false)
  }

  const handleTogglePref = (key) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    saveStoredNotifPrefs(updated)
  }

  const isGranted = permission === 'granted'

  return (
    <HudPanel glow className="border-info overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}>
      <div className="flex items-center justify-between border-b border-border-color pb-3 mb-4">
        <div className="flex items-center gap-2 text-info">
          <Smartphone size={18} />
          <div>
            <span className="font-display text-lg uppercase tracking-widest font-bold block leading-none">PHONE NOTIFICATIONS SENTINEL</span>
            <span className="font-mono text-[9px] text-muted uppercase">iPhone & Android Web Push Reminders</span>
          </div>
        </div>
        <span
          className="font-mono text-[9px] font-bold px-2 py-0.5 border"
          style={{
            background: isGranted ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
            color: isGranted ? 'var(--success)' : 'var(--warning)',
            borderColor: isGranted ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)'
          }}
        >
          {isGranted ? '✓ ENABLED' : permission === 'denied' ? '⛔ BLOCKED' : '⚠ PENDING'}
        </span>
      </div>

      {/* iPhone iOS Specific Helper Banner */}
      {isIos && (
        <div className="p-3 bg-info/10 border border-info/30 rounded font-mono text-xs text-info mb-4 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-primary">
            <Share size={14} className="text-info" />  iPhone Web Push Requirement:
          </div>
          <div className="text-[11px] leading-relaxed text-secondary">
            On iOS (iPhone), Apple requires adding Loki OS to your Home Screen first:
            <br />
            <strong>Tap Share icon in Safari ➔ &quot;Add to Home Screen&quot;</strong>, then open from Home Screen to tap Enable below!
          </div>
        </div>
      )}

      {!supported ? (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded font-mono text-xs text-danger mb-3">
          ⚠ Web notifications require Web Push API support. On iPhone, add Loki OS to your Home Screen as a PWA first!
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!isGranted ? (
              <button
                type="button"
                onClick={handleEnable}
                className="btn btn-primary btn-sm flex items-center gap-2 bg-info text-bg-primary font-mono text-xs py-2 px-4"
              >
                <Bell size={14} /> ENABLE PHONE NOTIFICATIONS
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="btn btn-secondary btn-sm flex items-center gap-2 font-mono text-xs py-2 px-4 border-info text-info hover:bg-info/10"
              >
                <Send size={13} /> {testing ? 'SENDING...' : 'TRIGGER TEST DIRECTIVE'}
              </button>
            )}
          </div>

          {msg && (
            <div className={`font-mono text-xs p-2 border rounded ${msg.includes('✓') || msg.includes('⚡') ? 'border-success text-success bg-success/5' : 'border-warning text-warning bg-warning/5'}`}>
              {msg}
            </div>
          )}

          <div className="p-3 bg-warning/10 border border-warning/30 rounded font-mono text-[10px] leading-relaxed text-warning">
            <strong>BACKGROUND DELIVERY NOTE:</strong> iPhone pauses page timers when the Home Screen app is closed. The test button proves permission and service-worker display only; reliable scheduled delivery while closed requires a Web Push subscription plus a server-side sender.
          </div>

          {/* Dynamic Real-Time Toggles */}
          <div className="pt-2 border-t border-border-color flex flex-col gap-2.5 font-mono text-xs">
            <div className="text-muted text-[10px] uppercase tracking-widest mb-1 font-bold">DYNAMIC REAL-TIME REMINDERS</div>

            {[
              { key: 'calendarEventsAlert', icon: Calendar, title: '📅 Calendar Events (15m Prior)', desc: 'Notifies 15m before any saved calendar event starts' },
              { key: 'pendingTasksAlert', icon: CheckSquare, title: '📋 Pending Operations Alert', desc: 'Alerts at 11:00 & 16:30 for uncompleted daily tasks' },
              { key: 'pendingHabitsAlert', icon: Target, title: '⚔️ Pending Routines Matrix Alert', desc: 'Alerts at 12:30 & 20:00 for remaining daily habits' },
            ].map(({ key, title, desc, icon: Icon }) => {
              const active = prefs[key]
              return (
                <div
                  key={key}
                  onClick={() => handleTogglePref(key)}
                  className="flex items-center justify-between p-2.5 bg-bg-primary border border-border-color rounded cursor-pointer hover:border-info transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={15} className="text-info shrink-0" />
                    <div>
                      <div className="font-bold text-primary text-[11px]">{title}</div>
                      <div className="text-[9px] text-muted">{desc}</div>
                    </div>
                  </div>
                  <div
                    className="w-9 h-5 rounded-full relative transition-colors shrink-0"
                    style={{ background: active && isGranted ? 'var(--info)' : 'var(--bg-tertiary)' }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform"
                      style={{ transform: active && isGranted ? 'translateX(18px)' : 'translateX(2px)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scheduled System Reminders */}
          <div className="pt-2 border-t border-border-color flex flex-col gap-2.5 font-mono text-xs">
            <div className="text-muted text-[10px] uppercase tracking-widest mb-1 font-bold">SCHEDULED SYSTEM REMINDERS</div>

            {[
              { key: 'morningAlert', icon: Sun, title: '🌅 Morning Protocol (07:30 AM)', desc: 'Routines & daily priority check' },
              { key: 'middayAlert', icon: Zap, title: '⚡ Mid-Day Focus Sprint (13:00 / 1:00 PM)', desc: 'High-impact task sprint prompt' },
              { key: 'hydrationAlert', icon: Droplet, title: '💧 Hydration & Recon Check (16:00 / 4:00 PM)', desc: 'Movement & hydration break' },
              { key: 'screenTimeAlert', icon: Clock, title: '📱 Digital Addiction Check (19:00 / 7:00 PM)', desc: 'Audits screen hours & doomscroll limit' },
              { key: 'dailyOpsAlert', icon: Shield, title: '⚔️ Daily Ops Audit (21:00 / 9:00 PM)', desc: 'Prompts habit matrix & weight entry' },
              { key: 'bedtimeAlert', icon: Moon, title: '🌙 Bedtime Sentinel Alert (23:15 / 11:15 PM)', desc: 'Warns 45m before 12 AM sleep limit' },
              { key: 'debriefAlert', icon: Calendar, title: '📋 Sunday Debrief Prompt (Sun 18:00)', desc: 'Alerts for weekly debrief (+40 XP)' },
            ].map(({ key, title, desc, icon: Icon }) => {
              const active = prefs[key]
              return (
                <div
                  key={key}
                  onClick={() => handleTogglePref(key)}
                  className="flex items-center justify-between p-2.5 bg-bg-primary border border-border-color rounded cursor-pointer hover:border-info transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={15} className="text-info shrink-0" />
                    <div>
                      <div className="font-bold text-primary text-[11px]">{title}</div>
                      <div className="text-[9px] text-muted">{desc}</div>
                    </div>
                  </div>
                  <div
                    className="w-9 h-5 rounded-full relative transition-colors shrink-0"
                    style={{ background: active && isGranted ? 'var(--info)' : 'var(--bg-tertiary)' }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform"
                      style={{ transform: active && isGranted ? 'translateX(18px)' : 'translateX(2px)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}
    </HudPanel>
  )
}
