'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGoals } from '@/lib/hooks/useGoals'
import { useHabits } from '@/lib/hooks/useHabits'
import { useAuth } from '@/lib/hooks/useAuth'
import HudPanel from './HudPanel'
import { AlertTriangle, Activity, Flame, ShieldAlert, Cpu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function IntelligenceFeed() {
  const { user } = useAuth()
  const { mainQuest } = useGoals()
  const { habits } = useHabits()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function generateIntelligence() {
      const newAlerts = []
      const supabase = createClient()
      
      // 1. Check Main Quest Stall
      if (mainQuest && mainQuest.length > 0) {
        const quest = mainQuest[0]
        const lastUpdated = new Date(quest.updated_at).getTime()
        const daysSinceUpdate = (new Date().getTime() - lastUpdated) / (1000 * 3600 * 24)
        if (daysSinceUpdate > 3) {
          newAlerts.push({
            id: 'quest_stall',
            type: 'warning',
            icon: AlertTriangle,
            message: `MAIN MISSION STALLED: "${quest.title}" has no activity in ${Math.floor(daysSinceUpdate)} days.`
          })
        }
      }

      // 2. Check Fitness Streak
      if (habits && habits.length > 0) {
        const fitnessHabits = habits.filter(h => h.category === 'health' || h.stat_category === 'strength')
        let brokenStreak = false
        fitnessHabits.forEach(h => {
          if (h.total_completions > 0 && h.current_streak === 0) {
            brokenStreak = true
          }
        })
        if (brokenStreak) {
          newAlerts.push({
            id: 'fitness_streak',
            type: 'danger',
            icon: Flame,
            message: "FITNESS STREAK BROKEN: Physical conditioning routines missed."
          })
        }
      }

      // 3. Check Screen Time Regression
      const { data: screenTime } = await supabase
        .from('screen_time_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(2)

      if (screenTime && screenTime.length === 2) {
        const [latest, previous] = screenTime
        if (latest.total_hours > previous.total_hours && latest.total_hours > 6) {
          newAlerts.push({
            id: 'screen_time',
            type: 'danger',
            icon: Activity,
            message: `PHONE ADDICTION REGRESSING: Screen time increased to ${latest.total_hours}h.`
          })
        }
      }
      
      setAlerts(newAlerts)
      setLoading(false)
    }

    generateIntelligence()
  }, [user, mainQuest, habits])

  if (loading) return null

  if (alerts.length === 0) {
    return (
      <HudPanel glow>
        <div className="flex items-center gap-3 text-success">
          <Cpu size={16} />
          <span className="font-mono text-sm uppercase tracking-widest">SYSTEM OPTIMAL: NO THREATS DETECTED</span>
        </div>
      </HudPanel>
    )
  }

  return (
    <div className="flex-col gap-3">
      <AnimatePresence>
        {alerts.map((alert, i) => {
          const Icon = alert.icon
          const colorClass = alert.type === 'danger' ? 'text-danger border-danger' : 'text-amber border-amber'
          const bgClass = alert.type === 'danger' ? 'bg-danger-subtle' : 'bg-amber-subtle'
          
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={`p-4 border ${colorClass} ${bgClass} flex items-start gap-4 relative overflow-hidden group`}>
                <div className={`absolute top-0 left-0 w-1 h-full ${alert.type === 'danger' ? 'bg-danger' : 'bg-amber'}`} />
                <Icon className={`mt-0.5 shrink-0 ${alert.type === 'danger' ? 'text-danger' : 'text-amber'}`} size={18} />
                <div className="flex-col">
                  <span className="font-display text-sm tracking-widest uppercase text-primary">INTELLIGENCE ALERT</span>
                  <span className={`font-mono text-xs ${alert.type === 'danger' ? 'text-danger' : 'text-amber'}`}>{alert.message}</span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
