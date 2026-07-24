'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useHabits } from '@/lib/hooks/useHabits'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Brain, Zap, Target, Award, CheckCircle, Crosshair, TrendingUp, Search, Calendar, Flame, Lock, Unlock, Play, Pause, AlertTriangle, ChevronRight, X, Edit2, Trash2, Plus, Smartphone, Settings, BarChart2, Briefcase, Heart, BookOpen, User as UserIcon, LogOut, Sun, Moon, Cpu, Coffee, Activity, ArrowRight, ShieldAlert, Navigation, Layers, Link as LinkIcon, Database, ArrowUpCircle, Eye, Skull, Rocket, Sparkles, Dumbbell, Swords } from 'lucide-react'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { getLocalDateStr } from '@/lib/utils/dates'

// ── DEFAULT BLUEPRINT DATA ──
const DEFAULT_BLUEPRINT = {
  identity: 'Founder, Builder, AI Educator, Marketer, Operator, Lifelong Learner',
  mission: 'Build Beyond Tatva into a leading AI education platform that helps students use AI effectively while creating financial freedom, meaningful impact, and long term personal growth.',
  motives: `I do not want to spend my life working on goals chosen by other people.\n\nI want to build something valuable that improves the lives of students and creates opportunities for myself and my family.\n\nBeyond Tatva is more than a business. It is proof that I can turn ideas into reality.`,
  strengths: ['Fast learner', 'Curious about technology', 'Willing to experiment', 'Strong interest in AI', 'Creative thinker'],
  weaknesses: ['Phone addiction', 'Inconsistent execution', 'Overplanning', 'Starting too many projects', 'Difficulty focusing on one priority'],
  values_list: ['No quitting Beyond Tatva', 'Workout at least 3 times per week', 'Maintain personal hygiene', 'Daily learning', 'Journal regularly'],
  future_vision: `Build Beyond Tatva into a recognized education company.\n\nGenerate sustainable income exceeding ₹5 lakh per month.`
}

const DEFAULT_BATTLES = [
  { name: 'Phone Addiction', hp: 80, severity: 'high', notes: 'Primary discipline threat.', linked_habits: [] },
  { name: 'Porn Consumption', hp: 90, severity: 'high', notes: 'Drain on discipline and self-respect.', linked_habits: [] },
  { name: 'Inconsistent Execution', hp: 70, severity: 'high', notes: 'Starting strong, dropping off.', linked_habits: [] }
]

