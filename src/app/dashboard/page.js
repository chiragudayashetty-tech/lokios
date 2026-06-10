'use client'

import AppShell from '@/components/layout/AppShell'
import { useProfile } from '@/lib/hooks/useProfile'
import { useTasks } from '@/lib/hooks/useTasks'
import { useGoals } from '@/lib/hooks/useGoals'
import { useCalendar } from '@/lib/hooks/useCalendar'
import { getRankDisplay, getRankProgress } from '@/lib/utils/ranks'
import { xpToNextLevel } from '@/lib/utils/xp'
import Link from 'next/link'

export default function Dashboard() {
  const { profile } = useProfile()
  const { todayTasks, completeTask } = useTasks()
  const { mainQuest } = useGoals()
  const { events } = useCalendar()
  
  if (!profile) return null
  
  const rank = getRankDisplay(profile.current_rank || 'E')
  const xpInfo = xpToNextLevel(profile.total_xp || 0)
  const rankProgress = getRankProgress(profile.total_xp || 0, profile.current_rank || 'E')
  
  const completedTasks = todayTasks.filter(t => t.status === 'completed').length
  const totalTasks = todayTasks.length
  const progressPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  return (
    <AppShell>
      <div className="page-container">
        <header className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {profile.full_name || profile.username || 'Commander'}.</p>
        </header>

        <div className="grid-auto" style={{ marginBottom: 'var(--space-6)' }}>
          {/* Main Quest */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h2 className="card-title">Main Quest</h2>
              <span className="badge badge-warning">Priority</span>
            </div>
            {mainQuest ? (
              <div>
                <h3 style={{ fontSize: 'var(--text-xl-size)', marginBottom: 'var(--space-2)' }}>
                  {mainQuest.title}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div className="progress-bar" style={{ flex: 1, background: 'var(--bg-tertiary)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${mainQuest.progress || 0}%`, background: 'var(--accent-gradient)', height: '100%' }}></div>
                  </div>
                  <span style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>{mainQuest.progress || 0}%</span>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>No Main Quest set.</p>
                <Link href="/goals" className="btn btn-primary btn-sm">Set Main Quest</Link>
              </div>
            )}
          </div>

          {/* Level & XP */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Level {profile.current_level || 1}</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{profile.total_xp} XP</span>
            </div>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                <span>Progress to Level {profile.current_level + 1}</span>
                <span>{xpInfo.current} / {xpInfo.required}</span>
              </div>
              <div className="progress-bar" style={{ background: 'var(--bg-tertiary)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${xpInfo.percentage}%`, background: 'var(--success)', height: '100%' }}></div>
              </div>
            </div>
          </div>

          {/* Rank */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', 
              background: `linear-gradient(135deg, ${rank.color}, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', boxShadow: `0 0 15px ${rank.color}40`
            }}>
              {rank.icon}
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)' }}>Current Rank</div>
              <div style={{ fontSize: 'var(--text-lg-size)', fontWeight: 'bold', color: rank.color }}>{rank.name}</div>
            </div>
          </div>

          {/* Streak */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ fontSize: '32px' }}>🔥</div>
            <div>
              <div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)' }}>Active Streak</div>
              <div style={{ fontSize: 'var(--text-2xl-size)', fontWeight: 'bold' }}>{profile.streak_days || 0} <span style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>days</span></div>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Today's Tasks */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Today's Tasks</h2>
              <span className="badge">{completedTasks}/{totalTasks}</span>
            </div>
            {todayTasks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {todayTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <input 
                      type="checkbox" 
                      checked={task.status === 'completed'}
                      onChange={() => completeTask(task.id)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                    />
                    <span style={{ flex: 1, textDecoration: task.status === 'completed' ? 'line-through' : 'none', color: task.status === 'completed' ? 'var(--text-muted)' : 'inherit' }}>
                      {task.title}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-secondary)' }}>+{task.xp_reward || 15} XP</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>No tasks for today. Rest well.</p>
            )}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Link href="/tasks" className="btn btn-ghost btn-sm btn-full">Manage Tasks</Link>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Progress */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
               <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                 <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                   <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-tertiary)" strokeWidth="3" />
                   <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--accent-primary)" strokeWidth="3" strokeDasharray={`${progressPct}, 100`} />
                 </svg>
                 <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm-size)', fontWeight: 'bold' }}>
                   {progressPct}%
                 </div>
               </div>
               <div>
                 <h3 style={{ fontSize: 'var(--text-base)', marginBottom: '4px' }}>Daily Progress</h3>
                 <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Complete tasks and habits to fill your ring.</p>
               </div>
            </div>

            {/* Calendar Widget */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Today's Schedule</h3>
              </div>
              {events.filter(e => new Date(e.start_time).toDateString() === new Date().toDateString()).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {events.filter(e => new Date(e.start_time).toDateString() === new Date().toDateString()).map(event => (
                    <div key={event.id} style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-sm-size)' }}>
                      <div style={{ color: 'var(--text-muted)', width: '45px' }}>
                        {new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div style={{ flex: 1, borderLeft: `2px solid ${event.color || 'var(--accent-primary)'}`, paddingLeft: 'var(--space-2)' }}>
                        {event.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)' }}>No events scheduled.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
