import { ACTIVE_SEASON } from '@/lib/theme/levelTheme'

/** Six-armed frost crystal, drawn so each arm has little side branches. */
function FrostCrystal() {
  const arms = [0, 60, 120, 180, 240, 300]
  return (
    <svg className="winter-crystal" viewBox="0 0 64 64" width="44" height="44" aria-hidden="true">
      <defs>
        <linearGradient id="winterCrystalGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="var(--accent-primary)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <g stroke="url(#winterCrystalGrad)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        {arms.map(deg => (
          <g key={deg} transform={`rotate(${deg} 32 32)`}>
            <path d="M32 32V8" />
            <path d="M32 16l-6-6M32 16l6-6" />
            <path d="M32 24l-4-4M32 24l4-4" />
          </g>
        ))}
      </g>
      <circle cx="32" cy="32" r="3.2" fill="#fff" />
    </svg>
  )
}

/**
 * Seasonal loading state.
 * - default: inline, centred in the page area (used while a page fetches data)
 * - fullscreen: boot screen with the wordmark (route + auth loading)
 * - compact: small, for loading inside a card
 */
export default function WinterLoader({ label = 'Loading', fullscreen = false, compact = false }) {
  const winter = ACTIVE_SEASON === 'winter'

  return (
    <div className={`winter-loader ${fullscreen ? 'winter-loader--full' : ''} ${compact ? 'winter-loader--compact' : ''}`} role="status" aria-live="polite">
      {fullscreen && (
        <div className="winter-loader-brand">
          <span className="logo-text">ChiragOS</span>
          {winter && <span className="season-badge">Winter arc</span>}
        </div>
      )}

      <div className="winter-loader-orb">
        <span className="winter-loader-ring" />
        <span className="winter-loader-glow" />
        {winter ? <FrostCrystal /> : <span className="winter-loader-gem" />}
      </div>

      <div className="winter-loader-label">
        {label}
        <span className="winter-loader-dots"><i>.</i><i>.</i><i>.</i></span>
      </div>

      {winter && <div className="winter-loader-tagline">Winter is coming</div>}

      {fullscreen && <div className="winter-loader-bar"><span /></div>}
    </div>
  )
}
