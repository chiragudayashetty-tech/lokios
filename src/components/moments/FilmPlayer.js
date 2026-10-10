'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { PHOTO_MS } from '@/lib/moments/moments'

const fmtDay = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/** Story-style player: tap right/left to skip, space or the button to pause. */
export default function FilmPlayer({ rows, startIndex = 0, title, onClose }) {
  const [i, setI] = useState(startIndex)
  const [p, setP] = useState(0) // progress of the current item, 0..1
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const videoRef = useRef(null)
  const row = rows[i]

  const next = () => (i + 1 < rows.length ? (setI(i + 1), setP(0)) : onClose())
  const prev = () => { setI(Math.max(0, i - 1)); setP(0) }

  // Photos: timer. Videos: follow the element's own clock (max 5 s).
  useEffect(() => {
    if (!row || paused) return
    if (row.kind === 'video') {
      const v = videoRef.current
      if (!v) return
      v.play().catch(() => { setMuted(true); v.muted = true; v.play().catch(() => {}) })
      let raf
      const loop = () => {
        const d = Math.min(5, v.duration || (row.duration_ms || 5000) / 1000)
        const q = d ? v.currentTime / d : 0
        setP(Math.min(1, q))
        if (v.ended || q >= 1) return next()
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => { cancelAnimationFrame(raf); v.pause() }
    }
    const t0 = performance.now() - p * PHOTO_MS
    let raf
    const loop = () => {
      const q = (performance.now() - t0) / PHOTO_MS
      setP(Math.min(1, q))
      if (q >= 1) return next()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [i, paused, row]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === ' ') { e.preventDefault(); setPaused((x) => !x) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (!row || typeof document === 'undefined') return null
  return createPortal(
    <div className="mo-player" role="dialog" aria-label={title || 'Moments film'}>
      <div className="mo-segs">{rows.map((r, k) => <span key={r.date}><i style={{ width: `${k < i ? 100 : k === i ? p * 100 : 0}%` }} /></span>)}</div>
      <div className="mo-ptop">
        <span><b>{fmtDay(row.date)}</b>{title ? ` · ${title}` : ''}</span>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Sound on' : 'Mute'}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        <button type="button" onClick={() => setPaused((x) => !x)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
        <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      <div className="mo-media">
        {row.kind === 'video'
          ? <video key={row.date} ref={videoRef} src={row.url} playsInline muted={muted} />
          : <img key={row.date} src={row.url} alt={row.caption || fmtDay(row.date)} className="mo-kenburns" style={{ animationPlayState: paused ? 'paused' : 'running' }} />}
      </div>
      <button type="button" className="mo-tap is-left" onClick={prev} aria-label="Previous day" />
      <button type="button" className="mo-tap is-right" onClick={next} aria-label="Next day" />
      {row.caption && <p className="mo-caption">{row.caption}</p>}
    </div>,
    document.body,
  )
}
