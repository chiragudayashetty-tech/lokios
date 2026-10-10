'use client'

import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import WorldView from '@/components/world/WorldView'
import { useOSSlice } from '@/lib/context/OSContext'
import { useWorldData } from '@/lib/world/useWorldData'

/** /world — the living island, built from habits, tasks, missions and screen time. */
export default function WorldPage() {
  const { user } = useOSSlice('auth')
  const { data } = useWorldData(user?.id)
  return (
    <AppShell>
      <div className="page-container wd-page">
        <header className="wd-head">
          <h1>Your island</h1>
          <p>Grown from what you already log. Nothing to add — just keep living.</p>
        </header>
        {data ? <WorldView data={data} /> : <WinterLoader label="Growing your island" />}
      </div>
    </AppShell>
  )
}
