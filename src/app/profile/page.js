'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, Snowflake, CalendarDays, Zap, Flame, Sparkles, Swords, Check, Pencil, Target, Quote, User as UserIcon } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import SchemaHint from '@/components/ui/SchemaHint'
import Ring from '@/components/ui/Ring'
import StatsRadar from '@/components/profile/StatsRadar'
import TrophyCase from '@/components/profile/TrophyCase'
import BlueprintCards from '@/components/profile/BlueprintCards'
import PublicShareCard from '@/components/profile/PublicShareCard'
import { useOSSlice } from '@/lib/context/OSContext'
import { useGameState } from '@/lib/hooks/useGameState'
import { useAchievements } from '@/lib/hooks/useAchievements'
import { createClient } from '@/lib/supabase/client'
import { fetchAllXpHistory } from '@/lib/utils/xpFallback'
import { calculateLevel, getRankForXp, xpToNextLevel } from '@/lib/utils/xp'
import { SAGA_TITLES } from '@/lib/constants'
import { statLevels } from '@/lib/utils/profileStats'
import { isActiveGoal, progressOf, typeLabel } from '@/lib/utils/missions'
import { useMilestones } from '@/lib/hooks/useMilestones'

/** Downscale an image to a square JPEG (≤ 512px) before upload. */
async function toAvatarBlob(file) {
  const img = await createImageBitmap(file)
  const side = Math.min(img.width, img.height)
  const size = Math.min(512, side)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
}

const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

