'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, History, BookOpen, FileText, Hammer, ClipboardList, FolderKanban, Award } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WorkGallery from '@/components/portfolio/WorkGallery'
import PortfolioTimeline from '@/components/portfolio/PortfolioTimeline'
import BookShelf from '@/components/portfolio/BookShelf'
import Resume from '@/components/portfolio/Resume'
import LegacyPortfolio from '@/components/portfolio/LegacyPortfolio'
import PrintButton from '@/components/profile/PrintButton'
import { useOSSlice } from '@/lib/context/OSContext'
import { useTable } from '@/lib/hooks/useTable'
import { useLocalPref } from '@/lib/hooks/useLocalPref'
import { useAchievements } from '@/lib/hooks/useAchievements'
import { createClient } from '@/lib/supabase/client'
import { fetchAllXpHistory } from '@/lib/utils/xpFallback'
import { calculateLevel } from '@/lib/utils/xp'

const TABS = [
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'timeline', label: 'Timeline', icon: History },
  { id: 'books', label: 'Books', icon: BookOpen },
  { id: 'resume', label: 'Résumé', icon: FileText },
  { id: 'logs', label: 'Work log', icon: Hammer },
  { id: 'reviews', label: 'Weekly reviews', icon: ClipboardList },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
]

export default function PortfolioPage() {
  const { user } = useOSSlice('auth')
  const { profile } = useOSSlice('profile')
  const { goals = [] } = useOSSlice('goals')
  const items = useTable('portfolio_items', user?.id)
  const ach = useAchievements()
  const [tab, setTab] = useLocalPref('lokios_portfolio_tab', 'work', TABS.map((t) => t.id))
  const [extra, setExtra] = useState({ logs: [], books: [], projects: [], xp: [], strengths: [], loaded: false })

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const sb = createClient()
    Promise.all([
      sb.from('work_logs').select('id, title, description, date, created_at').eq('user_id', user.id).order('date', { ascending: false }),
      sb.from('books_completed').select('*').eq('user_id', user.id).order('date_completed', { ascending: false }),
      sb.from('projects').select('*').eq('user_id', user.id),
      fetchAllXpHistory(sb, user.id, 'amount, created_at', true),
      sb.from('user_blueprints').select('strengths').eq('user_id', user.id).limit(1),
    ]).then(([logs, books, projects, xp, bp]) => {
      if (cancelled) return
      setExtra({ logs: logs.data || [], books: books.data || [], projects: projects.data || [], xp: xp || [], strengths: bp.data?.[0]?.strengths || [], loaded: true })
    })
    return () => { cancelled = true }
  }, [user?.id])

  const onBooksChange = useCallback((books) => setExtra((x) => (x.books === books ? x : { ...x, books })), [])
  const missions = useMemo(() => goals.filter((g) => g.status === 'completed').sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || ''))), [goals])
  const activeGoals = goals.filter((g) => !['completed', 'failed', 'cancelled'].includes(g.status))

  // Legacy projects show on the résumé next to the new work items
  const resumeItems = useMemo(() => [
    ...items.rows,
    ...extra.projects.map((p) => ({ id: `proj_${p.id}`, title: p.title, description: p.description || p.tagline, shipped_on: p.created_at?.slice(0, 10), tags: p.tech_stack ? String(p.tech_stack).split(',').map((s) => s.trim()).filter(Boolean) : [], links: [p.live_url && { kind: 'live', label: 'Live', url: p.live_url }, p.github_url && { kind: 'repo', label: 'Repo', url: p.github_url }].filter(Boolean) })),
  ].sort((a, b) => String(b.shipped_on || '').localeCompare(String(a.shipped_on || ''))), [items.rows, extra.projects])

  const name = profile?.full_name || profile?.username || user?.user_metadata?.full_name || 'Operator'

  return (
    <AppShell>
      <div className="page-container pfo-page">
        <header className="tk-head">
          <div>
            <h1 className="page-title flex items-center gap-3"><Award className="text-amber" /> Portfolio</h1>
            <p className="page-subtitle">Proof of work — what you shipped, read and finished.</p>
          </div>
        </header>
        <div className="tl-tabs" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}><Icon size={13} /> {label}</button>
          ))}
        </div>

        {tab === 'work' && <WorkGallery userId={user?.id} items={items.rows} missing={items.missing} goals={activeGoals.concat(missions)} onInsert={items.insert} onUpdate={items.update} onRemove={items.remove} />}
        {tab === 'timeline' && <PortfolioTimeline items={items.rows} logs={extra.logs} missions={missions} books={extra.books} xpRows={extra.xp} />}
        {tab === 'books' && (
          <>
            <BookShelf books={extra.books} />
            <LegacyPortfolio tab="books" onBooksChange={onBooksChange} />
          </>
        )}
        {tab === 'resume' && (
          <div className="resume-tab">
            <div className="resume-toolbar no-print">
              <PrintButton />
              {profile?.is_public && profile?.public_slug && <a className="btn btn-ghost" href={`/p/${profile.public_slug}/resume`} target="_blank" rel="noreferrer">Public link</a>}
            </div>
            <div className="resume-print-root">
              <Resume
                profile={{ name, avatar_url: profile?.avatar_url, bio: profile?.bio, mission_statement: profile?.mission_statement, level: calculateLevel(profile?.total_xp || 0), total_xp: profile?.total_xp, longest_streak: profile?.longest_streak }}
                items={resumeItems}
                missions={missions}
                books={extra.books}
                achievements={ach.list.filter((a) => ach.earned.has(a.id)).length}
                skills={extra.strengths}
              />
            </div>
          </div>
        )}
        {tab === 'logs' && <LegacyPortfolio tab="timeline" />}
        {tab === 'reviews' && <LegacyPortfolio tab="reviews" />}
        {tab === 'projects' && <LegacyPortfolio tab="projects" />}
      </div>
    </AppShell>
  )
}
