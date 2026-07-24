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
import { Smartphone, Bell, CheckCircle, AlertTriangle, Send, Moon, Shield, Calendar, Clock } from 'lucide-react'

export default function NotificationControl() {
  const [permission, setPermission] = useState('default')
  const [supported, setSupported] = useState(true)
  const [prefs, setPrefs] = useState(getStoredNotifPrefs())
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setSupported(isNotificationSupported())
    setPermission(getNotificationPermission())
    setPrefs(getStoredNotifPrefs())
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
      setMsg(`⚠ Error: ${e.message}`)
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
            <span className="font-mono text-[9px] text-muted uppercase">PWA Web Push & Tactical Reminders</span>
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

      {!supported ? (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded font-mono text-xs text-danger mb-3">
          ⚠ Web notifications are not supported on this browser context. On iOS, please add Loki OS to your Home Screen as a PWA first!
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!isGranted ? (
              <button
                type="button"
                onClick={handleEnable}
                className="btn btn-primary btn-sm flex items-center gap-2 bg-info text-bg-primary font-mono text-xs py-1.5 px-4"
              >
                <Bell size={14} /> ENABLE PHONE NOTIFICATIONS
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="btn btn-secondary btn-sm flex items-center gap-2 font-mono text-xs py-1.5 px-4 border-info text-info hover:bg-info/10"
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

          {/* Individual Reminder Toggles */}
          <div className="pt-2 border-t border-border-color flex flex-col gap-2.5 font-mono text-xs">
            <div className="text-muted text-[10px] uppercase tracking-widest mb-1">AUTOMATED TACTICAL REMINDERS</div>

            {[
              { key: 'bedtimeAlert', icon: Moon, title: '🌙 Bedtime Wind-Down Alert (23:15)', desc: 'Warns 45m before 12 AM bedtime limit' },
              { key: 'dailyOpsAlert', icon: Shield, title: '⚔️ Daily Ops Audit (21:00)', desc: 'Prompts habit logging & weight entry' },
              { key: 'screenTimeAlert', icon: Clock, title: '📱 Screen Time Check (19:00)', desc: 'Audits total hours & doomscroll limit' },
              { key: 'debriefAlert', icon: Calendar, title: '📋 Sunday Debrief Prompt (Sun 18:00)', desc: 'Alerts to complete weekly review (+40 XP)' },
            ].map(({ key, title, desc }) => {
              const active = prefs[key]
              return (
                <div
                  key={key}
                  onClick={() => handleTogglePref(key)}
                  className="flex items-center justify-between p-2.5 bg-bg-primary border border-border-color rounded cursor-pointer hover:border-info transition-colors"
                >
                  <div>
                    <div className="font-bold text-primary text-[11px]">{title}</div>
                    <div className="text-[9px] text-muted">{desc}</div>
                  </div>
                  <div
                    className="w-9 h-5 rounded-full relative transition-colors"
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
