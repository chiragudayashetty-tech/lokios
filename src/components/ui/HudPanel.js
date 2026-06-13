'use client'

export default function HudPanel({ children, className = '', glow = false, scanLine = false, label = '', style = {} }) {
  return (
    <div className={`hud-panel ${glow ? 'hud-glow' : ''} ${className}`} style={style}>
      {/* Optional label */}
      {label && (
        <div className="font-mono text-xs text-muted tracking-widest uppercase mb-4 border-b border-border-color pb-2 flex items-center justify-between">
          <span>{label}</span>
        </div>
      )}
      
      {children}
    </div>
  )
}
