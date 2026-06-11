'use client'

import { motion } from 'framer-motion'
import { Flame, Rocket, Target, BookOpen, MessageSquare, Palette, Dumbbell } from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import BattleCard from '@/components/ui/BattleCard'
import StatCard from '@/components/ui/StatCard'
import TacticalProgress from '@/components/ui/ProgressBar'
import TypewriterText from '@/components/ui/TypewriterText'
import { useProfile } from '@/lib/hooks/useProfile'
import { useTasks } from '@/lib/hooks/useTasks'
import { useGoals } from '@/lib/hooks/useGoals'
import { useCalendar } from '@/lib/hooks/useCalendar'
import { useUserConfig } from '@/lib/hooks/useUserConfig'
import { useCharacterStats } from '@/lib/hooks/useCharacterStats'
import { getRankDisplay } from '@/lib/utils/ranks'
import { xpToNextLevel } from '@/lib/utils/xp'
import { STAT_CATEGORIES } from '@/lib/constants'

export default function MissionControl() {
  const { profile } = useProfile()
  const { config } = useUserConfig()
  const { stats } = useCharacterStats()
  const { mainQuest } = useGoals()
  const { todayTasks } = useTasks()
  const { events } = useCalendar()
  
  const rankInfo = getRankDisplay(profile?.rank)
  const xpProgress = profile ? xpToNextLevel(profile.total_xp) : { percentage: 0 }
  
  const completedTasks = todayTasks.filter(t => t.status === 'completed').length
  const todayEvents = events.filter(e => new Date(e.start_time).toDateString() === new Date().toDateString())

  const ICON_MAP = {
    Rocket, Target, BookOpen, MessageSquare, Palette, Dumbbell
  }

  return (
    <AppShell>
      <div className="page-container">
        
        {/* TOP IDENTITY BAR */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <HudPanel label="OPERATOR STATUS" className="flex-between flex-wrap gap-4" style={{ padding: '1rem 1.5rem' }}>
            <div className="flex items-center gap-4">
              <div>
                <h1 className="font-display text-2xl uppercase tracking-wider glow-amber text-primary">
                  {profile?.full_name || profile?.username || 'COMMANDER'}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="badge badge-amber">{config?.class || 'OPERATOR'}</span>
                  <span className="badge" style={{ color: rankInfo.color, borderColor: rankInfo.color, borderWidth: '1px', borderStyle: 'solid', background: 'transparent' }}>
                    {rankInfo.icon} {rankInfo.name}
                  </span>
                  <span className="font-mono text-sm text-muted">LV.{profile?.level || 1}</span>
                </div>
              </div>
            </div>
            {config?.current_arc && (
              <div className="text-right">
                <div className="font-display text-xs text-muted uppercase tracking-wide">CURRENT ARC</div>
                <TypewriterText text={config.current_arc} speed={40} className="text-amber uppercase" />
              </div>
            )}
          </HudPanel>
        </motion.div>

        {/* HERO: ACTIVE MISSION */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="mb-8">
          <HudPanel label="PRIMARY MISSION" glow scanLine style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {mainQuest ? (
              <>
                <h2 className="font-display text-3xl uppercase tracking-wider text-primary mb-2 glow-amber">{mainQuest.title}</h2>
                <div className="flex gap-3 mb-6">
                  {config?.current_enemy && (
                    <span className="font-mono text-xs text-danger bg-danger-subtle px-2 py-1 uppercase border border-danger" style={{ opacity: 0.8 }}>
                      THREAT: {config.current_enemy}
                    </span>
                  )}
                  {config?.current_bottleneck && (
                    <span className="font-mono text-xs text-warning bg-warning-subtle px-2 py-1 uppercase border border-warning" style={{ opacity: 0.8 }}>
                      BOTTLENECK: {config.current_bottleneck}
                    </span>
                  )}
                </div>
                <TacticalProgress value={mainQuest.progress} max={100} label="MISSION PROGRESS" showValue />
              </>
            ) : (
              <div className="flex-col flex-center text-center">
                <span className="font-mono text-muted mb-4">NO ACTIVE PRIMARY MISSION DETECTED</span>
                <Link href="/goals" className="btn btn-secondary">ASSIGN MISSION</Link>
              </div>
            )}
          </HudPanel>
        </motion.div>

        {/* OVERALL LEVEL PROGRESS */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-8">
          <TacticalProgress value={xpProgress.percentage} max={100} label="LEVEL PROGRESSION" color="var(--info)" height={4} />
        </motion.div>

        {/* ACTIVE BATTLES */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <div className="font-display text-sm text-muted uppercase tracking-wider mb-4">Active Battles</div>
          {config?.battles?.length > 0 ? (
            <div className="grid-auto">
              {config.battles.map((battle, i) => (
                <BattleCard 
                  key={i} 
                  name={battle.name} 
                  metric={battle.metric} 
                  current={battle.current} 
                  target={battle.target} 
                />
              ))}
            </div>
          ) : (
            <div className="empty-state p-6">
              <span>No active battles tracked.</span>
              <Link href="/command-center" className="text-amber underline mt-2">Configure in Command Center</Link>
            </div>
          )}
        </motion.div>

        {/* CHARACTER STATS */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-8">
          <div className="font-display text-sm text-muted uppercase tracking-wider mb-4">Operator Stats</div>
          <div className="grid-3">
            {STAT_CATEGORIES.map((cat) => {
              const statData = stats?.[cat.id] || { level: 1, xp: 0 }
              return (
                <StatCard 
                  key={cat.id} 
                  name={cat.name} 
                  level={statData.level} 
                  xp={statData.xp} 
                  icon={ICON_MAP[cat.icon]} 
                />
              )
            })}
          </div>
        </motion.div>

        {/* TODAY OVERVIEW */}
        <div className="grid-2">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <HudPanel label="OPERATIONS (TODAY)">
              <div className="flex-between mb-4">
                <span className="font-mono text-sm text-amber">COMPLETED: {completedTasks}/{todayTasks.length}</span>
                <Link href="/tasks" className="badge badge-amber">MANAGE</Link>
              </div>
              <div className="flex-col gap-2">
                {todayTasks.length > 0 ? (
                  todayTasks.slice(0, 5).map(task => (
                    <div key={task.id} className={`task-item ${task.status === 'completed' ? 'completed' : ''}`}>
                      <span className="task-title flex-1">{task.title}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-muted font-mono text-sm">NO OPERATIONS SCHEDULED</span>
                )}
              </div>
            </HudPanel>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="flex-col gap-6">
            <HudPanel label="STREAK INTELLIGENCE">
              <div className="flex items-center gap-4">
                <Flame size={48} className="text-warning" style={{ filter: 'drop-shadow(0 0 10px var(--warning-subtle))' }} />
                <div className="flex-col">
                  <span className="font-mono text-4xl text-warning font-bold">{profile?.streak_days || 0}</span>
                  <span className="font-display text-sm text-muted uppercase tracking-wider">Day Streak</span>
                </div>
              </div>
            </HudPanel>

            <HudPanel label="SCHEDULE">
              <div className="flex-col gap-3">
                {todayEvents.length > 0 ? (
                  todayEvents.map(event => (
                    <div key={event.id} className="flex gap-3 text-sm">
                      <span className="font-mono text-amber shrink-0">{new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <span className="text-primary truncate">{event.title}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-muted font-mono text-sm">NO EVENTS DETECTED</span>
                )}
              </div>
            </HudPanel>
          </motion.div>
        </div>

      </div>
    </AppShell>
  )
}
