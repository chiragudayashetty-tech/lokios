'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, ShieldAlert, Flame } from 'lucide-react'
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

  const toNext = Math.max(0, xpProgress.required - xpProgress.current)
  const pct = Math.max(4, Math.min(100, Math.round(xpProgress.percentage)))

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0 4px', marginBottom: '20px', boxSizing: 'border-box' }}>
      <div 
        className="loki-capsule-hud premium-xp-hud"
        style={{
          width: '100%',
          maxWidth: '1280px',
          minHeight: '48px',
          borderRadius: '9999px',
          background: 'rgba(9, 13, 24, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          gap: '12px',
          boxSizing: 'border-box'
        }}
      >
        
        {/* ── 1. SAGA & LEVEL (Left) ── */}
        <Link 
          href="/xp" 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, textDecoration: 'none', color: 'inherit' }}
        >
          {/* Glowing Faceted Crystal Gem Icon */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e1b4b, #581c87, #0f172a)',
            border: '1px solid rgba(168, 85, 247, 0.5)',
            boxShadow: '0 0 15px rgba(168, 85, 247, 0.35)',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.8))' }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '14px', color: '#ffffff', letterSpacing: '0.04em', lineHeight: 1 }}>
                LV.{level}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>
                SAGA {rank.code}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '10px', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
              {rankTitle}
            </span>
          </div>
        </Link>

        {/* ── 2. LEVEL PROGRESS CAPSULE BAR (Center) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', flex: 1, maxWidth: '320px', minWidth: 0, padding: '0 6px' }}>
          <div className="capsule-track" style={{ width: '100%', height: '8px', borderRadius: '9999px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.12)', overflow: 'hidden' }}>
            <motion.div 
              className="capsule-fill"
              style={{
                height: '100%',
                borderRadius: '9999px',
                background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #22d3ee 100%)',
                boxShadow: '0 0 12px rgba(168, 85, 247, 0.7)'
              }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#94a3b8' }}>
            <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{xpProgress.current.toLocaleString()} / {xpProgress.required.toLocaleString()} XP</span>
            <span style={{ color: '#64748b' }}>{toNext.toLocaleString()} to LV.{level + 1}</span>
          </div>
        </div>

        {/* ── 3. 3-DAY TREND (Desktop only) ── */}
        <div className="hidden lg:flex" style={{ alignItems: 'center', gap: '16px', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b', fontWeight: 700 }}>
              3-DAY TREND
            </span>
            <div 
              style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '11px', 
                fontWeight: 800, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                marginTop: '1px',
                color: trend3Day < 0 ? '#f43f5e' : '#34d399' 
              }}
            >
              <span>{trend3Day >= 0 ? '↗' : '↘'}</span>
              <span>{trend3Day >= 0 ? `+${trend3Day}` : trend3Day} XP</span>
            </div>
          </div>

          {/* Sparkline */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '16px', paddingBottom: '1px' }}>
            {sparklineBars.slice(-5).map((bar, idx) => (
              <div 
                key={idx}
                style={{ 
                  width: '4px',
                  borderRadius: '2px 2px 0 0',
                  height: `${bar.heightPct}%`,
                  backgroundColor: bar.isPositive ? '#34d399' : '#f43f5e',
                }}
              />
            ))}
          </div>
        </div>

        {/* ── 4. MOMENTUM & STATUS PILL (Right) ── */}
        <Link 
          href="/xp" 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, textDecoration: 'none', color: 'inherit', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '12px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b', fontWeight: 700 }}>
              TODAY
            </span>
            <div 
              style={{ 
                fontFamily: 'var(--font-display)', 
                fontWeight: 900, 
                fontSize: '13px', 
                letterSpacing: '-0.02em', 
                lineHeight: 1, 
                color: todayNet < 0 ? '#f43f5e' : todayNet > 0 ? '#34d399' : '#818cf8' 
              }}
            >
              {todayNet >= 0 ? `+${todayNet}` : todayNet} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: '#64748b' }}>XP</span>
            </div>
          </div>

          {/* Status Pill Badge */}
          <div 
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              border: '1px solid',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexShrink: 0,
              backgroundColor: state === 'AT RISK' ? 'rgba(76, 5, 25, 0.85)' : state === 'RECOVERY' ? 'rgba(6, 40, 55, 0.85)' : state === 'SURGING' ? 'rgba(6, 44, 28, 0.85)' : 'rgba(30, 27, 75, 0.85)',
              borderColor: state === 'AT RISK' ? '#f43f5e' : state === 'RECOVERY' ? '#22d3ee' : state === 'SURGING' ? '#34d399' : '#818cf8',
              color: state === 'AT RISK' ? '#f43f5e' : state === 'RECOVERY' ? '#22d3ee' : state === 'SURGING' ? '#34d399' : '#818cf8',
              boxShadow: state === 'SURGING' ? '0 0 10px rgba(52, 211, 153, 0.35)' : 'none'
            }}
          >
            {state === 'AT RISK' ? (
              <ShieldAlert size={11} style={{ color: '#f43f5e' }} />
            ) : state === 'RECOVERY' ? (
              <Shield size={11} style={{ color: '#22d3ee' }} />
            ) : state === 'SURGING' ? (
              <Flame size={11} style={{ color: '#34d399' }} />
            ) : (
              <Shield size={11} style={{ color: '#818cf8' }} />
            )}
            <span>{state}</span>
          </div>
        </Link>

      </div>
    </div>
  )
}

