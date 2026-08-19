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
        <div className="w-[1px] h-8 bg-white/10 shrink-0 hidden md:block" />

        {/* ── 3. DAILY MOMENTUM ── */}
        <Link href="/xp" className="flex items-center gap-3.5 shrink-0 group select-none hover:opacity-90 transition-opacity">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1.5 font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.18em] text-slate-400 font-semibold whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${todayNet >= 0 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'} animate-pulse`} />
              <span>DAILY MOMENTUM</span>
            </div>
            <div className={`font-display font-black text-lg sm:text-xl tracking-tight leading-none mt-1 whitespace-nowrap ${todayNet >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {todayNet >= 0 ? `+${todayNet}` : todayNet} <span className="font-mono text-xs font-bold text-slate-400">XP</span>
            </div>
          </div>

          {/* Status Pill Badge */}
          <div className={`px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            state === 'AT RISK' 
              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.25)]' 
              : state === 'SURGING'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : state === 'RECOVERY'
              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'bg-amber-950/60 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
          }`}>
            {state === 'AT RISK' ? <ShieldAlert size={11} className="text-rose-400 shrink-0" /> : state === 'SURGING' ? <Flame size={11} className="text-emerald-400 shrink-0" /> : <Shield size={11} className="text-amber-400 shrink-0" />}
            <span>{state}</span>
          </div>
        </Link>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-white/10 shrink-0 hidden lg:block" />

        {/* ── 4. 3-DAY TREND WITH SPARKLINE HISTOGRAM ── */}
        <div className="items-center gap-3 shrink-0 hidden sm:flex">
          <div className="flex flex-col justify-center">
            <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.18em] text-slate-400 font-semibold whitespace-nowrap">
              3-DAY TREND
            </span>
            <div className={`font-mono text-xs sm:text-sm font-bold flex items-center gap-1 whitespace-nowrap mt-0.5 ${trend3Day >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              <span>{trend3Day >= 0 ? '↗' : '↘'}</span>
              <span>{trend3Day >= 0 ? `+${trend3Day}` : trend3Day} XP</span>
            </div>
          </div>

          {/* Mini Sparkline Bars */}
          <div className="flex items-end gap-1 h-5 px-1 pb-0.5">
            {sparklineBars.map((bar, idx) => (
              <div 
                key={idx}
                className={`w-1 rounded-t-sm transition-all duration-300 ${
                  bar.isPositive 
                    ? 'bg-emerald-400/80 shadow-[0_0_4px_#34d399]' 
                    : 'bg-rose-500/80 shadow-[0_0_4px_#f43f5e]'
                }`}
                style={{ height: `${bar.heightPct}%` }}
                title={`${bar.date || `Day ${idx + 1}`}: ${bar.net >= 0 ? '+' : ''}${bar.net} XP`}
              />
            ))}
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-white/10 shrink-0 hidden xl:block" />

        {/* ── 5. LIFETIME XP ── */}
        <div className="flex flex-col justify-center shrink-0 hidden lg:flex">
          <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.18em] text-slate-400 font-semibold whitespace-nowrap">
            LIFETIME
          </span>
          <div className="flex items-center gap-1.5 font-display font-bold text-xs sm:text-sm text-slate-100 whitespace-nowrap mt-0.5">
            <Box size={14} className="text-indigo-400 shrink-0" />
            <span>{totalXp.toLocaleString()} XP</span>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-white/10 shrink-0 hidden sm:block" />

        {/* ── 6. DATE & OPERATOR AVATAR ── */}
        <Link href="/profile" className="flex items-center gap-3.5 shrink-0 group select-none hover:opacity-90 transition-opacity">
          <div className="flex flex-col justify-center text-right font-mono hidden sm:flex">
            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider leading-tight whitespace-nowrap">
              {monthDayStr}
            </span>
            <span className="text-[9px] font-semibold text-indigo-300 uppercase tracking-widest flex items-center justify-end gap-1 leading-tight whitespace-nowrap">
              {weekdayStr} <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] shrink-0" />
            </span>
          </div>

          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-indigo-400/50 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 shadow-[0_0_14px_rgba(99,102,241,0.35)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={16} className="text-indigo-300" />
            )}
          </div>
        </Link>

      </div>
    </div>
  )
}
