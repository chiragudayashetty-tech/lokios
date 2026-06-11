'use client'

import { useState, useEffect } from 'react'

export default function TypewriterText({ text, speed = 40, className = '', onComplete }) {
  const [displayed, setDisplayed] = useState('')
  const [index, setIndex] = useState(0)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setIndex(0)
    setComplete(false)
  }, [text])

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayed(prev => prev + text[index])
        setIndex(i => i + 1)
      }, speed)
      return () => clearTimeout(timer)
    } else if (!complete && text.length > 0) {
      setComplete(true)
      onComplete?.()
    }
  }, [index, text, speed, complete, onComplete])

  return (
    <span className={`typewriter-text ${className}`} style={{ fontFamily: 'var(--font-mono)' }}>
      {displayed}
      {!complete && <span className="typewriter-cursor">█</span>}
    </span>
  )
}
