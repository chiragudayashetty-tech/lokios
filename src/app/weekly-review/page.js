'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr, formatDate, getStartOfWeek, getEndOfWeek } from '@/lib/utils/dates'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { CalendarDays, Trophy, CheckSquare, Crosshair, ArrowRight, Save, Target, AlertTriangle } from 'lucide-react'

export default function WeeklyReview() {
  const { user } = useAuth()
  const router = useRouter()
  
  const RenderDebrief = ({ text }) => {
    if (!text) return null
    const sections = text.split('### ').filter(s => s.trim())
    
    return (
      <div className="space-y-6">
        {sections.map((section, idx) => {
          let title = ''
          let content = section.trim()
          const knownTitles = ['What went well?', 'Bottlenecks & Fails', 'Priorities for Next Week']
          
          for (const kt of knownTitles) {
            if (content.startsWith(kt)) {
              title = kt
              content = content.substring(kt.length).trim()
              break
            }
          }
          
          if (!title) {
            const lines = content.split('\n')
            title = lines[0]
            content = lines.slice(1).join('\n').trim()
          }

          let colorClass = 'text-primary'
          let Icon = ArrowRight
          
          if (title.toLowerCase().includes('went well')) {
            colorClass = 'text-success'
            Icon = Target
          } else if (title.toLowerCase().includes('fail') || title.toLowerCase().includes('bottleneck')) {
            colorClass = 'text-danger'
            Icon = AlertTriangle
          } else if (title.toLowerCase().includes('priorit')) {
            colorClass = 'text-info'
            Icon = ArrowRight
          }

          return (
            <div key={idx} className="space-y-3">
              <h4 className={`font-display tracking-widest uppercase flex items-center gap-2 ${colorClass}`}>
                <Icon size={16} /> {title}
              </h4>
              <div className="font-mono text-sm text-secondary whitespace-pre-wrap pl-6 border-l-2 border-border-color ml-2 opacity-90 leading-relaxed">
                {content || 'None recorded.'}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  
  const [loadingStats, setLoadingStats] = useState(true)
  const [stats, setStats] = useState({ xp: 0, tasks: 0, habits: 0 })
  
  const [wins, setWins] = useState('')
  const [fails, setFails] = useState('')
  const [nextGoal1, setNextGoal1] = useState('')
  const [nextGoal2, setNextGoal2] = useState('')
  const [nextGoal3, setNextGoal3] = useState('')
  const [saving, setSaving] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  
  const [showHistory, setShowHistory] = useState(false)
  const [historyLogs, setHistoryLogs] = useState([])
  const [expandedArchive, setExpandedArchive] = useState(null)

  const getWordCount = (str) => {
    if (!str || !str.trim()) return 0
    return str.trim().split(/\s+/).length
  }

  const handleGoalChange = (val, setter) => {
    const words = val.trim().split(/\s+/)
    if (words.length > 20) {
      setter(words.slice(0, 20).join(' '))
    } else {
      setter(val)
    }
  }

  useEffect(() => {
    if (!user) return

    const fetchStats = async () => {
      const supabase = createClient()
      
      const today = new Date()
      
      // Enforce calendar week boundaries (Monday to Sunday)
      const startOfWeek = getStartOfWeek(today)
      const endOfWeek = getEndOfWeek(today)
      
      const startStr = getLocalDateStr(startOfWeek)
      const endStr = getLocalDateStr(endOfWeek)
      
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
        xp: xpLogs.reduce((sum, log) => sum + log.amount, 0),
        tasks: tasksCompleted.length,
        habits: habitLogs.length,
        missions: goalsCompleted.length
      })

      setLoadingStats(false)
    }

    const fetchHistory = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('work_logs').select('*').eq('user_id', user.id).ilike('title', 'Weekly Debrief%').order('created_at', { ascending: false })
      if (data) setHistoryLogs(data)
    }

    fetchStats()
    fetchHistory()
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || saving) return
    const goalsList = [nextGoal1, nextGoal2, nextGoal3].filter(g => g.trim())
    if (!wins.trim() || !fails.trim() || goalsList.length === 0) {
      alert('Please fill out wins, fails, and at least 1 Next Week Priority Goal.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const todayStr = getLocalDateStr()

    const formattedGoals = goalsList.map((g, i) => `${i + 1}. ${g.trim()}`).join('\n')

    const formattedContent = `### What went well?
${wins}

### Bottlenecks & Fails
${fails}

### Priorities for Next Week
${formattedGoals}`

    try {
      const payload = {
        user_id: user.id,
        title: `Weekly Debrief: ${dateRange.start} - ${dateRange.end}`,
        type: 'project_work',
        description: formattedContent,
        date: todayStr,
      }

      const { error: insertError } = await supabase.from('work_logs').insert([payload])
      if (insertError) throw insertError

      // Deploy the priority goals as finishable operations to the tasks table
      const endOfWeekStr = getLocalDateStr(getEndOfWeek(new Date()))
      for (const goalText of goalsList) {
        await supabase.from('tasks').insert([{
          user_id: user.id,
          title: goalText.trim(),
          type: 'custom',
          category: 'weekly_goal',
          due_date: endOfWeekStr,
          status: 'pending',
          description: '[Weekly Goal] Priority for Next Week (from Weekly Debrief)'
        }])
      }

      await robustAwardXP(user.id, 5, 'task', todayStr, `Weekly Review Completed`, 'discipline')
      
      setWins('')
      setFails('')
      setNextGoal1('')
      setNextGoal2('')
      setNextGoal3('')
      setShowHistory(true)
      
      // refresh history
      const { data } = await supabase.from('work_logs').select('*').eq('user_id', user.id).ilike('title', 'Weekly Debrief%').order('created_at', { ascending: false })
      if (data) setHistoryLogs(data)
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
        
        <header className="mb-8 flex-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-4xl text-primary uppercase tracking-widest mb-2 flex items-center gap-3">
              <CalendarDays size={32} className="text-amber" />
              Weekly Debrief
            </h1>
            <p className="font-mono text-muted text-sm uppercase tracking-widest">
              {dateRange.start} — {dateRange.end}
            </p>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            className="btn btn-ghost border border-border-color"
          >
            {showHistory ? 'VIEW THIS WEEK' : 'VIEW ARCHIVES'}
          </button>
        </header>

        {!showHistory ? (
          <>
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-display uppercase tracking-widest text-lg flex items-center gap-2 text-primary">
                  <ArrowRight size={20} /> Priorities for Next Week
                </label>
                <span className="font-mono text-[10px] text-muted uppercase tracking-wider">MAX 20 WORDS PER GOAL</span>
              </div>
              <p className="font-mono text-xs text-muted">Enter up to 3 key goals for next week. These will automatically deploy to your Command Center as finishable operations!</p>
              
              <div className="space-y-3 mt-2">
                {[
                  { id: 1, val: nextGoal1, set: setNextGoal1, placeholder: "Goal #1 (e.g., Ship landing page redesign & test payment link)" },
                  { id: 2, val: nextGoal2, set: setNextGoal2, placeholder: "Goal #2 (e.g., Close 3 client proposals and conduct demo calls)" },
                  { id: 3, val: nextGoal3, set: setNextGoal3, placeholder: "Goal #3 (e.g., Complete 5 workouts and stick to 8h sleep target)" },
                ].map((item) => {
                  const words = getWordCount(item.val)
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-amber font-bold uppercase tracking-widest">PRIORITY GOAL #{item.id}</span>
                        <span className={`font-mono text-[9px] ${words >= 20 ? 'text-danger font-bold' : 'text-muted'}`}>({words}/20 words)</span>
                      </div>
                      <input 
                        type="text"
                        className="input w-full font-mono text-xs py-2 px-3 bg-bg-primary border border-border-color focus:border-amber rounded"
                        placeholder={item.placeholder}
                        value={item.val}
                        onChange={e => handleGoalChange(e.target.value, item.set)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-border-color flex items-center justify-between">
              <div className="font-mono text-xs text-muted">
                Reward: <span className="text-amber">+5 XP</span>
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
        </>
        ) : (
          <div className="space-y-4">
            {historyLogs.length === 0 ? (
              <div className="text-center py-12 text-muted font-mono text-sm">NO ARCHIVES FOUND.</div>
            ) : (
              historyLogs.map(log => (
                <HudPanel key={log.id} className="cursor-pointer hover:border-amber transition-colors" onClick={() => setExpandedArchive(expandedArchive === log.id ? null : log.id)}>
                  <div className="flex-between">
                    <div>
                      <h3 className="font-display text-lg text-primary">{log.title || 'Weekly Debrief'}</h3>
                      <p className="font-mono text-xs text-muted">{formatDate(log.date)}</p>
                    </div>
                    <span className="font-mono text-xs text-amber">{log.amount || 5} XP</span>
                  </div>
                  {expandedArchive === log.id && (
                    <div className="mt-4 pt-5 border-t border-border-color">
                      <RenderDebrief text={log.description} />
                    </div>
                  )}
                </HudPanel>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
