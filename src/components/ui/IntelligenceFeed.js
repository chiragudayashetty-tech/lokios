'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGoals } from '@/lib/hooks/useGoals'
import { useTasks } from '@/lib/hooks/useTasks'
import { useHabits } from '@/lib/hooks/useHabits'
import { useAuth } from '@/lib/hooks/useAuth'
import HudPanel from './HudPanel'
import { AlertTriangle, Activity, Zap, Cpu, Skull, Crosshair } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DIFFICULTY_LEVELS } from '@/lib/constants'

export default function IntelligenceFeed() {
  const { user } = useAuth()
  const { mainQuest } = useGoals()
  const { tasks, todayTasks } = useTasks()
  const { habits } = useHabits()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function evaluateConsequences() {
      const newAlerts = []
      const supabase = createClient()
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const currentHour = today.getHours()
      const isWeekday = today.getDay() >= 1 && today.getDay() <= 5

      // ── 1. THE LACK OF DIRECTION PENALTY ──
      // Founder must deploy at least 3 operations on weekday mornings.
      if (isWeekday && currentHour >= 8 && currentHour < 12) {
        const deployedToday = tasks.filter(t => t.due_date?.split('T')[0] === todayStr || (t.created_at?.split('T')[0] === todayStr && !t.due_date))
        if (deployedToday.length < 3) {
          newAlerts.push({
            id: 'direction_penalty',
            type: 'critical',
            icon: Skull,
            message: `LACK OF DIRECTION: Only ${deployedToday.length}/3 operations deployed this morning. Immediate action required. (-25 XP PENALTY)`,
            actionable: true
          })
          
          // Apply penalty (only once per day ideally, but we simulate it here visually for immediate feedback)
          // To prevent infinite loop deducting XP every render, we'd normally track `last_evaluated_date`.
        }
      }

      // ── 2. OVERDUE OPERATIONS PENALTY ──
      const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < todayStr)
      
      if (overdueTasks.length > 0) {
        let totalPenalty = 0
        overdueTasks.forEach(task => {
          const diff = DIFFICULTY_LEVELS[task.difficulty] || DIFFICULTY_LEVELS.MEDIUM
          totalPenalty += diff.penalty
        })

        newAlerts.push({
          id: 'overdue_penalty',
          type: 'danger',
          icon: AlertTriangle,
          message: `${overdueTasks.length} OVERDUE OPERATIONS DETECTED. Bleeding ${totalPenalty} XP daily until resolved.`
        })
      }

      // ── 3. MISSED ROUTINES (YESTERDAY) ──
      // Calculate yesterday's date
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // Fetch logs for yesterday
      const { data: yesterdayLogs } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('date', yesterdayStr)

      if (yesterdayLogs) {
        const completedHabitIds = new Set(yesterdayLogs.map(l => l.habit_id))
        const missedHabits = habits.filter(h => {
           // Basic check if habit should have been done yesterday (assuming daily for simplicity)
           if (h.frequency !== 'daily' && !(h.recurrence_days && h.recurrence_days.includes(yesterday.getDay()))) return false
           return !completedHabitIds.has(h.id)
        })

        if (missedHabits.length > 0) {
          newAlerts.push({
            id: 'missed_routines',
            type: 'warning',
            icon: Activity,
            message: `DISCIPLINE BREACH: You missed ${missedHabits.length} routines yesterday. Active Battles have gained strength.`
          })
        }
      }

      // ── 4. LONG TERM GOAL DEADLINE WARNING ──
      if (mainQuest && mainQuest.deadline) {
        const deadline = new Date(mainQuest.deadline)
        const daysLeft = Math.ceil((deadline - today) / (1000 * 3600 * 24))
        
        if (daysLeft <= 14 && daysLeft > 0) {
          newAlerts.push({
            id: 'deadline_warning',
            type: 'warning',
            icon: Crosshair,
            message: `MISSION DEADLINE APPROACHING: "${mainQuest.title}" is due in ${daysLeft} days. Accelerate execution.`
          })
        } else if (daysLeft < 0 && mainQuest.status !== 'completed') {
          newAlerts.push({
            id: 'deadline_failed',
            type: 'critical',
            icon: Skull,
            message: `MISSION FAILED: Deadline passed for "${mainQuest.title}". Massive XP loss imminent.`
          })
        }
      }
      
      setAlerts(newAlerts)
      setLoading(false)
    }

    evaluateConsequences()
  }, [user, mainQuest, tasks, habits])

  if (loading) return null

  if (alerts.length === 0) {
    return (
      <HudPanel glow className="mb-6">
        <div className="flex items-center gap-3 text-success">
          <Cpu size={16} />
          <span className="font-mono text-sm uppercase tracking-widest">CONSEQUENCE ENGINE: ALL SYSTEMS NOMINAL. NO PENALTIES ACTIVE.</span>
        </div>
      </HudPanel>
    )
  }

  return (
    <div className="flex-col gap-3 mb-6">
      <AnimatePresence>
        {alerts.map((alert, i) => {
          const Icon = alert.icon
          let colorClass, bgClass, borderColor;
          
          if (alert.type === 'critical') {
            colorClass = 'text-white'
            bgClass = 'bg-danger'
            borderColor = 'border-danger-strong'
          } else if (alert.type === 'danger') {
            colorClass = 'text-danger'
            bgClass = 'bg-danger-subtle'
            borderColor = 'border-danger'
          } else if (alert.type === 'warning') {
            colorClass = 'text-amber'
            bgClass = 'bg-amber-subtle'
            borderColor = 'border-amber'
          } else {
            colorClass = 'text-info'
            bgClass = 'bg-info-subtle'
            borderColor = 'border-info'
          }
          
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={`p-4 border ${borderColor} ${bgClass} flex items-start gap-4 relative overflow-hidden group`}>
                <div className={`absolute top-0 left-0 w-1 h-full ${alert.type === 'critical' ? 'bg-white' : borderColor.replace('border-', 'bg-')}`} />
                <Icon className={`mt-0.5 shrink-0 ${colorClass}`} size={18} />
                <div className="flex-col">
                  <span className={`font-display text-sm tracking-widest uppercase ${colorClass}`}>
                    {alert.type === 'critical' ? 'CRITICAL ALERT' : 'A.I. ANALYSIS'}
                  </span>
                  <span className={`font-mono text-xs ${colorClass} mt-1`}>{alert.message}</span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
