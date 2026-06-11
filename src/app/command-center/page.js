'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import BattleCard from '@/components/ui/BattleCard'
import { useUserConfig } from '@/lib/hooks/useUserConfig'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, Plus, X, Shield, Swords, Target, Cpu, Brain, Activity } from 'lucide-react'

export default function CommandCenter() {
  const { config, loading, updateConfig } = useUserConfig()
  const [formData, setFormData] = useState(config)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Battle form state
  const [showBattleForm, setShowBattleForm] = useState(false)
  const [newBattle, setNewBattle] = useState({ name: '', metric: '', current: 0, target: 100 })

  useEffect(() => {
    if (config) setFormData(config)
  }, [config])

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    setSaveSuccess(false)
    await updateConfig(formData)
    setIsSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  const addBattle = () => {
    if (!newBattle.name || !newBattle.metric) return
    const battles = [...(formData.battles || []), newBattle]
    handleChange('battles', battles)
    setNewBattle({ name: '', metric: '', current: 0, target: 100 })
    setShowBattleForm(false)
  }

  const removeBattle = (index) => {
    const battles = [...formData.battles]
    battles.splice(index, 1)
    handleChange('battles', battles)
  }

  const ListInput = ({ label, field, placeholder }) => {
    const items = formData[field] || []
    const [newItem, setNewItem] = useState('')
    
    const addItem = (e) => {
      e.preventDefault()
      if (!newItem.trim()) return
      handleChange(field, [...items, newItem.trim()])
      setNewItem('')
    }
    
    const removeItem = (idx) => {
      const newItems = [...items]
      newItems.splice(idx, 1)
      handleChange(field, newItems)
    }

    return (
      <div className="flex-col gap-2">
        <label className="font-display text-amber text-xs uppercase tracking-widest">{label}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {items.map((item, i) => (
            <span key={i} className="badge bg-tertiary border border-border-color text-primary flex items-center gap-1">
              {item} <button onClick={() => removeItem(i)} className="text-muted hover:text-danger"><X size={10} /></button>
            </span>
          ))}
          {items.length === 0 && <span className="text-xs text-muted font-mono italic">No data entries.</span>}
        </div>
        <form onSubmit={addItem} className="flex gap-2">
          <input type="text" className="input font-mono text-sm py-1.5" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder={placeholder} />
          <button type="submit" className="btn btn-secondary btn-sm"><Plus size={14} /></button>
        </form>
      </div>
    )
  }

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">UPLOADING BLUEPRINT...</span></div></AppShell>

  return (
    <AppShell>
      <div className="page-container narrow relative">
        <header className="page-header flex-between sticky top-0 z-20 bg-primary/90 backdrop-blur pb-4 border-b border-border-color">
          <div>
            <h1 className="page-title">COMMAND CENTER</h1>
            <p className="page-subtitle font-mono uppercase text-xs text-amber glow-amber">Central Nervous System Configuration.</p>
          </div>
          <button onClick={handleSave} className="btn btn-primary btn-lg flex gap-2 tracking-widest" disabled={isSaving}>
            {isSaving ? <span className="animate-pulse">SAVING...</span> : saveSuccess ? <span className="text-bg-primary font-bold">SECURED</span> : <><Save size={18} /> OVERWRITE DATA</>}
          </button>
        </header>

        <div className="flex-col gap-8 mt-8 pb-12">
          
          <HudPanel label="OPERATOR DIRECTIVE" glow>
            <div className="grid-2">
              <div className="col-span-2">
                <label className="font-display text-amber text-xs uppercase tracking-widest mb-1 block">WHO I WANT TO BECOME</label>
                <textarea className="textarea font-mono" value={formData.who_i_want_to_become} onChange={e=>handleChange('who_i_want_to_become', e.target.value)} placeholder="Define your ultimate evolution..." />
              </div>
              <div>
                <label className="font-display text-amber text-xs uppercase tracking-widest mb-1 block">CLASS ASSIGNMENT</label>
                <input type="text" className="input font-mono" value={formData.class} onChange={e=>handleChange('class', e.target.value)} placeholder="e.g. Founder, Developer, Creator" />
              </div>
              <div>
                <label className="font-display text-amber text-xs uppercase tracking-widest mb-1 block">CURRENT NARRATIVE ARC</label>
                <input type="text" className="input font-mono" value={formData.current_arc} onChange={e=>handleChange('current_arc', e.target.value)} placeholder="e.g. Discipline Rebuild, Scale Phase" />
              </div>
            </div>
          </HudPanel>

          <HudPanel label="TACTICAL FOCUS">
            <div className="flex-col gap-4">
              <div>
                <label className="font-display text-warning text-xs uppercase tracking-widest mb-1 block flex items-center gap-1"><Target size={12} /> PRIMARY MISSION</label>
                <input type="text" className="input font-mono text-lg border-warning text-warning" value={formData.current_mission} onChange={e=>handleChange('current_mission', e.target.value)} placeholder="The single most important objective right now" />
              </div>
              <div className="grid-2">
                <div>
                  <label className="font-display text-danger text-xs uppercase tracking-widest mb-1 block flex items-center gap-1"><Swords size={12} /> CURRENT ENEMY</label>
                  <input type="text" className="input font-mono text-danger border-danger" value={formData.current_enemy} onChange={e=>handleChange('current_enemy', e.target.value)} placeholder="e.g. Procrastination, Phone Addiction" />
                </div>
                <div>
                  <label className="font-display text-info text-xs uppercase tracking-widest mb-1 block flex items-center gap-1"><Cpu size={12} /> SYSTEM BOTTLENECK</label>
                  <input type="text" className="input font-mono text-info border-info" value={formData.current_bottleneck} onChange={e=>handleChange('current_bottleneck', e.target.value)} placeholder="What is slowing you down?" />
                </div>
              </div>
            </div>
          </HudPanel>

          <HudPanel label="ACTIVE BATTLES">
            <div className="flex-between mb-4 border-b border-border-color pb-2">
              <span className="font-mono text-xs text-muted">Quantifiable conflicts currently engaged.</span>
              <button onClick={() => setShowBattleForm(!showBattleForm)} className="btn btn-secondary btn-sm"><Plus size={14} /> NEW BATTLE</button>
            </div>
            
            <AnimatePresence>
              {showBattleForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
                  <div className="p-4 bg-tertiary border border-hud-border flex-col gap-4">
                    <div className="grid-2">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">BATTLE NAME</label>
                        <input type="text" className="input font-mono py-1" value={newBattle.name} onChange={e=>setNewBattle({...newBattle, name: e.target.value})} placeholder="e.g. Defeat Screen Time" />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">METRIC (e.g. Hours)</label>
                        <input type="text" className="input font-mono py-1" value={newBattle.metric} onChange={e=>setNewBattle({...newBattle, metric: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid-2">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">CURRENT STAT</label>
                        <input type="number" className="input font-mono py-1" value={newBattle.current} onChange={e=>setNewBattle({...newBattle, current: Number(e.target.value)})} />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-amber mb-1 block">TARGET STAT</label>
                        <input type="number" className="input font-mono py-1 border-amber text-amber" value={newBattle.target} onChange={e=>setNewBattle({...newBattle, target: Number(e.target.value)})} />
                      </div>
                    </div>
                    <button onClick={addBattle} className="btn btn-primary btn-full mt-2">DEPLOY BATTLE</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid-2">
              {(formData.battles || []).map((battle, i) => (
                <div key={i} className="relative group">
                  <button onClick={() => removeBattle(i)} className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                  <BattleCard name={battle.name} metric={battle.metric} current={battle.current} target={battle.target} />
                </div>
              ))}
              {(!formData.battles || formData.battles.length === 0) && <div className="col-span-2 empty-state py-8">NO ACTIVE BATTLES DEPLOYED</div>}
            </div>
          </HudPanel>

          <HudPanel label="MACRO STRATEGY">
            <div className="grid-2">
              <div className="col-span-2">
                <label className="font-display text-amber text-xs uppercase tracking-widest mb-1 block flex items-center gap-1"><Brain size={12} /> LONG-TERM VISION</label>
                <textarea className="textarea font-mono" value={formData.vision} onChange={e=>handleChange('vision', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="font-display text-amber text-xs uppercase tracking-widest mb-1 block flex items-center gap-1"><Activity size={12} /> CORE PURPOSE</label>
                <textarea className="textarea font-mono" value={formData.purpose} onChange={e=>handleChange('purpose', e.target.value)} />
              </div>
              <div>
                <label className="font-display text-amber text-xs uppercase tracking-widest mb-1 block">12 MONTH TARGET</label>
                <input type="text" className="input font-mono" value={formData.twelve_month_goal} onChange={e=>handleChange('twelve_month_goal', e.target.value)} />
              </div>
              <div>
                <label className="font-display text-amber text-xs uppercase tracking-widest mb-1 block">INCOME PROTOCOL</label>
                <input type="text" className="input font-mono" value={formData.income_goal} onChange={e=>handleChange('income_goal', e.target.value)} />
              </div>
            </div>
          </HudPanel>

          <HudPanel label="SWOT ANALYSIS">
            <div className="grid-2">
              <ListInput label="KNOWN STRENGTHS" field="current_strengths" placeholder="Input strength..." />
              <ListInput label="CRITICAL WEAKNESSES" field="current_weaknesses" placeholder="Input weakness..." />
            </div>
          </HudPanel>

          <HudPanel label="EXPANSION MODULES">
            <div className="grid-2">
              <ListInput label="SKILLS TO ACQUIRE" field="skills_to_master" placeholder="Input skill..." />
              <ListInput label="INTEL TO CONSUME (BOOKS)" field="books_to_read" placeholder="Input title..." />
              <div className="col-span-2 mt-4 pt-4 border-t border-border-color">
                <ListInput label="CORE OPERATING VALUES" field="core_values" placeholder="Input value..." />
              </div>
            </div>
          </HudPanel>

        </div>
      </div>
    </AppShell>
  )
}
