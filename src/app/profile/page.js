'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProfile } from '@/lib/hooks/useProfile'
import { useUserConfig } from '@/lib/hooks/useUserConfig'
import { getRankDisplay, getAllRanks } from '@/lib/utils/ranks'
import { xpToNextLevel } from '@/lib/utils/xp'
import { motion } from 'framer-motion'
import { User as UserIcon, Shield, Trophy, Settings, LogOut, Database } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function Profile() {
  const { user, signOut } = useAuth()
  const { profile, loading: pLoading } = useProfile()
  const { config, loading: cLoading } = useUserConfig()
  const [isSeeding, setIsSeeding] = useState(false)

  const handleSeed = async () => {
    if (!user) return
    setIsSeeding(true)
    const supabase = createClient()
    
    const notificationPrefs = {
      who_i_want_to_become: "A highly disciplined founder operating at peak performance.",
      class: "Founder",
      current_arc: "Discipline Rebuild",
      current_mission: "Launch Beyond Tatva",
      twelve_month_goal: "20 paid students, ₹30,000/month income, Complete Beyond Tatva course, Improve communication skills, Build portfolio, Reduce phone addiction",
      battles: [
        { name: "Phone Addiction", metric: "Hours/Day", current: 13, target: 6 },
        { name: "Communication", metric: "Confidence", current: 20, target: 100 },
        { name: "Fitness", metric: "Workouts/Week", current: 2, target: 5 },
        { name: "Personal Care", metric: "Consistency", current: 40, target: 100 }
      ],
      skills_to_master: ["AI", "Marketing", "Sales", "Content Creation", "Video Editing", "Automation", "Business"],
      vision: "To build a suite of successful products and operate as an elite founder.",
      purpose: "To push boundaries and create massive value."
    }

    await supabase.from('profiles').update({ full_name: "Chirag Shetty", notification_prefs: notificationPrefs }).eq('id', user.id)
    await supabase.from('habits').delete().eq('user_id', user.id)
    
    const routines = [
      { user_id: user.id, title: "Wakeup Before 7am", category: "personal", frequency: "daily", stat_category: "discipline", xp_per_completion: 25, icon: "Target" },
      { user_id: user.id, title: "No Snoozing", category: "personal", frequency: "daily", stat_category: "discipline", xp_per_completion: 25, icon: "Flame" },
      { user_id: user.id, title: "Drink 3L Water", category: "health", frequency: "daily", stat_category: "discipline", xp_per_completion: 30, icon: "Target" },
      { user_id: user.id, title: "Workout", category: "health", frequency: "daily", stat_category: "strength", xp_per_completion: 25, icon: "Dumbbell" },
      { user_id: user.id, title: "Morning Working", category: "business", frequency: "daily", stat_category: "founder", xp_per_completion: 25, icon: "Rocket" },
      { user_id: user.id, title: "Read Books", category: "learning", frequency: "daily", stat_category: "learning", xp_per_completion: 25, icon: "BookOpen" },
      { user_id: user.id, title: "Meditation", category: "personal", frequency: "daily", stat_category: "discipline", xp_per_completion: 25, icon: "Target" },
      { user_id: user.id, title: "Skill Learning atleast 1hr", category: "learning", frequency: "daily", stat_category: "learning", xp_per_completion: 21, icon: "Sparkles" },
      { user_id: user.id, title: "Daily Journal", category: "personal", frequency: "daily", stat_category: "creation", xp_per_completion: 30, icon: "BookOpen" },
      { user_id: user.id, title: "Limit Social Media", category: "personal", frequency: "daily", stat_category: "discipline", xp_per_completion: 30, icon: "Shield" },
      { user_id: user.id, title: "No Alcohol", category: "health", frequency: "daily", stat_category: "discipline", xp_per_completion: 25, icon: "Shield" },
      { user_id: user.id, title: "Track Expenses", category: "business", frequency: "daily", stat_category: "founder", xp_per_completion: 30, icon: "Target" },
      { user_id: user.id, title: "Sleep By 12", category: "health", frequency: "daily", stat_category: "discipline", xp_per_completion: 25, icon: "Target" },
      { user_id: user.id, title: "Startup work", category: "business", frequency: "daily", stat_category: "founder", xp_per_completion: 25, icon: "Rocket" }
    ]
    await supabase.from('habits').insert(routines)
    
    setIsSeeding(false)
    window.location.reload()
  }
  
  if (pLoading || cLoading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">ACCESSING PROFILE DATA...</span></div></AppShell>

  const rankInfo = getRankDisplay(profile?.rank)
  const xpProgress = profile ? xpToNextLevel(profile.total_xp) : { percentage: 0, current: 0, required: 50 }

  return (
    <AppShell>
      <div className="page-container narrow">
        <header className="page-header">
          <h1 className="page-title">OPERATOR PROFILE</h1>
          <p className="page-subtitle font-mono uppercase text-xs">Identity, credentials, and system access.</p>
        </header>

        <HudPanel glow scanLine className="mb-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-sm bg-tertiary border-2 border-amber flex-center overflow-hidden shrink-0 relative">
              <UserIcon size={48} className="text-amber opacity-50" />
              <div className="absolute inset-0 border border-amber opacity-20 m-1" />
            </div>
            <div className="flex-col flex-1">
              <h2 className="font-display text-3xl uppercase tracking-wider text-primary glow-amber">{profile?.full_name || 'COMMANDER'}</h2>
              <span className="font-mono text-sm text-secondary">@{profile?.username || 'user'}</span>
              
              <div className="flex items-center gap-4 mt-4 border-t border-border-color pt-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} color={rankInfo.color} />
                  <span className="font-display tracking-widest text-sm" style={{ color: rankInfo.color }}>{rankInfo.name.toUpperCase()}</span>
                </div>
                <div className="w-px h-4 bg-border-color" />
                <div className="font-mono text-amber text-sm">LV. {profile?.level || 1}</div>
                <div className="w-px h-4 bg-border-color" />
                <div className="font-mono text-muted text-xs">{profile?.total_xp || 0} TOTAL XP</div>
              </div>
            </div>
          </div>
        </HudPanel>

        <div className="grid-2">
          <div className="flex-col gap-6">
            <HudPanel label="CREDENTIALS">
              <div className="flex-col gap-4 font-mono text-sm">
                <div className="flex-between border-b border-border-color pb-2">
                  <span className="text-muted">OPERATOR ID</span>
                  <span className="text-primary truncate ml-4">{user?.id}</span>
                </div>
                <div className="flex-between border-b border-border-color pb-2">
                  <span className="text-muted">LINKED EMAIL</span>
                  <span className="text-primary truncate ml-4">{user?.email}</span>
                </div>
                <div className="flex-between border-b border-border-color pb-2">
                  <span className="text-muted">CLASS</span>
                  <span className="text-amber">{config?.class || 'UNASSIGNED'}</span>
                </div>
                <div className="flex-between pb-2">
                  <span className="text-muted">ACCOUNT CREATED</span>
                  <span className="text-primary">{new Date(user?.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </HudPanel>

            <HudPanel label="RANKS PROTOCOL">
              <div className="flex-col gap-2 font-mono text-xs">
                {getAllRanks().map(r => (
                  <div key={r.code} className={`flex-between p-2 border ${r.code === profile?.rank ? 'border-amber bg-amber-subtle text-amber' : 'border-transparent text-muted'}`}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: r.color }}>{r.icon}</span>
                      <span>{r.name.toUpperCase()}</span>
                    </div>
                    <span>{r.minXp.toLocaleString()}+ XP</span>
                  </div>
                ))}
              </div>
            </HudPanel>
          </div>

          <div className="flex-col gap-6">
            <HudPanel label="PORTFOLIO SETTINGS">
              <div className="flex-col gap-4 font-mono text-sm">
                <div className="flex-col gap-1">
                  <span className="text-muted text-xs">PUBLIC URL</span>
                  <div className="p-3 bg-tertiary border border-border-color text-primary truncate">
                    {window.location.origin}/p/{profile?.public_portfolio_slug || profile?.username}
                  </div>
                </div>
                <div className="flex-between p-3 bg-tertiary border border-border-color">
                  <span className="text-muted">VISIBILITY</span>
                  <span className={profile?.portfolio_visible ? 'text-success' : 'text-danger'}>
                    {profile?.portfolio_visible ? 'PUBLIC (ONLINE)' : 'PRIVATE (OFFLINE)'}
                  </span>
                </div>
              </div>
            </HudPanel>

            <HudPanel label="SYSTEM ACTION">
              <div className="flex-col gap-4">
                <button onClick={handleSeed} disabled={isSeeding} className="btn btn-secondary w-full flex-center py-4 tracking-widest gap-2">
                  <Database size={16} /> {isSeeding ? 'SEEDING...' : 'INITIALIZE BLUEPRINT'}
                </button>
                <button onClick={signOut} className="btn btn-danger w-full flex-center py-4 tracking-widest gap-2">
                  <LogOut size={16} /> END SESSION
                </button>
              </div>
            </HudPanel>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
