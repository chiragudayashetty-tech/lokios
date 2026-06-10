'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProfile } from '@/lib/hooks/useProfile'
import { getRankDisplay } from '@/lib/utils/ranks'
import { createClient } from '@/lib/supabase/client'

export default function Profile() {
  const { signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [achievements, setAchievements] = useState([])
  const [userAchievements, setUserAchievements] = useState([])

  useEffect(() => {
    if (profile) setFormData(profile)
  }, [profile])

  useEffect(() => {
    if (!profile?.id) return
    const fetchAchievements = async () => {
      const supabase = createClient()
      const [allAchRes, userAchRes] = await Promise.all([
        supabase.from('achievements').select('*').order('xp_reward', { ascending: true }),
        supabase.from('user_achievements').select('achievement_id, earned_at').eq('user_id', profile.id)
      ])
      if (allAchRes.data) setAchievements(allAchRes.data)
      if (userAchRes.data) setUserAchievements(userAchRes.data.map(a => a.achievement_id))
    }
    fetchAchievements()
  }, [profile])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    await updateProfile(formData)
    setSaving(false)
  }

  if (!profile) return null

  const rank = getRankDisplay(profile.current_rank || 'E')

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">Profile Settings</h1>
        </header>

        {/* Profile Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-6)', background: `linear-gradient(to right, var(--bg-secondary), ${rank.color}15)` }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
          </div>
          <div>
            <h2 style={{ fontSize: 'var(--text-2xl-size)' }}>{profile.full_name || profile.username || 'Commander'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: '4px' }}>
              <span className="badge" style={{ background: rank.color, color: '#fff' }}>{rank.icon} {rank.name}</span>
              <span style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>Level {profile.current_level} • {profile.total_xp} XP</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Personal Info */}
          <section className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Personal Information</h3>
            <div className="grid-2">
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Username</label>
                <input type="text" className="input" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Full Name</label>
                <input type="text" className="input" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Bio</label>
              <textarea className="textarea" value={formData.bio || ''} onChange={e => setFormData({...formData, bio: e.target.value})} />
            </div>
          </section>

          {/* Portfolio Settings */}
          <section className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Public Portfolio Settings</h3>
            <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <input type="checkbox" checked={formData.portfolio_visible || false} onChange={e => setFormData({...formData, portfolio_visible: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }} />
              <label>Make portfolio public</label>
            </div>
            
            {formData.portfolio_visible && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Portfolio Slug</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>chiragos.com/p/</span>
                    <input type="text" className="input" value={formData.public_portfolio_slug || ''} onChange={e => setFormData({...formData, public_portfolio_slug: e.target.value})} placeholder="your-name" />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Headline</label>
                  <input type="text" className="input" value={formData.portfolio_headline || ''} onChange={e => setFormData({...formData, portfolio_headline: e.target.value})} placeholder="e.g. Developer & Designer" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>About</label>
                  <textarea className="textarea" value={formData.portfolio_about || ''} onChange={e => setFormData({...formData, portfolio_about: e.target.value})} />
                </div>
              </div>
            )}
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {/* Achievements */}
        <section style={{ marginTop: 'var(--space-10)' }}>
          <h2 style={{ fontSize: 'var(--text-2xl-size)', marginBottom: 'var(--space-6)' }}>Achievements</h2>
          <div className="grid-auto">
            {achievements.map(ach => {
              const earned = userAchievements.includes(ach.id)
              return (
                <div key={ach.id} className="card card-flat" style={{ opacity: earned ? 1 : 0.4, filter: earned ? 'none' : 'grayscale(100%)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <div style={{ fontSize: '32px' }}>{ach.icon || '🏆'}</div>
                  <div>
                    <h4 style={{ fontWeight: 600 }}>{ach.name}</h4>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{ach.description}</p>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-secondary)', marginTop: '4px' }}>+{ach.xp_reward} XP</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div style={{ marginTop: 'var(--space-12)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-6)', textAlign: 'center' }}>
          <button onClick={signOut} className="btn btn-danger btn-sm">Sign Out</button>
        </div>
      </div>
    </AppShell>
  )
}
