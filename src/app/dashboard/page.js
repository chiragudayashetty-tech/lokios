'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crosshair, Target, Shield, Dumbbell, BookOpen, Clock, Activity, AlertTriangle, CheckSquare, Zap, Terminal, BatteryCharging } from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import IntelligenceFeed from '@/components/ui/IntelligenceFeed'
import { useProfile } from '@/lib/hooks/useProfile'
import { useTasks } from '@/lib/hooks/useTasks'
import { useGoals } from '@/lib/hooks/useGoals'
import { useHabits } from '@/lib/hooks/useHabits'
import { createClient } from '@/lib/supabase/client'

export default function MissionControl() {
  const { profile } = useProfile()
  const { mainQuest, sideQuests } = useGoals()
  const { tasks, todayTasks, completeTask } = useTasks()
  const { habits, todayLogs, toggleHabit } = useHabits()
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    async function fetchTimeline() {
      const supabase = createClient()
      const { data } = await supabase
        .from('xp_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6)
      if (data) setTimeline(data)
    }
    fetchTimeline()
  }, [])

  // Section 3: Today's Battle Plan (Active Habits + Due Tasks)
  const activeHabits = habits.filter(h => !todayLogs.some(log => log.habit_id === h.id))
  const completedHabits = habits.filter(h => todayLogs.some(log => log.habit_id === h.id))
  const pendingTasks = todayTasks.filter(t => t.status !== 'completed')

  // Section 4: Next Action (Highest Priority Pending Task)
  const allPending = tasks.filter(t => t.status !== 'completed')
  const nextAction = allPending.sort((a, b) => b.priority - a.priority)[0]

  // Section 2: Current Battles
  const getBattleStatus = (statCategory) => {
    const relatedHabits = habits.filter(h => h.stat_category === statCategory)
    const totalHabits = relatedHabits.length
    if (totalHabits === 0) return { progress: 0, label: 'INACTIVE', color: 'var(--text-muted)' }
    const completed = relatedHabits.filter(h => todayLogs.some(l => l.habit_id === h.id)).length
    const progress = Math.round((completed / totalHabits) * 100)
    return { 
      progress, 
      label: progress === 100 ? 'SECURED' : progress > 0 ? 'ENGAGED' : 'VULNERABLE',
      color: progress === 100 ? 'var(--success)' : progress > 0 ? 'var(--accent-primary)' : 'var(--danger)'
    }
  }

  const BATTLES = [
    { id: 'phone', name: 'PHONE ADDICTION', icon: BatteryCharging, ...getBattleStatus('discipline') },
    { id: 'fitness', name: 'PHYSICAL CONDITIONING', icon: Dumbbell, ...getBattleStatus('strength') },
    { id: 'comm', name: 'COMMUNICATION', icon: Terminal, ...getBattleStatus('learning') },
    { id: 'personal', name: 'PERSONAL CARE', icon: Shield, ...getBattleStatus('discipline') }
  ]

  return (
    <AppShell>
      <div className="page-container relative max-w-[1600px]">
        
        {/* HEADER */}
        <header className="mb-6 flex-between flex-wrap gap-4 border-b border-border-color pb-4">
          <div>
            <h1 className="font-display text-4xl uppercase tracking-widest text-primary glow-amber flex items-center gap-3">
              <Crosshair size={28} className="text-amber" /> MISSION CONTROL
            </h1>
            <p className="font-mono text-xs uppercase tracking-widest text-muted mt-1">
              OPERATOR: {profile?.full_name || 'CHIRAG SHETTY'} // CLASS: FOUNDER // ARC: DISCIPLINE REBUILD
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl text-amber">{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</div>
            <div className="font-mono text-[10px] text-muted tracking-widest uppercase">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Main Ops (8 cols) */}
          <div className="xl:col-span-8 flex-col gap-6">
            
            {/* INTELLIGENCE FEED */}
            <IntelligenceFeed />

            {/* SECTION 1: CURRENT MISSION */}
            <HudPanel glow scanLine className="relative overflow-hidden border-amber" style={{ minHeight: '180px' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber opacity-5 blur-[100px] rounded-full" />
              <div className="flex-between mb-4">
                <span className="font-mono text-xs text-amber flex items-center gap-2"><Target size={14} /> CURRENT MISSION</span>
                <span className="badge badge-amber animate-pulse">ACTIVE</span>
              </div>
              
              {mainQuest ? (
                <>
                  <h2 className="font-display text-4xl uppercase tracking-wider text-primary mb-2">{mainQuest.title}</h2>
                  <p className="font-mono text-sm text-secondary mb-8 max-w-2xl">{mainQuest.description || 'Execution phase initialized.'}</p>
                  <TacticalProgress value={mainQuest.progress} max={100} label="MISSION COMPLETION" showValue color="var(--accent-primary)" />
                </>
              ) : (
                <div className="flex-center flex-col h-full opacity-50 py-8">
                  <AlertTriangle size={32} className="text-amber mb-2" />
                  <span className="font-mono text-sm">AWAITING PRIMARY MISSION DIRECTIVE</span>
                  <Link href="/goals" className="btn btn-primary btn-sm mt-4">ASSIGN MISSION</Link>
                </div>
              )}
            </HudPanel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* SECTION 3: TODAY'S BATTLE PLAN */}
              <HudPanel label="TODAY'S BATTLE PLAN">
                <div className="flex-col gap-3">
                  <AnimatePresence>
                    {activeHabits.map(habit => (
                      <motion.div key={habit.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, height:0}}
                        className="flex items-center gap-3 p-3 bg-tertiary border border-border-color group hover:border-amber transition-colors cursor-pointer"
                        onClick={() => toggleHabit(habit.id)}
                      >
                        <div className="w-4 h-4 border border-border-strong group-hover:border-amber flex-center shrink-0" />
                        <span className="font-mono text-sm text-primary flex-1 truncate">{habit.title}</span>
                      </motion.div>
                    ))}
                    {pendingTasks.map(task => (
                      <motion.div key={task.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, height:0}}
                        className="flex items-center gap-3 p-3 bg-tertiary border border-border-color group hover:border-amber transition-colors cursor-pointer"
                        onClick={() => completeTask(task.id)}
                      >
                        <div className="w-4 h-4 border border-border-strong group-hover:border-amber flex-center shrink-0" />
                        <span className="font-mono text-sm text-primary flex-1 truncate">{task.title}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {activeHabits.length === 0 && pendingTasks.length === 0 && (
                    <div className="p-4 text-center border border-success-subtle bg-success-subtle">
                      <span className="font-mono text-xs text-success tracking-widest">ALL OBJECTIVES SECURED</span>
                    </div>
                  )}
                </div>
              </HudPanel>

              {/* SECTION 4: NEXT ACTION */}
              <HudPanel label="NEXT ACTION">
                {nextAction ? (
                  <div className="flex-col h-full justify-center py-4">
                    <div className="mb-4">
                      <span className="font-mono text-[10px] text-danger bg-danger-subtle px-2 py-1 uppercase border border-danger">HIGHEST PRIORITY</span>
                    </div>
                    <h3 className="font-display text-2xl uppercase tracking-wide text-primary mb-2">{nextAction.title}</h3>
                    <p className="font-mono text-xs text-secondary mb-6">{nextAction.description || 'Awaiting execution.'}</p>
                    <button onClick={() => completeTask(nextAction.id)} className="btn btn-primary w-full flex-center gap-2">
                      <Zap size={16} /> EXECUTE
                    </button>
                  </div>
                ) : (
                  <div className="flex-center flex-col h-full opacity-50 py-12">
                    <CheckSquare size={32} className="text-success mb-2" />
                    <span className="font-mono text-sm">NO PENDING ACTIONS</span>
                  </div>
                )}
              </HudPanel>

            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar (4 cols) */}
          <div className="xl:col-span-4 flex-col gap-6">
            
            {/* SECTION 2: CURRENT BATTLES */}
            <HudPanel label="CURRENT BATTLES" className="border-info">
              <div className="flex-col gap-4">
                {BATTLES.map(battle => {
                  const Icon = battle.icon
                  return (
                    <div key={battle.id} className="relative p-3 bg-tertiary border border-border-color overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: battle.color }} />
                      <div className="flex-between mb-2 pl-2">
                        <div className="flex items-center gap-2">
                          <Icon size={14} style={{ color: battle.color }} />
                          <span className="font-mono text-xs text-primary">{battle.name}</span>
                        </div>
                        <span className="font-mono text-[10px]" style={{ color: battle.color }}>{battle.label}</span>
                      </div>
                      <div className="pl-2">
                        <div className="w-full h-1 bg-bg-primary rounded-full overflow-hidden">
                          <div className="h-full transition-all duration-1000" style={{ width: `${battle.progress}%`, backgroundColor: battle.color }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </HudPanel>

            {/* SECTION 5: ACTIVITY TIMELINE */}
            <HudPanel label="ACTIVITY TIMELINE" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-col gap-0 flex-1 overflow-y-auto pr-2" style={{ maxHeight: '400px' }}>
                <AnimatePresence>
                  {timeline.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className="relative pl-6 py-3 border-l border-border-strong group hover:border-amber transition-colors"
                    >
                      <div className="absolute left-[-4px] top-4 w-2 h-2 rounded-full bg-border-color group-hover:bg-amber transition-colors" />
                      <div className="font-mono text-[9px] text-muted mb-1">{new Date(item.created_at).toLocaleTimeString()}</div>
                      <div className="font-mono text-xs text-primary uppercase leading-relaxed">{item.description}</div>
                      <div className="font-mono text-[10px] text-amber mt-1">+{item.amount} XP</div>
                    </motion.div>
                  ))}
                  {timeline.length === 0 && <div className="font-mono text-xs text-muted py-4">NO RECENT ACTIVITY DETECTED.</div>}
                </AnimatePresence>
              </div>
              <div className="pt-4 mt-2 border-t border-border-color text-center">
                <Link href="/portfolio-log" className="font-mono text-xs text-amber hover:text-primary transition-colors underline">VIEW FULL LOGS</Link>
              </div>
            </HudPanel>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
