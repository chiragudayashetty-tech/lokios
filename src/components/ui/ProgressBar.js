'use client'

import { motion } from 'framer-motion'

export default function TacticalProgress({ value = 0, max = 100, color = '#d4a843', height = 6, label = '', showValue = true }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div className="flex-col w-full">
      {(label || showValue) && (
        <div className="flex-between mb-2">
          {label && <span className="font-mono text-xs text-muted uppercase tracking-widest">{label}</span>}
          {showValue && (
            <span className="font-mono text-xs font-bold" style={{ color }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-bg-primary border border-border-color p-[2px]" style={{ height: `${height + 4}px` }}>
        <motion.div
          className="h-full relative overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ background: color }}
        >
          <div className="absolute inset-0 w-full h-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', animation: 'shimmer 2s infinite' }} />
        </motion.div>
      </div>
    </div>
  )
}