function EditableText({ label, icon: Icon, value, placeholder, onSave, rows = 3, disabled }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [saving, setSaving] = useState(false)
  return (
    <section className="pf-card">
      <div className="pf-card-head"><Icon size={15} /> {label}{!editing && !disabled && <button type="button" className="tl-icon pf-edit" onClick={() => { setDraft(value || ''); setEditing(true) }} aria-label={`Edit ${label}`}><Pencil size={13} /></button>}</div>
      {editing ? (
        <>
          <textarea className="textarea" rows={rows} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} autoFocus aria-label={label} />
          <div className="bp-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={async () => { setSaving(true); const ok = await onSave(draft.trim() || null); setSaving(false); if (ok) setEditing(false) }}><Check size={14} /> Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      ) : value ? <p className={label === 'Mission statement' ? 'pf-statement' : 'bp-text'}>{value}</p> : <p className="ms-muted">{placeholder}</p>}
    </section>
  )
}

export default function ProfilePage() {
  const { user } = useOSSlice('auth')
  const { profile, fetchProfile } = useOSSlice('profile')
  const { goals = [] } = useOSSlice('goals')
  const { tasks = [] } = useOSSlice('tasks')
  const milestones = useMilestones()
  const game = useGameState()
  const ach = useAchievements()
  const [statRows, setStatRows] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetchAllXpHistory(createClient(), user.id, 'amount, stat_category', true).then((rows) => { if (!cancelled) setStatRows(rows) })
    return () => { cancelled = true }
  }, [user?.id])

  if (!profile) return <AppShell><WinterLoader label="Loading profile" /></AppShell>

  const extras = 'is_public' in profile
  const xp = profile.total_xp || 0
  const level = calculateLevel(xp)
  const rank = getRankForXp(xp)
  const next = xpToNextLevel(xp)
  const name = profile.full_name || profile.username || user?.user_metadata?.full_name || 'Operator'
  const memberSince = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null
  const stats = statRows ? statLevels(statRows) : null
  const main = goals.filter((g) => isActiveGoal(g)).sort((a, b) => (a.type === 'main_quest' ? -1 : 0) - (b.type === 'main_quest' ? -1 : 0))[0]

  const update = async (patch) => {
    const { error } = await createClient().from('profiles').update(patch).eq('id', user.id)
    if (error) {
      setNotice({ ok: false, msg: /duplicate|unique/i.test(error.message) ? 'That link is taken — try another.' : error.message })
      return false
    }
    await fetchProfile?.()
    return true
  }

  const upload = async (file) => {
    if (!file) return
    setUploading(true)
    setNotice(null)
    try {
      const blob = await toAvatarBlob(file)
      const path = `${user.id}/avatar-${Date.now()}.jpg`
      const sb = createClient()
      const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      const { data } = sb.storage.from('avatars').getPublicUrl(path)
      if (await update({ avatar_url: data.publicUrl })) setNotice({ ok: true, msg: 'Photo updated.' })
    } catch (e) {
      setNotice({ ok: false, msg: /bucket|not found/i.test(e?.message || '') ? 'The avatars storage bucket is missing — run the round-2 migration.' : `Upload failed: ${e?.message || e}` })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const records = [
    { icon: Zap, label: 'Total XP', value: xp.toLocaleString() },
    { icon: Flame, label: 'Longest streak', value: `${Math.max(game.model?.longest || 0, profile.longest_streak || 0)}d` },
    { icon: Sparkles, label: 'Perfect days', value: ach.stats?.perfectDays ?? '—' },
    { icon: Swords, label: 'Bosses defeated', value: ach.stats?.bosses ?? '—' },
  ]

  return (
    <AppShell>
      <div className="page-container pf-page">
        <section className="pf-hero">
          <div className="pf-avatar-wrap">
            <button type="button" className="pf-avatar" onClick={() => extras && fileRef.current?.click()} disabled={uploading || !extras} aria-label="Change profile photo">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initialsOf(name)}</span>}
              {extras && <i className="pf-avatar-cam"><Camera size={15} /></i>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
            {uploading && <span className="pf-uploading">Uploading…</span>}
          </div>
          <div className="pf-hero-text">
            <span className="pf-saga">{SAGA_TITLES[rank.code] || rank.name}</span>
            <h1 className="pf-name">{name}</h1>
            <div className="pf-chips">
              <span className="pf-chip is-level">Lv. {level}</span>
              <span className="pf-chip" style={{ color: rank.color }}>{rank.icon} {rank.name}</span>
              {game.season?.title && <span className="pf-chip"><Snowflake size={12} /> {game.season.title}</span>}
              {memberSince && <span className="pf-chip"><CalendarDays size={12} /> Since {memberSince}</span>}
            </div>
            <div className="pf-level-bar" aria-label={`${Math.round(next.percentage)}% to level ${level + 1}`}><span style={{ width: `${next.percentage}%` }} /></div>
            <span className="pf-level-sub">{next.current.toLocaleString()} / {next.required.toLocaleString()} XP to Lv. {level + 1}</span>
          </div>
        </section>
        {notice && <p className={`cal-notice ${notice.ok ? 'is-ok' : 'is-bad'}`}>{notice.msg}</p>}
        {!extras && <SchemaHint feature="Photo, bio, mission statement and public profile" />}

        <div className="pf-records">
          {records.map((r) => { const Icon = r.icon; return <div key={r.label} className="record-tile"><span className="record-label"><Icon size={11} /> {r.label}</span><span className="record-value">{r.value}</span></div> })}
        </div>

        <div className="pf-two">
          <section className="pf-card">
            <div className="pf-card-head"><Sparkles size={15} /> Character stats</div>
            {stats ? <StatsRadar stats={stats} /> : <div className="arena-skeleton pf-skel" />}
          </section>
          <div className="pf-col">
            <EditableText label="Mission statement" icon={Quote} value={profile.mission_statement} placeholder="One sentence you'd stand behind for the next ten years." onSave={(v) => update({ mission_statement: v })} rows={2} disabled={!extras} />
            <EditableText label="About me" icon={UserIcon} value={profile.bio} placeholder="Who you are and what you're building." onSave={(v) => update({ bio: v })} disabled={!extras} />
            {main && (
              <Link href={`/goals/${main.id}`} className="pf-card pf-mission">
                <div className="pf-card-head"><Target size={15} /> Current {typeLabel(main).toLowerCase()} mission</div>
                <div className="pf-mission-row">
                  <Ring value={progressOf(main, milestones.list, tasks) / 100} size={54} stroke={6} gradient><b className="ms-ring-num">{progressOf(main, milestones.list, tasks)}%</b></Ring>
                  <span className="pf-mission-title">{main.title}</span>
                </div>
              </Link>
            )}
          </div>
        </div>

        <TrophyCase />

        <PublicShareCard profile={profile} userId={user?.id} fallbackName={name} onSaved={fetchProfile} />

        <h2 className="pf-section-title">Blueprint</h2>
        <BlueprintCards userId={user?.id} />
      </div>
    </AppShell>
  )
}
