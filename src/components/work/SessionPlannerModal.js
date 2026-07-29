'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWork from '@/lib/hooks/useWork';
import { X, Calendar, Clock, Target, Tag, Zap, AlertTriangle, Link as LinkIcon, Plus } from 'lucide-react';

export default function SessionPlannerModal({ isOpen, onClose }) {
  const { currentWorkspace, categories, projects, tags, entities, createSession } = useWork();

  const [formData, setFormData] = useState({
    category_id: '',
    project_id: '',
    milestone_id: '',
    planned_start_time: '',
    planned_duration_hours: 0,
    planned_duration_mins: 0,
    planned_output_text: '',
    planned_goal: '',
    energy_level: 3,
    difficulty_estimate: 3,
    tag_ids: [],
    entity_ids: []
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setFormData(prev => ({ ...prev, planned_start_time: now.toISOString().slice(0, 16) }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category_id || !currentWorkspace) return;

    setIsLoading(true);
    try {
      const durationMins = (parseInt(formData.planned_duration_hours || 0) * 60) + parseInt(formData.planned_duration_mins || 0);
      
      await createSession({
        workspace_id: currentWorkspace.id,
        category_id: formData.category_id,
        project_id: formData.project_id || null,
        milestone_id: formData.milestone_id || null,
        date: new Date(formData.planned_start_time).toISOString().split('T')[0],
        planned_start_time: new Date(formData.planned_start_time).toISOString(),
        planned_duration_minutes: durationMins,
        planned_output_text: formData.planned_output_text,
        metadata: {
          planned_goal: formData.planned_goal,
          energy_level: formData.energy_level,
          difficulty_estimate: formData.difficulty_estimate
        },
        status: 'planned'
      });
      // Handle tag/entity linking here if API supports it in bulk
      
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <AnimatePresence>
      <div 
        onClick={handleBackdropClick}
        style={{
          position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '24px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          style={{
            background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '1px' }}>
              Plan Work Session
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Core Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CATEGORY *</label>
                <select 
                  required
                  value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}
                  style={{ padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                >
                  <option value="">Select Category...</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PROJECT</label>
                <select 
                  value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})}
                  style={{ padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                >
                  <option value="">No Project</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {/* Time Planning */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} /> START TIME
                </label>
                <input 
                  type="datetime-local"
                  required
                  value={formData.planned_start_time} onChange={e => setFormData({...formData, planned_start_time: e.target.value})}
                  style={{ padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> DURATION (HH:MM)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" min="0" placeholder="HH" value={formData.planned_duration_hours} onChange={e => setFormData({...formData, planned_duration_hours: e.target.value})}
                    style={{ flex: 1, padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }} />
                  <input type="number" min="0" max="59" placeholder="MM" value={formData.planned_duration_mins} onChange={e => setFormData({...formData, planned_duration_mins: e.target.value})}
                    style={{ flex: 1, padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }} />
                </div>
              </div>
            </div>

            {/* Output & Goals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Target size={14} /> PLANNED GOAL
              </label>
              <input 
                type="text" placeholder="What is the primary objective?"
                value={formData.planned_goal} onChange={e => setFormData({...formData, planned_goal: e.target.value})}
                style={{ padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PLANNED OUTPUT (Deliverable)</label>
              <textarea 
                placeholder="Describe what will be produced..."
                value={formData.planned_output_text} onChange={e => setFormData({...formData, planned_output_text: e.target.value})}
                style={{ padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', minHeight: '80px', resize: 'vertical' }}
              />
            </div>

            {/* Scores */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                  <Zap size={14} /> ENERGY LEVEL (1-5)
                </label>
                <input type="range" min="1" max="5" value={formData.energy_level} onChange={e => setFormData({...formData, energy_level: parseInt(e.target.value)})} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>😴</span><span>⚡</span>
                </div>
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                  <AlertTriangle size={14} /> DIFFICULTY ESTIMATE (1-5)
                </label>
                <input type="range" min="1" max="5" value={formData.difficulty_estimate} onChange={e => setFormData({...formData, difficulty_estimate: parseInt(e.target.value)})} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Easy</span><span>Extreme</span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button type="button" onClick={onClose} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Cancel
              </button>
              <button type="submit" disabled={isLoading} style={{ padding: '12px 24px', background: 'var(--accent-gradient)', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                {isLoading ? 'Creating...' : 'Create Session'}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
