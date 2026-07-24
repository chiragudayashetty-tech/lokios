'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Crosshair, Target, CheckSquare, Lightbulb,
  BookOpen, Briefcase, CalendarDays, Monitor, User,
  Menu, X, Shield, Trophy, RefreshCw, LogOut, ClipboardList, Scale
} from 'lucide-react'
import LokiAI from '@/components/LokiAI'
import { calculateLevel, getRankForXp } from '@/lib/utils/xp'

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Command Center' },
  { href: '/quests', icon: Crosshair, label: 'Daily Ops' },
  { href: '/goals', icon: Target, label: 'Missions' },
  { href: '/tasks', icon: CheckSquare, label: 'Operations' },
  { href: '/brain-dump', icon: Lightbulb, label: 'Intel Drop' },
  { href: '/journal', icon: BookOpen, label: 'Journal' },
  { href: '/portfolio-log', icon: Briefcase, label: 'Proof of Work' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },

  { href: '/screen-time', icon: Monitor, label: 'Screen Intel' },
  { href: '/xp', icon: Trophy, label: 'XP Metrics' },
  { href: '/weight', icon: Scale, label: 'Wellness' },
  { href: '/profile', icon: User, label: 'Operator Profile' }
]

export default function AppShell({ children }) {
  const pathname = usePathname()
  const { auth, profile: { profile }, tasks: { todayTasks }, habits: { habits, todayLogs } } = useOS()
  const { user } = auth
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // NOTIFICATION MANAGER
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const requestPerms = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
    }
    requestPerms()

    const checkAlarms = () => {
      if (Notification.permission !== 'granted') return
      
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const dateStr = now.toDateString()

      // 9:00 AM Morning Briefing
      if (hours === 9 && minutes === 0) {
        const key = `notif_morning_${dateStr}`
        if (!localStorage.getItem(key)) {
          const dueTasks = todayTasks?.length || 0
          new Notification('Morning Briefing', {
            body: `Operator, you have ${dueTasks} Operations and ${habits?.length || 0} Daily Routines to secure today.`,
            icon: '/icons/icon-192.png'
          })
          localStorage.setItem(key, 'true')
        }
      }

      // 8:00 PM Evening Warning
      if (hours === 20 && minutes === 0) {
        const key = `notif_evening_${dateStr}`
        if (!localStorage.getItem(key)) {
          const incompleteHabits = (habits?.length || 0) - (todayLogs?.filter(l => l.status === 'completed')?.length || 0)
          if (incompleteHabits > 0) {
            new Notification('Evening Warning', {
              body: `Midnight approaches. You still have ${incompleteHabits} routines unmarked. Secure them to protect your XP.`,
              icon: '/icons/icon-192.png'
            })
          }
          localStorage.setItem(key, 'true')
        }
      }
    }

    const interval = setInterval(checkAlarms, 60000) // Check every minute
    checkAlarms() // Check immediately on mount

    return () => clearInterval(interval)
  }, [todayTasks, habits, todayLogs])

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

  if (!user) return null

  const mainItems = [
    NAV_ITEMS[0], // Command Center
    NAV_ITEMS[1], // Daily Ops
    NAV_ITEMS[3], // Operations
    NAV_ITEMS[2], // Missions
  ]

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 flex-col px-6 overflow-y-auto"
            style={{ 
              zIndex: 1100,
              display: 'flex',
              background: 'rgba(4, 5, 7, 0.98)', 
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              paddingTop: 'max(48px, env(safe-area-inset-top))',
              paddingBottom: 'calc(100px + env(safe-area-inset-bottom))' 
            }}
            onClick={(e) => { if(e.target === e.currentTarget) setMobileMenuOpen(false) }}
          >
            <div className="flex-col gap-6 mt-4 mb-auto max-w-md mx-auto w-full">
              <div className="font-display text-4xl tracking-widest uppercase text-primary mb-2 opacity-50">Systems</div>
              <nav className="flex-col gap-3">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <div className={`flex items-center gap-4 p-4 rounded-xl transition-transform active:scale-95 ${isActive ? 'bg-amber text-bg-primary shadow-lg shadow-amber/20' : 'bg-tertiary text-primary border border-border-color'}`}>
                        <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
                        <span className="font-display text-xl uppercase tracking-wider">{item.label}</span>
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </div>
            
            <div className="mt-8 max-w-md mx-auto w-full flex flex-col gap-3">
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-tertiary border border-border-color rounded-xl text-primary active:scale-95 transition-transform"
              >
                <X size={20} />
                <span className="font-display tracking-wider uppercase text-sm">Close Menu</span>
              </button>
              
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                className="w-full flex items-center justify-center gap-3 p-4 bg-tertiary border border-border-color rounded-xl text-primary active:scale-95 transition-transform"
              >
                <RefreshCw size={20} />
                <span className="font-display tracking-wider uppercase text-sm">Force Sync / Reload</span>
              </button>

              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to sign out?')) {
                    auth.signOut()
                  }
                }}
                className="w-full flex items-center justify-center gap-3 p-4 bg-tertiary border border-danger rounded-xl text-danger active:scale-95 transition-transform"
              >
                <LogOut size={20} />
                <span className="font-display tracking-wider uppercase text-sm">Sign Out</span>
              </button>

              <LokiAI />

              <div className="flex items-center justify-between p-4 bg-tertiary border border-border-color rounded-xl">
                <div className="flex items-center gap-3">
                  <Shield size={24} color={profile ? getRankForXp(profile.total_xp || 0).colorHex : "var(--accent-primary)"} />
                  <div className="flex-col">
                    <span className="font-display uppercase text-xs tracking-wide text-muted" style={{ color: profile ? getRankForXp(profile.total_xp || 0).colorHex : 'inherit' }}>
                      {profile ? `${getRankForXp(profile.total_xp || 0).code}-RANK` : 'OPERATOR'}
                    </span>
                    <span className="font-mono text-sm text-primary font-bold">LV.{profile ? calculateLevel(profile.total_xp || 0) : 1}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="sidebar hidden-mobile">
        <div className="sidebar-header">
          <div className="sidebar-logo">C</div>
          <div className="flex-col" style={{ minWidth: 0 }}>
            <span className="sidebar-title">CHIRAGOS</span>
            <span className="sidebar-version">PRIVATE OS</span>
          </div>
        </div>

        <div className="sidebar-section-label">Systems</div>

        <nav className="sidebar-nav">
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
                  <Icon size={18} strokeWidth={1.5} color={isActive ? 'var(--accent-primary)' : 'currentColor'} />
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
            </div>
          </div>
          <LokiAI />
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to sign out?')) {
                auth.signOut()
              }
            }}
            className="w-full flex items-center justify-center gap-2 mt-3 p-2 rounded text-muted hover:text-danger hover:bg-danger-subtle transition-colors font-mono text-xs uppercase tracking-wider"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav" style={{ zIndex: 100 }}>
        {mainItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{ flex: 1 }}>
              <div 
                className={`flex-col flex-center p-3 transition-all active:scale-90 ${isActive ? 'active-nav-item' : 'inactive-nav-item'}`} 
                style={{ 
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  minHeight: '56px',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, background: 'var(--accent-primary)', borderRadius: '0 0 2px 2px', boxShadow: '0 0 8px var(--amber-glow)' }} />
                )}
                <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                <span className="mt-1 font-display uppercase tracking-wide" style={{ fontSize: '9px', opacity: isActive ? 1 : 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>{item.label}</span>
              </div>
            </Link>
          )
        })}
        <button type="button" style={{ flex: 1, minHeight: '56px', width: '20%', position: 'relative' }} className={`flex-col flex-center p-3 transition-all active:scale-90 ${mobileMenuOpen ? 'text-primary' : 'text-muted inactive-nav-item'}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen && (
            <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, background: 'var(--accent-primary)', borderRadius: '0 0 2px 2px', boxShadow: '0 0 8px var(--amber-glow)' }} />
          )}
          {mobileMenuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={1.5} />}
          <span className="mt-1 font-display uppercase tracking-wide" style={{ fontSize: '9px', opacity: mobileMenuOpen ? 1 : 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>{mobileMenuOpen ? 'Close' : 'More'}</span>
        </button>
      </nav>

    </div>
  )
}
