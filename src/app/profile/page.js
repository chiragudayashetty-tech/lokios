'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useHabits } from '@/lib/hooks/useHabits'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Brain, Zap, Target, Award, CheckCircle, Crosshair, TrendingUp, Search, Calendar, Flame, Lock, Unlock, Play, Pause, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, X, Edit2, Trash2, Plus, Smartphone, Settings, BarChart2, Briefcase, Heart, BookOpen, User as UserIcon, LogOut, Sun, Moon, Cpu, Coffee, Activity, ArrowRight, ShieldAlert, Navigation, Layers, Link as LinkIcon, Database, ArrowUpCircle, Eye, Skull, Rocket, Sparkles, Dumbbell, Swords } from 'lucide-react'
import { QUEST_CATEGORIES } from '@/lib/constants'
import { getLocalDateStr } from '@/lib/utils/dates'
import { syncWarRoomDailyEvaluator } from '@/lib/utils/warRoomSync'

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
  
  const [openSections, setOpenSections] = useState({
    identity: false,
    mission: false,
    endgame: false,
    warroom: true,
    advantages: false,
    vulnerabilities: false,
    code: false
  })

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }
  
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

    const handleBattlesUpdated = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setBattles(e.detail)
      }
    }
    window.addEventListener('lokios_battles_updated', handleBattlesUpdated)
    return () => window.removeEventListener('lokios_battles_updated', handleBattlesUpdated)
  }, [user])

  const fetchBlueprint = async () => {
    const supabase = createClient()
    const evaluatedBattles = await syncWarRoomDailyEvaluator(user.id)

    const { data: rows, error } = await supabase.from('user_blueprints').select('*').eq('user_id', user.id)
    
    if (error) {
      console.error('Error fetching blueprint:', error)
    }

    if (rows && rows.length > 0) {
      const data = rows[0]
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
      if (evaluatedBattles && evaluatedBattles.length > 0) {
        setBattles(evaluatedBattles)
      } else if (data.battles && Array.isArray(data.battles)) {
        const migratedBattles = data.battles.map(b => ({
          name: b.name,
          severity: b.severity,
          notes: b.notes,
          hp: b.hp !== undefined ? b.hp : (b.status === 'defeated' ? 0 : 50),
          linked_habits: b.linked_habits || []
        }))
        setBattles(migratedBattles)
      } else {
        setBattles([])
      }
    } else {
      setBattles(evaluatedBattles || DEFAULT_BATTLES)
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
            <p className="font-mono text-xs text-amber tracking-widest uppercase mt-1">Identity Matrix</p>
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
            <HudPanel glow className="border-info">
              <div 
                onClick={() => toggleSection('identity')}
                className="flex items-center justify-between gap-3 text-info border-b border-border-color pb-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <UserIcon size={16} /> <span className="font-display text-lg uppercase tracking-widest font-bold">IDENTITY</span>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.identity && !editMode && (
                    <span className="font-mono text-[10px] text-muted truncate max-w-[140px] hidden sm:inline-block">
                      {form.identity}
                    </span>
                  )}
                  <button type="button" className="p-1 text-muted hover:text-info transition-colors shrink-0">
                    {openSections.identity || editMode ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {(openSections.identity || editMode) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-4">
                    {editMode ? (
                      <textarea className="textarea h-32 font-mono text-xs w-full" value={form.identity} onChange={e => setForm({...form, identity: e.target.value})} />
                    ) : (
                      <div className="font-mono text-sm leading-relaxed text-secondary">{form.identity}</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </HudPanel>

            <HudPanel className="border-amber">
              <div 
                onClick={() => toggleSection('mission')}
                className="flex items-center justify-between gap-3 text-amber border-b border-border-color pb-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Target size={16} /> <span className="font-display text-lg uppercase tracking-widest font-bold">MISSION</span>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.mission && !editMode && (
                    <span className="font-mono text-[10px] text-muted truncate max-w-[140px] hidden sm:inline-block">
                      {form.mission}
                    </span>
                  )}
                  <button type="button" className="p-1 text-muted hover:text-amber transition-colors shrink-0">
                    {openSections.mission || editMode ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {(openSections.mission || editMode) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-4">
                    {editMode ? (
                      <textarea className="textarea h-48 font-mono text-xs w-full" value={form.mission} onChange={e => setForm({...form, mission: e.target.value})} />
                    ) : (
                      <div className="font-mono text-sm leading-relaxed text-primary bg-amber/5 p-3 rounded border border-amber/20">{form.mission}</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </HudPanel>

            <HudPanel className="border-border-color">
              <div 
                onClick={() => toggleSection('endgame')}
                className="flex items-center justify-between gap-3 text-muted border-b border-border-color pb-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Eye size={16} /> <span className="font-display text-lg uppercase tracking-widest font-bold">5-YEAR ENDGAME</span>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.endgame && !editMode && (
                    <span className="font-mono text-[10px] text-muted truncate max-w-[140px] hidden sm:inline-block">
                      {form.future_vision}
                    </span>
                  )}
                  <button type="button" className="p-1 text-muted hover:text-primary transition-colors shrink-0">
                    {openSections.endgame || editMode ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {(openSections.endgame || editMode) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-4">
                    {editMode ? (
                      <textarea className="textarea h-48 font-mono text-xs w-full" value={form.future_vision} onChange={e => setForm({...form, future_vision: e.target.value})} />
                    ) : (
                      <div className="font-mono text-xs leading-relaxed text-secondary whitespace-pre-wrap">{form.future_vision}</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </HudPanel>
          </div>



          {/* ── COLUMN 3: INTEL & SYSTEM SENTINELS ── */}
          <div className="flex flex-col gap-6">
            {/* Known Advantages */}
            <HudPanel className="border-success">
              <div 
                onClick={() => toggleSection('advantages')}
                className="flex items-center justify-between gap-3 text-success border-b border-border-color pb-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} /> <span className="font-display text-lg uppercase tracking-widest font-bold">KNOWN ADVANTAGES</span>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.advantages && !editMode && (
                    <span className="font-mono text-[10px] text-muted truncate max-w-[120px] hidden sm:inline-block">
                      {form.strengths.split('\n').filter(Boolean).length} ADVANTAGES
                    </span>
                  )}
                  <button type="button" className="p-1 text-muted hover:text-success transition-colors shrink-0">
                    {openSections.advantages || editMode ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {(openSections.advantages || editMode) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-4">
                    {editMode ? (
                      <textarea className="textarea h-40 font-mono text-xs w-full" value={form.strengths} onChange={e => setForm({...form, strengths: e.target.value})} />
                    ) : (
                      <ul className="flex flex-col gap-2 font-mono text-xs text-secondary">
                        {form.strengths.split('\n').filter(Boolean).map((s, i) => (
                          <li key={i} className="flex gap-2 p-2 border border-border-color bg-tertiary rounded"><span className="text-success">■</span> {s}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </HudPanel>

            {/* Vulnerabilities */}
            <HudPanel className="border-danger">
              <div 
                onClick={() => toggleSection('vulnerabilities')}
                className="flex items-center justify-between gap-3 text-danger border-b border-border-color pb-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} /> <span className="font-display text-lg uppercase tracking-widest font-bold">VULNERABILITIES</span>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.vulnerabilities && !editMode && (
                    <span className="font-mono text-[10px] text-muted truncate max-w-[120px] hidden sm:inline-block">
                      {form.weaknesses.split('\n').filter(Boolean).length} THREATS
                    </span>
                  )}
                  <button type="button" className="p-1 text-muted hover:text-danger transition-colors shrink-0">
                    {openSections.vulnerabilities || editMode ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {(openSections.vulnerabilities || editMode) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-4">
                    {editMode ? (
                      <textarea className="textarea h-40 font-mono text-xs w-full" value={form.weaknesses} onChange={e => setForm({...form, weaknesses: e.target.value})} />
                    ) : (
                      <ul className="flex flex-col gap-2 font-mono text-xs text-secondary">
                        {form.weaknesses.split('\n').filter(Boolean).map((w, i) => (
                          <li key={i} className="flex gap-2 p-2 border border-border-color bg-tertiary rounded"><span className="text-danger">■</span> {w}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </HudPanel>

            {/* The Code */}
            <HudPanel glow className="border-amber">
              <div 
                onClick={() => toggleSection('code')}
                className="flex items-center justify-between gap-3 text-amber border-b border-border-color pb-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Flame size={16} /> <span className="font-display text-lg uppercase tracking-widest font-bold">THE CODE (NON-NEGOTIABLES)</span>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.code && !editMode && (
                    <span className="font-mono text-[10px] text-muted truncate max-w-[120px] hidden sm:inline-block">
                      {form.values_list.split('\n').filter(Boolean).length} RULES
                    </span>
                  )}
                  <button type="button" className="p-1 text-muted hover:text-amber transition-colors shrink-0">
                    {openSections.code || editMode ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {(openSections.code || editMode) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-4">
                    {editMode ? (
                      <textarea className="textarea h-40 font-mono text-xs w-full" value={form.values_list} onChange={e => setForm({...form, values_list: e.target.value})} />
                    ) : (
                      <ul className="flex flex-col gap-3 font-mono text-xs text-primary">
                        {form.values_list.split('\n').filter(Boolean).map((v, i) => (
                          <li key={i} className="flex gap-2 p-2 border border-border-color bg-tertiary rounded">
                            <span className="text-amber">{String(i+1).padStart(2, '0')}</span> {v}
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </HudPanel>
          </div>

        </div>
      </div>

    </AppShell>
  )
}
