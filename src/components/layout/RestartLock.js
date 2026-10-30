'use client'

import Link from 'next/link'
import { Lock, CheckSquare, Target, Wallet, RotateCcw } from 'lucide-react'
import { daysToRestart, RESTART_DATE } from '@/lib/utils/restart'

const OPEN = [
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/goals', label: 'Missions', icon: Target },
  { href: '/budget', label: 'Budget', icon: Wallet },
]

/** Shown instead of a locked page until the restart date. */
export default function RestartLock() {
  const days = daysToRestart()
  const when = new Date(`${RESTART_DATE}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div className="page-container rs-lock">
      <div className="rs-card">
        <span className="rs-icon"><RotateCcw size={26} /></span>
        <h1>Restarting {when}</h1>
        <p className="rs-count">{days <= 1 ? 'Tomorrow.' : `${days} days to go.`}</p>
        <p>The last stretch didn&apos;t go to plan. That&apos;s done. Loki OS restarts clean on {when} — habits, focus, journal and the rest unlock then.</p>
        <p className="rs-sub">Until then: clear your tasks, shape your missions, and keep your spending logged. No penalties, nothing to catch up on.</p>
        <div className="rs-links">
          {OPEN.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="btn btn-secondary"><Icon size={16} /> {label}</Link>)}
        </div>
        <p className="rs-locked"><Lock size={12} /> Everything else is locked until the restart.</p>
      </div>
    </div>
  )
}
