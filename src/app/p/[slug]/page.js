import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculateLevel, getRankForXp } from '@/lib/utils/xp'
import { SAGA_TITLES } from '@/lib/constants'
import { statLevels } from '@/lib/utils/profileStats'
import { ACHIEVEMENTS, RARITY } from '@/lib/achievements'
import StatsRadar from '@/components/profile/StatsRadar'
import { LegacyPublicPortfolio, legacyMetadata } from '@/components/profile/LegacyPublicPortfolio'

/** Whitelisted public data via get_public_profile(); { missingFn } before the round-2 migration. */
async function loadPublic(slug) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_public_profile', { p_slug: slug })
  if (error) return { missingFn: true }
  return { data }
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const { data, missingFn } = await loadPublic(slug)
  if (missingFn) return legacyMetadata(slug)
  if (!data) notFound() // before streaming starts, so the response is a real 404
  return { title: `${data.profile.name} · ChiragOS`, description: data.profile.mission_statement || data.profile.bio || undefined }
}

const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

export default async function PublicProfilePage({ params }) {
  const { slug } = await params
  const { data, missingFn } = await loadPublic(slug)
  if (missingFn) return <LegacyPublicPortfolio slug={slug} />
  if (!data) notFound()

  const p = data.profile
  const level = calculateLevel(p.total_xp || 0)
  const rank = getRankForXp(p.total_xp || 0)
  const stats = statLevels(data.stats || {})
  const earned = new Map((data.achievements || []).map((a) => [a.id, a.earned_at]))
  const badges = ACHIEVEMENTS.filter((a) => earned.has(a.id)).sort((a, b) => ['legendary', 'epic', 'rare', 'common'].indexOf(a.rarity) - ['legendary', 'epic', 'rare', 'common'].indexOf(b.rarity))

  return (
    <div className="pub">
      <div className="pub-inner">
        <section className="pf-hero">
          <div className="pf-avatar pub-avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{initials(p.name)}</span>}</div>
          <div className="pf-hero-text">
            <span className="pf-saga">{SAGA_TITLES[rank.code] || rank.name}</span>
            <h1 className="pf-name">{p.name}</h1>
            <div className="pf-chips">
              <span className="pf-chip is-level">Lv. {level}</span>
              <span className="pf-chip">{Number(p.total_xp || 0).toLocaleString()} XP</span>
              <span className="pf-chip">🔥 {p.longest_streak || 0}-day best streak</span>
              {p.member_since && <span className="pf-chip">Since {new Date(p.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>}
            </div>
            <Link href={`/p/${slug}/resume`} className="td-link">View résumé →</Link>
          </div>
        </section>

        {(p.mission_statement || p.bio) && (
          <section className="pf-card">
            {p.mission_statement && <p className="pf-statement">{p.mission_statement}</p>}
            {p.bio && <p className="bp-text">{p.bio}</p>}
          </section>
        )}

        <div className="pf-two">
          <section className="pf-card">
            <div className="pf-card-head">Character stats</div>
            <StatsRadar stats={stats} height={240} />
          </section>
          <section className="pf-card">
            <div className="pf-card-head">Achievements · {badges.length}</div>
            {badges.length ? (
              <div className="pub-badges">
                {badges.slice(0, 12).map((a) => (
                  <span key={a.id} className={`pub-badge ach--${a.rarity}`} style={{ '--rc': RARITY[a.rarity].color }} title={a.description}>{a.name}</span>
                ))}
              </div>
            ) : <p className="ms-muted">No achievements yet.</p>}
          </section>
        </div>

        {(data.portfolio || []).length > 0 && (
          <section className="pf-card">
            <div className="pf-card-head">Work</div>
            <div className="pub-work">
              {data.portfolio.map((w, i) => (
                <article key={i} className="pub-work-item">
                  {w.cover_url && <img src={w.cover_url} alt="" />}
                  <b>{w.title}</b>
                  {w.impact && <span className="pub-impact">{w.impact}</span>}
                  {w.description && <p>{w.description}</p>}
                  {(w.links || []).length > 0 && <span className="pub-links">{w.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.label || 'Link'}</a>)}</span>}
                </article>
              ))}
            </div>
          </section>
        )}

        {(data.missions || []).length > 0 && (
          <section className="pf-card">
            <div className="pf-card-head">Missions completed</div>
            <ul className="bp-list">{data.missions.map((m, i) => <li key={i}>🏁 {m.title}</li>)}</ul>
          </section>
        )}
        <p className="pub-foot">Built with ChiragOS</p>
      </div>
    </div>
  )
}
