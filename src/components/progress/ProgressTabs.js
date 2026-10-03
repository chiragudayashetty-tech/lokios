'use client'

import { BarChart3, BedDouble, Award } from 'lucide-react'
import ProgressExtras from '@/components/game/ProgressExtras'
import SleepPanel from './SleepPanel'
import AchievementGallery from '@/components/achievements/AchievementGallery'
import { useLocalPref } from '@/lib/hooks/useLocalPref'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'sleep', label: 'Sleep', icon: BedDouble },
  { id: 'achievements', label: 'Achievements', icon: Award },
]

/** Progress page sections: Overview (records, streaks, mastery), Sleep, Achievements. */
export default function ProgressTabs() {
  const tabs = TABS
  const [tab, setTab] = useLocalPref('lokios_progress_tab', 'overview', tabs.map((t) => t.id))
  return (
    <div className="progress-tabs">
      <div className="tl-tabs" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}><Icon size={13} /> {label}</button>
        ))}
      </div>
      {tab === 'overview' && <ProgressExtras />}
      {tab === 'sleep' && <SleepPanel />}
      {tab === 'achievements' && <AchievementGallery />}
    </div>
  )
}
