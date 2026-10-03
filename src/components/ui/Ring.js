'use client'

/** Circular progress ring (0–1). Children render in the centre. */
export default function Ring({ value = 0, size = 64, stroke = 7, color = 'var(--accent-primary)', track = 'rgba(255,255,255,0.08)', gradient = false, children, label, className = '' }) {
  const v = Math.max(0, Math.min(1, Number(value) || 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const id = gradient ? `ring-grad-${size}-${stroke}` : null
  return (
    <div className={`prog-ring ${className}`} style={{ width: size, height: size }} role="img" aria-label={label || `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {gradient && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={gradient ? `url(#${id})` : color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {children != null && <div className="prog-ring-center">{children}</div>}
    </div>
  )
}