export default function OperatorDashboard() {
  const { user } = useAuth()
  const { habits } = useHabits()
  const [loading, setLoading] = useState(true)
  const [blueprint, setBlueprint] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  
  const [battles, setBattles] = useState(DEFAULT_BATTLES)
  const [showAddBattle, setShowAddBattle] = useState(false)
  const [newBattle, setNewBattle] = useState({ name: '', severity: 'medium', notes: '', linked_habits: [], hp: 100 })
  const [todayHabitLogs, setTodayHabitLogs] = useState([])
  const [todayScreenTime, setTodayScreenTime] = useState(null)
  const [selectedBattleIntel, setSelectedBattleIntel] = useState(null)

  const [form, setForm] = useState({
    identity: DEFAULT_BLUEPRINT.identity,
    mission: DEFAULT_BLUEPRINT.mission,
    motives: DEFAULT_BLUEPRINT.motives,
    values_list: DEFAULT_BLUEPRINT.values_list.join('\n'),
    weaknesses: DEFAULT_BLUEPRINT.weaknesses.join('\n'),
    strengths: DEFAULT_BLUEPRINT.strengths.join('\n'),
    future_vision: DEFAULT_BLUEPRINT.future_vision
  })

  useEffect(() => {
    if (!user) return
    fetchBlueprint()
  }, [user])

  const fetchBlueprint = async () => {
    const supabase = createClient()
    const { data: rows, error } = await supabase.from('user_blueprints').select('*').eq('user_id', user.id)
    
    if (error) {
      console.error('Error fetching blueprint:', error)
    }

    if (rows && rows.length > 0) {
      const data = rows[0] // take the first one if multiple exist
      setBlueprint(data)
      setForm({
        identity: data.identity || DEFAULT_BLUEPRINT.identity,
        mission: data.mission || DEFAULT_BLUEPRINT.mission,
        motives: data.motives || DEFAULT_BLUEPRINT.motives,
        values_list: data.values_list ? data.values_list.join('\n') : DEFAULT_BLUEPRINT.values_list.join('\n'),
        weaknesses: data.weaknesses ? data.weaknesses.join('\n') : DEFAULT_BLUEPRINT.weaknesses.join('\n'),
        strengths: data.strengths ? data.strengths.join('\n') : DEFAULT_BLUEPRINT.strengths.join('\n'),
        future_vision: data.future_vision || DEFAULT_BLUEPRINT.future_vision
      })
      if (data.battles && Array.isArray(data.battles)) {
        // Migrate old battles (status) to new battles (hp)
        const migratedBattles = data.battles.map(b => ({
          name: b.name,
          severity: b.severity,
          notes: b.notes,
          hp: b.hp !== undefined ? b.hp : (b.status === 'defeated' ? 0 : 100),
          linked_habits: b.linked_habits || []
        }))
        setBattles(migratedBattles)
      } else {
        setBattles([]) // If data.battles is null or undefined or empty in a weird way, reset it.
      }
    } else {
      setBattles(DEFAULT_BATTLES) // Fallback if no blueprint
    }

    const todayStr = getLocalDateStr(new Date())

    // Fetch today's habit logs for live battle intel
    const { data: hLogs } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayStr)
    setTodayHabitLogs(hLogs || [])

    // Fetch today's screen time log for live battle intel
    const { data: stLogs } = await supabase
      .from('screen_time_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayStr)
      .limit(1)
    if (stLogs && stLogs.length > 0) setTodayScreenTime(stLogs[0])

    setLoading(false)
  }

  const handleStrikeBack = async (idx) => {
    if (!user) return
    const updated = [...battles]
    const target = updated[idx]
    if (!target) return

    const oldHp = target.hp ?? 100
    const newHp = Math.max(0, oldHp - 10)
    target.hp = newHp

    if (!target.combat_logs) target.combat_logs = []
    target.combat_logs.unshift({
      date: getLocalDateStr(new Date()),
      action: '⚡ STRIKE BACK EXECUTED',
      hpChange: -10
    })

    let xpAward = 25
    if (newHp === 0 && oldHp > 0) {
      xpAward = 200
    }

    setBattles(updated)

    const supabase = createClient()
    await supabase
      .from('user_blueprints')
      .update({ battles: updated })
      .eq('user_id', user.id)

    await robustAwardXP(user.id, xpAward, `War Room Strike Back: ${target.name}`)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      user_id: user.id,
      identity: form.identity,
      mission: form.mission,
      motives: form.motives,
      values_list: form.values_list.split('\n').filter(Boolean),
      weaknesses: form.weaknesses.split('\n').filter(Boolean),
      strengths: form.strengths.split('\n').filter(Boolean),
      future_vision: form.future_vision,
      battles: battles
    }

    let result
    if (blueprint) {
      result = await supabase.from('user_blueprints').update(payload).eq('id', blueprint.id)
    } else {
      result = await supabase.from('user_blueprints').insert([payload])
    }

    if (result.error) {
      console.error('Error saving blueprint:', result.error)
      alert('Error saving directives: ' + result.error.message)
    } else {
      await fetchBlueprint()
      setEditMode(false)
    }
    setSaving(false)
  }

  const saveBattlesToDB = async (newBattles) => {
    const supabase = createClient()
    let result
    if (blueprint) {
      result = await supabase.from('user_blueprints').update({ battles: newBattles }).eq('id', blueprint.id)
    } else {
      result = await supabase.from('user_blueprints').insert([{
        user_id: user.id,
        identity: form.identity,
        mission: form.mission,
        motives: form.motives,
        values_list: form.values_list.split('\n').filter(Boolean),
        weaknesses: form.weaknesses.split('\n').filter(Boolean),
        strengths: form.strengths.split('\n').filter(Boolean),
        future_vision: form.future_vision,
        battles: newBattles
      }])
    }

    if (result.error) {
      console.error('Error saving battles:', result.error)
      alert('Error saving war room updates: ' + result.error.message)
    } else {
      await fetchBlueprint()
    }
  }

  const addBattle = async () => {
    if (!newBattle.name.trim()) return
    const currentBattles = await new Promise(resolve => {
      setBattles(prev => {
        const next = [...prev, { ...newBattle }]
        resolve(next)
        return next
      })
    })
    setNewBattle({ name: '', severity: 'medium', notes: '', linked_habits: [], hp: 100 })
    setShowAddBattle(false)
    await saveBattlesToDB(currentBattles)
  }

  const removeBattle = async (idx) => {
    const currentBattles = await new Promise(resolve => {
      setBattles(prev => {
        const next = prev.filter((_, i) => i !== idx)
        resolve(next)
        return next
      })
    })
    await saveBattlesToDB(currentBattles)
  }

  const toggleLinkedHabit = async (battleIdx, habitId) => {
    const currentBattles = await new Promise(resolve => {
      setBattles(prev => {
        const next = prev.map((b, i) => {
          if (i !== battleIdx) return b
          const isLinked = b.linked_habits?.includes(habitId)
          return {
            ...b,
            linked_habits: isLinked 
              ? b.linked_habits.filter(id => id !== habitId)
              : [...(b.linked_habits || []), habitId]
          }
        })
        resolve(next)
        return next
      })
    })
    await saveBattlesToDB(currentBattles)
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">ACCESSING IDENTITY MATRIX...</span></div></AppShell>

  const SEVERITY_COLORS = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--info)' }

  return (
    <AppShell>
      <div className="page-container full" style={{ padding: 'var(--space-4)', maxWidth: '1600px', margin: '0 auto' }}>
        <header className="page-header flex-between mb-8">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-widest text-primary uppercase">OPERATOR DASHBOARD</h1>
            <p className="font-mono text-xs text-amber tracking-widest uppercase mt-1">Identity Matrix & War Room</p>
          </div>
          <div className="flex gap-3">
            <button className={`btn ${editMode ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setEditMode(!editMode)}>
              {editMode ? 'CANCEL' : 'ENTER EDIT MODE'}
            </button>
            {editMode && (
              <button className="btn btn-primary bg-success text-white border-success-subtle hover:bg-success-glow" onClick={handleSave} disabled={saving}>
                {saving ? 'SAVING...' : 'SAVE DIRECTIVES'}
              </button>
            )}
          </div>
        </header>

        <style dangerouslySetInnerHTML={{__html: `
          .operator-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: var(--space-6);
            align-items: start;
          }
          @media (min-width: 1024px) {
            .operator-grid {
              grid-template-columns: 3fr 5fr 4fr;
            }
          }
        `}} />

        <div className="operator-grid">
          
          {/* ── COLUMN 1: IDENTITY ── */}
          <div className="flex flex-col gap-6">
            <HudPanel glow className="border-info" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}>
              <div className="flex items-center gap-2 mb-4 text-info border-b border-border-color pb-2">
                <UserIcon size={16} /> <span className="font-display text-lg uppercase tracking-widest">IDENTITY</span>
              </div>
              {editMode ? (
                <textarea className="textarea h-32 font-mono text-xs" value={form.identity} onChange={e => setForm({...form, identity: e.target.value})} />
              ) : (
                <div className="font-mono text-sm leading-relaxed text-secondary">{form.identity}</div>
              )}
            </HudPanel>

            <HudPanel className="border-amber" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}>
              <div className="flex items-center gap-2 mb-4 text-amber border-b border-border-color pb-2">
                <Target size={16} /> <span className="font-display text-lg uppercase tracking-widest">MISSION</span>
              </div>
              {editMode ? (
                <textarea className="textarea h-48 font-mono text-xs" value={form.mission} onChange={e => setForm({...form, mission: e.target.value})} />
              ) : (
                <div className="font-mono text-sm leading-relaxed text-primary">{form.mission}</div>
              )}
            </HudPanel>

            <HudPanel className="border-border-color" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}>
              <div className="flex items-center gap-2 mb-4 text-muted border-b border-border-color pb-2">
                <Eye size={16} /> <span className="font-display text-lg uppercase tracking-widest">5-YEAR ENDGAME</span>
              </div>
              {editMode ? (
                <textarea className="textarea h-48 font-mono text-xs" value={form.future_vision} onChange={e => setForm({...form, future_vision: e.target.value})} />
              ) : (
                <div className="font-mono text-xs leading-relaxed text-secondary whitespace-pre-wrap">{form.future_vision}</div>
              )}
            </HudPanel>
          </div>

          {/* ── COLUMN 2: WAR ROOM / BATTLES ── */}
          <div className="flex flex-col gap-6">
            <HudPanel glow className="border-danger" style={{ clipPath: 'polygon(0 15px, 15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}>
              <div className="flex items-center justify-between mb-4 border-b border-danger-subtle pb-3">
                <div className="flex items-center gap-2 text-danger">
                  <Swords size={20} className="animate-pulse" /> 
                  <div>
                    <span className="font-display text-xl uppercase tracking-widest font-bold block">WAR ROOM</span>
                    <span className="font-mono text-[9px] text-muted uppercase">Tactical Threat Mitigation & Counter-Measures</span>
                  </div>
                </div>
                {editMode && (
                  <button className="btn btn-ghost btn-sm text-danger hover:bg-danger-subtle flex items-center gap-1" onClick={() => setShowAddBattle(true)}>
                    <Plus size={14} /> DEPLOY BATTLE
                  </button>
                )}
              </div>

              {/* Threat Status Summary Bar */}
              <div className="grid grid-cols-3 gap-2 mb-4 p-2 bg-bg-primary border border-border-color rounded-sm font-mono text-[9px] text-center">
                <div>
                  <div className="text-muted uppercase">ACTIVE</div>
                  <div className="font-bold text-amber">{battles.filter(b => b.hp > 0).length}</div>
                </div>
                <div>
                  <div className="text-muted uppercase">CRITICAL (&gt;75 HP)</div>
                  <div className="font-bold text-danger">{battles.filter(b => b.hp > 75).length}</div>
                </div>
                <div>
                  <div className="text-muted uppercase">SUPPRESSED</div>
                  <div className="font-bold text-success">{battles.filter(b => b.hp <= 40).length}</div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <AnimatePresence>
                  {battles.map((battle, idx) => {
                    const sevColor = SEVERITY_COLORS[battle.severity] || 'var(--info)'

                    // Calculate Live HP & Intel Factors for Today
                    const liveIntel = (function() {
                      let baseHp = 50
                      const succeeded = []
                      const failed = []

                      if (battle.linked_habits && battle.linked_habits.length > 0) {
                        battle.linked_habits.forEach(habitId => {
                          if (habitId === 'sys_screen_intel') return
                          const habit = (habits || []).find(h => h.id === habitId)
                          const log = (todayHabitLogs || []).find(l => l.habit_id === habitId)
                          const title = habit?.title || 'Linked Habit'

                          if (log?.status === 'completed') {
                            baseHp -= 15
                            succeeded.push(`Completed habit "${title}" (-15 HP to threat)`)
                          } else if (log?.status === 'failed') {
                            baseHp += 20
                            failed.push(`Failed habit "${title}" (+20 HP to threat)`)
                          } else {
                            baseHp += 5
                            failed.push(`Pending habit "${title}" (+5 HP threat drift)`)
                          }
                        })
                      }

                      const bName = battle.name?.toLowerCase() || ''
                      if (bName.includes('phone') || bName.includes('screen') || bName.includes('addiction') || bName.includes('execution')) {
                        if (todayScreenTime) {
                          const tHours = parseFloat(todayScreenTime.total_hours) || 0
                          const dMins  = parseInt(todayScreenTime.doom_scroll_minutes ?? todayScreenTime.doomscroll_minutes) || 0
                          const sHours = parseFloat(todayScreenTime.streaming_hours) || 0

                          if (tHours <= 6) {
                            baseHp -= 10
                            succeeded.push(`Screen Time (${tHours}h) ≤ 6h limit (-10 HP)`)
                          } else {
                            baseHp += 15
                            failed.push(`Screen Time (${tHours}h) > 6h limit (+15 HP)`)
                          }

                          if (dMins <= 60) {
                            baseHp -= 10
                            succeeded.push(`Doomscroll (${dMins}m) ≤ 60m limit (-10 HP)`)
                          } else {
                            baseHp += 15
                            failed.push(`Doomscroll (${dMins}m) > 60m limit (+15 HP)`)
                          }

                          if (sHours <= 2) {
                            baseHp -= 5
                            succeeded.push(`Streaming (${sHours}h) ≤ 2h limit (-5 HP)`)
                          } else {
                            baseHp += 10
                            failed.push(`Streaming (${sHours}h) > 2h limit (+10 HP)`)
                          }
                        } else {
                          failed.push(`No Screen Time logged today (+10 HP threat drift)`)
                          baseHp += 10
                        }
                      }

                      const hp = Math.max(0, Math.min(100, baseHp))
                      return { hp, succeeded, failed }
                    })()

                    const hp = liveIntel.hp
                    const isDefeated = hp <= 0
                    const isCritical = hp > 75
                    const borderColor = isDefeated ? 'var(--text-muted)' : sevColor
                    const latestLogs = battle.combat_logs?.slice(0, 2) || []

                    return (
                      <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => setSelectedBattleIntel({ battle, intel: liveIntel })}
                        className={`relative p-4 bg-tertiary border transition-all cursor-pointer hover:border-danger ${isDefeated ? 'opacity-50' : ''}`}
                        style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}>
                        
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className={`font-display text-xl uppercase tracking-wider ${isDefeated ? 'line-through text-muted' : 'text-primary'}`}>
                              {battle.name}
                            </h3>
                            <span className="font-mono text-[9px] px-2 py-0.5 border uppercase mt-1 inline-block"
                              style={{ color: borderColor, borderColor: borderColor }}>
                              {isDefeated ? 'DEFEATED / SUPPRESSED' : `THREAT: ${battle.severity.toUpperCase()}`}
                            </span>
                          </div>
                          
                          {editMode && (
                            <button onClick={(e) => { e.stopPropagation(); removeBattle(idx); }} className="text-muted hover:text-danger p-1">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        {!isDefeated && (
                          <div className="mt-4 mb-2">
                            <div className="flex justify-between font-mono text-[10px] mb-1">
                              <span className="text-muted uppercase">LIVE THREAT HP (CLICK FOR INTEL)</span>
                              <span className={hp > 75 ? 'text-danger font-bold' : 'text-amber font-bold'}>{hp} / 100 HP</span>
                            </div>
                            <div className="h-2 w-full bg-bg-primary border border-border-color rounded-full overflow-hidden">
                              <motion.div 
                                className={`h-full ${hp > 75 ? 'bg-danger' : 'bg-amber'}`} 
                                initial={{ width: 0 }} 
                                animate={{ width: `${hp}%` }} 
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>
                        )}

                        {latestLogs.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-border-subtle font-mono text-[9px]">
                            <div className="text-muted mb-1 flex items-center gap-1"><Activity size={10} className="text-info" /> COMBAT HISTORY</div>
                            {latestLogs.map((log, lIdx) => (
                              <div key={lIdx} className="flex justify-between text-secondary py-0.5">
                                <span>{log.date}: {log.action}</span>
                                <span className={log.hpChange < 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                                  {log.hpChange > 0 ? `+${log.hpChange}` : log.hpChange} HP
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-border-subtle">
                          <div className="font-mono text-[10px] text-muted mb-2 flex items-center gap-1"><LinkIcon size={10} /> LINKED COUNTER-MEASURES (ROUTINES)</div>
                          
                          {editMode ? (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {[{ id: 'sys_screen_intel', title: 'SYSTEM: Screen Intel' }, ...habits].map(habit => {
                                const isLinked = battle.linked_habits?.includes(habit.id);
                                return (
                                  <div key={habit.id} onClick={() => toggleLinkedHabit(idx, habit.id)}
                                    className={`text-[10px] font-mono p-1.5 border cursor-pointer truncate transition-colors ${isLinked ? 'border-amber text-amber bg-amber-subtle' : 'border-border-color text-muted hover:border-secondary'}`}>
                                    {isLinked ? '✓ ' : '+ '}{habit.title}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {battle.linked_habits?.length > 0 ? (
                                battle.linked_habits.map(id => {
                                  const habit = id === 'sys_screen_intel' ? { id, title: 'SYSTEM: Screen Intel', category: 'personal_mission' } : habits.find(h => h.id === id);
                                  if (!habit) return null;
                                  
                                  const categoryData = QUEST_CATEGORIES.find(c => c.id === habit.category) || QUEST_CATEGORIES.find(c => c.id === 'other');
                                  const iconName = categoryData?.icon || 'Target';
                                  
                                  // Simple manual icon map since dynamic requires a bit of logic
                                  const IconComponent = {
                                    Rocket: Rocket,
                                    Target: Target,
                                    BookOpen: BookOpen,
                                    Sparkles: Sparkles,
                                    Dumbbell: Dumbbell
                                  }[iconName] || Target;

                                  return (
                                    <div 
                                      key={id} 
                                      className="flex items-center justify-center p-1.5 rounded-sm border opacity-80 hover:opacity-100 transition-opacity cursor-help"
                                      style={{ backgroundColor: `${categoryData.color}15`, borderColor: categoryData.color }}
                                      title={habit.title}
                                    >
                                      <IconComponent size={14} color={categoryData.color} />
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="font-mono text-[9px] text-danger">NO COUNTER-MEASURES DEPLOYED. VULNERABILITY DETECTED.</span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

                {/* Add Battle Modal inline */}
                <AnimatePresence>
                  {showAddBattle && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mt-2 p-4 bg-tertiary border border-danger">
                      <div className="flex justify-between mb-3">
                        <span className="font-display text-sm uppercase text-danger">DEPLOY NEW BATTLE</span>
                        <button onClick={() => setShowAddBattle(false)} className="text-muted hover:text-danger"><X size={16} /></button>
                      </div>
                      <div className="flex flex-col gap-3">
                        <input type="text" className="input font-mono" placeholder="Battle name..." value={newBattle.name} onChange={e => setNewBattle({...newBattle, name: e.target.value})} autoFocus />
                        <select className="select font-mono" value={newBattle.severity} onChange={e => setNewBattle({...newBattle, severity: e.target.value})}>
                          <option value="low">LOW THREAT</option>
                          <option value="medium">MEDIUM THREAT</option>
                          <option value="high">HIGH THREAT</option>
                          <option value="extreme">EXTREME THREAT</option>
                        </select>
                        <button onClick={addBattle} className="btn btn-primary w-full text-danger border-danger hover:bg-danger-subtle">DEPLOY BATTLE</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </HudPanel>
          </div>

          {/* ── COLUMN 3: INTEL ── */}
          <div className="flex flex-col gap-6">
            <HudPanel className="border-success" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}>
              <div className="flex items-center gap-2 mb-4 text-success border-b border-border-color pb-2">
                <Shield size={16} /> <span className="font-display text-lg uppercase tracking-widest">KNOWN ADVANTAGES</span>
              </div>
              {editMode ? (
                <textarea className="textarea h-40 font-mono text-xs" value={form.strengths} onChange={e => setForm({...form, strengths: e.target.value})} />
              ) : (
                <ul className="flex flex-col gap-2 font-mono text-xs text-secondary">
                  {form.strengths.split('\n').filter(Boolean).map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-success">■</span> {s}</li>
                  ))}
                </ul>
              )}
            </HudPanel>

            <HudPanel className="border-danger" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}>
              <div className="flex items-center gap-2 mb-4 text-danger border-b border-border-color pb-2">
                <AlertTriangle size={16} /> <span className="font-display text-lg uppercase tracking-widest">VULNERABILITIES</span>
              </div>
              {editMode ? (
                <textarea className="textarea h-40 font-mono text-xs" value={form.weaknesses} onChange={e => setForm({...form, weaknesses: e.target.value})} />
              ) : (
                <ul className="flex flex-col gap-2 font-mono text-xs text-secondary">
                  {form.weaknesses.split('\n').filter(Boolean).map((w, i) => (
                    <li key={i} className="flex gap-2"><span className="text-danger">■</span> {w}</li>
                  ))}
                </ul>
              )}
            </HudPanel>

            <HudPanel glow className="border-amber" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}>
              <div className="flex items-center gap-2 mb-4 text-amber border-b border-border-color pb-2">
                <Flame size={16} /> <span className="font-display text-lg uppercase tracking-widest">THE CODE (NON-NEGOTIABLES)</span>
              </div>
              {editMode ? (
                <textarea className="textarea h-40 font-mono text-xs" value={form.values_list} onChange={e => setForm({...form, values_list: e.target.value})} />
              ) : (
                <ul className="flex flex-col gap-3 font-mono text-xs text-primary">
                  {form.values_list.split('\n').filter(Boolean).map((v, i) => (
                    <li key={i} className="flex gap-2 p-2 border border-border-color bg-tertiary">
                      <span className="text-amber">{String(i+1).padStart(2, '0')}</span> {v}
                    </li>
                  ))}
                </ul>
              )}
            </HudPanel>
          </div>

        </div>
      </div>
      {/* COMBAT INTEL MODAL */}
      <AnimatePresence>
        {selectedBattleIntel && (
          <div className="modal-overlay" onClick={() => setSelectedBattleIntel(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg p-6 bg-tertiary border border-danger rounded-sm shadow-2xl relative m-4"
            >
              <button 
                onClick={() => setSelectedBattleIntel(null)}
                className="absolute top-4 right-4 text-muted hover:text-primary"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2 text-danger mb-4 border-b border-border-color pb-3">
                <Swords size={18} className="animate-pulse" />
                <span className="font-display text-lg uppercase tracking-widest font-bold">
                  COMBAT INTEL // {selectedBattleIntel.battle.name}
                </span>
              </div>

              <div className="mb-6">
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-muted">LIVE REAL-TIME THREAT HP</span>
                  <span className="font-bold text-danger">{selectedBattleIntel.intel.hp} / 100 HP</span>
                </div>
                <div className="h-3 w-full bg-bg-primary border border-border-color rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-danger transition-all duration-500" 
                    style={{ width: `${selectedBattleIntel.intel.hp}%` }}
                  />
                </div>
              </div>

              {/* WHY SUCCEEDED (GREEN) */}
              <div className="mb-4 p-3 bg-success/5 border border-success/30 rounded-sm font-mono text-xs">
                <div className="text-success font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                  <CheckCircle size={14} /> WHY THREAT HP IS DECREASING (SUCCEEDED)
                </div>
                {selectedBattleIntel.intel.succeeded.length > 0 ? (
                  <ul className="flex flex-col gap-1.5 text-secondary">
                    {selectedBattleIntel.intel.succeeded.map((reason, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-success font-bold">•</span> {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted text-[10px]">No victory factors achieved yet today.</div>
                )}
              </div>

              {/* WHY FAILED (RED) */}
              <div className="mb-6 p-3 bg-danger/5 border border-danger/30 rounded-sm font-mono text-xs">
                <div className="text-danger font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                  <AlertTriangle size={14} /> WHY THREAT HP IS INCREASING (FAILED / PENALTY)
                </div>
                {selectedBattleIntel.intel.failed.length > 0 ? (
                  <ul className="flex flex-col gap-1.5 text-secondary">
                    {selectedBattleIntel.intel.failed.map((reason, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-danger font-bold">•</span> {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-success text-[10px]">Zero failure penalties active today! Perfect defense.</div>
                )}
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={() => setSelectedBattleIntel(null)}
                  className="btn btn-primary btn-sm font-mono text-xs"
                >
                  CLOSE INTEL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
