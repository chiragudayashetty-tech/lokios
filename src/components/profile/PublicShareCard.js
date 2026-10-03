'use client'

import { useState } from 'react'
import { Globe, ExternalLink, FileText, Copy, Check } from 'lucide-react'
import SchemaHint from '@/components/ui/SchemaHint'
import { createClient } from '@/lib/supabase/client'

export const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/** Public profile toggle + link (#43). Used on Profile and Settings → Privacy. */
export default function PublicShareCard({ profile, userId, fallbackName, onSaved }) {
  const [slug, setSlug] = useState(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState(null)
  if (!profile) return null
  if (!('is_public' in profile)) return <section className="pf-card pf-share"><div className="pf-card-head"><Globe size={15} /> Public profile</div><SchemaHint feature="Public profiles" /></section>

  const slugValue = slug ?? profile.public_slug ?? slugify(profile.username || fallbackName)
  const publicUrl = typeof window !== 'undefined' && profile.public_slug ? `${window.location.origin}/p/${profile.public_slug}` : null
  const update = async (patch) => {
    const { error } = await createClient().from('profiles').update(patch).eq('id', userId)
    if (error) {
      setNotice({ ok: false, msg: /duplicate|unique/i.test(error.message) ? 'That link is taken — try another.' : error.message })
      return false
    }
    setNotice(null)
    await onSaved?.()
    return true
  }

  return (
    <section className="pf-card pf-share">
      <div className="pf-card-head"><Globe size={15} /> Public profile</div>
      <div className="pf-share-row">
        <div className="settings-row-text">
          <span className="settings-label">Share a read-only profile</span>
          <span className="settings-hint">Shows your name, photo, bio, stats, achievements, portfolio and completed missions. Never budget, journal or tasks.</span>
        </div>
        <button type="button" className={`settings-toggle ${profile.is_public ? 'is-on' : ''}`} aria-pressed={!!profile.is_public} aria-label="Public profile" onClick={() => update({ is_public: !profile.is_public, public_slug: profile.public_slug || slugify(slugValue) || null })}><span /></button>
      </div>
      <div className="pf-slug">
        <span className="pf-slug-prefix">/p/</span>
        <input className="input" value={slugValue} onChange={(e) => setSlug(slugify(e.target.value))} aria-label="Public link" />
        <button type="button" className="btn btn-secondary btn-sm" disabled={!slugValue || slugValue === profile.public_slug} onClick={async () => { if (await update({ public_slug: slugValue })) { setSlug(null); setNotice({ ok: true, msg: 'Link saved.' }) } }}>Save link</button>
      </div>
      {notice && <p className={`cal-notice ${notice.ok ? 'is-ok' : 'is-bad'}`}>{notice.msg}</p>}
      {profile.is_public && publicUrl && (
        <div className="pf-share-links">
          <a href={publicUrl} target="_blank" rel="noreferrer" className="td-link"><ExternalLink size={13} /> Open public profile</a>
          <a href={`${publicUrl}/resume`} target="_blank" rel="noreferrer" className="td-link"><FileText size={13} /> Public résumé</a>
          <button type="button" className="td-link" onClick={() => { navigator.clipboard?.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}</button>
        </div>
      )}
    </section>
  )
}
