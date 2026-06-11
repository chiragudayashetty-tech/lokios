'use client'

import { motion } from 'framer-motion'

export default function TacticalProgress({ value = 0, max = 100, color = '#d4a843', height = 6, label = '', showValue = true }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div className="tactical-progress">
      {(label || showValue) && (
        <div className="tactical-progress-header">
          {label && <span className="tactical-progress-label">{label}</span>}
          {showValue && (
            <span className="tactical-progress-value" style={{ fontFamily: 'var(--font-mono)', color }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div className="tactical-progress-track" style={{ height: `${height}px` }}>
        <motion.div
          className="tactical-progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ background: `linear-gradient(90deg, ${color}44, ${color})`, height: '100%' }}
        />
        {/* Scan effect on fill */}
        <div className="tactical-progress-scan" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
