// Auto-generated résumé (#38) from profile + portfolio + missions. Presentational
// only (no hooks), so it renders on the server (public page) and the client (tab).

const fmtMonth = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '')

/**
 * profile: { name, avatar_url, bio, mission_statement, level, total_xp, longest_streak, member_since }
 * items: portfolio items, missions: completed missions, books: [{ title, author }], achievements: number
 */
export default function Resume({ profile, items = [], missions = [], books = [], achievements = 0, skills = [] }) {
  return (
    <article className="resume" aria-label="Résumé">
      <div className="resume-head">
        {profile.avatar_url && <img className="resume-photo" src={profile.avatar_url} alt="" />}
        <div>
          <h1 className="resume-name">{profile.name}</h1>
          {profile.mission_statement && <p className="resume-tagline">{profile.mission_statement}</p>}
          <p className="resume-meta">Level {profile.level} · {Number(profile.total_xp || 0).toLocaleString()} XP · longest streak {profile.longest_streak || 0} days{achievements ? ` · ${achievements} achievements` : ''}</p>
        </div>
      </div>

      {profile.bio && (
        <section className="resume-sec">
          <h2>About</h2>
          <p>{profile.bio}</p>
        </section>
      )}

      {items.length > 0 && (
        <section className="resume-sec">
          <h2>Selected work</h2>
          {items.map((it, i) => (
            <div key={it.id || i} className="resume-item">
              <div className="resume-item-head"><b>{it.title}</b><span>{fmtMonth(it.shipped_on)}</span></div>
              {it.impact && <p className="resume-impact">{it.impact}</p>}
              {it.description && <p>{it.description}</p>}
              {(it.tags || []).length > 0 && <p className="resume-tags">{it.tags.join(' · ')}</p>}
              {(it.links || []).length > 0 && <p className="resume-links">{it.links.map((l) => <a key={l.url} href={l.url}>{l.label || l.url}</a>)}</p>}
            </div>
          ))}
        </section>
      )}

      {missions.length > 0 && (
        <section className="resume-sec">
          <h2>Missions completed</h2>
          <ul className="resume-list">
            {missions.map((m, i) => <li key={i}><b>{m.title}</b>{m.completed_at && <span> · {fmtMonth(m.completed_at)}</span>}</li>)}
          </ul>
        </section>
      )}

      {skills.length > 0 && (
        <section className="resume-sec">
          <h2>Strengths</h2>
          <p>{skills.join(' · ')}</p>
        </section>
      )}

      {books.length > 0 && (
        <section className="resume-sec">
          <h2>Reading</h2>
          <p>{books.slice(0, 12).map((b) => b.title).join(' · ')}</p>
        </section>
      )}
    </article>
  )
}
