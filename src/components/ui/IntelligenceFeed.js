'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGoals } from '@/lib/hooks/useGoals'
import { useTasks } from '@/lib/hooks/useTasks'
import { useHabits } from '@/lib/hooks/useHabits'
import { useAuth } from '@/lib/hooks/useAuth'
import { useXP } from '@/lib/hooks/useXP'
import { XP_RULES } from '@/lib/xpRules'
import HudPanel from './HudPanel'
import { AlertTriangle, Activity, Zap, Cpu, Skull, Crosshair } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getLocalDateStr } from '@/lib/utils/dates'
import { DIFFICULTY_LEVELS } from '@/lib/constants'

export default function IntelligenceFeed() {
  const { user } = useAuth()
  const { mainQuest } = useGoals()
  const { tasks, todayTasks } = useTasks()
  const { habits } = useHabits()
  const { awardXP } = useXP()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const evaluatedTodayRef = useRef(false)

  useEffect(() => {
    if (!user) return
    if (evaluatedTodayRef.current) return
    evaluatedTodayRef.current = true

    async function evaluateConsequences() {
      const today = new Date()
      const todayStr = getLocalDateStr(today)
      const cacheKey = `consequences_${user.id}_${todayStr}`
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        setAlerts(JSON.parse(cached))
        setLoading(false)
        return
      }

      const newAlerts = []
      const supabase = createClient()
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
            iconName: 'Skull',
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

      // ── 3. MISSED ROUTINES & BATTLE DAMAGE ──
      // Calculate yesterday's date
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = getLocalDateStr(yesterday)

      // Fetch logs for yesterday
      const { data: yesterdayLogs } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('date', yesterdayStr)

      // Fetch blueprint to evaluate battles
      const { data: blueprint } = await supabase
        .from('user_blueprints')
        .select('id, battles, last_evaluated_date')
        .eq('user_id', user.id)
        .single()

      if (yesterdayLogs && blueprint && blueprint.battles) {
        const completedHabitIds = new Set(yesterdayLogs.map(l => l.habit_id))
        let totalMissed = 0
        let battleUpdatesNeeded = false
        
        const updatedBattles = blueprint.battles.map(battle => {
          if (!battle.linked_habits || battle.linked_habits.length === 0) return battle
          
          let hpChange = 0
          let habitsMissed = 0
          let habitsHit = 0

          battle.linked_habits.forEach(habitId => {
            if (completedHabitIds.has(habitId)) {
              hpChange -= 15 // Direct damage to the enemy
              habitsHit++
            } else {
              hpChange += 20 // Enemy heals
              habitsMissed++
              totalMissed++
            }
          })

          if (hpChange !== 0) {
            battleUpdatesNeeded = true
            const oldHp = battle.hp || 100
            const newHp = Math.max(0, Math.min(100, oldHp + hpChange))
            
            if (hpChange > 0) {
              newAlerts.push({
                id: `battle_heal_${battle.name}`,
                type: 'warning',
                iconName: 'Activity',
                message: `BATTLE LOST GROUND: Missing counter-measures caused "${battle.name}" to heal +${hpChange} HP.`
              })
            } else {
              newAlerts.push({
                id: `battle_dmg_${battle.name}`,
                type: 'success',
                iconName: 'Zap',
                message: `DIRECT HIT: Counter-measures dealt -${Math.abs(hpChange)} HP damage to "${battle.name}".`
              })
            }
            return { ...battle, hp: newHp }
          }
          return battle
        })

        if (totalMissed > 0) {
          const penalty = totalMissed * XP_RULES.HABIT.MISS
          newAlerts.push({
            id: 'missed_routines',
            type: 'danger',
            icon: Skull,
            message: `DISCIPLINE BREACH: You missed ${totalMissed} critical routines yesterday. (${penalty} XP)`
          })
          
          if (blueprint.last_evaluated_date !== todayStr) {
            // XP penalty removed here to prevent double-penalizing. Handled safely by useHabitsInternal.
            // await awardXP(penalty, 'habit_miss_batch', todayStr, `Missed ${totalMissed} daily ops yesterday`, 'discipline')
          }
        }

        // Persist the battle HP damage if not evaluated today yet
        if (blueprint.last_evaluated_date !== todayStr) {
          await supabase.from('user_blueprints')
            .update({ 
              battles: updatedBattles, 
              last_evaluated_date: todayStr 
            })
            .eq('id', blueprint.id)
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
            iconName: 'Crosshair',
            message: `MISSION DEADLINE APPROACHING: "${mainQuest.title}" is due in ${daysLeft} days. Accelerate execution.`
          })
        } else if (daysLeft < 0 && mainQuest.status !== 'completed') {
          newAlerts.push({
            id: 'deadline_failed',
            type: 'critical',
            iconName: 'Skull',
            message: `MISSION FAILED: Deadline passed for "${mainQuest.title}". Massive XP loss imminent.`
          })
        }
      }
      
      setAlerts(newAlerts)
      sessionStorage.setItem(cacheKey, JSON.stringify(newAlerts))
      setLoading(false)
    }

    evaluateConsequences()
  }, [user])

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
          const iconMap = { Skull, Activity, Zap, Crosshair }
          const Icon = iconMap[alert.iconName] || AlertTriangle
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
