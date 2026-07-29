'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useWork from '@/lib/hooks/useWork'
import { Target, Plus, Trash2, Edit2, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function TargetManager() {
  const { targets, metrics, createTarget, updateTarget, deleteTarget } = useWork()
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    metric_id: '', period: 'weekly', target_value: '', comparison_operator: '>=', notify_on_achieve: true
  })

  const periodColors = { daily: '#3B82F6', weekly: '#8B5CF6', monthly: '#10B981' }

  const handleCreate = async (e) => {
    e.preventDefault()
    await createTarget({
      ...formData,
      target_value: parseFloat(formData.target_value)
    })
    setIsFormOpen(false)
    setFormData({ metric_id: '', period: 'weekly', target_value: '', comparison_operator: '>=', notify_on_achieve: true })
  }

  const handleDelete = async (id) => {
    if (confirm('Delete this target?')) {
      await deleteTarget(id)
    }
  }

  return (
    <div style={{ padding: '20px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '2px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target color="var(--accent-secondary)" /> Target Management
        </h2>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-active)',
            border: '1px solid var(--border-color)', color: 'var(--accent-primary)',
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            fontFamily: 'var(--font-display)', textTransform: 'uppercase'
          }}
        >
          <Plus size={16} /> Set Target
        </button>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.form
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            onSubmit={handleCreate}
            style={{
              background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
              padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <select required value={formData.metric_id} onChange={e => setFormData({...formData, metric_id: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <option value="" disabled>Select Metric...</option>
                {metrics?.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
              </select>
              <select value={formData.period} onChange={e => setFormData({...formData, period: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <select value={formData.comparison_operator} onChange={e => setFormData({...formData, comparison_operator: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <option value=">=">At least (≥)</option>
                <option value="<=">At most (≤)</option>
                <option value="=">Exactly (=)</option>
              </select>
              <input required type="number" step="any" placeholder="Target Value" value={formData.target_value} onChange={e => setFormData({...formData, target_value: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-sm)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={formData.notify_on_achieve} onChange={e => setFormData({...formData, notify_on_achieve: e.target.checked})} /> Notify on achieve
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setIsFormOpen(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: 'var(--bg-active)', border: '1px solid var(--accent-secondary)', color: 'var(--accent-primary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Save Target</button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {targets?.map(target => (
          <TargetCard key={target.id} target={target} metric={metrics?.find(m => m.id === target.metric_id)} periodColors={periodColors} onDelete={() => handleDelete(target.id)} />
        ))}
        {(!targets || targets.length === 0) && (
           <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No targets set yet.</div>
        )}
      </div>
    </div>
  )
}

function TargetCard({ target, metric, periodColors, onDelete }) {
  // Mock current progress for visualization
  const currentProgress = target.target_value * 0.65 // simulating 65% progress
  const percentage = Math.min(100, Math.round((currentProgress / target.target_value) * 100))
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  const isAchieved = target.comparison_operator === '>=' ? currentProgress >= target.target_value : currentProgress <= target.target_value

  return (
    <motion.div
      layout
      style={{
        background: 'var(--glass-bg)', border: `1px solid ${isAchieved ? 'var(--success)' : 'var(--glass-border)'}`,
        borderRadius: 'var(--radius-md)', padding: '20px', position: 'relative',
        boxShadow: isAchieved ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'var(--shadow-sm)',
        transition: 'var(--transition-base)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
            {metric?.name || 'Unknown Metric'}
          </h3>
          <span style={{ 
            fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px',
            border: `1px solid ${periodColors[target.period]}40`,
            color: periodColors[target.period], background: `${periodColors[target.period]}10`,
            textTransform: 'uppercase', fontFamily: 'var(--font-mono)'
          }}>
            {target.period}
          </span>
        </div>
        <button onClick={onDelete} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
            {currentProgress.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {target.target_value} {metric?.unit}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: isAchieved ? 'var(--success)' : 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isAchieved ? <><CheckCircle2 size={14}/> Target achieved!</> : <><TrendingUp size={14}/> {(target.target_value - currentProgress).toFixed(1)} remaining</>}
          </div>
        </div>

        <div style={{ position: 'relative', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="70" height="70" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="35" cy="35" r={radius} fill="none" stroke="var(--bg-tertiary)" strokeWidth="6" />
            <circle cx="35" cy="35" r={radius} fill="none" stroke={isAchieved ? 'var(--success)' : 'var(--accent-secondary)'} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
          </svg>
          <div style={{ position: 'absolute', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            {percentage}%
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>History:</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[true, false, true, true, false].map((met, i) => (
            <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: met ? 'var(--success)' : 'var(--danger)', opacity: 0.8 }} title={met ? 'Met' : 'Missed'} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
