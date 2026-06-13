'use client'

export default function HudPanel({ children, className = '', glow = false, scanLine = false, label = '', style = {} }) {
  return (
    <div className={`hud-panel ${glow ? 'hud-glow' : ''} ${className}`} style={style}>
      {/* Optional label */}
      {label && (
        <div className="hud-label font-mono text-[10px] text-muted tracking-widest uppercase absolute top-4 right-4">{label}</div>
      )}
      
      {children}
    </div>
  )
}
