'use client'

import { Award } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import AchievementGallery from '@/components/achievements/AchievementGallery'

export default function AchievementsPage() {
  return (
    <AppShell>
      <div className="page-container">
        <header className="tk-head">
          <div>
            <h1 className="page-title flex items-center gap-3"><Award className="text-amber" /> Achievements</h1>
            <p className="page-subtitle">Badges for the habits, missions and streaks that add up.</p>
          </div>
        </header>
        <AchievementGallery />
      </div>
    </AppShell>
  )
}
