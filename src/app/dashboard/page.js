'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crosshair, Target, Shield, Dumbbell, BookOpen, Clock, Activity, AlertTriangle, CheckSquare, Zap, Terminal, BatteryCharging, Swords, Smartphone, Moon, Brain, DollarSign, Repeat } from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import TacticalProgress from '@/components/ui/ProgressBar'
import IntelligenceFeed from '@/components/ui/IntelligenceFeed'
import { useOS } from '@/lib/context/OSContext'
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
  const { profile: { profile }, goals: { mainQuest }, tasks: { tasks, todayTasks }, habits: { habits, todayLogs, toggleHabit }, completeOperation } = useOS()
  const [timeline, setTimeline] = useState([])
  const [battles, setBattles] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function fetchTimeline() {
      const supabase = createClient()
      
      // Fetch timeline
      const { data: timelineData } = await supabase
        .from('xp_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8)
      if (timelineData) setTimeline(timelineData)
    }
    fetchTimeline()
  }, [todayLogs, tasks]) // Refetch when logs or tasks change

  useEffect(() => {
    async function fetchBattles() {
      const supabase = createClient()
      // Fetch battles from blueprint
      const { data: bpData } = await supabase
        .from('user_blueprints')
        .select('battles')
        .single()
      if (bpData?.battles) {
        setBattles(bpData.battles.filter(b => b.status !== 'defeated'))
      }
    }
    fetchBattles()
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

        <header className="mb-8 flex-between flex-wrap gap-4 pb-4">
          <div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-primary flex items-center gap-3">
              MISSION CONTROL
            </h1>
            <p className="font-mono text-xs uppercase tracking-widest text-muted mt-2">
              OPERATOR: {profile?.full_name || 'CHIRAG SHETTY'} // ARC: DISCIPLINE REBUILD
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-bold text-primary tracking-tighter">{currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</div>
            <div className="font-mono text-[10px] text-muted tracking-widest uppercase mt-1">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
        </header>

        <style dangerouslySetInnerHTML={{__html: `
          .bento-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: var(--space-6);
            align-items: stretch;
          }
          @media (min-width: 1024px) {
            .bento-grid {
              grid-template-columns: repeat(12, 1fr);
              grid-auto-rows: minmax(min-content, max-content);
            }
            .bento-col-span-8 { grid-column: span 8; }
            .bento-col-span-4 { grid-column: span 4; }
            .bento-col-span-12 { grid-column: span 12; }
            .bento-col-span-6 { grid-column: span 6; }
          }
        `}} />

        <div className="bento-grid">

          {/* LEFT BENTO AREA (8 cols) */}
          <div className="bento-col-span-8 flex flex-col gap-6">

            {/* INTELLIGENCE FEED */}
            <IntelligenceFeed />

            {/* SECTION 1: CURRENT MISSION */}
            <HudPanel className="relative overflow-hidden border-info-subtle bg-gradient-to-br from-bg-tertiary to-bg-primary" style={{ minHeight: '180px' }}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-info opacity-10 blur-[100px] rounded-full pointer-events-none" />
              <div className="flex-between mb-4 relative z-10">
                <span className="font-mono text-xs text-info flex items-center gap-2"><Target size={14} /> ACTIVE OBJECTIVE</span>
                <span className="badge badge-info animate-pulse">EXECUTING</span>
              </div>

              {mainQuest ? (
                <div className="relative z-10">
                  <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-primary mb-2 leading-tight">{mainQuest.title}</h2>
                  <p className="font-mono text-sm text-secondary mb-8 max-w-2xl">{mainQuest.description || 'Execution phase initialized.'}</p>
                  <TacticalProgress value={mainQuest.progress} max={100} label="MISSION COMPLETION" showValue color="var(--info)" />
                </div>
              ) : (
                <div className="flex-center flex-col h-full opacity-50 py-8 relative z-10">
                  <AlertTriangle size={32} className="text-muted mb-2" />
                  <span className="font-mono text-sm">NO ACTIVE DIRECTIVES</span>
                  <Link href="/goals" className="btn btn-primary btn-sm mt-4">ASSIGN MISSION</Link>
                </div>
              )}
            </HudPanel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* SECTION 3: TODAY'S BATTLE PLAN */}
              <HudPanel label="TODAY'S BATTLE PLAN">
                <div className="flex-col gap-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <AnimatePresence>
                    {activeHabits.map(habit => (
                      <motion.div key={habit.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, height:0}}
                        className="flex items-center gap-3 p-3 bg-tertiary border border-border-color group hover:border-info transition-colors cursor-pointer rounded-md">
                        <div className="w-4 h-4 border border-border-strong group-hover:border-info flex-center shrink-0 rounded-sm" />
                        <span className="font-mono text-sm text-primary flex-1 truncate">{habit.title}</span>
                        <span className="font-mono text-[9px] text-info font-bold">+{habit.xp_per_completion || 5} XP</span>
                      </motion.div>
                    ))}
                    {pendingTasks.map(task => (
                      <motion.div key={task.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, height:0}}
                        className="flex items-center gap-3 p-3 bg-tertiary border border-info-subtle group hover:border-info transition-colors cursor-pointer rounded-md"
                        onClick={() => completeOperation(task.id)}>
                        <div className="w-4 h-4 border border-info flex-center shrink-0 rounded-sm" />
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
              {nextAction && (
                <HudPanel label="NEXT ACTION">
                  <div className="flex-col h-full justify-center py-4">
                    <div className="mb-4">
                      <span className="font-mono text-[10px] text-danger bg-danger-subtle px-2 py-1 uppercase border border-danger">HIGHEST PRIORITY</span>
                    </div>
                    <h3 className="font-display text-2xl uppercase tracking-wide text-primary mb-2">{nextAction.title}</h3>
                    <p className="font-mono text-xs text-secondary mb-6">{nextAction.description || 'Awaiting execution.'}</p>
                    <button onClick={() => completeOperation(nextAction.id)} className="btn btn-primary w-full flex-center gap-2">
                      <Zap size={16} /> EXECUTE
                    </button>
                  </div>
                </HudPanel>
              )}
            </div>
          </div>

          {/* RIGHT BENTO AREA (4 cols) */}
          <div className="bento-col-span-4 flex flex-col gap-6">

            {/* TODAY'S PROGRESS WIDGET */}
            <HudPanel className="p-5 flex-col flex-center text-center relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-success opacity-10 blur-[40px] rounded-full" />
               <h3 className="font-mono text-xs text-muted uppercase tracking-widest mb-1">DAILY COMPLETION</h3>
               <div className="font-display text-6xl font-bold tracking-tighter text-primary my-2">
                 {todayPct}<span className="text-2xl text-secondary">%</span>
               </div>
               <div className="font-mono text-[10px] text-muted">
                 {completedTodayItems} / {totalTodayItems} OBJECTIVES
               </div>
               <div className="mt-6">
                 <TacticalProgress value={todayPct} height={8} showValue={false} color="var(--success)" />
               </div>
            </HudPanel>

            {/* SECTION 2: ACTIVE BATTLES */}
            {battles.length > 0 && (
            <HudPanel label="BATTLE STATUS" className="border-danger-subtle">
              <div className="flex-col gap-3">
                {battles.map((battle, idx) => {
                  const Icon = BATTLE_ICONS[battle.name] || Swords
                  const statusColor = STATUS_COLORS[battle.status] || 'var(--danger)'
                  const severityColor = SEVERITY_COLORS[battle.severity] || 'var(--info)'
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
                })}
                <Link href="/profile" className="font-mono text-[10px] text-muted hover:text-primary hover:underline text-center transition-colors mt-1">
                  MANAGE BATTLES →
                </Link>
              </div>
            </HudPanel>
            )}

            {/* SECTION 5: ACTIVITY TIMELINE */}
            <HudPanel label="ACTIVITY TIMELINE" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-col gap-0 flex-1 overflow-y-auto pr-2" style={{ maxHeight: '400px' }}>
                <AnimatePresence>
                  {timeline.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className="relative pl-6 py-3 border-l border-border-strong group hover:border-info transition-colors">
                      <div className="absolute left-[-4px] top-4 w-2 h-2 rounded-full bg-border-color group-hover:bg-info transition-colors" />
                      <div className="font-mono text-[9px] text-muted mb-1">{new Date(item.created_at).toLocaleTimeString()}</div>
                      <div className="font-mono text-xs text-primary leading-relaxed">{item.description}</div>
                      <div className="font-mono text-[10px] text-info mt-1 font-bold">+{item.amount} XP</div>
                    </motion.div>
                  ))}
                  {timeline.length === 0 && <div className="font-mono text-xs text-muted py-4">NO RECENT ACTIVITY DETECTED.</div>}
                </AnimatePresence>
              </div>
              <div className="pt-4 mt-2 border-t border-border-color text-center">
                <Link href="/xp" className="font-mono text-xs text-info hover:text-primary transition-colors hover:underline">VIEW FULL LOGS</Link>
              </div>
            </HudPanel>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
