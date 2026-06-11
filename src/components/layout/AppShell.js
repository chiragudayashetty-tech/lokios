'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProfile } from '@/lib/hooks/useProfile'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Home, Crosshair, Target, CheckSquare, Lightbulb, 
  BookOpen, Briefcase, CalendarDays, Monitor, User, 
  Menu, X, Shield 
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Command Center' },
  { href: '/quests', icon: Crosshair, label: 'Daily Ops' },
  { href: '/goals', icon: Target, label: 'Missions' },
  { href: '/tasks', icon: CheckSquare, label: 'Operations' },
  { href: '/brain-dump', icon: Lightbulb, label: 'Intel Drop' },
  { href: '/journal', icon: BookOpen, label: 'Field Log' },
  { href: '/portfolio-log', icon: Briefcase, label: 'Proof of Work' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/screen-time', icon: Monitor, label: 'Screen Intel' },
  { href: '/profile', icon: User, label: 'Operator Profile' }
]

export default function AppShell({ children }) {
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (authLoading || profileLoading) {
    return (
      <div className="flex-center" style={{ height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <div className="typewriter-text font-mono text-amber">INITIALIZING SYSTEMS...</div>
      </div>
    )
  }

  if (!user) return null

  const mainItems = NAV_ITEMS.slice(0, 4)
  const moreItems = NAV_ITEMS.slice(4)

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar hidden-mobile">
        <div className="sidebar-header">
          <Shield size={24} color="var(--accent-primary)" />
          <span className="sidebar-brand">CHIRAGOS</span>
        </div>
        
        <div className="nav-section-title">SYSTEMS</div>
        
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
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
          <Shield size={24} color="var(--accent-primary)" opacity={0.5} />
          <div className="flex-col">
            <span className="font-display uppercase text-xs tracking-wide">{profile?.rank || 'OPERATOR'}</span>
            <span className="font-mono text-sm text-amber">LV.{profile?.level || 1}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav hidden-desktop">
        {mainItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{ flex: 1 }}>
              <div className="flex-col flex-center p-4" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                <Icon size={20} strokeWidth={1.5} />
                <span className="text-xs mt-1 font-display uppercase tracking-wide" style={{ fontSize: '10px' }}>{item.label}</span>
              </div>
            </Link>
          )
        })}
        <button style={{ flex: 1 }} className="flex-col flex-center p-4 text-muted" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={20} strokeWidth={1.5} />
          <span className="text-xs mt-1 font-display uppercase tracking-wide" style={{ fontSize: '10px' }}>More</span>
        </button>
      </nav>

      {/* Mobile More Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            className="fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: 'var(--bg-primary)' }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            <div className="flex-between p-4 border-b border-subtle">
              <span className="sidebar-brand">SYSTEMS</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-amber">
                <X size={24} />
              </button>
            </div>
            <div className="flex-col p-4 gap-2 overflow-y-auto">
              {moreItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                    <div className={`nav-item ${isActive ? 'active' : ''}`} style={{ padding: '1rem' }}>
                      <Icon size={20} strokeWidth={1.5} color={isActive ? 'var(--accent-primary)' : 'currentColor'} />
                      <span className="font-display text-lg uppercase tracking-wide">{item.label}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
