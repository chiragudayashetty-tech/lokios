'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Video, RefreshCw, Circle, Square, Check } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import { MAX_MS, isVideo, photoFromFile, clipFromVideo, saveMoment, recorderMime } from '@/lib/moments/moments'

const fmtDay = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

/** Live camera that records at most 5 s, front/back switchable. Calls onClip(File). */
function LiveRecorder({ onClip, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recRef = useRef(null)
  const [facing, setFacing] = useState('environment')
  const [left, setLeft] = useState(null) // ms remaining while recording
  const [err, setErr] = useState(null)

  useEffect(() => {
    let alive = true
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        streamRef.current = s
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}) }
      })
      .catch(() => setErr('Camera blocked. Allow camera access, or use “Camera” / “Library” instead.'))
    return () => { alive = false; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [facing])

  const start = () => {
    const s = streamRef.current
    if (!s) return
    const mime = recorderMime()
    const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
    const chunks = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'video/webm'
      onClip(new File(chunks, `moment.${/mp4/.test(type) ? 'mp4' : 'webm'}`, { type }))
    }
    recRef.current = rec
    rec.start(200)
    const t0 = performance.now()
    const tick = () => {
      if (rec.state !== 'recording') return
      const remaining = MAX_MS - (performance.now() - t0)
      if (remaining <= 0) { setLeft(0); rec.stop(); return }
      setLeft(remaining)
      requestAnimationFrame(tick)
    }
    tick()
  }
  const stop = () => recRef.current?.state === 'recording' && recRef.current.stop()

  if (err) return <div className="mo-live"><p className="mo-err">{err}</p><button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Back</button></div>
  const recording = left != null && left > 0
  return (
    <div className="mo-live">
      <div className="mo-frame">
        <video ref={videoRef} playsInline muted className={facing === 'user' ? 'is-mirror' : ''} />
        {recording && <div className="mo-rec"><span className="mo-dot" />{(left / 1000).toFixed(1)}s</div>}
        {recording && <div className="mo-recbar"><i style={{ width: `${(1 - left / MAX_MS) * 100}%` }} /></div>}
      </div>
      <div className="mo-live-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={recording}>Cancel</button>
        <button type="button" className={`mo-shutter ${recording ? 'is-on' : ''}`} onClick={recording ? stop : start} aria-label={recording ? 'Stop recording' : 'Record up to 5 seconds'}>
          {recording ? <Square size={20} /> : <Circle size={26} />}
        </button>
        <button type="button" className="tl-icon" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} disabled={recording} aria-label="Switch camera"><RefreshCw size={16} /></button>
      </div>
    </div>
  )
}

/**
 * Capture today's (or `date`'s) moment: camera, library or live 5-second recorder.
 * Videos over 5 s get a trimmer to pick which 5 seconds to keep.
 */
export default function CaptureSheet({ open, onClose, userId, date, existing, onSaved }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [duration, setDuration] = useState(null)
  const [startSec, setStartSec] = useState(0)
  const [caption, setCaption] = useState(existing?.caption || '')
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)
  const camRef = useRef(null)
  const libRef = useRef(null)
  const previewRef = useRef(null)

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const reset = () => { setFile(null); setPreview(null); setDuration(null); setStartSec(0); setErr(null); setLive(false); setBusy(null) }
  const close = () => { if (busy) return; reset(); onClose() }

  const take = (f) => {
    if (!f) return
    setErr(null); setLive(false)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setDuration(null); setStartSec(0)
  }

  // Loop the chosen 5-second window in the preview
  useEffect(() => {
    const v = previewRef.current
    if (!v || !file || !isVideo(file)) return
    const onTime = () => { if (duration > 5.25 && v.currentTime > startSec + 5) v.currentTime = startSec }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [file, startSec, duration])

  const save = async () => {
    if (!file) return
    setErr(null)
    try {
      setBusy(isVideo(file) && duration > 5.25 ? 'Trimming to 5 seconds…' : 'Preparing…')
      const m = isVideo(file) ? await clipFromVideo(file, startSec, (p) => setBusy(`Trimming… ${Math.round(p * 100)}%`)) : await photoFromFile(file)
      setBusy('Uploading…')
      const row = await saveMoment(userId, date, m, caption)
      onSaved?.(row)
      reset(); onClose()
    } catch (e) {
      setErr(e?.message || String(e)); setBusy(null)
    }
  }

  const long = duration != null && duration > 5.25
  return (
    <Sheet open={!!open} onClose={close} title={`Moment · ${fmtDay(date)}`}>
      <div className="mo-sheet">
        {live ? (
          <LiveRecorder onClip={take} onCancel={() => setLive(false)} />
        ) : !file ? (
          <>
            <p className="mo-hint">One photo or up to 5 seconds of video. {existing ? 'This replaces the one you already have.' : 'It goes into this month’s film.'}</p>
            <div className="mo-pick">
              <button type="button" onClick={() => camRef.current?.click()}><Camera size={22} /><b>Camera</b><span>photo or video</span></button>
              <button type="button" onClick={() => setLive(true)} disabled={typeof navigator !== 'undefined' && !navigator.mediaDevices}><Video size={22} /><b>Record 5s</b><span>stops by itself</span></button>
              <button type="button" onClick={() => libRef.current?.click()}><ImageIcon size={22} /><b>Library</b><span>pick and trim</span></button>
            </div>
            <input ref={camRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={(e) => take(e.target.files?.[0])} />
            <input ref={libRef} type="file" accept="image/*,video/*" hidden onChange={(e) => take(e.target.files?.[0])} />
          </>
        ) : (
          <>
            <div className="mo-frame">
              {isVideo(file)
                ? <video ref={previewRef} src={preview} playsInline autoPlay loop={!long} muted={false} controls={false} onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); e.currentTarget.currentTime = 0 }} />
                : <img src={preview} alt="Preview" />}
            </div>
            {long && (
              <label className="mo-trim">
                <span>Pick the 5 seconds to keep · {startSec.toFixed(1)}s – {(startSec + 5).toFixed(1)}s of {duration.toFixed(1)}s</span>
                <input type="range" min={0} max={Math.max(0, duration - 5)} step={0.1} value={startSec} onChange={(e) => { const s = +e.target.value; setStartSec(s); if (previewRef.current) previewRef.current.currentTime = s }} />
              </label>
            )}
            <input className="input" maxLength={80} placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
            {err && <p className="mo-err">{err}</p>}
            <div className="mo-actions">
              <button type="button" className="btn btn-ghost" onClick={reset} disabled={!!busy}>Retake</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={!!busy || !userId}><Check size={15} /> {busy || 'Save moment'}</button>
            </div>
          </>
        )}
        {err && !file && <p className="mo-err">{err}</p>}
      </div>
    </Sheet>
  )
}
