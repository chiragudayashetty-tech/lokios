// Render moments into one video file in the browser (canvas + MediaRecorder).
import { PHOTO_MS, recorderMime, loadVideo } from '@/lib/moments/moments'

const FW = 720
const FH = 1280
const TITLE_MS = 1600

const fmtDay = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

function cover(ctx, src, sw, sh, zoom = 1) {
  const k = Math.max(FW / sw, FH / sh) * zoom
  const w = sw * k
  const h = sh * k
  ctx.drawImage(src, (FW - w) / 2, (FH - h) / 2, w, h)
}

function overlay(ctx, row, i, n) {
  const g = ctx.createLinearGradient(0, FH - 320, 0, FH)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)')
  ctx.fillStyle = g; ctx.fillRect(0, FH - 320, FW, 320)
  ctx.fillStyle = '#fff'; ctx.font = '700 44px Inter, system-ui, sans-serif'; ctx.textBaseline = 'alphabetic'
  ctx.fillText(fmtDay(row.date), 48, FH - 120)
  if (row.caption) {
    ctx.font = '400 30px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.fillText(row.caption.length > 42 ? `${row.caption.slice(0, 41)}…` : row.caption, 48, FH - 70)
  }
  // story-style progress segments
  const gap = 6
  const segW = (FW - 96 - gap * (n - 1)) / n
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = k <= i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'
    ctx.fillRect(48 + k * (segW + gap), 40, Math.max(2, segW), 5)
  }
}

function titleCard(ctx, title, sub) {
  ctx.fillStyle = '#0b0b14'; ctx.fillRect(0, 0, FW, FH)
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
  ctx.font = '800 64px Inter, system-ui, sans-serif'; ctx.fillText(title, FW / 2, FH / 2 - 10)
  ctx.font = '400 32px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(sub, FW / 2, FH / 2 + 50)
  ctx.textAlign = 'left'
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src })

/** Plays every moment into a canvas recording. Resolves to { blob, ext }. */
export async function exportFilm(rows, { title, sub, onProgress } = {}) {
  const mime = recorderMime()
  if (mime == null) throw new Error('This browser cannot record video. Try Chrome or Safari 15+.')
  const canvas = Object.assign(document.createElement('canvas'), { width: FW, height: FH })
  const ctx = canvas.getContext('2d')
  const stream = canvas.captureStream(30)
  let audioCtx = null
  let dest = null
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    dest = audioCtx.createMediaStreamDestination()
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
  } catch {}
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined)
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise((r) => { rec.onstop = r })

  const total = TITLE_MS + rows.reduce((s, r) => s + (r.kind === 'video' ? r.duration_ms || 3000 : PHOTO_MS), 0)
  let elapsed = 0
  const tick = (ms) => { elapsed += ms; onProgress?.(Math.min(1, elapsed / total)) }

  rec.start(250)
  titleCard(ctx, title || 'Moments', sub || `${rows.length} days`)
  await wait(TITLE_MS); tick(TITLE_MS)

  for (const [i, row] of rows.entries()) {
    if (!row.url) continue
    if (row.kind === 'photo') {
      const img = await loadImage(row.url).catch(() => null)
      if (!img) continue
      const t0 = performance.now()
      await new Promise((resolve) => {
        const draw = () => {
          const p = (performance.now() - t0) / PHOTO_MS
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FW, FH)
          cover(ctx, img, img.width, img.height, 1 + 0.06 * Math.min(1, p)) // slow Ken Burns zoom
          overlay(ctx, row, i, rows.length)
          if (p >= 1) return resolve()
          requestAnimationFrame(draw)
        }
        draw()
      })
      tick(PHOTO_MS)
    } else {
      const v = await loadVideo(row.url).catch(() => null)
      if (!v) continue
      let src = null
      if (audioCtx && dest) { try { src = audioCtx.createMediaElementSource(v); src.connect(dest); v.muted = false } catch { v.muted = true } }
      await v.play().catch(() => {})
      const limit = Math.min(5000, row.duration_ms || 5000)
      const t0 = performance.now()
      await new Promise((resolve) => {
        const draw = () => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FW, FH)
          if (v.videoWidth) cover(ctx, v, v.videoWidth, v.videoHeight)
          overlay(ctx, row, i, rows.length)
          if (v.ended || performance.now() - t0 >= limit) return resolve()
          requestAnimationFrame(draw)
        }
        draw()
      })
      v.pause(); src?.disconnect()
      tick(limit)
    }
  }
  titleCard(ctx, title || 'Moments', 'Made with ChiragOS')
  await wait(900)
  rec.stop()
  await stopped
  audioCtx?.close?.()
  const type = rec.mimeType || mime || 'video/webm'
  return { blob: new Blob(chunks, { type }), ext: /mp4/.test(type) ? 'mp4' : 'webm' }
}
