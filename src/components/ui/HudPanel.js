'use client'

export default function HudPanel({ children, className = '', glow = false, scanLine = false, label = '', style = {} }) {
  return (
    <div className={`hud-panel ${glow ? 'hud-glow' : ''} ${className}`} style={style}>
      {/* Corner brackets */}
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />
      
      {/* Optional scan line */}
      {scanLine && <div className="scan-line" />}
      
      {/* Optional label */}
      {label && (
        <div className="hud-label">{label}</div>
      )}
      
      {children}
    </div>
  )
}
