'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLocalDateStr } from '@/lib/utils/dates'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale, TrendingDown, Trophy, Lock, Check, Target, Flame,
  Moon, Clock, CheckCircle2, XCircle, BarChart2, Activity, ChevronDown, ChevronUp,
  Ruler, Sparkles, Calendar, Trash2, Edit3
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, Tooltip, ReferenceLine, XAxis, YAxis,
  LineChart, Line, ComposedChart
} from 'recharts'

export default function WellnessPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const todayStr = getLocalDateStr(new Date())

  const [activeTab, setActiveTab] = useState('body')
  const [showSleepHistory, setShowSleepHistory] = useState(false)
  const [showBodyHistory, setShowBodyHistory] = useState(false)

  // ─── BODY & BELLY RECON STATE ───
  const [config, setConfig] = useState(null)
  const [logs, setLogs] = useState([])
  const [loadingBody, setLoadingBody] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggedToday, setLoggedToday] = useState(false)

  const [logDate, setLogDate] = useState(todayStr)
  const [todayWeight, setTodayWeight] = useState('')
  const [todayBelly, setTodayBelly] = useState('')
  const [logToast, setLogToast] = useState(null)

  const [setupStartingWeight, setSetupStartingWeight] = useState('')
  const [setupTargetWeight, setSetupTargetWeight] = useState('')
  const [setupStartingBelly, setSetupStartingBelly] = useState('')
  const [setupTargetBelly, setSetupTargetBelly] = useState('')

  const [showNewTarget, setShowNewTarget] = useState(false)
  const [newTargetWeight, setNewTargetWeight] = useState('')
  const [newTargetBelly, setNewTargetBelly] = useState('')

  const [chartMetric, setChartMetric] = useState('both') 
  const [editingLog, setEditingLog] = useState(null)
  const [editWeight, setEditWeight] = useState('')
  const [editBelly, setEditBelly] = useState('')

  // ─── SLEEP ANALYTICS STATE ───
  const [sleepLogs, setSleepLogs] = useState([])
  const [loadingSleep, setLoadingSleep] = useState(true)

  const initializedBody = useRef(false)
  const initializedSleep = useRef(false)

  const fetchBodyData = useCallback(async () => {
    if (!user) return
    if (!initializedBody.current) setLoadingBody(true)

    try {
      const [configRes, logsRes] = await Promise.all([
        supabase.from('weight_config').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('weight_logs').select('*').eq('user_id', user.id).order('date', { ascending: true })
      ])

      let localConfig = {}
      let localBellyMap = {}
      if (typeof window !== 'undefined') {
        try {
          const rawCfg = localStorage.getItem(`lokios_wellness_config_${user.id}`)
          if (rawCfg) localConfig = JSON.parse(rawCfg)
          const rawBelly = localStorage.getItem(`lokios_belly_logs_${user.id}`)
          if (rawBelly) localBellyMap = JSON.parse(rawBelly)
        } catch (e) {
          console.warn('Failed to parse local belly data:', e)
        }
      }

      let mergedConfig = null
      if (configRes.data || Object.keys(localConfig).length > 0) {
        mergedConfig = {
          starting_weight: 80,
          target_weight: 70,
          starting_belly_cm: 92,
          target_belly_cm: 80,
          ...configRes.data,
          ...localConfig
        }
        setConfig(mergedConfig)
      } else {
        setConfig(null)
      }

      const rawLogs = logsRes.data || []
      const mergedLogs = rawLogs.map(l => {
        const localBelly = localBellyMap[l.date]
        const dbBelly = l.belly_size_cm ?? l.waist_cm ?? l.belly_cm
        const finalBelly = (typeof dbBelly === 'number' && dbBelly > 0) ? dbBelly : (typeof localBelly === 'number' && localBelly > 0 ? localBelly : null)
        return {
          ...l,
          weight_kg: parseFloat(l.weight_kg),
          belly_size_cm: finalBelly ? parseFloat(finalBelly) : null
        }
      })

      Object.entries(localBellyMap).forEach(([dateStr, bellyVal]) => {
        if (!mergedLogs.some(l => l.date === dateStr) && typeof bellyVal === 'number') {
          mergedLogs.push({
            user_id: user.id,
            date: dateStr,
            weight_kg: mergedConfig?.starting_weight || 75,
            belly_size_cm: bellyVal
          })
        }
      })

      mergedLogs.sort((a, b) => a.date.localeCompare(b.date))
      setLogs(mergedLogs)

      const todayLog = mergedLogs.find(l => l.date === todayStr)
      if (todayLog) {
        setLoggedToday(true)
        setTodayWeight(String(todayLog.weight_kg || ''))
        if (todayLog.belly_size_cm) setTodayBelly(String(todayLog.belly_size_cm))
      }
    } catch (err) {
      console.error('Error fetching body data:', err)
    } finally {
      setLoadingBody(false)
      initializedBody.current = true
    }
  }, [user, todayStr])

  const fetchSleepData = useCallback(async () => {
    if (!user) return
    if (!initializedSleep.current) setLoadingSleep(true)

    try {
      const sb = createClient()
      const { data: sleepData, error: sleepErr } = await sb
        .from('sleep_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })

      if (sleepData && sleepData.length > 0) {
        setSleepLogs(sleepData)
      } else {
        setSleepLogs([])
      }
    } catch (err) {
      console.error('fetchSleepData exception:', err)
    } finally {
      setLoadingSleep(false)
      initializedSleep.current = true
    }
  }, [user])

  useEffect(() => { fetchBodyData(); fetchSleepData(); }, [fetchBodyData, fetchSleepData])
  useEffect(() => { if (activeTab === 'sleep') fetchSleepData() }, [activeTab, fetchSleepData])

  useEffect(() => {
    const handleSleepUpdate = () => { fetchSleepData() }
    const handleWeightUpdate = () => { fetchBodyData() }
    window.addEventListener('lokios_sleep_updated', handleSleepUpdate)
    window.addEventListener('lokios_weight_updated', handleWeightUpdate)
    return () => {
      window.removeEventListener('lokios_sleep_updated', handleSleepUpdate)
      window.removeEventListener('lokios_weight_updated', handleWeightUpdate)
    }
  }, [fetchSleepData, fetchBodyData])

  const handleSetup = async () => {
    if (!setupStartingWeight || !setupTargetWeight) return
    setSaving(true)
    const sWeight = parseFloat(setupStartingWeight)
    const tWeight = parseFloat(setupTargetWeight)
    const sBelly = parseFloat(setupStartingBelly) || 90
    const tBelly = parseFloat(setupTargetBelly) || 80

    if (typeof window !== 'undefined' && user?.id) {
      const cfgObj = {
        starting_weight: sWeight,
        target_weight: tWeight,
        starting_belly_cm: sBelly,
        target_belly_cm: tBelly,
        milestones_awarded: 0
      }
      localStorage.setItem(`lokios_wellness_config_${user.id}`, JSON.stringify(cfgObj))
    }

    try {
      await supabase.from('weight_config').insert({
        user_id: user.id,
        starting_weight: sWeight,
        target_weight: tWeight,
        starting_belly_cm: sBelly,
        target_belly_cm: tBelly,
        milestones_awarded: 0
      })
    } catch (e) {
      console.warn('DB setup error:', e)
    }

    await fetchBodyData()
    setSaving(false)
  }

  const handleLogRecon = async () => {
    if (!user) return
    const weightVal = parseFloat(todayWeight)
    const bellyVal = todayBelly ? parseFloat(todayBelly) : null
    const targetDate = logDate || todayStr

    if ((isNaN(weightVal) || weightVal <= 0 || weightVal > 400) && (!bellyVal || isNaN(bellyVal))) {
      alert('Please enter a valid weight (kg) or belly size (cm).')
      return
    }

    setSaving(true)

    if (typeof window !== 'undefined') {
      try {
        const rawBelly = localStorage.getItem(`lokios_belly_logs_${user.id}`)
        const bellyMap = rawBelly ? JSON.parse(rawBelly) : {}
        if (bellyVal && !isNaN(bellyVal)) {
          bellyMap[targetDate] = bellyVal
        }
        localStorage.setItem(`lokios_belly_logs_${user.id}`, JSON.stringify(bellyMap))
      } catch (e) {}
    }

    try {
      const payload = {
        user_id: user.id,
        date: targetDate,
        weight_kg: !isNaN(weightVal) && weightVal > 0 ? weightVal : (logs[logs.length - 1]?.weight_kg || 75),
        belly_size_cm: bellyVal,
        waist_cm: bellyVal
      }

      await supabase.from('weight_logs').delete().eq('user_id', user.id).eq('date', targetDate)
      await supabase.from('weight_logs').insert(payload)

      if (config && !isNaN(weightVal) && weightVal > 0) {
        const kgLost = Math.floor(config.starting_weight - weightVal)
        const alreadyAwarded = config.milestones_awarded || 0
        if (kgLost > alreadyAwarded && kgLost > 0) {
          await supabase.from('weight_config').update({ milestones_awarded: kgLost }).eq('id', config.id)
        }
        if (weightVal <= config.target_weight && !config.target_hit_at) {
          await supabase.from('weight_config').update({ target_hit_at: targetDate }).eq('id', config.id)
        }
      }
    } catch (e) {
      console.warn('DB Log error:', e)
    }

    if (targetDate === todayStr) setLoggedToday(true)
    setLogToast('✓ BODY RECON LOGGED')
    setTimeout(() => setLogToast(null), 3000)

    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lokios_weight_updated'))
    await fetchBodyData()
    setSaving(false)
  }

  const handleNewTarget = async () => {
    if (!newTargetWeight && !newTargetBelly) return
    setSaving(true)
    const tWeight = newTargetWeight ? parseFloat(newTargetWeight) : config?.target_weight
    const tBelly = newTargetBelly ? parseFloat(newTargetBelly) : config?.target_belly_cm

    if (typeof window !== 'undefined' && user?.id) {
      const cfgObj = { ...config, target_weight: tWeight, target_belly_cm: tBelly }
      localStorage.setItem(`lokios_wellness_config_${user.id}`, JSON.stringify(cfgObj))
    }

    try {
      await supabase.from('weight_config').update({
        target_weight: tWeight,
        target_belly_cm: tBelly,
        target_hit_at: null
      }).eq('id', config.id)
    } catch (e) {}

    setShowNewTarget(false)
    await fetchBodyData()
    setSaving(false)
  }

  const handleSaveEditLog = async () => {
    if (!editingLog || !user) return
    const wVal = parseFloat(editWeight)
    const bVal = editBelly ? parseFloat(editBelly) : null

    if (typeof window !== 'undefined') {
      try {
        const rawBelly = localStorage.getItem(`lokios_belly_logs_${user.id}`)
        const bellyMap = rawBelly ? JSON.parse(rawBelly) : {}
        if (bVal && !isNaN(bVal)) bellyMap[editingLog.date] = bVal
        else delete bellyMap[editingLog.date]
        localStorage.setItem(`lokios_belly_logs_${user.id}`, JSON.stringify(bellyMap))
      } catch (e) {}
    }

    try {
      await supabase.from('weight_logs').update({
        weight_kg: !isNaN(wVal) ? wVal : editingLog.weight_kg,
        belly_size_cm: bVal,
        waist_cm: bVal
      }).eq('user_id', user.id).eq('date', editingLog.date)
    } catch (e) {}

    setEditingLog(null)
    await fetchBodyData()
  }

  const handleDeleteLog = async (dateStr) => {
    if (!confirm(`Delete body recon log for ${dateStr}?`)) return
    if (typeof window !== 'undefined') {
      try {
        const rawBelly = localStorage.getItem(`lokios_belly_logs_${user.id}`)
        const bellyMap = rawBelly ? JSON.parse(rawBelly) : {}
        delete bellyMap[dateStr]
        localStorage.setItem(`lokios_belly_logs_${user.id}`, JSON.stringify(bellyMap))
      } catch (e) {}
    }
    await supabase.from('weight_logs').delete().eq('user_id', user.id).eq('date', dateStr)
    await fetchBodyData()
  }

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null
  const latestWeight = latestLog?.weight_kg || null
  const startWeight = config?.starting_weight || (logs[0]?.weight_kg || 80)
  const targetWeight = config?.target_weight || 70
  const totalWeightLost = latestWeight ? (startWeight - latestWeight).toFixed(1) : 0
  const weightProgressPct = latestWeight && startWeight !== targetWeight
    ? Math.min(100, Math.max(0, ((startWeight - latestWeight) / (startWeight - targetWeight)) * 100)) : 0
  const logsWithBelly = logs.filter(l => typeof l.belly_size_cm === 'number' && l.belly_size_cm > 0)
  const latestBelly = logsWithBelly.length > 0 ? logsWithBelly[logsWithBelly.length - 1].belly_size_cm : null
  const startBelly = config?.starting_belly_cm || (logsWithBelly[0]?.belly_size_cm || 92)
  const targetBelly = config?.target_belly_cm || (startBelly - 10 > 0 ? startBelly - 10 : 80)
  const totalBellyReduced = latestBelly ? (startBelly - latestBelly).toFixed(1) : 0
  const bellyProgressPct = latestBelly && startBelly !== targetBelly
    ? Math.min(100, Math.max(0, ((startBelly - latestBelly) / (startBelly - targetBelly)) * 100)) : 0
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = getLocalDateStr(weekAgo)
  const weekAgoLog = logs.find(l => l.date <= weekAgoStr)
  const weekWeightChange = weekAgoLog && latestWeight ? (latestWeight - weekAgoLog.weight_kg).toFixed(1) : null
  const weekAgoBellyLog = [...logsWithBelly].reverse().find(l => l.date <= weekAgoStr)
  const weekBellyChange = weekAgoBellyLog && latestBelly ? (latestBelly - weekAgoBellyLog.belly_size_cm).toFixed(1) : null
  const waistWeightRatio = latestWeight && latestBelly ? (latestBelly / latestWeight).toFixed(2) : null
  const isInMaintenance = config?.target_hit_at != null
  const chartData = logs.map(l => ({
    date: new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    fullDate: l.date,
    weight: l.weight_kg ? parseFloat(l.weight_kg) : null,
    belly: l.belly_size_cm ? parseFloat(l.belly_size_cm) : null,
    bellyInches: l.belly_size_cm ? parseFloat((l.belly_size_cm / 2.54).toFixed(1)) : null
  }))

  const bellyMilestones = useMemo(() => {
    if (!startBelly || !targetBelly || startBelly <= targetBelly) return []
    const totalSteps = Math.ceil((startBelly - targetBelly) / 2)
    return Array.from({ length: totalSteps }, (_, i) => {
      const targetCm = parseFloat((startBelly - (i + 1) * 2).toFixed(1))
      const hitLog = logs.find(l => l.belly_size_cm && l.belly_size_cm <= targetCm)
      return { cm: (i + 1) * 2, targetCm, inches: (targetCm / 2.54).toFixed(1), hit: !!hitLog, date: hitLog?.date, isTarget: targetCm <= targetBelly }
    })
  }, [startBelly, targetBelly, logs])

  const weightMilestones = useMemo(() => {
    if (!config || config.starting_weight <= config.target_weight) return []
    return Array.from({ length: Math.ceil(config.starting_weight - config.target_weight) }, (_, i) => {
      const targetKg = parseFloat((config.starting_weight - (i + 1)).toFixed(1))
      const hitLog = logs.find(l => parseFloat(l.weight_kg) <= targetKg)
      return { kg: i + 1, targetKg: targetKg.toFixed(1), hit: !!hitLog, date: hitLog?.date, isTarget: targetKg <= config.target_weight }
    })
  }, [config, logs])

  const isLogHealthy = (l) => {
    if (!l) return false
    if (l.status === 'healthy') return true
    const [bH] = (l.bedtime || '23:00').split(':').map(Number)
    const [wH, wM] = (l.wake_time || '08:00').split(':').map(Number)
    const dur = parseFloat(l.duration_hours || 0)
    const bOk = bH >= 20 || bH <= 2
    const wOk = wH < 10 || (wH === 10 && wM === 0)
    const dOk = dur >= 5.5 && dur <= 10.5
    return bOk && wOk && dOk
  }

  const sleepChartData = sleepLogs.map(l => ({
    date: new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    hours: parseFloat(l.duration_hours) || 0
  }))
  const avgSleep = sleepLogs.length > 0 ? (sleepLogs.reduce((s, l) => s + (parseFloat(l.duration_hours) || 0), 0) / sleepLogs.length).toFixed(1) : null
  const healthyNights = sleepLogs.filter(isLogHealthy).length
  const totalNights = sleepLogs.length
  const bedtimeScore = totalNights > 0 ? Math.round((sleepLogs.filter(l => {
    const [h] = (l.bedtime || '00:00').split(':').map(Number)
    return h >= 20 || h <= 2
  }).length / totalNights) * 100) : null
  const wakeScore = totalNights > 0 ? Math.round((sleepLogs.filter(l => {
    const [h, m] = (l.wake_time || '09:00').split(':').map(Number)
    return h < 10 || (h === 10 && m === 0)
  }).length / totalNights) * 100) : null

  let currentStreak = 0, bestStreak = 0, streak = 0
  const sortedSleep = [...sleepLogs].sort((a, b) => a.date.localeCompare(b.date))
  sortedSleep.forEach(l => {
    if (isLogHealthy(l)) { streak++; if (streak > bestStreak) bestStreak = streak }
    else streak = 0
  })
  if (sortedSleep.length > 0 && isLogHealthy(sortedSleep[sortedSleep.length - 1])) currentStreak = streak

  const CustomReconTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      const dataPoint = payload[0]?.payload
      return (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px' }}>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider mb-1">{dataPoint?.fullDate || label}</p>
          {dataPoint?.weight && (<div className="flex items-center gap-2 font-mono text-xs"><span className="text-amber font-bold">WEIGHT:</span><span className="text-primary font-bold">{dataPoint.weight} kg</span></div>)}
          {dataPoint?.belly && (<div className="flex items-center gap-2 font-mono text-xs mt-0.5"><span className="text-info font-bold">BELLY:</span><span className="text-primary font-bold">{dataPoint.belly} cm</span></div>)}
        </div>
      )
    }
    return null
  }

  const CustomSleepTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '6px 10px' }}>
          <p className="font-mono text-[9px] text-muted">{label}</p>
          <p className="font-mono text-[11px] font-bold text-primary">{payload[0].value} h</p>
        </div>
      )
    }
    return null
  }

  if (loadingBody) {
    return (
      <AppShell>
        <div className="page-container flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <div className="font-mono text-muted text-sm animate-pulse">Loading Wellness OS...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page-container max-w-[1200px] pb-12">
        <AnimatePresence>
          {logToast && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-[999] px-5 py-3 font-display font-bold text-base tracking-tight rounded shadow-2xl"
              style={{ background: 'var(--success)', color: '#0a0a0a', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
              {logToast}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Activity size={24} color="var(--accent-primary)" />
            <div>
              <h1 className="font-display font-bold text-primary tracking-tight" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)' }}>
                WELLNESS & BODY RECON
              </h1>
              <p className="font-mono text-[9px] text-muted uppercase tracking-widest">
                Body Weight · Belly / Waist Measurement · Sleep Intelligence
              </p>
            </div>
          </div>

          <div className="flex border border-border-color overflow-hidden rounded-md">
            {[
              { id: 'body', icon: Scale, label: 'BODY & BELLY RECON' },
              { id: 'sleep', icon: Moon, label: 'SLEEP ANALYTICS' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                style={{
                  background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === tab.id ? '#0a0a0a' : 'var(--text-muted)',
                  borderRight: tab.id === 'body' ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'body' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {!config ? (
              <div className="max-w-lg mx-auto pt-6">
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Scale size={28} color="var(--accent-primary)" />
                    <h2 className="font-display font-bold text-primary tracking-tight text-3xl">INITIALIZE BODY RECON</h2>
                  </div>
                  <p className="font-mono text-[11px] text-muted uppercase tracking-widest">Weight & Waist Measurement Protocol</p>
                </div>
                <div className="p-7 rounded-xl" style={{ background: 'linear-gradient(135deg,#111,#0a0a0a)', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--accent-primary)' }}>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-5">Set Starting & Target Baselines</div>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1.5">Starting Weight (kg)</label>
                        <input type="number" step="0.1" value={setupStartingWeight} onChange={e => setSetupStartingWeight(e.target.value)} placeholder="e.g. 78.5"
                          className="w-full p-2.5 font-mono text-base text-primary border border-border-color outline-none rounded bg-bg-primary" />
                      </div>
                      <div>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1.5">Target Weight (kg)</label>
                        <input type="number" step="0.1" value={setupTargetWeight} onChange={e => setSetupTargetWeight(e.target.value)} placeholder="e.g. 70.0"
                          className="w-full p-2.5 font-mono text-base text-primary border border-border-color outline-none rounded bg-bg-primary" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1.5">Starting Belly / Waist (cm)</label>
                        <input type="number" step="0.5" value={setupStartingBelly} onChange={e => setSetupStartingBelly(e.target.value)} placeholder="e.g. 92.0"
                          className="w-full p-2.5 font-mono text-base text-primary border border-border-color outline-none rounded bg-bg-primary" />
                      </div>
                      <div>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1.5">Target Belly / Waist (cm)</label>
                        <input type="number" step="0.5" value={setupTargetBelly} onChange={e => setSetupTargetBelly(e.target.value)} placeholder="e.g. 80.0"
                          className="w-full p-2.5 font-mono text-base text-primary border border-border-color outline-none rounded bg-bg-primary" />
                      </div>
                    </div>
                    <button onClick={handleSetup} disabled={!setupStartingWeight || !setupTargetWeight || saving}
                      className="w-full p-3.5 font-display font-bold uppercase tracking-widest text-sm transition-all rounded mt-2 cursor-pointer"
                      style={{ background: setupStartingWeight && setupTargetWeight ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: setupStartingWeight && setupTargetWeight ? '#0a0a0a' : 'var(--text-muted)', opacity: saving ? 0.5 : 1 }}>
                      {saving ? 'Initializing...' : 'Begin Tracking'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {isInMaintenance && (
                  <div className="p-4 flex items-center justify-between gap-3 rounded-xl"
                    style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.3)', borderLeft: '3px solid var(--success)' }}>
                    <div className="flex items-center gap-3">
                      <Trophy size={18} color="var(--success)" />
                      <div>
                        <div className="font-display font-bold text-primary">TARGET REACHED!</div>
                        <div className="font-mono text-[9px] text-muted">Hit {config.target_weight} kg on {new Date(config.target_hit_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                    </div>
                    <button onClick={() => setShowNewTarget(true)} className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest border border-success text-success hover:bg-success hover:text-bg-primary transition-colors rounded">
                      Set New Target
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5 p-4 rounded-xl border border-border-color bg-bg-secondary flex flex-col justify-between" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Scale size={14} color="var(--accent-primary)" />
                          <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Daily Recon Logger</span>
                        </div>
                        {loggedToday && <span className="flex items-center gap-1 font-mono text-[9px] text-success font-bold bg-success/10 px-2 py-0.5 rounded border border-success/30"><CheckCircle2 size={10} /> LOGGED TODAY</span>}
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="font-mono text-[9px] uppercase tracking-wider text-muted block mb-1">Weight (kg)</label>
                            <div className="relative"><input type="number" step="0.1" value={todayWeight} onChange={e => setTodayWeight(e.target.value)} placeholder="e.g. 77.5" className="w-full p-2 font-mono text-base text-primary border border-border-color outline-none rounded bg-bg-primary" /><span className="absolute right-2.5 top-2.5 font-mono text-[10px] text-muted">kg</span></div>
                          </div>
                          <div>
                            <label className="font-mono text-[9px] uppercase tracking-wider text-info block mb-1">Belly Size (cm)</label>
                            <div className="relative"><input type="number" step="0.5" value={todayBelly} onChange={e => setTodayBelly(e.target.value)} placeholder="e.g. 88.0" className="w-full p-2 font-mono text-base text-primary border border-info/40 outline-none rounded bg-bg-primary" /><span className="absolute right-2.5 top-2.5 font-mono text-[10px] text-info font-bold">cm</span></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5 text-muted font-mono text-[9px]"><Calendar size={11} /><span>DATE:</span><input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-primary text-[10px] font-mono outline-none" /></div>
                          {logDate !== todayStr && <button type="button" onClick={() => setLogDate(todayStr)} className="font-mono text-[8px] text-amber hover:underline cursor-pointer">Reset Today</button>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border-color/60">
                      <button onClick={handleLogRecon} disabled={(!todayWeight && !todayBelly) || saving} className="flex-1 w-full py-2.5 px-4 font-display font-bold uppercase tracking-widest text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer" style={{ background: (todayWeight || todayBelly) ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: (todayWeight || todayBelly) ? '#0a0a0a' : 'var(--text-muted)' }}>{saving ? 'RECORDING...' : 'LOG RECON'}</button>
                    </div>
                  </div>
                  <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3.5 rounded-xl border border-border-color bg-bg-tertiary flex flex-col justify-between">
                      <span className="font-mono text-[9px] uppercase font-bold text-muted">Weight</span>
                      <div className="font-display font-bold text-xl text-primary">{latestWeight ? `${latestWeight} kg` : '—'}</div>
                      <span className="font-mono text-[9px] font-bold" style={{ color: parseFloat(totalWeightLost) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{totalWeightLost > 0 ? `▼ ${totalWeightLost} kg` : '0 kg net'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-info/30 bg-bg-tertiary flex flex-col justify-between">
                      <span className="font-mono text-[9px] uppercase font-bold text-info">Belly</span>
                      <div className="font-display font-bold text-xl text-primary">{latestBelly ? `${latestBelly} cm` : '—'}</div>
                      <span className="font-mono text-[9px] font-bold" style={{ color: parseFloat(totalBellyReduced) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{totalBellyReduced > 0 ? `▼ ${totalBellyReduced} cm` : '0 cm net'}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}
