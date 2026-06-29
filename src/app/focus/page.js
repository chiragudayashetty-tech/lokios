'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Square, CheckCircle, X, ChevronDown, Timer, Zap, AlertTriangle, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr } from '@/lib/utils/dates'
import { useOS } from '@/lib/context/OSContext'
import { robustAwardXP } from '@/lib/utils/xpFallback'

import { PRESETS, CATEGORIES } from '@/lib/hooks/useFocusInternal'

export default function FocusMode() {
  const { auth: { user }, focus } = useOS()
  const router = useRouter()

  const {
    phase, setPhase,
    selectedPreset, setSelectedPreset,
    customMins, setCustomMins,
    taskName, setTaskName,
    category, setCategory,
    saving,
    totalSeconds,
    timeLeft, setTimeLeft,
    isActive, setIsActive,
    sessionXp,
    aborted,
    startSession,
    handleComplete,
    handleAbort,
    resetTimer
  } = focus

  // ── Read task from URL ──
  useEffect(() => {
    if (phase !== 'setup') return // Only read URL if we're setting up
    const params = new URLSearchParams(window.location.search)
    if (params.get('task')) setTaskName(params.get('task').toUpperCase())
    if (params.get('cat')) {
      const found = CATEGORIES.find(c => c.id === params.get('cat'))
      if (found) setCategory(found)
    }
  }, [phase, setTaskName, setCategory])

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0')
  const secs = (timeLeft % 60).toString().padStart(2, '0')
  const progressPct = ((totalSeconds - timeLeft) / totalSeconds) * 100
  const elapsedMins = Math.floor((totalSeconds - timeLeft) / 60)
  const totalMins = Math.floor(totalSeconds / 60)

  return (
    <div className="flex-center relative overflow-hidden" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Ambient pulse when running */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="pulse"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.05, 0.12, 0.05] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 50%, ${category.color} 0%, transparent 70%)` }}
          />
        )}
      </AnimatePresence>

      {/* ── SETUP PHASE ── */}
      <AnimatePresence mode="wait">
        {phase === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg px-4 flex flex-col gap-6"
          >
            <div className="text-center mb-2">
              <span className="font-mono text-xs tracking-widest text-muted uppercase">Isolation Protocol</span>
              <h1 className="font-display text-3xl uppercase tracking-widest text-primary mt-1">Configure Session</h1>
            </div>

            {/* Session Name */}
            <div>
              <label className="font-mono text-xs text-muted uppercase tracking-widest mb-2 block">Session Name (optional)</label>
              <input
                type="text"
                value={taskName}
                onChange={e => setTaskName(e.target.value.toUpperCase())}
                placeholder="WHAT ARE YOU BUILDING?"
                className="input w-full font-mono text-sm uppercase"
              />
            </div>

            {/* Category */}
            <div>
              <label className="font-mono text-xs text-muted uppercase tracking-widest mb-2 block">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat)}
                    className="p-2 text-center font-mono text-xs uppercase tracking-wider border rounded transition-all"
                    style={{
                      borderColor: category.id === cat.id ? cat.color : 'var(--border-color)',
                      background: category.id === cat.id ? `${cat.color}18` : 'var(--bg-secondary)',
                      color: category.id === cat.id ? cat.color : 'var(--text-muted)',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Presets */}
            <div>
              <label className="font-mono text-xs text-muted uppercase tracking-widest mb-2 block">Duration</label>
              <div className="flex gap-2 flex-wrap">
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPreset(i)}
                    className="flex-1 min-w-[60px] p-2 font-mono text-xs uppercase border rounded transition-all"
                    style={{
                      borderColor: selectedPreset === i ? category.color : 'var(--border-color)',
                      background: selectedPreset === i ? `${category.color}18` : 'var(--bg-secondary)',
                      color: selectedPreset === i ? category.color : 'var(--text-muted)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {PRESETS[selectedPreset].mins === null && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1} max={180}
                    value={customMins}
                    onChange={e => setCustomMins(Math.max(1, Math.min(180, Number(e.target.value))))}
                    className="input w-24 font-mono text-sm text-center"
                  />
                  <span className="font-mono text-xs text-muted">MINUTES (max 180)</span>
                </div>
              )}
            </div>

            {/* XP Rules Summary */}
            <div className="border border-border-color rounded p-3 bg-bg-secondary">
              <span className="font-mono text-xs text-muted uppercase tracking-widest block mb-2">XP Rules</span>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs" style={{ color: 'var(--text-success)' }}>+10 XP base per completed session</span>
                <span className="font-mono text-xs" style={{ color: 'var(--text-success)' }}>+1 XP per 5 minutes of focus (bonus)</span>
                <span className="font-mono text-xs text-danger">−5 XP for aborting early</span>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={startSession}
              className="btn btn-primary btn-lg w-full tracking-widest font-display text-lg"
              style={{ borderColor: category.color, color: category.color }}
            >
              <Play size={20} /> INITIATE SESSION
            </button>

            <button onClick={() => router.push('/dashboard')} className="btn btn-ghost text-muted text-sm mx-auto">
              ← Back to Command Center
            </button>
          </motion.div>
        )}

        {/* ── RUNNING PHASE ── */}
        {phase === 'running' && (
          <motion.div
            key="running"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex flex-col items-center text-center z-10 w-full max-w-lg px-4"
          >
            <span className="font-mono text-xs tracking-widest mb-2 uppercase" style={{ color: category.color }}>
              {category.label} — ISOLATION PROTOCOL ACTIVE
            </span>
            <h1 className="font-display text-3xl text-primary uppercase tracking-wide mb-8 px-4">
              {taskName || 'FOCUS SESSION'}
            </h1>

            {/* Circular Timer */}
            <div className="relative flex-center mb-10" style={{ width: 'min(280px, 80vw)', height: 'min(280px, 80vw)' }}>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 280 280" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="140" cy="140" r="130" fill="none" stroke="var(--bg-tertiary)" strokeWidth="6" />
                <motion.circle
                  cx="140" cy="140" r="130" fill="none"
                  stroke={category.color} strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 130}
                  strokeDashoffset={2 * Math.PI * 130 * (1 - progressPct / 100)}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="flex flex-col items-center">
                <span className="font-mono glow-amber" style={{ fontSize: 'clamp(3.5rem, 14vw, 5.5rem)', lineHeight: 1, color: category.color }}>
                  {mins}:{secs}
                </span>
                <span className="font-mono text-muted text-xs tracking-widest mt-2">
                  {isActive ? 'ENGAGED' : 'SUSPENDED'}
                </span>
                <span className="font-mono text-xs mt-1" style={{ color: category.color, opacity: 0.7 }}>
                  {elapsedMins}/{totalMins} min
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setIsActive(!isActive)}
                className="btn btn-lg flex items-center gap-2"
                style={{
                  borderColor: category.color,
                  color: category.color,
                  background: `${category.color}15`,
                  minWidth: '160px'
                }}
              >
                {isActive ? <><Pause size={20} /> SUSPEND</> : <><Play size={20} /> RESUME</>}
              </button>
            </div>

            {/* Complete + Abort */}
            <div className="flex gap-3 w-full max-w-xs mb-6">
              <button
                onClick={() => handleComplete(true)}
                disabled={saving}
                className="btn flex-1 flex items-center justify-center gap-2 text-success border-success hover:bg-success-subtle"
              >
                <CheckCircle size={16} /> {saving ? 'SAVING...' : 'COMPLETE'}
              </button>
              <button
                onClick={handleAbort}
                disabled={saving}
                className="btn btn-ghost flex items-center gap-2 text-danger border-danger-subtle hover:bg-danger-subtle"
              >
                <X size={16} /> ABORT
              </button>
            </div>

            {/* Minimize Button */}
            <button
              onClick={() => router.push('/dashboard')}
              className="btn btn-ghost text-muted text-sm flex items-center gap-2"
            >
              <ChevronDown size={16} /> MINIMIZE TO HUD
            </button>

            <span className="font-mono text-xs text-muted mt-4">Abort = −5 XP penalty</span>
          </motion.div>
        )}

        {/* ── DONE PHASE ── */}
        {phase === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center z-10 w-full max-w-md px-4 gap-6"
          >
            {aborted ? (
              <>
                <AlertTriangle size={56} className="text-danger" />
                <h1 className="font-display text-3xl uppercase tracking-widest text-danger">Session Aborted</h1>
                <p className="font-mono text-sm text-muted">Concentration broken. −5 XP penalty applied.</p>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                >
                  <CheckCircle size={72} style={{ color: category.color }} />
                </motion.div>
                <h1 className="font-display text-3xl uppercase tracking-widest" style={{ color: category.color }}>
                  Operation Complete
                </h1>
                <div className="border rounded p-4 w-full" style={{ borderColor: category.color, background: `${category.color}10` }}>
                  <div className="font-mono text-xs text-muted uppercase tracking-widest mb-2">Session Summary</div>
                  <div className="font-display text-xl text-primary">{taskName || 'FOCUS SESSION'}</div>
                  <div className="font-mono text-xs text-muted mt-1">{category.label} • {elapsedMins} minutes</div>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Zap size={18} style={{ color: category.color }} />
                    <span className="font-display text-2xl font-bold" style={{ color: category.color }}>
                      +{sessionXp} XP
                    </span>
                    <span className="font-mono text-xs text-muted">EARNED</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 w-full">
              <button
                onClick={() => { setPhase('setup'); setTimeLeft(totalSeconds); setIsActive(false); setAborted(false) }}
                className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} /> NEW SESSION
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn btn-primary flex-1"
              >
                → COMMAND CENTER
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
