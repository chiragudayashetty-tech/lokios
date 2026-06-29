'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr, formatDate } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { CalendarDays, Trophy, CheckSquare, Crosshair, ArrowRight, Save, Target, AlertTriangle } from 'lucide-react'

export default function WeeklyReview() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [loadingStats, setLoadingStats] = useState(true)
  const [stats, setStats] = useState({ xp: 0, tasks: 0, habits: 0 })
  
  const [wins, setWins] = useState('')
  const [fails, setFails] = useState('')
  const [nextActions, setNextActions] = useState('')
  const [saving, setSaving] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    if (!user) return

    const fetchStats = async () => {
      const supabase = createClient()
      
      const today = new Date()
      const endStr = getLocalDateStr(today)
      
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // Last 7 days including today
      const startStr = getLocalDateStr(sevenDaysAgo)
      
      setDateRange({ start: formatDate(startStr, 'MMM DD'), end: formatDate(endStr, 'MMM DD') })

      const [xpRes, habitRes, taskRes, goalRes] = await Promise.all([
        supabase.from('xp_history').select('amount, source_type').eq('user_id', user.id).gte('created_at', startStr).lte('created_at', endStr + 'T23:59:59.999Z'),
        supabase.from('habit_logs').select('status').eq('user_id', user.id).gte('date', startStr).lte('date', endStr).eq('status', 'completed'),
        supabase.from('tasks').select('id').eq('user_id', user.id).gte('completed_at', startStr).lte('completed_at', endStr + 'T23:59:59.999Z').eq('status', 'completed'),
        supabase.from('goals').select('id').eq('user_id', user.id).gte('completed_at', startStr).lte('completed_at', endStr + 'T23:59:59.999Z').eq('status', 'completed')
      ])

      const xpLogs = xpRes.data || []
      const habitLogs = habitRes.data || []
      const tasksCompleted = taskRes.data || []
      const goalsCompleted = goalRes.data || []

      setStats({
        xp: xpLogs.reduce((sum, log) => sum + (log.amount > 0 ? log.amount : 0), 0),
        tasks: tasksCompleted.length,
        habits: habitLogs.length,
        missions: goalsCompleted.length
      })

      setLoadingStats(false)
    }

    fetchStats()
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || saving) return
    if (!wins.trim() || !fails.trim() || !nextActions.trim()) {
      alert('Please fill out all fields to complete your review.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const todayStr = getLocalDateStr()

    // Format the description as structured text so it renders nicely in Proof of Work
    const formattedContent = `### What went well?
${wins}

### Bottlenecks & Fails
${fails}

### Priorities for Next Week
${nextActions}`

    try {
      const payload = {
        user_id: user.id,
        title: `Weekly Debrief: ${dateRange.start} - ${dateRange.end}`,
        type: 'weekly_review',
        description: formattedContent,
        date: todayStr,
      }

      await supabase.from('work_logs').insert([payload])
      await robustAwardXP(user.id, 40, 'weekly_review', todayStr, `Weekly Review Completed`, 'discipline')
      
      router.push('/portfolio-log?tab=reviews')
    } catch (error) {
      console.error('Failed to save review:', error)
      alert('Failed to save review. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        
        <header className="mb-8">
          <h1 className="font-display text-4xl text-primary uppercase tracking-widest mb-2 flex items-center gap-3">
            <CalendarDays size={32} className="text-amber" />
            Weekly Debrief
          </h1>
          <p className="font-mono text-muted text-sm uppercase tracking-widest">
            {dateRange.start} — {dateRange.end}
          </p>
        </header>

        {/* STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HudPanel>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber/10 rounded-lg text-amber">
                <Trophy size={24} />
              </div>
              <div className="flex-col">
                <span className="font-mono text-xs text-muted uppercase tracking-widest">XP Earned</span>
                <span className="font-display text-2xl text-primary">
                  {loadingStats ? '...' : `+${stats.xp}`}
                </span>
              </div>
            </div>
          </HudPanel>
          <HudPanel>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg text-success">
                <Target size={24} />
              </div>
              <div className="flex-col">
                <span className="font-mono text-xs text-muted uppercase tracking-widest">Missions Done</span>
                <span className="font-display text-2xl text-primary">
                  {loadingStats ? '...' : stats.missions}
                </span>
              </div>
            </div>
          </HudPanel>
          <HudPanel>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg text-primary">
                <CheckSquare size={24} />
              </div>
              <div className="flex-col">
                <span className="font-mono text-xs text-muted uppercase tracking-widest">Ops Completed</span>
                <span className="font-display text-2xl text-primary">
                  {loadingStats ? '...' : stats.tasks}
                </span>
              </div>
            </div>
          </HudPanel>
          <HudPanel>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-lg text-secondary">
                <Crosshair size={24} />
              </div>
              <div className="flex-col">
                <span className="font-mono text-xs text-muted uppercase tracking-widest">Habit Actions</span>
                <span className="font-display text-2xl text-primary">
                  {loadingStats ? '...' : stats.habits}
                </span>
              </div>
            </div>
          </HudPanel>
        </div>

        {/* REVIEW FORM */}
        <HudPanel label="A.A.R. (AFTER ACTION REPORT)">
          <form onSubmit={handleSubmit} className="space-y-8 mt-4">
            
            <div className="space-y-3">
              <label className="font-display uppercase tracking-widest text-lg flex items-center gap-2 text-success">
                <Target size={20} /> What went well?
              </label>
              <p className="font-mono text-xs text-muted">Identify your wins, big or small. What progress was made?</p>
              <textarea 
                className="input w-full min-h-[120px] resize-y"
                placeholder="I successfully..."
                value={wins}
                onChange={e => setWins(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="font-display uppercase tracking-widest text-lg flex items-center gap-2 text-danger">
                <AlertTriangle size={20} /> Bottlenecks & Fails
              </label>
              <p className="font-mono text-xs text-muted">Where did you fall short? What distractions or obstacles slowed you down?</p>
              <textarea 
                className="input w-full min-h-[120px] resize-y"
                placeholder="I struggled with..."
                value={fails}
                onChange={e => setFails(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="font-display uppercase tracking-widest text-lg flex items-center gap-2 text-primary">
                <ArrowRight size={20} /> Priorities for Next Week
              </label>
              <p className="font-mono text-xs text-muted">List the top 1-3 things that MUST get done next week to move the needle.</p>
              <textarea 
                className="input w-full min-h-[120px] resize-y"
                placeholder="1.&#10;2.&#10;3."
                value={nextActions}
                onChange={e => setNextActions(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t border-border-color flex items-center justify-between">
              <div className="font-mono text-xs text-muted">
                Reward: <span className="text-amber">+40 XP</span>
              </div>
              <button 
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-lg flex items-center gap-2 tracking-widest"
              >
                {saving ? (
                  'SAVING DEBRIEF...'
                ) : (
                  <>
                    <Save size={18} />
                    COMPLETE REVIEW
                  </>
                )}
              </button>
            </div>

          </form>
        </HudPanel>

      </div>
    </AppShell>
  )
}
