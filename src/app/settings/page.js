'use client'

import { useState } from 'react'
import { Settings, RotateCcw, Check } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import RulesSection from '@/components/settings/RulesSection'
import HabitsSection from '@/components/settings/HabitsSection'
import CalendarTimeSection from '@/components/settings/CalendarTimeSection'
import MoneySection from '@/components/settings/MoneySection'
import AppearanceSection from '@/components/settings/AppearanceSection'
import NotificationsSection from '@/components/settings/NotificationsSection'
import IntegrationsSection from '@/components/settings/IntegrationsSection'
import PrivacySection from '@/components/settings/PrivacySection'
import DataSection from '@/components/settings/DataSection'
import { useOSSlice } from '@/lib/context/OSContext'
import { useSettings } from '@/lib/hooks/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '@/lib/settings'

const NAV = [
  ['rules', 'Rules'], ['habits', 'Habits'], ['time', 'Calendar & time'], ['money', 'Money'], ['appearance', 'Appearance'],
  ['notifications', 'Notifications'], ['integrations', 'Integrations'], ['privacy', 'Privacy'], ['data', 'Data'],
]

export default function SettingsPage() {
  const { user } = useOSSlice('auth')
  const s = useSettings()
  const [saved, setSaved] = useState(null) // null | 'local' | 'synced'

  const update = async (patch) => {
    const res = await saveSettings(patch, user?.id)
    setSaved(res.synced ? 'synced' : 'local')
    setTimeout(() => setSaved(null), 1800)
  }
  const go = (id) => document.getElementById(`set-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const props = { s, update, user }

  return (
    <AppShell>
      <div className="page-container settings-page set-page">
        <header className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-3"><Settings className="text-amber" /> Settings</h1>
            <p className="page-subtitle">Tune the rules of your game. Changes apply instantly{user ? ' and sync to your profile' : ''}.</p>
          </div>
          {saved && <span className="settings-saved" role="status"><Check size={14} /> {saved === 'synced' ? 'Saved & synced' : 'Saved on this device'}</span>}
        </header>

        <nav className="set-nav" aria-label="Settings sections">
          {NAV.map(([id, label]) => <button key={id} type="button" className="tk-chip" onClick={() => go(id)}>{label}</button>)}
        </nav>

        <RulesSection {...props} />
        <HabitsSection {...props} />
        <CalendarTimeSection {...props} />
        <MoneySection {...props} />
        <AppearanceSection {...props} />
        <NotificationsSection {...props} />
        <IntegrationsSection {...props} />
        <PrivacySection {...props} />
        <DataSection {...props} />

        <button type="button" className="btn btn-ghost" onClick={() => { if (window.confirm('Reset all settings to defaults? Your data is not touched.')) update(DEFAULT_SETTINGS) }}>
          <RotateCcw size={14} /> Reset settings to defaults
        </button>
      </div>
    </AppShell>
  )
}
