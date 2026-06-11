'use client'

import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

export default function AnimatedNumber({ value, duration = 1.5, format = 'integer' }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => {
    if (format === 'decimal') return v.toFixed(1)
    return Math.round(v).toLocaleString()
  })

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: 'easeOut' })
    return controls.stop
  }, [value, duration, count])

  return (
    <motion.span style={{ fontFamily: 'var(--font-mono)' }}>
      {rounded}
    </motion.span>
  )
}
