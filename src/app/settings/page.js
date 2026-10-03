'use client'

import { useEffect, useState } from 'react'
import { Settings, Flame, Gift, Wallet, Snowflake, Bell, RotateCcw, Check } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { useOSSlice } from '@/lib/context/OSContext'
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/lib/settings'
import { requestReminderPermission, notificationStatus } from '@/lib/utils/notifications'

function Row({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span className="settings-label">{label}</span>
        {hint && <span className="settings-hint">{hint}</span>}
      </div>
      <div className="settings-control">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`settings-toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

export default function SettingsPage() {
  const { user } = useOSSlice('auth')
  const [s, setS] = useState(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(null) // null | 'local' | 'synced'
  const [notif, setNotif] = useState('default')

  useEffect(() => {
    setS(getSettings())
    setNotif(notificationStatus())
  }, [])

  const update = async (patch) => {
    const next = { ...s, ...patch }
    setS(next)
    const res = await saveSettings(patch, user?.id)
    setSaved(res.synced ? 'synced' : 'local')
    setTimeout(() => setSaved(null), 1800)
  }

  const num = (key, { min, max, step = 1 }) => (
    <input
      type="number"
      className="input settings-number"
      value={s[key]}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setS(prev => ({ ...prev, [key]: e.target.value }))}
      onBlur={(e) => {
        const v = Math.min(max, Math.max(min, Number(e.target.value) || 0))
        update({ [key]: v })
      }}
    />
  )

  const enableReminders = async (on) => {
    if (on) {
      const result = await requestReminderPermission()
      setNotif(result)
      if (result !== 'granted') return
    }
    update({ reminderEnabled: on })
  }

  return (
    <AppShell>
      <div className="page-container settings-page">
        <header className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-3"><Settings className="text-amber" /> Settings</h1>
            <p className="page-subtitle">Tune the rules of your game. Changes apply instantly{user ? ' and sync to your profile' : ''}.</p>
          </div>
          {saved && <span className="settings-saved"><Check size={14} /> {saved === 'synced' ? 'Saved & synced' : 'Saved on this device'}</span>}
        </header>

        <section className="hud-panel settings-card">
          <div className="arena-card-head"><Flame size={15} style={{ color: 'var(--warning)' }} /> Streaks & penalties</div>
          <Row label="Streak day threshold" hint={`A day counts when ${Math.round(s.streakThreshold * 100)}% of scheduled habits are done`}>
            <input type="range" min="0.5" max="1" step="0.05" value={s.streakThreshold} onChange={(e) => update({ streakThreshold: Number(e.target.value) })} className="settings-range" />
            <span className="settings-value">{Math.round(s.streakThreshold * 100)}%</span>
          </Row>
          <Row label="Penalty cap" hint={`Repeated misses escalate ×1 → ×1.5 → … up to ×${s.penaltyCap}`}>
            <input type="range" min="1" max="5" step="0.5" value={s.penaltyCap} onChange={(e) => update({ penaltyCap: Number(e.target.value) })} className="settings-range" />
            <span className="settings-value">×{s.penaltyCap}</span>
          </Row>
          <Row label="Auto-fail look-back" hint="Missed habits older than this are never penalised (protects you after a break)">
            {num('autofailDays', { min: 0, max: 30 })}<span className="settings-unit">days</span>
          </Row>
        </section>

        <section className="hud-panel settings-card">
          <div className="arena-card-head"><Gift size={15} style={{ color: '#FFD166' }} /> Rewards</div>
          <Row label="Perfect day bonus" hint="XP for completing every scheduled habit (also rolls the 25% mystery chest)">
            {num('perfectDayXp', { min: 0, max: 500, step: 5 })}<span className="settings-unit">XP</span>
          </Row>
        </section>

        <section className="hud-panel settings-card">
          <div className="arena-card-head"><Wallet size={15} style={{ color: 'var(--success)' }} /> Budget</div>
          <Row label="Daily allowance" hint="Everyday spending. Bills & subscriptions don't count here">
            <span className="settings-unit">₹</span>{num('dailyBudget', { min: 0, max: 100000, step: 50 })}
          </Row>
          <Row label="Monthly bills limit" hint="Subscriptions, rent, utilities">
            <span className="settings-unit">₹</span>{num('monthlyBills', { min: 0, max: 1000000, step: 500 })}
          </Row>
        </section>

        <section className="hud-panel settings-card">
          <div className="arena-card-head"><Snowflake size={15} style={{ color: 'var(--accent-primary)' }} /> Season</div>
          <Row label="Winter Arc start" hint="Season pass counts XP gained from this date">
            <input type="date" className="input settings-date" value={s.seasonStart} onChange={(e) => update({ seasonStart: e.target.value })} />
          </Row>
        </section>

        <section className="hud-panel settings-card">
          <div className="arena-card-head"><Bell size={15} style={{ color: 'var(--info)' }} /> Notifications & popups</div>
          <Row label="Evening reminder" hint={notif === 'denied' ? 'Notifications are blocked in your browser settings' : notif === 'unsupported' ? 'This browser does not support notifications' : 'A nudge when habits are still open — "2 left, streak at risk"'}>
            <Toggle checked={!!s.reminderEnabled && notif === 'granted'} onChange={enableReminders} />
          </Row>
          {s.reminderEnabled && (
            <Row label="Reminder time">
              <input type="time" className="input settings-date" value={s.reminderTime} onChange={(e) => update({ reminderTime: e.target.value })} />
            </Row>
          )}
          <Row label="Sunday scorecard" hint="Your weekly grade, trends and focus for next week on the first open each Sunday">
            <Toggle checked={!!s.sundayRecap} onChange={(v) => update({ sundayRecap: v })} />
          </Row>
        </section>

        <button type="button" className="btn btn-ghost" onClick={() => { if (confirm('Reset all settings to defaults?')) update(DEFAULT_SETTINGS) }}>
          <RotateCcw size={14} /> Reset to defaults
        </button>
      </div>
    </AppShell>
  )
}
