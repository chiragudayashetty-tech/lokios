'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, ShieldAlert, Flame, Box, User } from 'lucide-react'
import { calculateLevel, xpToNextLevel, getRankForXp } from '@/lib/utils/xp'
import { SAGA_TITLES } from '@/lib/constants'

export default function CharacterCapsuleHUD({ profile, dailyMomentum }) {
  const totalXp = profile?.total_xp || 0
  const level = calculateLevel(totalXp)
  const xpProgress = xpToNextLevel(totalXp)
  const rank = getRankForXp(totalXp)
  const rankTitle = SAGA_TITLES[rank.code] || rank.name || 'The Spark'

  const todayNet = dailyMomentum?.todayNet || 0
  const trend3Day = dailyMomentum?.threeDayNet || 0
  const state = dailyMomentum?.state || 'STEADY'
  const sparklineBars = dailyMomentum?.sparkline || [
    { heightPct: 30, isPositive: true },
    { heightPct: 45, isPositive: true },
    { heightPct: 60, isPositive: false },
    { heightPct: 80, isPositive: false },
    { heightPct: 50, isPositive: false },
    { heightPct: 40, isPositive: todayNet >= 0 }
  ]

  // Date formatting
  const now = new Date()
  const monthDayStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
  const weekdayStr = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const toNext = Math.max(0, xpProgress.required - xpProgress.current)

  return (
    <div className="w-full flex justify-center px-1 sm:px-4 mb-5">
      <div className="loki-capsule-hud w-full max-w-[1280px] flex items-center justify-between gap-3 sm:gap-6 py-2.5 px-4 sm:px-6 rounded-full border border-white/10 bg-[#090d1a]/85 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)]">
        
        {/* ── 1. SAGA & LEVEL (Left) ── */}
        <Link href="/xp" className="flex items-center gap-3 shrink-0 group select-none hover:opacity-90 transition-opacity">
          {/* Glowing Faceted Crystal Gem Icon */}
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 border border-indigo-400/40 shadow-[0_0_15px_rgba(168,85,247,0.35)] shrink-0 group-hover:scale-105 transition-transform">
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-pulse" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="relative z-10 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">
              <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="url(#hudGemGrad1)" stroke="#c084fc" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M12 2L7 9L12 22L17 9L12 2Z" fill="url(#hudGemGrad2)" fillOpacity="0.9" />
              <path d="M2 9H22" stroke="#e9d5ff" strokeWidth="0.8" strokeLinecap="round" />
              <defs>
                <linearGradient id="hudGemGrad1" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#a855f7" />
                  <stop offset="1" stopColor="#4338ca" />
                </linearGradient>
                <linearGradient id="hudGemGrad2" x1="7" y1="2" x2="17" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f5d0fe" />
                  <stop offset="0.4" stopColor="#c084fc" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="flex flex-col justify-center min-w-0">
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-400 font-semibold leading-tight hidden xs:block">
              SAGA {rank.code}
            </span>
            <span className="font-display font-black text-xs sm:text-sm text-white tracking-wide leading-tight">
              LV.{level}
            </span>
            <span className="font-display font-semibold text-[10px] uppercase tracking-wider text-indigo-300 leading-tight truncate hidden md:block">
              {rankTitle}
            </span>
          </div>
        </Link>

        {/* ── 2. LEVEL PROGRESS CAPSULE BAR (Center) ── */}
        <div className="flex flex-col justify-center gap-1 flex-1 max-w-[280px] sm:max-w-xs px-2">
          <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-950 border border-white/10 p-[0.5px] overflow-hidden">
            <motion.div 
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 shadow-[0_0_10px_rgba(168,85,247,0.7)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, Math.min(100, xpProgress.percentage))}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[9px] text-slate-300">
            <span className="font-bold">{xpProgress.current.toLocaleString()} / {xpProgress.required.toLocaleString()} XP</span>
            <span className="text-slate-400 hidden sm:inline">{toNext.toLocaleString()} to LV.{level + 1}</span>
          </div>
        </div>

        {/* ── 3. 3-DAY TREND & LIFETIME (Desktop only) ── */}
        <div className="hidden lg:flex items-center gap-5 border-l border-white/10 pl-5">
          {/* Trend */}
          <div className="flex flex-col justify-center">
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
              3-DAY TREND
            </span>
            <div 
              className="font-mono text-xs font-bold flex items-center gap-1 mt-0.5"
              style={{ color: trend3Day < 0 ? '#f43f5e' : '#34d399' }}
            >
              <span>{trend3Day >= 0 ? '↗' : '↘'}</span>
              <span>{trend3Day >= 0 ? `+${trend3Day}` : trend3Day} XP</span>
            </div>
          </div>

          {/* Sparkline */}
          <div className="flex items-end gap-1 h-4 pb-0.5">
            {sparklineBars.slice(-5).map((bar, idx) => (
              <div 
                key={idx}
                className="w-1 rounded-t-sm"
                style={{ 
                  height: `${bar.heightPct}%`,
                  backgroundColor: bar.isPositive ? '#34d399' : '#f43f5e',
                }}
              />
            ))}
          </div>
        </div>

        {/* ── 4. MOMENTUM & STATUS PILL (Right) ── */}
        <Link href="/xp" className="flex items-center gap-2.5 shrink-0 group select-none hover:opacity-90 transition-opacity border-l border-white/10 pl-3 sm:pl-5">
          <div className="flex flex-col justify-center text-right">
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-slate-400 font-semibold hidden sm:block">
              TODAY
            </span>
            <div 
              className="font-display font-black text-xs sm:text-sm tracking-tight leading-none"
              style={{ color: todayNet < 0 ? '#f43f5e' : todayNet > 0 ? '#34d399' : '#818cf8' }}
            >
              {todayNet >= 0 ? `+${todayNet}` : todayNet} <span className="font-mono text-[9px] font-bold text-slate-400">XP</span>
            </div>
          </div>

          {/* Standalone Status Pill Badge */}
          <div 
            className="px-2.5 sm:px-3 py-1 rounded-full border text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0"
            style={{
              backgroundColor: state === 'AT RISK' ? 'rgba(76, 5, 25, 0.85)' : state === 'RECOVERY' ? 'rgba(6, 40, 55, 0.85)' : state === 'SURGING' ? 'rgba(6, 44, 28, 0.85)' : 'rgba(30, 27, 75, 0.85)',
              borderColor: state === 'AT RISK' ? '#f43f5e' : state === 'RECOVERY' ? '#22d3ee' : state === 'SURGING' ? '#34d399' : '#818cf8',
              color: state === 'AT RISK' ? '#f43f5e' : state === 'RECOVERY' ? '#22d3ee' : state === 'SURGING' ? '#34d399' : '#818cf8',
            }}
          >
            {state === 'AT RISK' ? (
              <ShieldAlert size={11} style={{ color: '#f43f5e' }} className="shrink-0" />
            ) : state === 'RECOVERY' ? (
              <Shield size={11} style={{ color: '#22d3ee' }} className="shrink-0" />
            ) : state === 'SURGING' ? (
              <Flame size={11} style={{ color: '#34d399' }} className="shrink-0" />
            ) : (
              <Shield size={11} style={{ color: '#818cf8' }} className="shrink-0" />
            )}
            <span className="leading-none">{state}</span>
          </div>
        </Link>

      </div>
    </div>
  )
}
