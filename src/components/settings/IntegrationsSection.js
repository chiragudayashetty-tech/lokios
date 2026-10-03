'use client'

import { useState } from 'react'
import { Plug, CalendarDays, X } from 'lucide-react'
import { Section } from './controls'
import { useOSSlice } from '@/lib/context/OSContext'

/** Google Calendar connection. */
export default function IntegrationsSection({ user }) {
  const { profile, fetchProfile } = useOSSlice('profile')
  const [busy, setBusy] = useState(false)
  const connected = !!profile?.google_refresh_token
  const disconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Events stop syncing.')) return
    setBusy(true)
    await fetch('/api/google/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?.id }) })
    await fetchProfile?.()
    setBusy(false)
  }
  return (
    <Section id="integrations" icon={Plug} title="Integrations">
      <div className="set-integration">
        <span className="set-int-icon"><CalendarDays size={18} /></span>
        <span className="set-int-main"><b>Google Calendar</b><span>{connected ? 'Connected · two-way sync from the Calendar page' : 'Pull events in and push time blocks out'}</span></span>
        {connected
          ? <button type="button" className="btn btn-ghost btn-sm" onClick={disconnect} disabled={busy}><X size={13} /> Disconnect</button>
          : <a className="btn btn-secondary btn-sm" href={user?.id ? `/api/google/auth?userId=${user.id}` : undefined} aria-disabled={!user?.id}>Connect</a>}
      </div>
    </Section>
  )
}
