import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRankDisplay } from '@/lib/utils/ranks'

export async function generateMetadata({ params }) {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('portfolio_summary').select('*').eq('public_portfolio_slug', params.slug).single()
  
  if (!profile) return { title: 'Not Found' }
  
  return {
    title: `${profile.full_name || profile.username}'s Portfolio`,
    description: profile.portfolio_headline,
  }
}

export default async function PublicPortfolio({ params }) {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('portfolio_summary').select('*').eq('public_portfolio_slug', params.slug).single()
  
  if (!profile) {
    notFound()
  }

  // Fetch public portfolio data
  const [workRes, projectsRes, skillsRes] = await Promise.all([
    supabase.from('work_logs').select('*').eq('user_id', profile.id).eq('is_public', true).order('date', { ascending: false }),
    supabase.from('projects').select('*').eq('user_id', profile.id).eq('is_public', true).order('created_at', { ascending: false }),
    supabase.from('skills').select('*').eq('user_id', profile.id).eq('is_public', true).order('level', { ascending: false })
  ])

  const workLogs = workRes.data || []
  const projects = projectsRes.data || []
  const skills = skillsRes.data || []
  const rank = getRankDisplay(profile.current_rank || 'E')

  return (
    <div className="portfolio-public" style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', paddingBottom: 'var(--space-20)' }}>
      {/* Hero */}
      <header style={{ padding: 'var(--space-12) var(--space-6)', textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: `linear-gradient(to bottom, ${rank.color}10, transparent)` }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--bg-tertiary)', margin: '0 auto var(--space-6)', overflow: 'hidden' }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '48px', lineHeight: '120px' }}>👤</span>}
          </div>
          <h1 style={{ fontSize: 'var(--text-4xl-size)', marginBottom: 'var(--space-2)' }}>{profile.full_name || profile.username}</h1>
          <p style={{ fontSize: 'var(--text-xl-size)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>{profile.portfolio_headline}</p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: rank.color, color: '#fff', fontSize: 'var(--text-sm-size)', padding: 'var(--space-2) var(--space-4)' }}>{rank.icon} {rank.name} • Lvl {profile.current_level}</span>
          </div>
        </div>
      </header>

      <main className="page-container narrow" style={{ marginTop: 'var(--space-10)' }}>
        {/* About */}
        {profile.portfolio_about && (
          <section style={{ marginBottom: 'var(--space-12)' }}>
            <h2 style={{ fontSize: 'var(--text-2xl-size)', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>About</h2>
            <p style={{ fontSize: 'var(--text-lg-size)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{profile.portfolio_about}</p>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section style={{ marginBottom: 'var(--space-12)' }}>
            <h2 style={{ fontSize: 'var(--text-2xl-size)', marginBottom: 'var(--space-6)', color: 'var(--text-primary)' }}>Skills</h2>
            <div className="grid-auto">
              {skills.map(skill => (
                <div key={skill.id} className="card card-flat" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div style={{ fontSize: '24px' }}>{skill.icon || '🎯'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{skill.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{skill.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <section style={{ marginBottom: 'var(--space-12)' }}>
            <h2 style={{ fontSize: 'var(--text-2xl-size)', marginBottom: 'var(--space-6)', color: 'var(--text-primary)' }}>Projects</h2>
            <div className="grid-2">
              {projects.map(proj => (
                <div key={proj.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: 'var(--text-xl-size)', marginBottom: 'var(--space-2)' }}>{proj.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', flex: 1 }}>{proj.description || proj.tagline}</p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    {proj.live_url && <a href={proj.live_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">Visit Site</a>}
                    {proj.github_url && <a href={proj.github_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">GitHub</a>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Timeline */}
        {workLogs.length > 0 && (
          <section>
            <h2 style={{ fontSize: 'var(--text-2xl-size)', marginBottom: 'var(--space-6)', color: 'var(--text-primary)' }}>Timeline</h2>
            <div style={{ borderLeft: '2px solid var(--border-color)', marginLeft: 'var(--space-4)', paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              {workLogs.map(log => (
                <div key={log.id} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', width: '14px', height: '14px', borderRadius: '50%', background: 'var(--accent-primary)', left: 'calc(-var(--space-6) - 9px)', top: '6px' }}></div>
                  <div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>{new Date(log.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
                  <h3 style={{ fontSize: 'var(--text-lg-size)', marginBottom: 'var(--space-2)' }}>{log.title}</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>{log.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
