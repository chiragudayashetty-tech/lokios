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
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        className="fixed bottom-20 right-6 z-[100] cursor-move"
        style={{ width: '220px' }}
      >
        <div 
          className="bg-black/60 border-2 shadow-2xl rounded-xl overflow-hidden backdrop-blur-xl"
          style={{ borderColor: focus.category?.color || 'var(--accent-primary)' }}
        >
          {/* Header & Drag Grip */}
          <div className="flex items-center justify-between p-2 pb-1 border-b border-border-color bg-black/40">
            <div className="flex items-center gap-2">
              <Zap size={12} color={focus.category?.color || 'var(--accent-primary)'} />
              <span className="font-mono text-[10px] text-muted tracking-widest uppercase truncate max-w-[120px]">
                {focus.taskName || focus.category?.label || 'FOCUS'}
              </span>
            </div>
            <button onClick={() => router.push('/focus')} className="text-muted hover:text-primary transition-colors">
              <ExternalLink size={12} />
            </button>
          </div>

          {/* Time Display */}
          <div className="p-3 text-center" onClick={() => router.push('/focus')}>
            <span className="font-display text-3xl tracking-widest text-primary">
              {mins}:{secs}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-tertiary">
            <motion.div 
              className="h-full"
              style={{ backgroundColor: focus.category?.color || 'var(--accent-primary)' }}
              initial={{ width: `${pct}%` }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
