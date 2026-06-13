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
  Menu, X, Shield, Trophy
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Command Center' },
  { href: '/quests', icon: Crosshair, label: 'Daily Ops' },
  { href: '/goals', icon: Target, label: 'Missions' },
  { href: '/tasks', icon: CheckSquare, label: 'Operations' },
  { href: '/brain-dump', icon: Lightbulb, label: 'Intel Drop' },
  { href: '/portfolio-log', icon: Briefcase, label: 'Proof of Work' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/screen-time', icon: Monitor, label: 'Screen Intel' },
  { href: '/xp', icon: Trophy, label: 'XP Metrics' },
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

  const mainItems = [
    NAV_ITEMS[0], // Command Center
    NAV_ITEMS[1], // Daily Ops
    NAV_ITEMS[3], // Operations
    NAV_ITEMS[9], // Operator Profile
  ]


  return (
    <div className="app-shell">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 hidden-desktop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        {mobileMenuOpen && (
          <button 
            className="absolute top-4 right-4 text-muted hover:text-danger hidden-desktop"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        )}
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
      <nav className="mobile-nav">
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

    </div>
  )
}
