// Moments: one photo or ≤5 s video per day. Private bucket, signed URLs.
import { createClient } from '@/lib/supabase/client'

export const MAX_MS = 5000
export const PHOTO_MS = 2000 // how long a photo holds in the film
const BUCKET = 'moments'
const MAX_SIDE = 1280

export const isVideo = (file) => /^video\//.test(file?.type || '') || /\.(mp4|mov|webm|m4v)$/i.test(file?.name || '')

/** Best recording container this browser can write (Safari: mp4, Chrome/Firefox: webm). */
export function recorderMime() {
  if (typeof MediaRecorder === 'undefined') return null
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
}
const extFor = (mime) => (/mp4/.test(mime) ? 'mp4' : /quicktime/.test(mime) ? 'mov' : 'webm')

function canvasBlob(canvas, type = 'image/jpeg', q = 0.85) {
  return new Promise((res) => canvas.toBlob(res, type, q))
}
function fit(w, h, max = MAX_SIDE) {
  const k = Math.min(1, max / Math.max(w, h))
  return [Math.round(w * k), Math.round(h * k)]
}

export async function photoFromFile(file) {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file))
  const [w, h] = fit(img.width, img.height)
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
  c.getContext('2d').drawImage(img, 0, 0, w, h)
  const [tw, th] = fit(w, h, 360)
  const t = Object.assign(document.createElement('canvas'), { width: tw, height: th })
  t.getContext('2d').drawImage(c, 0, 0, tw, th)
  return { kind: 'photo', blob: await canvasBlob(c), thumb: await canvasBlob(t, 'image/jpeg', 0.75), durationMs: null, mime: 'image/jpeg' }
}

/** Load a video file's metadata (duration, size) without playing it. */
export function loadVideo(src) {
  return new Promise((res, rej) => {
    const v = document.createElement('video')
    v.preload = 'auto'; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'
    v.onloadedmetadata = () => res(v)
    v.onerror = () => rej(new Error('This video could not be read on this device.'))
    v.src = src
  })
}

async function frameAt(v, t) {
  await new Promise((r) => { v.onseeked = r; v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05)) })
  const [w, h] = fit(v.videoWidth, v.videoHeight, 360)
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
  c.getContext('2d').drawImage(v, 0, 0, w, h)
  return canvasBlob(c, 'image/jpeg', 0.75)
}

/**
 * A ≤5 s clip from a video file. Short clips upload as they are; longer ones are
 * re-recorded from `startSec` for 5 s (with sound where the browser allows).
 */
export async function clipFromVideo(file, startSec = 0, onProgress) {
  const url = URL.createObjectURL(file)
  try {
    const v = await loadVideo(url)
    const dur = v.duration
    if (Number.isFinite(dur) && dur <= MAX_MS / 1000 + 0.25) {
      return { kind: 'video', blob: file, thumb: await frameAt(v, Math.min(0.3, dur / 2)), durationMs: Math.round(Math.min(dur, 5) * 1000), mime: file.type || 'video/mp4' }
    }
    const mime = recorderMime()
    if (mime == null) throw new Error('This browser cannot trim video. Pick a clip of 5 seconds or less.')
    const thumb = await frameAt(v, startSec + 0.2)
    const [w, h] = fit(v.videoWidth, v.videoHeight, 1080)
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
    const ctx = c.getContext('2d')
    const stream = c.captureStream(30)
    // Sound: route the element through WebAudio into the recording
    let audioCtx = null
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const src = audioCtx.createMediaElementSource(v)
      const dest = audioCtx.createMediaStreamDestination()
      src.connect(dest)
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
      v.muted = false
    } catch { v.muted = true }
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 3_500_000 } : undefined)
    const chunks = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise((r) => { rec.onstop = r })
    await new Promise((r) => { v.onseeked = r; v.currentTime = startSec })
    await v.play()
    rec.start(250)
    const t0 = performance.now()
    await new Promise((resolve) => {
      const draw = () => {
        ctx.drawImage(v, 0, 0, w, h)
        const el = performance.now() - t0
        onProgress?.(Math.min(1, el / MAX_MS))
        if (el >= MAX_MS || v.ended) return resolve()
        requestAnimationFrame(draw)
      }
      draw()
    })
    rec.stop(); v.pause()
    await done
    audioCtx?.close?.()
    const type = rec.mimeType || mime || 'video/webm'
    return { kind: 'video', blob: new Blob(chunks, { type }), thumb, durationMs: MAX_MS, mime: type }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Upload a prepared moment and upsert the day's row. Replaces (and removes) any earlier one. */
export async function saveMoment(userId, date, m, caption = '') {
  const sb = createClient()
  const stamp = Date.now()
  const path = `${userId}/${date}-${stamp}.${m.kind === 'photo' ? 'jpg' : extFor(m.mime)}`
  const thumbPath = `${userId}/${date}-${stamp}-thumb.jpg`
  const up = await sb.storage.from(BUCKET).upload(path, m.blob, { contentType: m.kind === 'photo' ? 'image/jpeg' : (m.mime || 'video/mp4').split(';')[0], upsert: true })
  if (up.error) throw new Error(up.error.message.includes('not found') ? 'Moments storage is not set up yet — run the moments SQL migration.' : up.error.message)
  if (m.thumb) await sb.storage.from(BUCKET).upload(thumbPath, m.thumb, { contentType: 'image/jpeg', upsert: true })
  const { data: old } = await sb.from('daily_moments').select('path, thumb_path').eq('user_id', userId).eq('date', date).maybeSingle()
  const row = { user_id: userId, date, kind: m.kind, path, thumb_path: m.thumb ? thumbPath : null, duration_ms: m.durationMs, caption: caption.trim() || null }
  const { data, error } = await sb.from('daily_moments').upsert(row, { onConflict: 'user_id,date' }).select().single()
  if (error) throw new Error(error.message)
  if (old) await sb.storage.from(BUCKET).remove([old.path, old.thumb_path].filter(Boolean))
  return data
}

export async function updateCaption(userId, date, caption) {
  await createClient().from('daily_moments').update({ caption: caption.trim() || null }).eq('user_id', userId).eq('date', date)
}

export async function deleteMoment(userId, row) {
  const sb = createClient()
  await sb.from('daily_moments').delete().eq('user_id', userId).eq('date', row.date)
  await sb.storage.from(BUCKET).remove([row.path, row.thumb_path].filter(Boolean))
}

/** Rows in [from, to] with signed URLs (1 h) for media and thumbnails. */
export async function listMoments(userId, from, to) {
  const sb = createClient()
  const { data, error } = await sb.from('daily_moments').select('*').eq('user_id', userId).gte('date', from).lte('date', to).order('date')
  if (error) return { rows: [], error: error.message }
  const rows = data || []
  const paths = [...new Set(rows.flatMap((r) => [r.path, r.thumb_path]).filter(Boolean))]
  const urls = new Map()
  if (paths.length) {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600)
    for (const s of signed || []) if (s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  return { rows: rows.map((r) => ({ ...r, url: urls.get(r.path) || null, thumb: urls.get(r.thumb_path) || (r.kind === 'photo' ? urls.get(r.path) : null) })) }
}
