'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { motion } from 'framer-motion'
import { Play, Pause, Square, Clock, Target, CheckCircle, X } from 'lucide-react'
import { useUserConfig } from '@/lib/hooks/useUserConfig'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function FocusMode() {
  const { config } = useUserConfig()
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(25 * 60) // 25 mins in seconds
  const [isActive, setIsActive] = useState(false)
  const [taskName, setTaskName] = useState('FOCUS SESSION')
  const [totalTime] = useState(25 * 60)

  useEffect(() => {
    // Get task name from URL query if present
    const params = new URLSearchParams(window.location.search)
    if (params.get('task')) setTaskName(params.get('task'))
  }, [])

  useEffect(() => {
    let interval = null
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      setIsActive(false)
      // Play sound or notification here
    }
    return () => clearInterval(interval)
  }, [isActive, timeLeft])

  const toggleTimer = () => setIsActive(!isActive)
  const resetTimer = () => { setIsActive(false); setTimeLeft(totalTime) }
  const completeTask = () => {
    // Would complete task in DB here
    router.push('/dashboard')
  }

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0')
  const secs = (timeLeft % 60).toString().padStart(2, '0')
  const progressPct = ((totalTime - timeLeft) / totalTime) * 100

  return (
    <div className="flex-center tactical-grid" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {isActive && <div className="radar-pulse" style={{ position: 'absolute', inset: 0, opacity: 0.1, background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', animation: 'pulse 4s infinite' }} />}
      
      <Link href="/dashboard" className="absolute top-8 left-8 btn btn-ghost text-muted">
        <X size={20} /> ABORT SESSION
      </Link>

      <motion.div 
        className="flex-col flex-center text-center z-10 w-full max-w-lg"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <span className="font-display text-amber uppercase tracking-widest text-sm mb-2 glow-amber">ISOLATION PROTOCOL ACTIVE</span>
        <h1 className="font-display text-4xl text-primary uppercase tracking-wide mb-2 px-4">{taskName}</h1>
        {config?.current_mission && (
          <span className="badge badge-amber mb-12">MISSION: {config.current_mission}</span>
        )}

        {/* Circular Timer Display */}
        <div className="relative flex-center mb-12" style={{ width: '320px', height: '320px' }}>
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="160" cy="160" r="150" fill="none" stroke="var(--bg-tertiary)" strokeWidth="4" />
            <motion.circle 
              cx="160" cy="160" r="150" fill="none" 
              stroke="var(--accent-primary)" strokeWidth="4"
              strokeDasharray={2 * Math.PI * 150}
              strokeDashoffset={2 * Math.PI * 150 * (1 - progressPct / 100)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          
          <div className="flex-col flex-center">
            <span className="font-mono text-amber glow-amber" style={{ fontSize: '6rem', lineHeight: 1 }}>{mins}:{secs}</span>
            <span className="font-mono text-muted text-sm tracking-widest mt-2">{isActive ? 'ENGAGED' : 'STANDBY'}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-8">
          <button 
            onClick={toggleTimer}
            className={`btn ${isActive ? 'btn-secondary text-amber' : 'btn-primary'} btn-lg flex items-center gap-2`}
            style={{ width: '160px' }}
          >
            {isActive ? <><Pause size={20} /> SUSPEND</> : <><Play size={20} /> EXECUTE</>}
          </button>
          <button onClick={resetTimer} className="btn btn-ghost p-3" title="Reset">
            <Square size={20} />
          </button>
        </div>

        <button onClick={completeTask} className="btn btn-ghost text-success hover:text-success border border-success-subtle hover:bg-success-subtle w-full max-w-xs p-4 tracking-widest">
          <CheckCircle size={18} className="mr-2" /> OPERATION COMPLETE
        </button>

      </motion.div>
    </div>
  )
}
