'use client'

import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, Zap, ExternalLink } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

export default function MiniFocusTimer() {
  const { focus } = useOS()
  const pathname = usePathname()
  const router = useRouter()

  // Only show if the timer is actively running, AND we are NOT on the focus page
  const show = focus?.isActive && pathname !== '/focus'

  if (!show) return null

  const mins = Math.floor(focus.timeLeft / 60).toString().padStart(2, '0')
  const secs = (focus.timeLeft % 60).toString().padStart(2, '0')
  const pct = 100 - (focus.timeLeft / focus.totalSeconds) * 100

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
        dragElastic={0}
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 50 }}
        className="fixed bottom-20 right-6 z-[100] cursor-move"
      >
        <div 
          className="flex items-center gap-3 bg-bg-secondary border-2 shadow-2xl rounded-full overflow-hidden px-4 py-2"
          style={{ borderColor: focus.category?.color || 'var(--accent-primary)' }}
        >
          {/* Circular Progress Indicator */}
          <div className="relative flex-center" style={{ width: '32px', height: '32px' }} onClick={() => router.push('/focus')}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bg-tertiary)" strokeWidth="3" />
              <motion.circle
                cx="18" cy="18" r="16" fill="none"
                stroke={focus.category?.color || 'var(--accent-primary)'} strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - pct / 100)}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <Zap size={14} color={focus.category?.color || 'var(--accent-primary)'} />
          </div>

          {/* Time Display */}
          <div className="flex-col cursor-pointer" onClick={() => router.push('/focus')}>
            <span className="font-display tracking-widest text-primary text-lg leading-none" style={{ color: focus.category?.color || 'var(--accent-primary)' }}>
              {mins}:{secs}
            </span>
            <span className="font-mono text-[9px] text-muted tracking-widest uppercase truncate max-w-[100px] leading-none mt-1">
              {focus.taskName || focus.category?.label || 'FOCUS'}
            </span>
          </div>

          {/* Open Full Screen Button */}
          <div className="pl-2 border-l border-border-color ml-1">
             <button onClick={() => router.push('/focus')} className="text-muted hover:text-primary transition-colors p-1 bg-tertiary rounded-full">
               <ExternalLink size={14} />
             </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
