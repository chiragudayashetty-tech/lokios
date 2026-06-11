'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Shield, Target, Zap, AlertTriangle, Eye, Flame, Book, Terminal, Save, Database, Swords, X, Plus, Trash2 } from 'lucide-react'

// ── DEFAULT BLUEPRINT DATA (pre-seeded from Chirag's Master Prompt) ──
const DEFAULT_BLUEPRINT = {
  identity: 'Founder, Builder, AI Educator, Marketer, Operator, Lifelong Learner',
  mission: 'Build Beyond Tatva into a leading AI education platform that helps students use AI effectively while creating financial freedom, meaningful impact, and long term personal growth.',
  motives: `I do not want to spend my life working on goals chosen by other people.

I want to build something valuable that improves the lives of students and creates opportunities for myself and my family.

Beyond Tatva is more than a business. It is proof that I can turn ideas into reality.

If I succeed, I gain freedom, confidence, income, impact, and the ability to build bigger things in the future.

If I fail, I want it to be because I tried everything, not because I stayed comfortable.`,
  strengths: [
    'Fast learner',
    'Curious about technology',
    'Willing to experiment',
    'Strong interest in AI',
    'Creative thinker',
    'Can learn independently',
    'Persistent when motivated',
    'Comfortable with digital tools',
    'Good at spotting opportunities',
    'Can connect ideas across different fields'
  ],
  weaknesses: [
    'Phone addiction',
    'Inconsistent execution',
    'Overplanning',
    'Starting too many projects',
    'Difficulty focusing on one priority',
    'Procrastination during difficult tasks',
    'Seeking perfection before launching',
    'Low sales confidence',
    'Avoiding uncomfortable conversations',
    'Short bursts of motivation followed by drop offs'
  ],
  values_list: [
    'No quitting Beyond Tatva',
    'Workout at least 3 times per week',
    'Maintain personal hygiene',
    'Daily learning',
    'Journal regularly',
    'Track screen time honestly',
    'Complete important tasks before entertainment',
    'Always tell the truth to myself',
    'Continue improving communication skills',
    'Protect long term goals over short term comfort'
  ],
  future_vision: `Build Beyond Tatva into a recognized education company.

Generate sustainable income exceeding ₹5 lakh per month.

Help thousands of students learn AI and future skills.

Build a strong personal brand.

Become highly skilled in AI, marketing, sales, content creation, and business operations.

Achieve financial independence.

Become physically fit, mentally disciplined, and emotionally resilient.

Create opportunities for students through internships, training, and career guidance.`
}

// ── DEFAULT ACTIVE BATTLES ──
const DEFAULT_BATTLES = [
  { name: 'Phone Addiction', status: 'active', severity: 'high', notes: 'Primary discipline threat. Track screen time daily.' },
  { name: 'Porn Consumption', status: 'active', severity: 'high', notes: 'Drain on discipline and self-respect. Zero tolerance.' },
  { name: 'Inconsistent Execution', status: 'active', severity: 'high', notes: 'Starting strong, dropping off. Build streak systems.' },
  { name: 'Fear of Selling', status: 'active', severity: 'medium', notes: 'Avoiding sales calls and uncomfortable conversations.' },
  { name: 'Poor Sleep Discipline', status: 'active', severity: 'medium', notes: 'Late nights sabotage mornings. Sleep by 12.' },
  { name: 'Overthinking', status: 'active', severity: 'medium', notes: 'Analysis paralysis. Ship imperfect, iterate.' },
]

