'use client'

import { motion } from 'framer-motion'

const STAT_ICONS = {
  founder: 'Rocket',
  discipline: 'Target',
  learning: 'BookOpen',
  communication: 'MessageSquare',
  creation: 'Palette',
  strength: 'Dumbbell',
}

const STAT_COLORS = {
  founder: '#d4a843',
  discipline: '#e74c3c',
  learning: '#3498db',
  communication: '#2ecc71',
  creation: '#9b59b6',
  strength: '#e67e22',
}

export default function StatCard({ name, level, xp, icon: IconComponent }) {
  const color = STAT_COLORS[name] || '#d4a843'
  const maxXpForLevel = level * level * 50
  const pct = Math.min((xp / Math.max(maxXpForLevel, 1)) * 100, 100)

  return (
    <div className="stat-card-tactical">
      <div className="stat-card-header">
        {IconComponent && <IconComponent size={18} color={color} strokeWidth={1.5} />}
        <span className="stat-card-name">{name}</span>
      </div>
      <div className="stat-card-level" style={{ color }}>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          LV.{level}
        </motion.span>
      </div>
      <div className="stat-card-bar">
        <motion.div
          className="stat-card-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ background: color }}
        />
      </div>
      <div className="stat-card-xp" style={{ fontFamily: 'var(--font-mono)' }}>
        {xp} XP
      </div>
    </div>
  )
}
