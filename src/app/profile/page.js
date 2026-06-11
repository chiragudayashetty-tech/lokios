'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { motion } from 'framer-motion'
import { User, Shield, Target, Zap, AlertTriangle, Eye, Flame, Book, Terminal, Save, Database } from 'lucide-react'

export default function PersonalBlueprint() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [blueprint, setBlueprint] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dbError, setDbError] = useState(false)

  // Edit states
  const [form, setForm] = useState({
    identity: '',
    mission: '',
    motives: '',
    values_list: '',
    weaknesses: '',
    strengths: '',
    future_vision: ''
  })

  useEffect(() => {
    if (!user) return
    fetchBlueprint()
  }, [user])

  const fetchBlueprint = async () => {
    const supabase = createClient()
    const { data, error } = await supabase.from('user_blueprints').select('*').eq('user_id', user.id).single()
    if (error && error.code === '42P01') {
      // Table doesn't exist yet (migration not run)
      setDbError(true)
      setLoading(false)
      return
    }
    if (data) {
      setBlueprint(data)
      setForm({
        identity: data.identity || '',
        mission: data.mission || '',
        motives: data.motives || '',
        values_list: data.values_list ? data.values_list.join('\n') : '',
        weaknesses: data.weaknesses ? data.weaknesses.join('\n') : '',
        strengths: data.strengths ? data.strengths.join('\n') : '',
        future_vision: data.future_vision || ''
      })
    }
    setLoading(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
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
      future_vision: form.future_vision
    }

    if (blueprint) {
      await supabase.from('user_blueprints').update(payload).eq('id', blueprint.id)
    } else {
      await supabase.from('user_blueprints').insert([payload])
    }
    await fetchBlueprint()
    setSaving(false)
  }

  const handleSeed = async () => {
    if (!confirm("This will erase current habits and seed the exact Weekday/Weekend routines from your Master Prompt. Ensure you ran the SQL Migration first. Proceed?")) return
    
    const supabase = createClient()
    
    // Clear existing
    await supabase.from('habits').delete().eq('user_id', user.id)
    
    // Weekdays = [1,2,3,4,5]
    // Saturday = [6]
    // Sunday = [0]
    const routines = [
      // WEEKDAYS (Founder, Fitness, Learning, Personal Care, Reflection)
      { user_id: user.id, title: "Beyond Tatva work", category: "business", frequency: "custom", recurrence_days: [1,2,3,4,5], stat_category: "founder", xp_per_completion: 30, icon: "Rocket" },
      { user_id: user.id, title: "Workout", category: "health", frequency: "custom", recurrence_days: [1,2,3,4,5], stat_category: "strength", xp_per_completion: 25, icon: "Dumbbell" },
      { user_id: user.id, title: "Read", category: "learning", frequency: "custom", recurrence_days: [1,2,3,4,5], stat_category: "learning", xp_per_completion: 20, icon: "BookOpen" },
      { user_id: user.id, title: "Learn", category: "learning", frequency: "custom", recurrence_days: [1,2,3,4,5], stat_category: "learning", xp_per_completion: 25, icon: "Terminal" },
      { user_id: user.id, title: "Hair treatment", category: "personal", frequency: "custom", recurrence_days: [1,2,3,4,5], stat_category: "discipline", xp_per_completion: 15, icon: "Shield" },
      { user_id: user.id, title: "Skin care", category: "personal", frequency: "custom", recurrence_days: [1,2,3,4,5], stat_category: "discipline", xp_per_completion: 15, icon: "Shield" },
      { user_id: user.id, title: "Grooming", category: "personal", frequency: "custom", recurrence_days: [1,2,3,4,5], stat_category: "discipline", xp_per_completion: 15, icon: "Shield" },
      { user_id: user.id, title: "Journal", category: "personal", frequency: "custom", recurrence_days: [1,2,3,4,5], stat_category: "discipline", xp_per_completion: 20, icon: "BookOpen" },
      
      // SATURDAY
      { user_id: user.id, title: "Weekly review", category: "business", frequency: "custom", recurrence_days: [6], stat_category: "founder", xp_per_completion: 40, icon: "Target" },
      { user_id: user.id, title: "Portfolio update", category: "business", frequency: "custom", recurrence_days: [6], stat_category: "creation", xp_per_completion: 50, icon: "Database" },
      { user_id: user.id, title: "Learning project", category: "learning", frequency: "custom", recurrence_days: [6], stat_category: "learning", xp_per_completion: 50, icon: "Terminal" },
      
      // SUNDAY
      { user_id: user.id, title: "Weekly planning", category: "business", frequency: "custom", recurrence_days: [0], stat_category: "founder", xp_per_completion: 40, icon: "Target" },
      { user_id: user.id, title: "Calendar planning", category: "business", frequency: "custom", recurrence_days: [0], stat_category: "discipline", xp_per_completion: 30, icon: "Calendar" },
      { user_id: user.id, title: "Recovery", category: "health", frequency: "custom", recurrence_days: [0], stat_category: "strength", xp_per_completion: 20, icon: "Shield" }
    ]
    await supabase.from('habits').insert(routines)
    alert('Routines Seeded!')
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">ACCESSING DEEP STORAGE...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container max-w-4xl">
        <header className="page-header flex-between">
          <div>
            <h1 className="page-title">PERSONAL BLUEPRINT</h1>
            <p className="page-subtitle font-mono uppercase text-xs">Core identity and foundational directives.</p>
          </div>
          <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={handleSave} disabled={saving || dbError}>
            <Save size={16} /> {saving ? 'SAVING...' : 'SAVE DIRECTIVES'}
          </button>
        </header>

        {dbError && (
          <HudPanel className="mb-8 border-danger bg-danger-subtle">
            <div className="flex items-center gap-4 text-danger font-mono">
              <AlertTriangle size={32} />
              <div>
                <strong className="block mb-1">DATABASE MIGRATION REQUIRED</strong>
                <span className="text-xs">The user_blueprints table does not exist. Please run migration_01.sql in your Supabase SQL Editor.</span>
              </div>
            </div>
          </HudPanel>
        )}

        <form onSubmit={handleSave} className="flex-col gap-8">
          
          <HudPanel label="CORE IDENTITY" glow className="border-info">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><User size={14} className="text-info"/> IDENTITY</label>
                <input type="text" className="input" value={form.identity} onChange={e=>setForm({...form, identity: e.target.value})} placeholder="e.g. Founder, Developer, Leader" disabled={dbError} />
              </div>
              <div>
                <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Target size={14} className="text-amber"/> PRIMARY MISSION</label>
                <input type="text" className="input" value={form.mission} onChange={e=>setForm({...form, mission: e.target.value})} placeholder="e.g. Launch Beyond Tatva" disabled={dbError} />
              </div>
            </div>
          </HudPanel>

          <HudPanel label="DRIVERS & MOTIVES">
            <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Zap size={14} className="text-amber"/> WHY DOES THIS MATTER?</label>
            <textarea className="textarea h-32" value={form.motives} onChange={e=>setForm({...form, motives: e.target.value})} placeholder="What is the deeper reason?" disabled={dbError} />
          </HudPanel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <HudPanel label="STRENGTHS">
              <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Shield size={14} className="text-success"/> KNOWN ADVANTAGES (One per line)</label>
              <textarea className="textarea h-40 font-mono" value={form.strengths} onChange={e=>setForm({...form, strengths: e.target.value})} placeholder="- Quick learner&#10;- Technical skills" disabled={dbError} />
            </HudPanel>
            
            <HudPanel label="WEAKNESSES">
              <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><AlertTriangle size={14} className="text-danger"/> KNOWN VULNERABILITIES (One per line)</label>
              <textarea className="textarea h-40 font-mono" value={form.weaknesses} onChange={e=>setForm({...form, weaknesses: e.target.value})} placeholder="- Inconsistent&#10;- Phone addiction" disabled={dbError} />
            </HudPanel>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <HudPanel label="CORE VALUES">
              <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Flame size={14} className="text-amber"/> NON-NEGOTIABLES (One per line)</label>
              <textarea className="textarea h-40 font-mono" value={form.values_list} onChange={e=>setForm({...form, values_list: e.target.value})} disabled={dbError} />
            </HudPanel>
            
            <HudPanel label="FUTURE VISION">
              <label className="font-mono text-xs text-muted mb-2 flex items-center gap-2"><Eye size={14} className="text-info"/> 5 YEAR TARGET</label>
              <textarea className="textarea h-40" value={form.future_vision} onChange={e=>setForm({...form, future_vision: e.target.value})} disabled={dbError} />
            </HudPanel>
          </div>

        </form>

        <HudPanel label="SYSTEM INITIALIZER" className="mt-8 border-danger">
          <div className="flex-between">
            <div>
              <h3 className="font-display text-xl uppercase text-danger mb-1">INJECT ROUTINES (DESTRUCTIVE)</h3>
              <p className="font-mono text-xs text-secondary">This will delete all current habits and seed the exact Weekday/Saturday/Sunday routines requested.</p>
            </div>
            <button className="btn bg-danger text-white hover:bg-danger-hover border border-danger-subtle px-6 py-2" onClick={handleSeed}>
              INJECT
            </button>
          </div>
        </HudPanel>

      </div>
    </AppShell>
  )
}
