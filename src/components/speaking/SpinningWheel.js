'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RotateCcw, Sparkles, Shuffle, Flame, Clock, Smile,
  AlertTriangle, HelpCircle, Repeat, Video, Compass,
  X, Check, ChevronRight
} from 'lucide-react'

// Map icon string to Lucide component
const ICON_MAP = {
  Clock,
  Smile,
  AlertTriangle,
  RotateCcw,
  HelpCircle,
  Sparkles,
  Flame,
  Repeat,
  Video,
  Compass
}

export default function SpinningWheel({
  challenges = [],
  topics = [],
  selectedTopic = null,
  selectedSituation = null,
  activePhase = 2,
  onPhaseChange = () => {},
  onSelectSituation = () => {},
  onSelectTopic = () => {},
  onClearSituation = () => {}
}) {
  const [wheelType, setWheelType] = useState('situation') // 'situation' | 'topic'
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [spinResult, setSpinResult] = useState(selectedSituation)
  const [isTopicSpinning, setIsTopicSpinning] = useState(false)

  const audioCtxRef = useRef(null)

  // Initialize Web Audio API for mechanical click sounds (failsafe)
  const playTickSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) audioCtxRef.current = new AudioCtx()
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
      if (audioCtxRef.current) {
        const osc = audioCtxRef.current.createOscillator()
        const gain = audioCtxRef.current.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(600, audioCtxRef.current.currentTime)
        osc.frequency.exponentialRampToValueAtTime(120, audioCtxRef.current.currentTime + 0.04)
        gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.04)
        osc.connect(gain)
        gain.connect(audioCtxRef.current.destination)
        osc.start()
        osc.stop(audioCtxRef.current.currentTime + 0.04)
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }, [])

  // Sync external selectedSituation changes
  useEffect(() => {
    setSpinResult(selectedSituation)
  }, [selectedSituation])

  // Wheel Constants
  const totalSlices = challenges.length || 10
  const sliceAngle = 360 / totalSlices // 36 degrees
  const size = 320
  const center = size / 2 // 160
  const radius = 145

  // Spin Situation Wheel
  const handleSpinSituation = (overrideTargetIndex = null) => {
    if (isSpinning || challenges.length === 0) return
    setIsSpinning(true)

    // Select random target index (or use override)
    const targetIndex = overrideTargetIndex !== null 
      ? overrideTargetIndex 
      : Math.floor(Math.random() * totalSlices)
    const targetChallenge = challenges[targetIndex]

    // Audio click ticks during spin
    let tickCount = 0
    const tickInterval = setInterval(() => {
      playTickSound()
      tickCount++
      if (tickCount > 24) clearInterval(tickInterval)
    }, 120)

    // Formula: To align slice's center with 12 o'clock (0°),
    // we need (centerAngle + rotation) % 360 === 0.
    // slice center is at: targetIndex * sliceAngle + sliceAngle / 2
    const sliceCenterAngle = targetIndex * sliceAngle + sliceAngle / 2
    const baseSpins = 360 * 5 // 5 full revolutions
    const targetRotation = rotation + baseSpins + (360 - (sliceCenterAngle + (rotation % 360)) % 360)

    setRotation(targetRotation)

    // Finish spin after 3.2 seconds
    setTimeout(() => {
      clearInterval(tickInterval)
      setIsSpinning(false)
      setSpinResult(targetChallenge)
      onSelectSituation(targetChallenge)
    }, 3200)
  }

  // Spin Topic (Rapid Carousel Slot)
  const handleSpinTopic = () => {
    if (isTopicSpinning || topics.length === 0) return
    setIsTopicSpinning(true)

    let count = 0
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * topics.length)
      onSelectTopic(topics[randomIndex])
      playTickSound()
      count++
      if (count > 14) {
        clearInterval(interval)
        setIsTopicSpinning(false)
      }
    }, 85)
  }

  // Spin Both Sequentially: Topic first, then Situation Challenge!
  const handleSpinBoth = () => {
    if (isSpinning || isTopicSpinning) return

    // 1. Spin topic immediately
    setIsTopicSpinning(true)
    let count = 0
    const topicInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * topics.length)
      onSelectTopic(topics[randomIndex])
      playTickSound()
      count++
      if (count > 12) {
        clearInterval(topicInterval)
        setIsTopicSpinning(false)
        // 2. Then spin situation wheel immediately after topic settles!
        setTimeout(() => {
          handleSpinSituation()
        }, 200)
      }
    }, 80)
  }

  const ActiveIcon = spinResult && ICON_MAP[spinResult.icon] ? ICON_MAP[spinResult.icon] : Sparkles

  return (
    <div className="p-6 rounded-2xl border border-border-color bg-gradient-to-b from-bg-secondary/95 via-black/80 to-bg-secondary/95 backdrop-blur-md shadow-2xl space-y-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-amber/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Dual Spin Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-amber font-black flex items-center gap-1.5">
              🎡 SITUATION CHALLENGE WHEEL
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-muted border border-white/10 font-bold uppercase">
              10 MODIFIERS
            </span>
          </div>
          <p className="font-mono text-[11px] text-muted mt-0.5">
            Spin the topic first, then spin the situation to add high-stakes cognitive constraints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Phase Dropdown */}
          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-xl border border-amber/30">
            <span className="font-mono text-[10px] text-muted uppercase font-bold">PHASE:</span>
            <select
              value={activePhase}
              onChange={(e) => onPhaseChange(Number(e.target.value))}
              className="bg-transparent text-amber font-mono text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value={1} className="bg-zinc-950 text-white">Phase 1 (Days 1–30)</option>
              <option value={2} className="bg-zinc-950 text-white">Phase 2 (Days 31–60)</option>
              <option value={3} className="bg-zinc-950 text-white">Phase 3 (Days 61–90)</option>
            </select>
          </div>

          {/* Master Spin Both Button */}
          <button
            type="button"
            onClick={handleSpinBoth}
            disabled={isSpinning || isTopicSpinning}
            className="btn font-mono text-xs px-5 py-2.5 bg-gradient-to-r from-amber via-yellow-400 to-amber-hover text-black font-black tracking-wider uppercase rounded-xl shadow-xl flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shrink-0"
          >
            <Sparkles size={16} className={isSpinning || isTopicSpinning ? 'animate-spin' : ''} />
            <span>{isSpinning || isTopicSpinning ? 'SPINNING COMBO...' : '🎰 SPIN BOTH (TOPIC + SITUATION)'}</span>
          </button>
        </div>
      </div>

      {/* Active Selection Banner if situation is active */}
      {spinResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-amber/40 bg-gradient-to-r from-amber-950/40 via-black to-amber-950/20 shadow-xl relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start sm:items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg"
                style={{ backgroundColor: `${spinResult.color}25`, borderColor: spinResult.color }}
              >
                <ActiveIcon size={20} style={{ color: spinResult.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded font-black uppercase text-black" style={{ backgroundColor: spinResult.color }}>
                    CHALLENGE #{spinResult.id}
                  </span>
                  <span className="font-mono text-sm font-black text-primary uppercase">
                    {spinResult.title}
                  </span>
                </div>
                <p className="font-mono text-xs text-primary/90 mt-1 leading-snug font-medium">
                  {spinResult.rules || spinResult.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 sm:self-center">
              <button
                type="button"
                onClick={() => handleSpinSituation()}
                disabled={isSpinning}
                className="btn btn-ghost btn-xs font-mono text-[10px] text-amber hover:text-amber-hover border border-amber/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1"
              >
                <RotateCcw size={11} className={isSpinning ? 'animate-spin' : ''} />
                <span>RE-SPIN</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpinResult(null)
                  onClearSituation()
                }}
                className="btn btn-ghost btn-xs font-mono text-[10px] text-muted hover:text-red-400 border border-white/10 px-2 py-1 rounded-lg"
                title="Remove Challenge"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* WHEEL DISPLAY & CHALLENGES LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* WHEEL CANVAS (LEFT 6 COLS) */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
          
          {/* Top Pointer Needle (12 o'clock, points downwards into winning slice) */}
          <div className="relative z-20 flex flex-col items-center -mb-4">
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-amber drop-shadow-[0_4px_12px_rgba(245,158,11,0.8)] filter" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber -mt-7 shadow-lg" />
          </div>

          {/* Rotating SVG Wheel */}
          <div className="relative p-2 rounded-full border-4 border-amber/20 bg-black/90 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transition-transform ease-out cursor-pointer"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: isSpinning ? '3.2s' : '0s',
                transitionTimingFunction: 'cubic-bezier(0.12, 0.8, 0.32, 1)'
              }}
              onClick={() => !isSpinning && handleSpinSituation()}
            >
              {/* Slices */}
              {challenges.map((c, idx) => {
                // Slice geometry: start at 12 o'clock (0 rad = top)
                const startAngle = (idx * sliceAngle * Math.PI) / 180
                const endAngle = ((idx + 1) * sliceAngle * Math.PI) / 180

                // SVG coordinates (0° is top, positive angle is clockwise)
                const x1 = center + radius * Math.sin(startAngle)
                const y1 = center - radius * Math.cos(startAngle)
                const x2 = center + radius * Math.sin(endAngle)
                const y2 = center - radius * Math.cos(endAngle)

                const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`

                // Text label positioning along the mid-angle of the slice
                const midAngle = ((idx * sliceAngle + sliceAngle / 2) * Math.PI) / 180
                const textRadius = radius * 0.72
                const textX = center + textRadius * Math.sin(midAngle)
                const textY = center - textRadius * Math.cos(midAngle)

                // Rotation angle for label readability
                const textRot = idx * sliceAngle + sliceAngle / 2

                return (
                  <g key={c.id}>
                    {/* Slice wedge */}
                    <path
                      d={pathData}
                      fill={c.color || '#333'}
                      fillOpacity={0.22}
                      stroke="#ffffff15"
                      strokeWidth="1.5"
                      className="hover:fill-opacity-40 transition-all"
                    />

                    {/* Outer accent arc */}
                    <path
                      d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
                      fill="none"
                      stroke={c.color}
                      strokeWidth="3.5"
                      strokeOpacity="0.8"
                    />

                    {/* Radial text label: ONLY NUMBERS */}
                    <text
                      x={textX}
                      y={textY}
                      fill="#ffffff"
                      fontSize="17"
                      fontFamily="monospace"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${textRot}, ${textX}, ${textY})`}
                      className="select-none pointer-events-none"
                      style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.9))' }}
                    >
                      {c.id}
                    </text>
                  </g>
                )
              })}

              {/* Decorative outer glow rim */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4 8"
                opacity="0.4"
              />
            </svg>

            {/* Center SPIN Hub Button */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSpinSituation()
                }}
                disabled={isSpinning}
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-black via-zinc-900 to-zinc-800 border-2 border-amber/60 text-amber shadow-[0_0_20px_rgba(245,158,11,0.4)] flex flex-col items-center justify-center font-mono font-black text-[11px] uppercase tracking-wider transform hover:scale-110 active:scale-95 transition-all pointer-events-auto cursor-pointer group disabled:opacity-50"
              >
                <RotateCcw size={16} className={`group-hover:rotate-180 transition-transform duration-500 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>SPIN</span>
              </button>
            </div>
          </div>

          <div className="font-mono text-[10px] text-muted uppercase tracking-widest mt-4 flex items-center gap-1.5 font-bold">
            <Sparkles size={12} className="text-amber" /> Click wheel or SPIN hub to rotate
          </div>
        </div>

        {/* 10 SITUATIONS GUIDE (RIGHT 6 COLS) */}
        <div className="lg:col-span-6 space-y-2 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="font-mono text-xs uppercase font-bold text-muted mb-2 tracking-wider flex items-center justify-between">
            <span>THE 10 SITUATION CHALLENGES</span>
            <span className="text-amber font-mono text-[10px]">Select Directly:</span>
          </div>

          {challenges.map((c) => {
            const isSelected = spinResult?.id === c.id
            const ItemIcon = ICON_MAP[c.icon] || Sparkles

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSpinResult(c)
                  onSelectSituation(c)
                }}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-amber/15 border-amber shadow-md ring-1 ring-amber/50'
                    : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/[0.02]'
                }`}
              >
                <div 
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${c.color}25`, color: c.color }}
                >
                  <ItemIcon size={13} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold text-primary truncate">
                      {c.id}. {c.title}
                    </span>
                    {isSelected && (
                      <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber text-black font-black uppercase shrink-0">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-muted line-clamp-1 mt-0.5 leading-snug">
                    {c.rules}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )
}
