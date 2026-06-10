'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProfile } from '@/lib/hooks/useProfile'

const NAV_ITEMS = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/quests', icon: '⚔️', label: 'Daily Quests' },
  { href: '/goals', icon: '🎯', label: 'Goals' },
  { href: '/tasks', icon: '✅', label: 'Tasks' },
  { href: '/brain-dump', icon: '💡', label: 'Brain Dump' },
  { href: '/journal', icon: '📖', label: 'Journal' },
  { href: '/portfolio-log', icon: '💼', label: 'Portfolio' },
  { href: '/calendar', icon: '📅', label: 'Calendar' },
  { href: '/screen-time', icon: '📱', label: 'Screen Time' },
  { href: '/profile', icon: '👤', label: 'Profile' },
]

export default function AppShell({ children }) {
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (authLoading || profileLoading) {
    return <div className="app-shell flex-center" style={{ height: '100vh' }}>Loading ChiragOS...</div>
  }

  if (!user) return null

  // For mobile bottom nav, we only show first 4 and a "More" button
  const mobileNavItems = NAV_ITEMS.slice(0, 4)

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} hidden-mobile`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">♛</div>
          <div className="sidebar-title">ChiragOS</div>
        </div>
        
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main Menu</div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button 
            className="sidebar-toggle btn-ghost btn-full"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? '▶' : '◀ Collapse'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav hidden-desktop">
        <div className="mobile-nav-items">
          {mobileNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-item ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="mobile-nav-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <button 
            className={`mobile-nav-item ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="mobile-nav-item-icon">☰</span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="modal-overlay hidden-desktop" 
          onClick={() => setMobileMenuOpen(false)}
          style={{ bottom: 'var(--mobile-nav-height)', zIndex: 'var(--z-modal)', top: 0, position: 'fixed' }}
        >
          <div 
            className="card" 
            style={{ position: 'absolute', bottom: 'var(--space-4)', left: 'var(--space-4)', right: 'var(--space-4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-col gap-2">
              {NAV_ITEMS.slice(4).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="nav-item-icon">{item.icon}</span>
                  <span className="nav-item-label">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
