'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Crosshair, Target, CheckSquare, Lightbulb,
  BookOpen, Briefcase, CalendarDays, Monitor, User,
  Menu, X, Shield, Trophy, RefreshCw, LogOut, ClipboardList, Download, Mic
} from 'lucide-react'
import IntelExportModal from '@/components/ui/IntelExportModal'
import XPToastStack from '@/components/ui/XPToastStack'
import CharacterCapsuleHUD from '@/components/ui/CharacterCapsuleHUD'
import { calculateLevel, getRankForXp } from '@/lib/utils/xp'

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Home', group: 'Plan' },
  { href: '/quests', icon: Crosshair, label: 'Focus', group: 'Plan' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks', group: 'Plan' },
  { href: '/goals', icon: Target, label: 'Goals', group: 'Plan' },
  { href: '/work', icon: Briefcase, label: 'Work log', group: 'Build' },
  { href: '/speaking', icon: Mic, label: 'Speaking', group: 'Build' },
  { href: '/brain-dump', icon: Lightbulb, label: 'Brain dump', group: 'Reflect' },
  { href: '/journal', icon: BookOpen, label: 'Journal', group: 'Reflect' },
  { href: '/portfolio-log', icon: Briefcase, label: 'Portfolio', group: 'Reflect' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar', group: 'Reflect' },

  { href: '/screen-time', icon: Monitor, label: 'Screen time', group: 'Reflect' },
  { href: '/xp', icon: Trophy, label: 'Progress', group: 'Reflect' },
  { href: '/profile', icon: User, label: 'Profile', group: 'Account' }
]

export default function AppShell({ children }) {
  const pathname = usePathname()
  const os = useOS() || {}
  const { auth = {}, profile: { profile } = {}, xp: { dailyMomentum, feedbackEvents = [], dismissFeedback } = {}, tasks: { todayTasks = [] } = {}, habits: { habits = [], todayLogs = [] } = {} } = os
  const { user } = auth
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // PWA INSTALL BANNER LOGIC
  const [showPwaInstall, setShowPwaInstall] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    const hasDismissed = localStorage.getItem('lokios_pwa_dismissed')

    if (isIos && isSafari && !isStandalone && !hasDismissed) {
      setShowPwaInstall(true)
    }
  }, [])

  const dismissPwa = () => {
    localStorage.setItem('lokios_pwa_dismissed', 'true')
    setShowPwaInstall(false)
  }

  const totalXp = profile?.total_xp || 0
  const rank = getRankForXp(totalXp)
  const todayNet = dailyMomentum?.todayNet || 0
  const trend3Day = dailyMomentum?.threeDayNet || 0

  if (!user) return null

  // Mobile bottom bar - use shortened labels to prevent wrapping
  const mobileNavItems = [
    { ...NAV_ITEMS.find(item => item.href === '/dashboard'), label: 'Home' },
    { ...NAV_ITEMS.find(item => item.href === '/quests'), label: 'Daily Ops' },
    { ...NAV_ITEMS.find(item => item.href === '/tasks'), label: 'Tasks' },
    { ...NAV_ITEMS.find(item => item.href === '/goals'), label: 'Missions' },
  ].filter(Boolean)

  return (
    <div className="app-shell">
      {/* PWA Install Banner */}
      {showPwaInstall && (
        <div className="pwa-install-banner">
          <div className="pwa-install-banner-icon">📱</div>
          <div className="pwa-install-banner-text">
            <div className="pwa-install-banner-title">Install App</div>
            <div className="pwa-install-banner-subtitle">Tap Share → Add to Home Screen</div>
          </div>
          <button className="pwa-install-banner-close" onClick={dismissPwa}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Mobile Full-Screen Takeover Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 flex flex-col px-5 overflow-y-auto"
            style={{ 
              zIndex: 1100,
              background: 'rgba(5, 7, 15, 0.96)', 
              backdropFilter: 'blur(36px)',
              WebkitBackdropFilter: 'blur(36px)',
              paddingTop: 'max(36px, env(safe-area-inset-top))',
              paddingBottom: 'calc(100px + env(safe-area-inset-bottom))' 
            }}
            onClick={(e) => { if(e.target === e.currentTarget) setMobileMenuOpen(false) }}
          >
            <div className="flex flex-col gap-5 mt-2 mb-auto max-w-md mx-auto w-full">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-indigo-400 font-bold block">
                    NAVIGATION SYSTEM
                  </span>
                  <div className="font-display font-black text-2xl tracking-wider uppercase text-white">
                    CHIRAG OS
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="mobile-menu-groups">
                {['Plan', 'Build', 'Reflect', 'Account'].map((group) => (
                  <div className="mobile-menu-group" key={group}>
                    <span className="mobile-menu-group-label">{group}</span>
                    <div className="grid grid-cols-2 gap-2.5">
                    {NAV_ITEMS.filter(item => item.group === group).map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <div className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all active:scale-95 ${
                        isActive 
                          ? 'bg-gradient-to-br from-indigo-500/25 to-purple-600/20 text-white border-indigo-400/50 shadow-lg shadow-indigo-500/20' 
                          : 'bg-white/[0.03] text-slate-300 border-white/[0.06] hover:bg-white/[0.06]'
                      }`}>
                        <div className={`p-1.5 rounded-xl ${isActive ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                          <Icon size={18} strokeWidth={isActive ? 2.2 : 1.6} />
                        </div>
                        <span className="font-display font-bold text-xs uppercase tracking-wider truncate">
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  )
                    })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
            
            <div className="mt-6 max-w-md mx-auto w-full flex flex-col gap-2.5">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <Shield size={22} color={profile ? getRankForXp(profile.total_xp || 0).colorHex : "var(--accent-primary)"} />
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: profile ? getRankForXp(profile.total_xp || 0).colorHex : 'inherit' }}>
                      {profile ? `${getRankForXp(profile.total_xp || 0).code}-RANK` : 'OPERATOR'}
                    </span>
                    <span className="font-display font-black text-sm text-white">LV.{profile ? calculateLevel(profile.total_xp || 0) : 1}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider" style={{ background: `${dailyMomentum?.color || '#818cf8'}20`, color: dailyMomentum?.color || '#818cf8', border: `1px solid ${dailyMomentum?.color || '#818cf8'}40` }}>
                  {dailyMomentum?.state || 'STEADY'}
                </span>
              </div>

              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.reload()
                }}
                className="w-full flex items-center justify-center gap-2.5 p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-slate-300 active:scale-95 transition-all text-xs font-mono uppercase tracking-wider"
              >
                <RefreshCw size={14} />
                <span>Force Sync & Reload</span>
              </button>

              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to sign out?')) auth.signOut()
                }}
                className="w-full flex items-center justify-center gap-2.5 p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl text-rose-400 active:scale-95 transition-all text-xs font-mono uppercase tracking-wider"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/dashboard" className="logo">
            <span className="logo-text">CHIRAG OS</span>
            <span className="logo-badge">v2.0</span>
          </Link>
        </div>

        <nav className="nav-list">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                <motion.div
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon size={18} strokeWidth={1.5} color={isActive ? '#ffffff' : 'currentColor'} />
                  {item.label}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <Shield size={24} color={profile ? getRankForXp(profile.total_xp || 0).colorHex : "var(--accent-primary)"} opacity={0.5} />
            <div className="flex-col">
              <span className="font-display uppercase text-xs tracking-wide" style={{ color: profile ? getRankForXp(profile.total_xp || 0).colorHex : 'inherit' }}>
                {profile ? `${getRankForXp(profile.total_xp || 0).code}-RANK` : 'OPERATOR'}
              </span>
              <span className="font-mono text-sm text-primary font-bold">LV.{profile ? calculateLevel(profile.total_xp || 0) : 1}</span>
              <span className="font-mono text-[9px] tracking-widest" style={{ color: dailyMomentum?.color || 'var(--text-muted)' }}>{dailyMomentum?.state || 'STEADY'}</span>
            </div>
          </div>
          <button
            onClick={() => setExportModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 mt-2 p-2 rounded border border-amber/40 bg-amber/10 text-amber hover:bg-amber/20 transition-colors font-mono text-xs uppercase tracking-wider"
          >
            <Download size={14} />
            Export Intel
          </button>
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to sign out?')) {
                auth.signOut()
              }
            }}
            className="w-full flex items-center justify-center gap-2 mt-2 p-2 rounded text-muted hover:text-danger hover:bg-danger-subtle transition-colors font-mono text-xs uppercase tracking-wider"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <CharacterCapsuleHUD profile={profile} dailyMomentum={dailyMomentum} />
        {children}
      </main>

      {/* Intel Export & Report Generator Modal */}
      <IntelExportModal 
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
      <XPToastStack events={feedbackEvents} onDismiss={dismissFeedback} />

      {/* Opal Mobile Floating Island Navigation */}
      <nav className="mobile-nav">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="flex-1 flex justify-center py-1">
              <div 
                className={`flex flex-col items-center justify-center w-full py-1 px-0.5 rounded-full transition-all duration-300 active:scale-95 ${
                  isActive 
                    ? 'active-nav-item text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.6} />
                <span className="mt-0.5 font-display text-[9px] uppercase tracking-wide font-semibold whitespace-nowrap">
                  {item.label}
                </span>
              </div>
            </Link>
          )
        })}
        <button 
          type="button" 
          className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-full transition-all duration-300 active:scale-95 ${
            mobileMenuOpen ? 'active-nav-item text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={18} strokeWidth={2.2} /> : <Menu size={18} strokeWidth={1.6} />}
          <span className="mt-0.5 font-display text-[9px] uppercase tracking-wide font-semibold whitespace-nowrap">
            {mobileMenuOpen ? 'Close' : 'More'}
          </span>
        </button>
      </nav>

    </div>
  )
}
