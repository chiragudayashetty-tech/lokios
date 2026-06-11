'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crosshair, Target, Shield, Dumbbell, BookOpen, Clock, Activity, AlertTriangle, CheckSquare, Zap, Terminal, BatteryCharging, Swords, Smartphone, Moon, Brain, DollarSign, Repeat } from 'lucide-react'
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

// Battle icon mapping
const BATTLE_ICONS = {
  'Phone Addiction': Smartphone,
  'Porn Consumption': Shield,
  'Inconsistent Execution': Repeat,
  'Fear of Selling': DollarSign,
  'Poor Sleep Discipline': Moon,
  'Overthinking': Brain,
}

export default function MissionControl() {
  const { profile } = useProfile()
  const { mainQuest, sideQuests } = useGoals()
  const { tasks, todayTasks, completeTask } = useTasks()
  const { habits, todayLogs, toggleHabit } = useHabits()
  const [timeline, setTimeline] = useState([])
  const [battles, setBattles] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      
      // Fetch timeline
      const { data: timelineData } = await supabase
        .from('xp_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8)
      if (timelineData) setTimeline(timelineData)

      // Fetch battles from blueprint
      const { data: bpData } = await supabase
        .from('user_blueprints')
        .select('battles')
        .single()
      if (bpData?.battles) {
        setBattles(bpData.battles.filter(b => b.status !== 'defeated'))
      }
    }
    fetchData()
  }, [])

  // Today's Battle Plan
  const activeHabits = habits.filter(h => !todayLogs.some(log => log.habit_id === h.id))
  const completedHabits = habits.filter(h => todayLogs.some(log => log.habit_id === h.id))
  const pendingTasks = todayTasks.filter(t => t.status !== 'completed')
  const totalTodayItems = habits.length + todayTasks.length
  const completedTodayItems = completedHabits.length + todayTasks.filter(t => t.status === 'completed').length
  const todayPct = totalTodayItems === 0 ? 0 : Math.round((completedTodayItems / totalTodayItems) * 100)

  // Next Action
  const allPending = tasks.filter(t => t.status !== 'completed')
  const nextAction = allPending.sort((a, b) => (b.priority || 3) - (a.priority || 3))[0]

  const STATUS_COLORS = { active: 'var(--danger)', winning: 'var(--success)' }
  const SEVERITY_COLORS = { high: 'var(--danger)', medium: 'var(--accent-primary)', low: 'var(--info)' }

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
            <div className="font-mono text-2xl text-amber">{currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</div>
            <div className="font-mono text-[10px] text-muted tracking-widest uppercase">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* LEFT COLUMN (8 cols) */}
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

            {/* TODAY'S PROGRESS BAR */}
            <HudPanel className="p-4">
              <div className="flex-between mb-2">
                <span className="font-mono text-xs text-amber uppercase tracking-widest">TODAY'S PROGRESS</span>
                <span className="font-mono text-xs text-primary">{completedTodayItems} / {totalTodayItems}</span>
              </div>
              <div className="w-full h-3 bg-bg-primary rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${todayPct}%`, background: todayPct === 100 ? 'var(--success)' : 'var(--accent-primary)' }} />
              </div>
            </HudPanel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* SECTION 3: TODAY'S BATTLE PLAN */}
              <HudPanel label="TODAY'S BATTLE PLAN">
                <div className="flex-col gap-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <AnimatePresence>
                    {activeHabits.map(habit => (
                      <motion.div key={habit.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, height:0}}
                        className="flex items-center gap-3 p-3 bg-tertiary border border-border-color group hover:border-amber transition-colors cursor-pointer"
                        onClick={() => toggleHabit(habit.id)}>
                        <div className="w-4 h-4 border border-border-strong group-hover:border-amber flex-center shrink-0" />
                        <span className="font-mono text-sm text-primary flex-1 truncate">{habit.title}</span>
                        <span className="font-mono text-[9px] text-amber">+{habit.xp_per_completion || 5}</span>
                      </motion.div>
                    ))}
                    {pendingTasks.map(task => (
                      <motion.div key={task.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, height:0}}
                        className="flex items-center gap-3 p-3 bg-tertiary border border-info-subtle group hover:border-info transition-colors cursor-pointer"
                        onClick={() => completeTask(task.id)}>
                        <div className="w-4 h-4 border border-info flex-center shrink-0" />
                        <span className="font-mono text-sm text-primary flex-1 truncate">{task.title}</span>
                        <span className="font-mono text-[9px] text-info">TASK</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {completedHabits.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border-subtle">
                      <div className="font-mono text-[9px] text-muted mb-2">COMPLETED ({completedHabits.length})</div>
                      {completedHabits.map(h => (
                        <div key={h.id} className="flex items-center gap-3 p-2 opacity-40 cursor-pointer hover:opacity-60" onClick={() => toggleHabit(h.id)}>
                          <div className="w-4 h-4 bg-success flex-center shrink-0 rounded-sm">
                            <CheckSquare size={10} color="#fff" />
                          </div>
                          <span className="font-mono text-xs text-muted line-through">{h.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
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

          {/* RIGHT COLUMN (4 cols) */}
          <div className="xl:col-span-4 flex-col gap-6">

            {/* SECTION 2: ACTIVE BATTLES */}
            <HudPanel label="ACTIVE BATTLES" className="border-danger">
              <div className="flex-col gap-3">
                {battles.length > 0 ? battles.map((battle, idx) => {
                  const Icon = BATTLE_ICONS[battle.name] || Swords
                  const statusColor = STATUS_COLORS[battle.status] || 'var(--danger)'
                  const severityColor = SEVERITY_COLORS[battle.severity] || 'var(--accent-primary)'
                  return (
                    <div key={idx} className="relative p-3 bg-tertiary border border-border-color overflow-hidden group hover:border-danger transition-colors">
                      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: severityColor }} />
                      <div className="flex-between mb-1 pl-2">
                        <div className="flex items-center gap-2">
                          <Icon size={14} style={{ color: severityColor }} />
                          <span className="font-mono text-xs text-primary">{battle.name}</span>
                        </div>
                        <span className="font-mono text-[9px] uppercase" style={{ color: statusColor }}>
                          {battle.status === 'winning' ? '🟢 WINNING' : '⚔️ ACTIVE'}
                        </span>
                      </div>
                      {battle.notes && (
                        <p className="font-mono text-[9px] text-muted pl-2 mt-1 truncate">{battle.notes}</p>
                      )}
                    </div>
                  )
                }) : (
                  <div className="flex-col gap-3">
                    {/* Fallback: show default battles if blueprint not loaded */}
                    {['Phone Addiction', 'Inconsistent Execution', 'Fear of Selling', 'Poor Sleep Discipline', 'Overthinking'].map(name => {
                      const Icon = BATTLE_ICONS[name] || Swords
                      return (
                        <div key={name} className="relative p-3 bg-tertiary border border-border-color overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-danger" />
                          <div className="flex items-center gap-2 pl-2">
                            <Icon size={14} className="text-danger" />
                            <span className="font-mono text-xs text-primary">{name}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Link href="/profile" className="font-mono text-[10px] text-muted hover:text-amber text-center transition-colors mt-1">
                  MANAGE BATTLES →
                </Link>
              </div>
            </HudPanel>

            {/* SECTION 5: ACTIVITY TIMELINE */}
            <HudPanel label="ACTIVITY TIMELINE" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-col gap-0 flex-1 overflow-y-auto pr-2" style={{ maxHeight: '400px' }}>
                <AnimatePresence>
                  {timeline.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className="relative pl-6 py-3 border-l border-border-strong group hover:border-amber transition-colors">
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
