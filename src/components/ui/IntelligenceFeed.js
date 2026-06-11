'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGoals } from '@/lib/hooks/useGoals'
import { useTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/hooks/useAuth'
import HudPanel from './HudPanel'
import { AlertTriangle, Activity, Zap, Cpu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function IntelligenceFeed() {
  const { user } = useAuth()
  const { mainQuest } = useGoals()
  const { tasks } = useTasks()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function generateIntelligence() {
      const newAlerts = []
      const supabase = createClient()
      
      // 1. Check Main Quest Stall
      if (mainQuest) {
        const lastUpdated = new Date(mainQuest.updated_at).getTime()
        const daysSinceUpdate = (new Date().getTime() - lastUpdated) / (1000 * 3600 * 24)
        if (daysSinceUpdate > 3) {
          newAlerts.push({
            id: 'quest_stall',
            type: 'danger',
            icon: AlertTriangle,
            message: `MISSION STALLED: "${mainQuest.title}" has no activity in ${Math.floor(daysSinceUpdate)} days.`
          })
        }
      }

      // 2. Check Screen Time Regression (Discipline Battle)
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
            type: 'warning',
            icon: Activity,
            message: `DISCIPLINE BATTLE LOSING GROUND: Screen time increased to ${latest.total_hours}h.`
          })
        }
      }

      // 3. Check Communication Skill Increase
      const todayStr = new Date().toISOString().split('T')[0]
      const commTasksToday = tasks.filter(t => 
        t.status === 'completed' && 
        t.completed_at && 
        t.completed_at.startsWith(todayStr) && 
        t.stat_category === 'communication'
      )
      
      if (commTasksToday.length > 0) {
        newAlerts.push({
          id: 'comm_skill',
          type: 'success',
          icon: Zap,
          message: `COMMUNICATION SKILL INCREASED: Operational requirements met today.`
        })
      }
      
      setAlerts(newAlerts)
      setLoading(false)
    }

    generateIntelligence()
  }, [user, mainQuest, tasks])

  if (loading) return null

  if (alerts.length === 0) {
    return (
      <HudPanel glow className="mb-6">
        <div className="flex items-center gap-3 text-info">
          <Cpu size={16} />
          <span className="font-mono text-sm uppercase tracking-widest">INTELLIGENCE: NO CRITICAL ALERTS</span>
        </div>
      </HudPanel>
    )
  }

  return (
    <div className="flex-col gap-3 mb-6">
      <AnimatePresence>
        {alerts.map((alert, i) => {
          const Icon = alert.icon
          let colorClass, bgClass;
          
          if (alert.type === 'danger') {
            colorClass = 'text-danger border-danger'
            bgClass = 'bg-danger-subtle'
          } else if (alert.type === 'warning') {
            colorClass = 'text-amber border-amber'
            bgClass = 'bg-amber-subtle'
          } else {
            colorClass = 'text-info border-info'
            bgClass = 'bg-info-subtle'
          }
          
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={`p-4 border ${colorClass} ${bgClass} flex items-start gap-4 relative overflow-hidden group`}>
                <div className={`absolute top-0 left-0 w-1 h-full ${alert.type === 'danger' ? 'bg-danger' : alert.type === 'warning' ? 'bg-amber' : 'bg-info'}`} />
                <Icon className={`mt-0.5 shrink-0 ${colorClass.split(' ')[0]}`} size={18} />
                <div className="flex-col">
                  <span className="font-mono text-sm tracking-widest uppercase text-primary">A.I. ANALYSIS</span>
                  <span className={`font-mono text-xs ${colorClass.split(' ')[0]}`}>{alert.message}</span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
