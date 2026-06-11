'use client'

import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'

export default function BattleCard({ name, metric, current, target, color = '#d4a843' }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const isWinning = current <= target

  return (
    <div className="battle-card">
      <div className="battle-card-header">
        <Swords size={16} color={color} strokeWidth={1.5} />
        <span className="battle-card-name">{name}</span>
      </div>
      <div className="battle-card-metrics">
        <div className="battle-card-metric">
          <span className="battle-card-metric-label">Current</span>
          <motion.span 
            className="battle-card-metric-value"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontFamily: 'var(--font-mono)', color: isWinning ? 'var(--success)' : 'var(--danger)' }}
          >
            {current}
          </motion.span>
        </div>
        <div className="battle-card-vs">vs</div>
        <div className="battle-card-metric">
          <span className="battle-card-metric-label">Target</span>
          <span className="battle-card-metric-value" style={{ fontFamily: 'var(--font-mono)', color }}>
            {target}
          </span>
        </div>
      </div>
      <div className="battle-card-metric-label" style={{ marginBottom: '4px' }}>{metric}</div>
      <div className="battle-card-bar">
        <motion.div
          className="battle-card-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        />
      </div>
    </div>
  )
}
