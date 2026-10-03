'use client'

import { useState, useEffect, useRef, createContext, useContext, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useOSSlice } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Crosshair, Target, CheckSquare, Lightbulb,
  BookOpen, Briefcase, CalendarDays, Monitor, User,
  Menu, X, Shield, Trophy, RefreshCw, LogOut, Download, Mic, Wallet, Award, Snowflake, Sun, Settings
} from 'lucide-react'
import IntelExportModal from '@/components/ui/IntelExportModal'
import XPToastStack from '@/components/ui/XPToastStack'
import CharacterCapsuleHUD from '@/components/ui/CharacterCapsuleHUD'
import LevelUpCelebration from '@/components/ui/LevelUpCelebration'
import GameOverlays from '@/components/game/GameOverlays'
import WeeklyScorecard from '@/components/game/WeeklyScorecard'
import AppServices from '@/components/layout/AppServices'
import { calculateLevel, getRankForXp } from '@/lib/utils/xp'
import { SAGA_TITLES } from '@/lib/constants'
import { celebrateAt } from '@/lib/utils/celebrate'
import { ACTIVE_SEASON } from '@/lib/theme/levelTheme'

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Home', group: 'Plan' },
  { href: '/today', icon: Sun, label: 'Today', group: 'Plan' },
  { href: '/quests', icon: Crosshair, label: 'Focus', group: 'Plan' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks', group: 'Plan' },
  { href: '/goals', icon: Target, label: 'Goals', group: 'Plan' },
  { href: '/work', icon: Briefcase, label: 'Work log', group: 'Build' },
  { href: '/speaking', icon: Mic, label: 'Speaking', group: 'Build' },
  { href: '/budget', icon: Wallet, label: 'Budget', group: 'Build' },
  { href: '/brain-dump', icon: Lightbulb, label: 'Brain dump', group: 'Reflect' },
  { href: '/journal', icon: BookOpen, label: 'Journal', group: 'Reflect' },
  { href: '/portfolio-log', icon: Award, label: 'Portfolio', group: 'Reflect' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar', group: 'Reflect' },
  { href: '/screen-time', icon: Monitor, label: 'Screen time', group: 'Reflect' },
  { href: '/xp', icon: Trophy, label: 'Progress', group: 'Reflect' },
  { href: '/profile', icon: User, label: 'Profile', group: 'Account' },
  { href: '/settings', icon: Settings, label: 'Settings', group: 'Account' }
]
const NAV_GROUPS = ['Plan', 'Build', 'Reflect', 'Account']
const DOCK_HREFS = ['/dashboard', '/today', '/tasks', '/goals']
const DOCK_ITEMS = DOCK_HREFS.map(href => NAV_ITEMS.find(item => item.href === href))

const pillSpring = { type: 'spring', stiffness: 520, damping: 38 }

// False during SSR and hydration, true afterwards. The auth hook seeds the user from
// localStorage on the client, so rendering the shell before mount mismatches the server HTML.
const noopSubscribe = () => () => {}
function useHasMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

// Routes that render without the app chrome.
const CHROMELESS = [/^\/$/, /^\/login/, /^\/p\//, /^\/auth\//]
const ShellContext = createContext(false)

/**
 * Mounted once in the root layout so the sidebar, HUD and dock persist across
 * navigation (no remount flicker, and the active pill can glide between routes).
 */
export function PersistentShell({ children }) {
  const pathname = usePathname() || '/'
  if (CHROMELESS.some(rx => rx.test(pathname))) return children
  return (
    <ShellContext.Provider value={true}>
      <AppShellFrame>{children}</AppShellFrame>
    </ShellContext.Provider>
  )
}

/** Pages still wrap themselves in <AppShell>; inside the persistent shell it is a pass-through. */
export default function AppShell({ children }) {
  const insideShell = useContext(ShellContext)
  if (insideShell) return children
  return <AppShellFrame>{children}</AppShellFrame>
}

function AppShellFrame({ children }) {
  const pathname = usePathname()
  const mainRef = useRef(null)
  const hasMounted = useHasMounted()
  // Slice subscriptions: the always-mounted shell ignores habit/task/journal updates
  const auth = useOSSlice('auth')
  const { profile } = useOSSlice('profile')
  const { dailyMomentum, feedbackEvents = [], dismissFeedback } = useOSSlice('xp')
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

  // The shell persists across routes, so reset scroll and close the menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
    mainRef.current?.scrollTo?.(0, 0)
    window.scrollTo(0, 0)
  }, [pathname])

  // Any control marked data-celebrate fires confetti from the tap point
  useEffect(() => {
    const onClick = (e) => {
      if (e.target.closest?.('[data-celebrate]')) celebrateAt(e.clientX, e.clientY)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Lock background scroll while the mobile menu sheet is open
  useEffect(() => {
    if (!mobileMenuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [mobileMenuOpen])

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

  if (!user || !hasMounted) return null

  const totalXp = profile?.total_xp || 0
  const level = profile ? calculateLevel(totalXp) : null
  const rank = getRankForXp(totalXp)
  const rankColor = profile ? rank.colorHex : 'var(--accent-primary)'
  const momentumColor = dailyMomentum?.color || 'var(--accent-primary)'
  const momentumState = dailyMomentum?.state || 'STEADY'

  const confirmSignOut = () => {
    if (confirm('Are you sure you want to sign out?')) auth.signOut()
  }

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
          <button className="pwa-install-banner-close" onClick={dismissPwa} aria-label="Dismiss install banner">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Mobile menu sheet */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 flex flex-col px-5 overflow-y-auto"
            style={{
              zIndex: 990, // below the dock (1000) so it stays tappable
              background: 'rgba(7, 6, 13, 0.9)',
              backdropFilter: 'blur(30px) saturate(140%)',
              WebkitBackdropFilter: 'blur(30px) saturate(140%)',
              paddingTop: 'max(28px, env(safe-area-inset-top))',
              paddingBottom: 'calc(110px + env(safe-area-inset-bottom))'
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setMobileMenuOpen(false) }}
          >
            <motion.div
              className="flex flex-col gap-6 max-w-md mx-auto w-full"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted font-semibold block">Menu</span>
                  <div className="flex items-center gap-2">
                    <div className="logo-text" style={{ fontSize: '1.6rem' }}>ChiragOS</div>
                    {ACTIVE_SEASON === 'winter' && <span className="season-badge"><Snowflake size={11} /> Winter arc</span>}
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="mobile-menu-groups">
                {NAV_GROUPS.map((group, groupIndex) => (
                  <div key={group}>
                    <span className="mobile-menu-group-label">{group}</span>
                    <div className="menu-grid">
                      {NAV_ITEMS.filter(item => item.group === group).map((item, i) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon
                        return (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, y: 12, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.04 * (groupIndex * 3 + i), type: 'spring', stiffness: 400, damping: 30 }}
                          >
                            <Link href={item.href} onClick={() => setMobileMenuOpen(false)}>
                              <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors active:scale-95 ${
                                isActive
                                  ? 'text-white border-amber/40 bg-amber/15'
                                  : 'bg-white/[0.03] text-slate-300 border-white/[0.06]'
                              }`}>
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'text-white' : 'bg-white/5 text-slate-400'}`}
                                  style={isActive ? { background: 'var(--accent-gradient)', boxShadow: '0 6px 16px -6px var(--accent-glow)' } : undefined}
                                >
                                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                                </div>
                                <span className="font-display font-semibold text-sm truncate">{item.label}</span>
                              </div>
                            </Link>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <Shield size={22} color={rankColor} />
                    <div className="flex flex-col">
                      <span className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: rankColor }}>
                        {profile ? `${rank.code}-Rank` : 'Operator'}
                      </span>
                      <span className="font-display font-extrabold text-base text-white">Lv. {level || 1}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider" style={{ background: `color-mix(in oklab, ${momentumColor} 14%, transparent)`, color: momentumColor, border: `1px solid color-mix(in oklab, ${momentumColor} 35%, transparent)` }}>
                    {momentumState}
                  </span>
                </div>

                <div className="menu-grid">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex items-center justify-center gap-2 p-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-slate-300 text-sm font-medium"
                  >
                    <RefreshCw size={15} />
                    Sync
                  </button>
                  <button
                    onClick={confirmSignOut}
                    className="flex items-center justify-center gap-2 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-300 text-sm font-medium"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/dashboard" className="logo">
            <span className="logo-text">ChiragOS</span>
            {ACTIVE_SEASON === 'winter'
              ? <span className="season-badge"><Snowflake size={11} /> Winter arc</span>
              : <span className="logo-badge">v3</span>}
          </Link>
        </div>

        <nav className="nav-list">
          {NAV_GROUPS.map(group => (
            <div key={group} className="flex flex-col gap-0.5">
              <span className="nav-group-label">{group}</span>
              {NAV_ITEMS.filter(item => item.group === group).map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}>
                    <div className={`nav-item ${isActive ? 'active' : ''}`}>
                      {isActive && <motion.span layoutId="sidebar-active-pill" className="nav-active-pill" transition={pillSpring} />}
                      <Icon size={18} strokeWidth={isActive ? 2.1 : 1.7} color={isActive ? 'var(--accent-primary)' : 'currentColor'} />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <Shield size={24} color={rankColor} opacity={0.8} />
            <div className="flex-col">
              <span className="font-display text-xs font-bold uppercase tracking-wide" style={{ color: rankColor }}>
                {profile ? `${rank.code}-Rank` : 'Operator'}
              </span>
              <span className="font-display text-sm text-primary font-extrabold">Lv. {level || 1}</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: momentumColor }}>{momentumState}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <button
              onClick={() => setExportModalOpen(true)}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-amber/30 bg-amber/10 text-amber hover:bg-amber/20 transition-colors text-xs font-semibold"
            >
              <Download size={13} />
              Export
            </button>
            <button
              onClick={confirmSignOut}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-white/[0.06] text-muted hover:text-danger hover:bg-danger/10 transition-colors text-xs font-semibold"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" ref={mainRef}>
        <CharacterCapsuleHUD profile={profile} dailyMomentum={dailyMomentum} />
        {/* Opacity-only fade: a transform here would trap position:fixed modals inside pages */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Intel Export & Report Generator Modal */}
      <IntelExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
      <XPToastStack events={feedbackEvents} onDismiss={dismissFeedback} />
      <GameOverlays />
      <WeeklyScorecard />
      <AppServices />
      <LevelUpCelebration level={level} rankTitle={SAGA_TITLES[rank.code] || rank.name} />

      {/* Mobile floating dock */}
      <nav className="mobile-nav" aria-label="Primary">
        {DOCK_ITEMS.map((item) => {
          const isActive = pathname === item.href && !mobileMenuOpen
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className={`mobile-dock-item ${isActive ? 'is-active' : ''}`} aria-current={isActive ? 'page' : undefined}>
              {isActive && <motion.span layoutId="dock-active-pill" className="mobile-dock-pill" transition={pillSpring} />}
              <Icon size={19} strokeWidth={isActive ? 2.3 : 1.8} />
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          className={`mobile-dock-item ${mobileMenuOpen ? 'is-active' : ''}`}
          onClick={() => setMobileMenuOpen(open => !open)}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen && <motion.span layoutId="dock-active-pill" className="mobile-dock-pill" transition={pillSpring} />}
          <motion.span animate={{ rotate: mobileMenuOpen ? 90 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} style={{ display: 'flex' }}>
            {mobileMenuOpen ? <X size={19} strokeWidth={2.3} /> : <Menu size={19} strokeWidth={1.8} />}
          </motion.span>
          <span>{mobileMenuOpen ? 'Close' : 'More'}</span>
        </button>
      </nav>
    </div>
  )
}