export default function PersonalBlueprint() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [blueprint, setBlueprint] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dbError, setDbError] = useState(false)
  const [activeSection, setActiveSection] = useState('identity')

  // Battles state (stored as JSON in blueprint.battles)
  const [battles, setBattles] = useState(DEFAULT_BATTLES)
  const [showAddBattle, setShowAddBattle] = useState(false)
  const [newBattle, setNewBattle] = useState({ name: '', severity: 'medium', notes: '' })

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
    const { data, error } = await supabase.from('user_blueprints').select('*').eq('user_id', user.id).single()
    if (error && (error.code === '42P01' || error.code === 'PGRST116')) {
      // Table doesn't exist or no row yet — use defaults
      if (error.code === '42P01') setDbError(true)
      setLoading(false)
      return
    }
    if (data) {
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
        setBattles(data.battles)
      }
    }
    setLoading(false)
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault()
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

    if (blueprint) {
      await supabase.from('user_blueprints').update(payload).eq('id', blueprint.id)
    } else {
      await supabase.from('user_blueprints').insert([payload])
    }
    await fetchBlueprint()
    setSaving(false)
  }

  const addBattle = () => {
    if (!newBattle.name.trim()) return
    setBattles(prev => [...prev, { ...newBattle, status: 'active' }])
    setNewBattle({ name: '', severity: 'medium', notes: '' })
    setShowAddBattle(false)
  }

  const removeBattle = (idx) => {
    setBattles(prev => prev.filter((_, i) => i !== idx))
  }

  const toggleBattleStatus = (idx) => {
    setBattles(prev => prev.map((b, i) => {
      if (i !== idx) return b
      const cycle = { active: 'winning', winning: 'defeated', defeated: 'active' }
      return { ...b, status: cycle[b.status] || 'active' }
    }))
  }

  const handleSeed = async () => {
    if (!confirm("⚠️ DESTRUCTIVE: This will delete ALL current habits and inject your exact Weekday/Saturday/Sunday routines. Proceed?")) return

    const supabase = createClient()
    await supabase.from('habits').delete().eq('user_id', user.id)

    const routines = [
      // ── WEEKDAYS ──
      { user_id: user.id, title: "Wake up at 7AM",              category: "discipline",    frequency: "daily", stat_category: "discipline",    xp_per_completion: 25 },
      { user_id: user.id, title: "Morning hygiene",             category: "personal_care", frequency: "daily", stat_category: "discipline",    xp_per_completion: 15 },
      { user_id: user.id, title: "Breakfast",                   category: "personal_care", frequency: "daily", stat_category: "discipline",    xp_per_completion: 10 },
      { user_id: user.id, title: "Beyond Tatva Deep Work (90m)",category: "founder",       frequency: "daily", stat_category: "founder",       xp_per_completion: 30 },
      { user_id: user.id, title: "Workout",                     category: "fitness",       frequency: "daily", stat_category: "strength",      xp_per_completion: 25 },
      { user_id: user.id, title: "Lunch",                       category: "personal_care", frequency: "daily", stat_category: "discipline",    xp_per_completion: 5  },
      { user_id: user.id, title: "BT Content / Course Building",category: "founder",       frequency: "daily", stat_category: "founder",       xp_per_completion: 25 },
      { user_id: user.id, title: "Marketing / Outreach",        category: "founder",       frequency: "daily", stat_category: "communication", xp_per_completion: 25 },
      { user_id: user.id, title: "AI Learning",                 category: "learning",      frequency: "daily", stat_category: "learning",      xp_per_completion: 25 },
      { user_id: user.id, title: "Reading (20 mins)",           category: "learning",      frequency: "daily", stat_category: "learning",      xp_per_completion: 20 },
      { user_id: user.id, title: "Journal",                     category: "discipline",    frequency: "daily", stat_category: "discipline",    xp_per_completion: 20 },
      { user_id: user.id, title: "Personal Care",               category: "personal_care", frequency: "daily", stat_category: "discipline",    xp_per_completion: 15 },
      { user_id: user.id, title: "Sleep by 12",                 category: "discipline",    frequency: "daily", stat_category: "discipline",    xp_per_completion: 20 },
    ]

    // Saturday additions
    const saturdayRoutines = [
      { user_id: user.id, title: "Weekly Review",        category: "founder",  frequency: "weekly", stat_category: "founder",  xp_per_completion: 40 },
      { user_id: user.id, title: "Portfolio Update",     category: "founder",  frequency: "weekly", stat_category: "creation", xp_per_completion: 30 },
      { user_id: user.id, title: "Content Creation",     category: "founder",  frequency: "weekly", stat_category: "founder",  xp_per_completion: 30 },
      { user_id: user.id, title: "Skill Building",       category: "learning", frequency: "weekly", stat_category: "learning", xp_per_completion: 30 },
    ]

    // Sunday additions
    const sundayRoutines = [
      { user_id: user.id, title: "Weekly Planning",     category: "founder",       frequency: "weekly", stat_category: "founder",    xp_per_completion: 40 },
      { user_id: user.id, title: "Calendar Planning",   category: "discipline",    frequency: "weekly", stat_category: "discipline", xp_per_completion: 25 },
      { user_id: user.id, title: "Goal Review",         category: "founder",       frequency: "weekly", stat_category: "founder",    xp_per_completion: 30 },
      { user_id: user.id, title: "Life Admin",          category: "discipline",    frequency: "weekly", stat_category: "discipline", xp_per_completion: 20 },
      { user_id: user.id, title: "Family Time",         category: "personal_care", frequency: "weekly", stat_category: "discipline", xp_per_completion: 15 },
      { user_id: user.id, title: "Recovery",            category: "fitness",       frequency: "weekly", stat_category: "strength",   xp_per_completion: 20 },
    ]

    await supabase.from('habits').insert([...routines, ...saturdayRoutines, ...sundayRoutines])
    alert('✅ All routines injected! Go to Daily Ops to see them.')
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">ACCESSING DEEP STORAGE...</span></div></AppShell>

  const SEVERITY_COLORS = { high: 'var(--danger)', medium: 'var(--accent-primary)', low: 'var(--info)' }
  const STATUS_LABELS = { active: '⚔️ ACTIVE', winning: '🟢 WINNING', defeated: '✅ DEFEATED' }
  const STATUS_COLORS = { active: 'var(--danger)', winning: 'var(--success)', defeated: 'var(--text-muted)' }

  const SECTIONS = [
    { id: 'identity', label: 'IDENTITY', icon: User },
    { id: 'mission', label: 'MISSION', icon: Target },
    { id: 'battles', label: 'BATTLES', icon: Swords },
    { id: 'strengths', label: 'INTEL', icon: Shield },
    { id: 'values', label: 'CODE', icon: Flame },
    { id: 'vision', label: 'VISION', icon: Eye },
  ]

  return (
    <AppShell>
      <div className="page-container max-w-5xl">

        <header className="page-header flex-between flex-wrap gap-4">
          <div>
            <h1 className="page-title flex items-center gap-3"><User className="text-amber" /> PERSONAL BLUEPRINT</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Core identity, active battles, and foundational directives.</p>
          </div>
          <button className="btn btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving || dbError}>
            <Save size={16} /> {saving ? 'SAVING...' : 'SAVE ALL'}
          </button>
        </header>

        {dbError && (
          <HudPanel className="mb-6 border-danger bg-danger-subtle">
            <div className="flex items-center gap-4 text-danger font-mono">
              <AlertTriangle size={28} />
              <div>
                <strong className="block mb-1">DATABASE MIGRATION REQUIRED</strong>
                <span className="text-xs">The user_blueprints table does not exist. Run migration_01.sql in Supabase SQL Editor.</span>
              </div>
            </div>
          </HudPanel>
        )}

        {/* Section Tabs */}
        <div className="tabs mb-6">
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <button key={s.id} className={`tab-item flex items-center gap-2 ${activeSection === s.id ? 'tab-active' : ''}`}
                onClick={() => setActiveSection(s.id)}>
                <Icon size={14} /> {s.label}
              </button>
            )
          })}
        </div>

        {/* ── IDENTITY ── */}
        {activeSection === 'identity' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-col gap-6">
            <HudPanel label="CORE IDENTITY" glow className="border-info">
              <div className="flex-col gap-4">
                <div>
                  <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><User size={14} className="text-info"/> WHO I AM</label>
                  <textarea className="textarea h-20 font-mono" value={form.identity} onChange={e => setForm({...form, identity: e.target.value})} disabled={dbError} />
                </div>
              </div>
            </HudPanel>
          </motion.div>
        )}

        {/* ── MISSION ── */}
        {activeSection === 'mission' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-col gap-6">
            <HudPanel label="PRIMARY MISSION" glow className="border-amber">
              <div className="flex-col gap-4">
                <div>
                  <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Target size={14} className="text-amber"/> MISSION STATEMENT</label>
                  <textarea className="textarea h-24 font-mono" value={form.mission} onChange={e => setForm({...form, mission: e.target.value})} disabled={dbError} />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Zap size={14} className="text-amber"/> WHY DOES THIS MATTER?</label>
                  <textarea className="textarea h-48 font-mono text-sm" value={form.motives} onChange={e => setForm({...form, motives: e.target.value})} disabled={dbError} />
                </div>
              </div>
            </HudPanel>
          </motion.div>
        )}

        {/* ── ACTIVE BATTLES ── */}
        {activeSection === 'battles' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-col gap-6">
            <HudPanel label="ACTIVE BATTLES" className="border-danger">
              <div className="flex-between mb-4">
                <p className="font-mono text-xs text-secondary">Goals are what you want. Battles are what is currently trying to stop you.</p>
                <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={() => setShowAddBattle(true)}>
                  <Plus size={14} /> ADD
                </button>
              </div>

              <div className="flex-col gap-3">
                {battles.map((battle, idx) => (
                  <div key={idx} className={`relative p-4 bg-tertiary border transition-all group ${battle.status === 'defeated' ? 'border-border-color opacity-50' : 'border-border-color hover:border-danger'}`}
                    style={{ borderLeftWidth: '3px', borderLeftColor: STATUS_COLORS[battle.status] }}>
                    <div className="flex-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className={`font-display text-lg uppercase tracking-wider ${battle.status === 'defeated' ? 'text-muted line-through' : 'text-primary'}`}>
                          {battle.name}
                        </h3>
                        <span className="font-mono text-[9px] px-2 py-0.5 border uppercase"
                          style={{ color: SEVERITY_COLORS[battle.severity], borderColor: SEVERITY_COLORS[battle.severity] }}>
                          {battle.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleBattleStatus(idx)}
                          className="font-mono text-[10px] uppercase px-2 py-1 border hover:bg-hover transition-colors"
                          style={{ color: STATUS_COLORS[battle.status], borderColor: STATUS_COLORS[battle.status] }}>
                          {STATUS_LABELS[battle.status]}
                        </button>
                        <button onClick={() => removeBattle(idx)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger p-1 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {battle.notes && <p className="font-mono text-xs text-secondary pl-0.5">{battle.notes}</p>}
                  </div>
                ))}
              </div>

              {/* Add Battle Modal */}
              <AnimatePresence>
                {showAddBattle && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-4 bg-tertiary border border-danger overflow-hidden">
                    <div className="flex-between mb-3">
                      <span className="font-display text-sm uppercase text-danger">DECLARE NEW BATTLE</span>
                      <button onClick={() => setShowAddBattle(false)} className="text-muted hover:text-danger"><X size={16} /></button>
                    </div>
                    <div className="flex-col gap-3">
                      <input type="text" className="input font-mono" placeholder="Battle name..." value={newBattle.name}
                        onChange={e => setNewBattle({...newBattle, name: e.target.value})} autoFocus />
                      <div className="grid grid-cols-2 gap-3">
                        <select className="select font-mono" value={newBattle.severity}
                          onChange={e => setNewBattle({...newBattle, severity: e.target.value})}>
                          <option value="low">LOW SEVERITY</option>
                          <option value="medium">MEDIUM SEVERITY</option>
                          <option value="high">HIGH SEVERITY</option>
                        </select>
                        <input type="text" className="input font-mono text-sm" placeholder="Notes..." value={newBattle.notes}
                          onChange={e => setNewBattle({...newBattle, notes: e.target.value})} />
                      </div>
                      <button onClick={addBattle} className="btn btn-primary w-full">DECLARE BATTLE</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </HudPanel>

            <div className="font-mono text-[10px] text-muted text-center">
              Click the status button to cycle: ACTIVE → WINNING → DEFEATED. Remember to hit SAVE ALL.
            </div>
          </motion.div>
        )}

        {/* ── STRENGTHS & WEAKNESSES ── */}
        {activeSection === 'strengths' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <HudPanel label="KNOWN ADVANTAGES" className="border-success">
              <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Shield size={14} className="text-success"/> One per line</label>
              <textarea className="textarea h-64 font-mono text-sm" value={form.strengths} onChange={e => setForm({...form, strengths: e.target.value})} disabled={dbError} />
            </HudPanel>
            <HudPanel label="KNOWN VULNERABILITIES" className="border-danger">
              <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><AlertTriangle size={14} className="text-danger"/> One per line</label>
              <textarea className="textarea h-64 font-mono text-sm" value={form.weaknesses} onChange={e => setForm({...form, weaknesses: e.target.value})} disabled={dbError} />
            </HudPanel>
          </motion.div>
        )}

        {/* ── NON-NEGOTIABLES ── */}
        {activeSection === 'values' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-col gap-6">
            <HudPanel label="NON-NEGOTIABLES" glow className="border-amber">
              <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Flame size={14} className="text-amber"/> THE CODE — One per line</label>
              <textarea className="textarea h-64 font-mono text-sm" value={form.values_list} onChange={e => setForm({...form, values_list: e.target.value})} disabled={dbError} />
            </HudPanel>
          </motion.div>
        )}

        {/* ── 5 YEAR VISION ── */}
        {activeSection === 'vision' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-col gap-6">
            <HudPanel label="5 YEAR TARGET" glow className="border-info">
              <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Eye size={14} className="text-info"/> THE ENDGAME</label>
              <textarea className="textarea h-64 font-mono text-sm" value={form.future_vision} onChange={e => setForm({...form, future_vision: e.target.value})} disabled={dbError} />
            </HudPanel>
          </motion.div>
        )}

        {/* ── INJECT ROUTINES ── */}
        <HudPanel label="SYSTEM INITIALIZER" className="mt-8 border-danger">
          <div className="flex-between">
            <div>
              <h3 className="font-display text-xl uppercase text-danger mb-1">INJECT ROUTINES (DESTRUCTIVE)</h3>
              <p className="font-mono text-xs text-secondary">Deletes all current habits. Seeds your exact Weekday (13 habits) + Saturday (4) + Sunday (6) routines.</p>
            </div>
            <button className="btn bg-danger text-white hover:opacity-80 border border-danger-subtle px-6 py-2" onClick={handleSeed}>
              INJECT
            </button>
          </div>
        </HudPanel>

      </div>
    </AppShell>
  )
}
