'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, Film, ChevronRight } from 'lucide-react'
import CaptureSheet from '@/components/moments/CaptureSheet'
import { listMoments } from '@/lib/moments/moments'

/** Today: one tap to capture the day's photo / ≤5 s video, or a peek at it once taken. */
export default function TodayMoment({ userId, today }) {
  const [row, setRow] = useState(undefined)
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    if (!userId) return
    const { rows } = await listMoments(userId, today, today)
    setRow(rows[0] || null)
  }, [userId, today])
  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect

  if (row === undefined) return null
  return (
    <section className="mo-tcard">
      {row ? (
        <Link href="/moments" className="mo-tcard-in">
          {row.thumb ? <img src={row.thumb} alt="" /> : <span className="mo-tcard-ph"><Film size={16} /></span>}
          <span className="mo-tcard-text"><b>Today&apos;s moment</b><small>{row.caption || (row.kind === 'video' ? `${Math.round((row.duration_ms || 0) / 1000)}s video` : 'Photo')} · captured</small></span>
          <ChevronRight size={16} />
        </Link>
      ) : (
        <button type="button" className="mo-tcard-in" onClick={() => setOpen(true)}>
          <span className="mo-tcard-ph is-cta"><Camera size={16} /></span>
          <span className="mo-tcard-text"><b>Capture today&apos;s moment</b><small>One photo or 5 seconds of video</small></span>
          <ChevronRight size={16} />
        </button>
      )}
      {open && <CaptureSheet open userId={userId} date={today} onClose={() => setOpen(false)} onSaved={(r) => { setOpen(false); load() }} />}
    </section>
  )
}
