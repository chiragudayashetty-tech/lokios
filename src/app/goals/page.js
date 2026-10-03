'use client'

import { useMemo, useState } from 'react'
import { Target, Plus, LayoutGrid, GanttChartSquare, Flag } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import SchemaHint from '@/components/ui/SchemaHint'
import MissionCard from '@/components/goals/MissionCard'
import GoalRoadmap from '@/components/goals/GoalRoadmap'
import MissionForm from '@/components/goals/MissionForm'
import { useOSSlice } from '@/lib/context/OSContext'
import { useMilestones } from '@/lib/hooks/useMilestones'
import { useLocalPref } from '@/lib/hooks/useLocalPref'
import { getLocalDateStr } from '@/lib/utils/dates'
import { isActiveGoal, progressOf, deadlineOf } from '@/lib/utils/missions'

const FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'main_quest', label: 'Main' },
  { id: 'side_quest', label: 'Side' },
  { id: 'long_term', label: 'Long range' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
]

export default function MissionsPage() {
  const { goals = [], loading, error, fetchGoals, addGoal } = useOSSlice('goals')
  const { tasks = [] } = useOSSlice('tasks')
  const milestones = useMilestones()
  const today = getLocalDateStr()
  const [view, setView] = useLocalPref('lokios_goals_view', 'grid', ['grid', 'roadmap'])
  const [filter, setFilter] = useState('active')
  const [creating, setCreating] = useState(0) // re-key the form per opening

  const progressById = useMemo(() => new Map(goals.map((g) => [g.id, progressOf(g, milestones.list, tasks)])), [goals, milestones.list, tasks])
  const extras = goals.length === 0 || 'why' in goals[0]

  const list = useMemo(() => {
    const byDeadline = (a, b) => (deadlineOf(a) || '9999').localeCompare(deadlineOf(b) || '9999')
    if (filter === 'completed') return goals.filter((g) => g.status === 'completed').sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')))
    if (filter === 'failed') return goals.filter((g) => g.status === 'failed' || g.status === 'cancelled')
    const active = goals.filter(isActiveGoal)
    const typeRank = { main_quest: 0, long_term: 1, side_quest: 2, weekly: 3 }
    if (filter === 'active') return active.sort((a, b) => (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9) || byDeadline(a, b))
    return active.filter((g) => g.type === filter).sort(byDeadline)
  }, [goals, filter])

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id,
    f.id === 'active' ? goals.filter(isActiveGoal).length
      : f.id === 'completed' ? goals.filter((g) => g.status === 'completed').length
        : f.id === 'failed' ? goals.filter((g) => g.status === 'failed' || g.status === 'cancelled').length
          : goals.filter((g) => isActiveGoal(g) && g.type === f.id).length])), [goals])

  if (error) return <AppShell><div className="page-container"><p className="text-muted">{error}</p><button type="button" className="btn btn-primary" onClick={fetchGoals}>Try again</button></div></AppShell>
  if (loading && !goals.length) return <AppShell><WinterLoader label="Loading missions" /></AppShell>

  return (
    <AppShell>
      <div className="page-container missions-page">
        <header className="tk-head">
          <div>
            <h1 className="page-title flex items-center gap-3"><Target className="text-amber" /> Missions</h1>
            <p className="page-subtitle">Big outcomes, broken into milestones you can actually hit.</p>
          </div>
          <div className="tk-head-actions">
            <div className="tk-view" role="tablist" aria-label="View">
              <button type="button" role="tab" aria-selected={view === 'grid'} className={view === 'grid' ? 'is-on' : ''} onClick={() => setView('grid')}><LayoutGrid size={14} /> Grid</button>
              <button type="button" role="tab" aria-selected={view === 'roadmap'} className={view === 'roadmap' ? 'is-on' : ''} onClick={() => setView('roadmap')}><GanttChartSquare size={14} /> Roadmap</button>
            </div>
            <button type="button" className="btn btn-primary tk-add" onClick={() => setCreating((n) => n + 1)}><Plus size={16} /> Mission</button>
          </div>
        </header>

        {milestones.missing && <SchemaHint feature="Milestones and the roadmap" />}

        {view === 'roadmap' ? (
          <GoalRoadmap goals={goals.filter(isActiveGoal)} milestones={milestones.list} progressById={progressById} today={today} />
        ) : (
          <>
            <div className="tk-chips ms-filters" role="tablist">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`tk-chip ${filter === f.id ? 'is-on' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.label} <span className="ms-count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            {list.length === 0 ? (
              <div className="tb-empty ms-empty">
                <div className="tb-empty-art"><Flag size={22} /></div>
                <p>{filter === 'completed' ? 'No completed missions yet — the first one is the hardest.' : filter === 'failed' ? 'Nothing failed. Keep it that way.' : 'No missions here yet.'}</p>
                {!['completed', 'failed'].includes(filter) && <button type="button" className="tb-empty-cta" onClick={() => setCreating((n) => n + 1)}><Plus size={13} /> Create a mission</button>}
              </div>
            ) : (
              <div className="ms-grid">
                {list.map((g) => <MissionCard key={g.id} goal={g} progress={progressById.get(g.id) || 0} milestones={milestones.list} tasks={tasks} today={today} />)}
              </div>
            )}
          </>
        )}

        <MissionForm
          key={`create_${creating}`}
          open={creating > 0}
          extras={extras}
          onClose={() => setCreating(0)}
          onSave={async (payload) => {
            let res = await addGoal(payload)
            if (res?.error && 'why' in payload && /why|cover|column/i.test(res.error.message || '')) {
              const basics = { ...payload } // round-2 columns missing → save the basics
              delete basics.why
              delete basics.cover
              res = await addGoal(basics)
            }
            return res
          }}
        />
      </div>
    </AppShell>
  )
}
