'use client'

import { motion } from 'framer-motion'

export default function TacticalProgress({ value = 0, max = 100, color = 'var(--accent-primary)', height = 6, label = '', showValue = true }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div className="flex-col w-full">
      {(label || showValue) && (
        <div className="flex-between mb-2">
          {label && <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">{label}</span>}
          {showValue && (
            <span className="font-mono text-xs font-bold" style={{ color }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div className="opal-progress-track" style={{ height: `${height}px` }}>
        <motion.div
          className="opal-progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: `linear-gradient(90deg, color-mix(in oklab, ${color} 70%, white), ${color})`,
            boxShadow: `0 0 12px -2px ${color}`,
          }}
        />
      </div>
    </div>
  )
}
