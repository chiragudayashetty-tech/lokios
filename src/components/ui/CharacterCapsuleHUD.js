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
    <div className="w-full flex justify-center px-2 sm:px-4 mb-6">
      <div className="loki-capsule-hud w-full max-w-[1360px] flex items-center justify-between gap-4 lg:gap-7 py-3 px-5 sm:px-7 rounded-full border border-indigo-500/30 bg-[#0a0d1a]/90 backdrop-blur-2xl shadow-[0_14px_45px_rgba(0,0,0,0.65),inset_0_0_24px_rgba(129,140,248,0.08),0_0_30px_rgba(99,102,241,0.18)] overflow-x-auto hide-scrollbar">
        
        {/* ── 1. SAGA & LEVEL (Leftmost) ── */}
        <Link href="/xp" className="flex items-center gap-3.5 shrink-0 group select-none hover:opacity-90 transition-opacity">
          {/* Glowing Faceted Crystal Gem Icon */}
          <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-indigo-950/90 via-purple-950/80 to-slate-950 border border-indigo-400/40 shadow-[0_0_18px_rgba(129,140,248,0.45)] shrink-0 group-hover:scale-105 transition-transform">
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-pulse" />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="relative z-10 drop-shadow-[0_0_8px_rgba(168,85,247,0.85)]">
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
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-400 font-semibold leading-tight">
              SAGA {rank.code}
            </span>
            <span className="font-display font-bold text-[11px] sm:text-xs uppercase tracking-wider text-indigo-300 leading-tight">
              {rankTitle}
            </span>
            <span className="font-display font-black text-sm sm:text-base text-white tracking-wide leading-tight">
              LV.{level}
            </span>
          </div>
        </Link>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-white/10 shrink-0" />

        {/* ── 2. LEVEL PROGRESS CAPSULE BAR ── */}
        <div className="flex flex-col justify-center gap-1.5 w-36 sm:w-44 lg:w-48 shrink-0">
          <div className="w-full h-2 rounded-full bg-slate-950/90 border border-white/10 p-[1px] overflow-hidden">
            <motion.div 
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, Math.min(100, xpProgress.percentage))}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[9px] sm:text-[10px] text-slate-300 gap-2">
            <span className="font-bold whitespace-nowrap">{xpProgress.current.toLocaleString()} / {xpProgress.required.toLocaleString()} XP</span>
            <span className="text-slate-400 flex items-center gap-0.5 text-[9px] whitespace-nowrap hidden sm:inline-flex">
              {toNext.toLocaleString()} to LV.{level + 1} →
            </span>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-white/10 shrink-0" />

        {/* ── 3. DAILY MOMENTUM ── */}
        <Link href="/xp" className="flex flex-col justify-center shrink-0 group select-none hover:opacity-90 transition-opacity">
          <div className="flex items-center gap-1.5 font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.18em] text-slate-400 font-semibold whitespace-nowrap">
            <span 
              className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" 
              style={{
                backgroundColor: state === 'AT RISK' ? '#f43f5e' : state === 'RECOVERY' ? '#22d3ee' : state === 'SURGING' ? '#34d399' : '#818cf8',
                boxShadow: `0 0 8px ${state === 'AT RISK' ? '#f43f5e' : state === 'RECOVERY' ? '#22d3ee' : state === 'SURGING' ? '#34d399' : '#818cf8'}`
              }}
            />
            <span>DAILY MOMENTUM</span>
          </div>
          <div 
            className="font-display font-black text-base sm:text-lg tracking-tight leading-none mt-1 whitespace-nowrap"
            style={{ color: todayNet < 0 ? '#f43f5e' : todayNet > 0 ? '#34d399' : '#818cf8' }}
          >
            {todayNet >= 0 ? `+${todayNet}` : todayNet} <span className="font-mono text-xs font-bold text-slate-400">XP</span>
          </div>
        </Link>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-white/10 shrink-0" />

        {/* ── 4. 3-DAY TREND WITH SPARKLINE HISTOGRAM ── */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col justify-center">
            <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.18em] text-slate-400 font-semibold whitespace-nowrap">
              3-DAY TREND
            </span>
            <div 
              className="font-mono text-xs font-bold flex items-center gap-1 whitespace-nowrap mt-0.5"
              style={{ color: trend3Day < 0 ? '#f43f5e' : '#34d399' }}
            >
              <span>{trend3Day >= 0 ? '↗' : '↘'}</span>
              <span>{trend3Day >= 0 ? `+${trend3Day}` : trend3Day} XP</span>
            </div>
          </div>

          {/* Mini Sparkline Bars */}
          <div className="flex items-end gap-1 h-5 px-1 pb-0.5">
            {sparklineBars.map((bar, idx) => (
              <div 
                key={idx}
                className="w-1 rounded-t-sm transition-all duration-300"
                style={{ 
                  height: `${bar.heightPct}%`,
                  backgroundColor: bar.isPositive ? '#34d399' : '#f43f5e',
                  boxShadow: `0 0 4px ${bar.isPositive ? '#34d399' : '#f43f5e'}`
                }}
                title={`${bar.date || `Day ${idx + 1}`}: ${bar.net >= 0 ? '+' : ''}${bar.net} XP`}
              />
            ))}
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-white/10 shrink-0" />

        {/* ── 5. LIFETIME XP ── */}
        <div className="flex flex-col justify-center shrink-0">
          <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.18em] text-slate-400 font-semibold whitespace-nowrap">
            LIFETIME
          </span>
          <div className="flex items-center gap-1.5 font-display font-bold text-xs sm:text-sm text-slate-100 whitespace-nowrap mt-0.5">
            <Box size={13} className="text-indigo-400 shrink-0" />
            <span>{totalXp.toLocaleString()} XP</span>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-white/10 shrink-0" />

        {/* ── 6. RIGHTMOST: DYNAMIC STATUS PILL BADGE (Instead of Profile Logo) ── */}
        <Link href="/xp" className="flex items-center gap-3 shrink-0 group select-none hover:opacity-90 transition-opacity">
          {/* Date Stamp */}
          <div className="flex flex-col justify-center text-right font-mono">
            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider leading-tight whitespace-nowrap">
              {monthDayStr}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-tight whitespace-nowrap">
              {weekdayStr}
            </span>
          </div>

          {/* Standalone Status Pill Badge with Strict Vibrant Colors */}
          <div 
            className="px-3.5 py-1.5 rounded-full border text-[10px] sm:text-[11px] font-mono font-black uppercase tracking-widest flex items-center gap-2 shrink-0 whitespace-nowrap transition-all group-hover:scale-105"
            style={{
              backgroundColor: state === 'AT RISK' ? 'rgba(76, 5, 25, 0.85)' : state === 'RECOVERY' ? 'rgba(6, 40, 55, 0.85)' : state === 'SURGING' ? 'rgba(6, 44, 28, 0.85)' : 'rgba(30, 27, 75, 0.85)',
              borderColor: state === 'AT RISK' ? '#f43f5e' : state === 'RECOVERY' ? '#22d3ee' : state === 'SURGING' ? '#34d399' : '#818cf8',
              color: state === 'AT RISK' ? '#f43f5e' : state === 'RECOVERY' ? '#22d3ee' : state === 'SURGING' ? '#34d399' : '#818cf8',
              boxShadow: `0 0 16px ${state === 'AT RISK' ? 'rgba(244, 63, 94, 0.45)' : state === 'RECOVERY' ? 'rgba(6, 182, 212, 0.45)' : state === 'SURGING' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(99, 102, 241, 0.45)'}`
            }}
          >
            {state === 'AT RISK' ? (
              <ShieldAlert size={13} style={{ color: '#f43f5e' }} className="shrink-0" />
            ) : state === 'RECOVERY' ? (
              <Shield size={13} style={{ color: '#22d3ee' }} className="shrink-0" />
            ) : state === 'SURGING' ? (
              <Flame size={13} style={{ color: '#34d399' }} className="shrink-0" />
            ) : (
              <Shield size={13} style={{ color: '#818cf8' }} className="shrink-0" />
            )}
            <span className="leading-none">{state}</span>
          </div>
        </Link>

      </div>
    </div>
  )
}
