'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWork } from '@/lib/hooks/useWork';
import { Play, Pause, Square, X, CheckCircle, AlertCircle, Lightbulb, Clock } from 'lucide-react';

export default function SessionExecutorModal({ session, isOpen, onClose }) {
  const { startSession, pauseSession, resumeSession, completeSession, cancelSession, saveReflection, updateSession, categories, projects } = useWork();
  
  const [elapsed, setElapsed] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [reflection, setReflection] = useState({ went_well: '', went_wrong: '', next_improvement: '' });
  const [notes, setNotes] = useState('');
  const [actualOutput, setActualOutput] = useState('');
  
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !session) return;
    
    // In a real app, calculate true elapsed time based on timestamps and timeline events
    if (session.status === 'active') {
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    
    return () => clearInterval(timerRef.current);
  }, [isOpen, session?.status]);

  if (!isOpen || !session) return null;

  const category = categories?.find(c => c.id === session.category_id);
  const project = projects?.find(p => p.id === session.project_id);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAction = async (action) => {
    try {
      if (action === 'start') await startSession(session.id);
      if (action === 'pause') await pauseSession(session.id);
      if (action === 'resume') await resumeSession(session.id);
      if (action === 'cancel') {
        if(confirm("Are you sure you want to cancel this session?")) {
           await cancelSession(session.id);
           onClose();
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleComplete = async () => {
    try {
      const actualDuration = elapsed; // Or from timeline
      const plannedDuration = (session.planned_duration_minutes || 1) * 60;
      const accuracy = (plannedDuration / actualDuration) * 100;
      
      await updateSession(session.id, {
        actual_duration_minutes: Math.round(actualDuration / 60),
        actual_output_text: actualOutput,
        notes,
        planning_accuracy_pct: accuracy,
        time_variance_minutes: (actualDuration - plannedDuration) / 60
      });
      if (reflection.went_well || reflection.went_wrong || reflection.next_improvement) {
        await saveReflection(session.id, reflection);
      }
      await completeSession(session.id);
      onClose();
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
      background: 'var(--bg-primary)', // full screen takeover style
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: category?.color || 'var(--accent-primary)' }}></span>
            {category?.name || 'Unknown Category'} 
            {project && <span style={{ color: 'var(--text-muted)' }}>/ {project.name}</span>}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            STATUS: <span style={{ color: session.status === 'active' ? 'var(--success)' : 'var(--warning)', fontWeight: 'bold' }}>{session.status.toUpperCase()}</span>
          </p>
        </div>
        {!isCompleting && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', overflowY: 'auto' }}>
        
        {!isCompleting ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '48px' }}>
            
            {/* Timer Display */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '72px', color: 'var(--accent-primary)', textShadow: '0 0 20px rgba(255,255,255,0.2)', letterSpacing: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(elapsed)}
              </div>
              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  <Clock size={16} /> Planned: {formatTime((session.planned_duration_minutes || 0) * 60)}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '20px' }}>
              {session.status === 'planned' && (
                <button onClick={() => handleAction('start')} style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--success)', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#000' }}>
                  <Play size={32} fill="currentColor" />
                </button>
              )}
              {session.status === 'active' && (
                <button onClick={() => handleAction('pause')} style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--warning)', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#000' }}>
                  <Pause size={32} fill="currentColor" />
                </button>
              )}
              {session.status === 'paused' && (
                <button onClick={() => handleAction('resume')} style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--info)', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#fff' }}>
                  <Play size={32} fill="currentColor" />
                </button>
              )}
              
              {(session.status === 'active' || session.status === 'paused') && (
                <button onClick={() => setIsCompleting(true)} style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--text-primary)', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#000' }}>
                  <Square size={28} fill="currentColor" />
                </button>
              )}
            </div>

            {session.status !== 'completed' && session.status !== 'cancelled' && (
               <button onClick={() => handleAction('cancel')} style={{ background: 'none', border: 'none', color: 'var(--danger)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                 Cancel Session
               </button>
            )}

            {/* Quick Notes */}
            <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SCRATCHPAD / NOTES</label>
              <textarea 
                value={notes} onChange={e => setNotes(e.target.value)}
                style={{ padding: '16px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', minHeight: '150px', resize: 'vertical' }}
              />
            </div>

          </motion.div>
        ) : (
          /* Completion Flow */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', textAlign: 'center', margin: 0 }}>Session Wrap-up</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', background: 'var(--glass-bg)', padding: '32px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ACTUAL OUTPUT</label>
                <textarea 
                  value={actualOutput} onChange={e => setActualOutput(e.target.value)} placeholder="What was actually produced?"
                  style={{ padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', minHeight: '80px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Reflections</h4>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <CheckCircle style={{ color: 'var(--success)', marginTop: '4px' }} size={20} />
                  <textarea value={reflection.went_well} onChange={e=>setReflection({...reflection, went_well: e.target.value})} placeholder="What went well?" style={{ flex: 1, padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', minHeight: '60px' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <AlertCircle style={{ color: 'var(--warning)', marginTop: '4px' }} size={20} />
                  <textarea value={reflection.went_wrong} onChange={e=>setReflection({...reflection, went_wrong: e.target.value})} placeholder="What went wrong?" style={{ flex: 1, padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', minHeight: '60px' }} />
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <Lightbulb style={{ color: 'var(--info)', marginTop: '4px' }} size={20} />
                  <textarea value={reflection.next_improvement} onChange={e=>setReflection({...reflection, next_improvement: e.target.value})} placeholder="Next time I will..." style={{ flex: 1, padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', minHeight: '60px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button onClick={() => setIsCompleting(false)} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
                  Back to Session
                </button>
                <button onClick={handleComplete} style={{ padding: '12px 24px', background: 'var(--success)', border: 'none', color: '#000', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Save & Complete
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
