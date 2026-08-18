'use client'

import { useState, useEffect, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import { getLocalDateStr } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useOS } from '@/lib/context/OSContext'
import { getSpeakingRestDays, setSpeakingRestDays, isSpeakingRestDay } from '@/lib/utils/restDays'
import { evaluateProtocolAutoFail } from '@/lib/utils/protocolAutoFail'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Play, Pause, RotateCcw, Shuffle, Video, Link as LinkIcon,
  CheckCircle2, Clock, Calendar, Sparkles, Award, ExternalLink,
  BookOpen, Star, Search
} from 'lucide-react'

// Pre-loaded 30 Topics Pool
const DEFAULT_30_TOPICS = [
  { id: 1, topic: 'Explain quantum computing to a 12-year-old.', category: 'Tech & Science' },
  { id: 2, topic: 'Why do countries have inflation?', category: 'Economics' },
  { id: 3, topic: 'How does CRISPR gene editing work?', category: 'BioTech & Science' },
  { id: 4, topic: 'Why do airplanes fly?', category: 'Engineering' },
  { id: 5, topic: 'How does GPS know your location?', category: 'Technology' },
  { id: 6, topic: 'Explain the Internet from scratch.', category: 'Technology' },
  { id: 7, topic: 'Why did the Roman Empire collapse?', category: 'History' },
  { id: 8, topic: 'How does a nuclear power plant work?', category: 'Physics & Energy' },
  { id: 9, topic: 'What makes a great teacher?', category: 'Education & Human' },
  { id: 10, topic: 'Why do humans procrastinate?', category: 'Psychology' },
  { id: 11, topic: 'How does Bitcoin actually work?', category: 'Finance & Crypto' },
  { id: 12, topic: 'Why do startups fail?', category: 'Business & Entrepreneurship' },
  { id: 13, topic: 'Explain machine learning without using the words "AI" or "computer."', category: 'Technology' },
  { id: 14, topic: 'How do vaccines train the immune system?', category: 'Biology & Health' },
  { id: 15, topic: 'Why do tsunamis happen?', category: 'Earth Science' },
  { id: 16, topic: 'What is game theory?', category: 'Strategy & Math' },
  { id: 17, topic: 'How does Formula 1 make a pit stop in under 2 seconds?', category: 'Engineering & Operations' },
  { id: 18, topic: 'Why do people trust brands?', category: 'Marketing & Psychology' },
  { id: 19, topic: 'Explain evolution without mentioning monkeys.', category: 'Biology' },
  { id: 20, topic: 'How does the stock market work?', category: 'Finance' },
  { id: 21, topic: 'Why do black holes exist?', category: 'Astrophysics' },
  { id: 22, topic: 'What makes ideas go viral?', category: 'Media & Marketing' },
  { id: 23, topic: 'How do Pixar movies tell stories so well?', category: 'Storytelling & Art' },
  { id: 24, topic: 'Explain cloud computing to your grandparents.', category: 'Technology' },
  { id: 25, topic: 'Why do civilizations rise and fall?', category: 'History & Philosophy' },
  { id: 26, topic: 'How does Google Search find answers in milliseconds?', category: 'Computer Science' },
  { id: 27, topic: 'What makes a speech memorable?', category: 'Communication & Oratory' },
  { id: 28, topic: 'Explain the greenhouse effect simply.', category: 'Environment & Climate' },
  { id: 29, topic: 'How does SpaceX land rockets?', category: 'Aerospace Engineering' },
  { id: 30, topic: 'What is leverage, and why is it Naval Ravikant\'s favorite concept?', category: 'Mental Models & Wealth' }
]

export default function SpeakingPracticePage() {
  const { user } = useAuth()
  const { xp: { awardXP } = {} } = useOS() || {}


  // State Management
  const [topics] = useState(DEFAULT_30_TOPICS)
  const [selectedTopic, setSelectedTopic] = useState(DEFAULT_30_TOPICS[0])
  const [isShuffling, setIsShuffling] = useState(false)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [restDays, setRestDaysState] = useState(getSpeakingRestDays())

  // 10-Min Timer State (10 mins = 600 seconds)
  const [timerSeconds, setTimerSeconds] = useState(600)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const timerRef = useRef(null)

  // Form State
  const [driveLink, setDriveLink] = useState('')
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  const todayStr = getLocalDateStr(new Date())
  const todayIsRestDay = isSpeakingRestDay()

  const handleToggleRestDay = (dayNum) => {
    const updated = restDays.includes(dayNum)
      ? restDays.filter(d => d !== dayNum)
      : [...restDays, dayNum]
    setRestDaysState(updated)
    setSpeakingRestDays(updated)
  }

  // Fetch History from Supabase & Run 3:00 AM Cutoff Auto-Fail Evaluator
  useEffect(() => {
    if (!user || !user.id) return
    const userId = user.id

    async function loadData() {
      setLoading(true)
      const sb = createClient()

      try {
        await evaluateProtocolAutoFail(userId)

        // Read local storage cache first
        const localRaw = localStorage.getItem(`lokios_speaking_logs_${userId}`)
        const localLogs = localRaw ? JSON.parse(localRaw) : []

        // Query speaking_logs + work_logs (user_id filter required by RLS)
        const [speakingRes, workRes] = await Promise.all([
          sb.from('speaking_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          sb.from('work_logs').select('*').eq('user_id', userId).or(`type.eq.speaking_practice,title.ilike.Speaking Practice%`).order('created_at', { ascending: false })
        ])

        if (speakingRes.error) console.error('[Speaking Sync] speaking_logs fetch error:', speakingRes.error)
        if (workRes.error) console.error('[Speaking Sync] work_logs fetch error:', workRes.error)

        const speakingData = speakingRes.data || []
        const workData = workRes.data || []

        // Build a date-keyed map (date is the canonical dedup key — UUIDs differ per device)
        const mapByDate = new Map()

        // 1. Add speaking_logs (indexed by date)
        speakingData.forEach(item => {
          if (item.date) mapByDate.set(item.date, item)
        })

        // 2. Add speaking entries from work_logs (only if date not already in map)
        workData.forEach(w => {
          if (w.date && !mapByDate.has(w.date)) {
            mapByDate.set(w.date, {
              id: w.id,
              user_id: w.user_id,
              date: w.date,
              topic: w.title ? w.title.replace(/^Speaking Practice:\s*/i, '') : 'Speaking Practice',
              category: 'General',
              day_number: 1,
              prep_duration_minutes: 10,
              drive_link: (w.media_urls && w.media_urls[0]) || '',
              notes: w.description || '',
              rating: 5,
              created_at: w.created_at || new Date().toISOString()
            })
          }
        })

        // 3. For each local log: only push to DB if that DATE is not already in the cloud
        // This prevents duplicate inserts on every refresh
        const cloudDates = new Set(speakingData.map(s => s.date).filter(Boolean))
        for (const item of localLogs) {
          if (!item.date) continue
          if (cloudDates.has(item.date)) {
            // Already in cloud — just merge into map if missing (prefer cloud version)
            if (!mapByDate.has(item.date)) mapByDate.set(item.date, item)
          } else {
            // Genuinely missing from cloud — push once
            mapByDate.set(item.date, item)
            const { error: pushErr } = await sb.from('speaking_logs').insert({
              user_id: userId,
              date: item.date,
              topic: item.topic || 'Speaking Practice',
              category: item.category || 'General',
              day_number: item.day_number || 1,
              prep_duration_minutes: item.prep_duration_minutes || 10,
              drive_link: item.drive_link || '',
              notes: item.notes || '',
              rating: item.rating || 5,
              created_at: item.created_at || new Date().toISOString()
            })
            if (pushErr) console.error('[Speaking Sync] Push failed:', pushErr?.message, item.date)
            else {
              console.log('[Speaking Sync] ✅ Pushed to cloud:', item.date, item.topic)
              cloudDates.add(item.date) // prevent double-push if duplicate in localLogs
            }
          }
        }

        const merged = Array.from(mapByDate.values()).sort((a, b) =>
          new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
        )

        setHistory(merged)
        localStorage.setItem(`lokios_speaking_logs_${userId}`, JSON.stringify(merged))
      } catch (err) {
        console.warn('Fallback loading speaking logs', err)
        const localRaw = localStorage.getItem(`lokios_speaking_logs_${userId}`)
        if (localRaw) setHistory(JSON.parse(localRaw))
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-Time Listener & Window Focus Listener for 100% Cross-Device Phone/Desktop Sync
    const sb = createClient()
    const channel = sb.channel(`speaking_sync_hub_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'speaking_logs', filter: `user_id=eq.${userId}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs', filter: `user_id=eq.${userId}` }, () => loadData())
      .subscribe()

    const handleFocus = () => loadData()
    window.addEventListener('focus', handleFocus)

    return () => {
      sb.removeChannel(channel)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user?.id])

  // Timer Effect
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev - 1)
      }, 1000)
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false)
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isTimerRunning, timerSeconds])

  // Timer Formatter
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStartTimer = () => setIsTimerRunning(true)
  const handlePauseTimer = () => setIsTimerRunning(false)
  const handleResetTimer = () => {
    setIsTimerRunning(false)
    setTimerSeconds(600)
  }

  // Pick Today's Topic / Random Topic
  const handleSelectTodaysTopic = () => {
    setIsShuffling(true)
    let count = 0
    // Try to pick from uncompleted topics first
    const completedTopicTitles = new Set(history.map(h => h.topic))
    const uncompletedTopics = topics.filter(t => !completedTopicTitles.has(t.topic))
    const pool = uncompletedTopics.length > 0 ? uncompletedTopics : topics

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * pool.length)
      setSelectedTopic(pool[randomIndex])
      count++
      if (count > 10) {
        clearInterval(interval)
        setIsShuffling(false)
        handleResetTimer()
      }
    }, 80)
  }

  // Submit Practice Session
  const handleSubmitSession = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!user || !selectedTopic) return
    setSubmitting(true)

    const sb = createClient()
    const prepDurationMinutes = Math.round((600 - timerSeconds) / 60)
    const currentDayNumber = history.length + 1

    let formattedLink = driveLink.trim()
    if (formattedLink && !formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
      formattedLink = `https://${formattedLink}`
    }

    const newLog = {
      user_id: user.id,
      date: todayStr,
      topic: selectedTopic.topic,
      category: selectedTopic.category || 'General',
      day_number: currentDayNumber,
      prep_duration_minutes: prepDurationMinutes > 0 ? prepDurationMinutes : 10,
      drive_link: formattedLink,
      notes: notes.trim(),
      rating: parseInt(rating) || 5,
      created_at: new Date().toISOString()
    }

    // 1. Optimistic Local Storage Save
    const localRaw = localStorage.getItem(`lokios_speaking_logs_${user.id}`)
    const localLogs = localRaw ? JSON.parse(localRaw) : []
    const updatedLocal = [newLog, ...localLogs.filter(l => l.date !== todayStr || l.topic !== newLog.topic)]
    localStorage.setItem(`lokios_speaking_logs_${user.id}`, JSON.stringify(updatedLocal))
    setHistory(updatedLocal)

    // 2. Save to speaking_logs (authoritative table)
    try {
      const { error: spErr } = await sb.from('speaking_logs').insert(newLog)
      if (spErr) console.error('[Speaking Submit] speaking_logs insert FAILED:', spErr, newLog)
      else console.log('[Speaking Submit] ✅ speaking_logs saved successfully:', newLog.date, newLog.topic)
    } catch (spEx) {
      console.error('[Speaking Submit] speaking_logs exception:', spEx)
    }

    setSubmitSuccess(true)
    setDriveLink('')
    setNotes('')
    setSubmitting(false)
    setTimeout(() => setSubmitSuccess(false), 4000)
  }

  // Calculate stats
  const totalSessions = history.length
  const uniqueTopicsCompleted = new Set(history.map(h => h.topic)).size
  const avgRating = totalSessions > 0 ? (history.reduce((acc, h) => acc + (h.rating || 5), 0) / totalSessions).toFixed(1) : '5.0'

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header Banner */}
        <div className="p-6 rounded-2xl border border-amber/30 bg-gradient-to-r from-amber-950/40 via-black to-amber-950/20 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-amber/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber/20 border border-amber/40 text-amber uppercase tracking-wider flex items-center gap-1">
                  <Mic size={12} /> 30-DAY CAMERA SPEAKING CHALLENGE
                </span>
                <span className="font-mono text-xs text-muted">Level Up Your Oratory</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-black text-primary uppercase tracking-tight flex items-center gap-2">
                SPEAKING PRACTICE HUB <Sparkles className="text-amber animate-pulse" size={24} />
              </h1>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-center min-w-[100px]">
                <div className="font-mono text-xl font-bold text-amber">{totalSessions}/30</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Days Done</div>
              </div>
              <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-center min-w-[100px]">
                <div className="font-mono text-xl font-bold text-success">{totalSessions}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Videos</div>
              </div>
              <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-center min-w-[100px]">
                <div className="font-mono text-xl font-bold text-purple-400">⭐ {avgRating}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Avg Rating</div>
              </div>
            </div>
          </div>

          {/* Rest Day Config Bar */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 font-mono text-xs relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-muted uppercase tracking-wider font-bold text-[10px]">SPEAKING REST DAYS:</span>
              <div className="flex items-center gap-1 bg-black/50 p-1 border border-border-color rounded-lg">
                {[
                  { day: 0, label: 'SUN' },
                  { day: 1, label: 'MON' },
                  { day: 2, label: 'TUE' },
                  { day: 3, label: 'WED' },
                  { day: 4, label: 'THU' },
                  { day: 5, label: 'FRI' },
                  { day: 6, label: 'SAT' }
                ].map((dObj) => {
                  const isRest = restDays.includes(dObj.day)
                  return (
                    <button
                      key={dObj.day}
                      type="button"
                      onClick={() => handleToggleRestDay(dObj.day)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        isRest
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50 shadow-sm'
                          : 'text-muted hover:text-primary hover:bg-white/5'
                      }`}
                      title={`Toggle ${dObj.label} as Rest Day`}
                    >
                      {dObj.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {todayIsRestDay && (
              <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-300 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                <span>☕ TODAY IS A REST DAY (NO PENALTY IF SKIPPED)</span>
              </div>
            )}
          </div>
        </div>

        {/* MAIN WORKFLOW GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 7 COLS: TOPIC SELECTOR & PREP TIMER */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* TOPIC SELECTOR CARD */}
            <div className="p-5 rounded-xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-amber" />
                  <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                    TOPIC SELECTOR
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-amber bg-amber/15 border border-amber/30 px-2.5 py-0.5 rounded-full">
                  DAY {history.length + 1}
                </div>
              </div>

              {/* ACTIVE TOPIC DISPLAY WITH TODAY'S TOPIC BUTTON IN THE MIDDLE */}
              <motion.div 
                key={selectedTopic.id || selectedTopic.topic}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-xl bg-black/60 border border-amber/30 text-center relative overflow-hidden space-y-4"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber/15 text-amber border border-amber/30 font-bold inline-block">
                  {selectedTopic.category || 'General'}
                </span>
                
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-primary leading-snug">
                  "{selectedTopic.topic}"
                </h2>

                {/* TODAY'S TOPIC BUTTON IN CENTER */}
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={handleSelectTodaysTopic}
                    disabled={isShuffling}
                    className="btn btn-primary btn-md font-mono text-xs flex items-center gap-2 font-black tracking-wider uppercase shadow-2xl px-6 py-2.5 bg-amber text-black hover:bg-amber-hover border border-amber-hover transition-all transform hover:scale-105 active:scale-95"
                  >
                    <Shuffle size={16} className={isShuffling ? 'animate-spin' : ''} />
                    <span>{isShuffling ? 'SELECTING...' : '🎯 SELECT TODAY\'S TOPIC'}</span>
                  </button>
                </div>
              </motion.div>

              {/* TOPIC QUICK PICK DIAL */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-muted uppercase tracking-wider font-bold">Topic Bank:</span>
                  <span className="font-mono text-[10px] text-amber">{topics.length} available</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {topics.map((t, idx) => {
                    const isDone = history.some(h => h.topic === t.topic)
                    const isSelected = selectedTopic.topic === t.topic
                    const topicNum = t.id || idx + 1
                    return (
                      <button
                        key={topicNum}
                        onClick={() => {
                          setSelectedTopic(t)
                          handleResetTimer()
                        }}
                        className={`w-7 h-7 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber text-black scale-110 shadow-md ring-2 ring-amber/50'
                            : isDone
                              ? 'bg-success/20 text-success border border-success/40'
                              : 'bg-bg-tertiary text-muted hover:text-primary hover:border-amber/50 border border-border-color'
                        }`}
                        title={`Topic ${topicNum}: ${t.topic}`}
                      >
                        {topicNum}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 10-MINUTE PREP TIMER CARD */}
            <div className="p-5 rounded-xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-info" />
                  <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                    PREPARATION TIMER
                  </span>
                </div>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  isTimerRunning ? 'bg-success/20 text-success border border-success/30 animate-pulse' : 'bg-white/10 text-muted'
                }`}>
                  {isTimerRunning ? 'IN PROGRESS' : 'READY'}
                </span>
              </div>

              {/* TIMER DISPLAY */}
              <div className="flex flex-col items-center justify-center p-6 bg-black/60 rounded-xl border border-white/10 text-center">
                <div className="font-mono text-5xl sm:text-6xl font-black tracking-wider text-primary mb-2 font-mono">
                  {formatTime(timerSeconds)}
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-amber to-success rounded-full"
                    animate={{ width: `${(timerSeconds / 600) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* CONTROLS */}
                <div className="flex items-center gap-3">
                  {!isTimerRunning ? (
                    <button
                      type="button"
                      onClick={handleStartTimer}
                      className="btn btn-primary btn-md font-mono text-xs font-bold px-6 flex items-center gap-2"
                    >
                      <Play size={16} /> START PREP
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseTimer}
                      className="btn btn-warning btn-md font-mono text-xs font-bold px-6 flex items-center gap-2"
                    >
                      <Pause size={16} /> PAUSE
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="btn btn-ghost btn-md font-mono text-xs text-muted hover:text-primary flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> RESET
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT 5 COLS: PROOF & LOG SUBMISSION FORM */}
          <div className="lg:col-span-5">
            <div className="p-5 rounded-xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-xl sticky top-20">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-4 text-purple-400">
                <Video size={18} />
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                  LOG VIDEO PROOF
                </span>
              </div>

              {submitSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-lg bg-success/20 border border-success/40 text-success font-mono text-xs flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>Session Logged! +25 XP Awarded! 🎉</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmitSession} className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-muted mb-1 block">ACTIVE TOPIC (DAY {history.length + 1})</label>
                  <input
                    type="text"
                    readOnly
                    value={`Day ${history.length + 1}: ${selectedTopic.topic}`}
                    className="w-full font-mono text-xs bg-black/60 text-muted border border-white/10 rounded-xl px-3 py-2.5 cursor-not-allowed"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-muted mb-1 block">VIDEO URL (OPTIONAL)</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="https://drive.google.com/file/d/..."
                      value={driveLink}
                      onChange={e => setDriveLink(e.target.value)}
                      className="w-full font-mono text-xs bg-black/50 text-primary border border-white/10 rounded-xl px-3 py-2.5 pl-9 focus:outline-none focus:border-amber transition-colors"
                      style={{ color: '#fff' }}
                    />
                    <LinkIcon size={14} className="absolute left-3 top-3 text-muted" />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-muted mb-1 block">NOTES</label>
                  <textarea
                    rows={3}
                    placeholder="Session reflections & feedback..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full font-mono text-xs bg-black/50 text-primary border border-white/10 rounded-xl p-3 focus:outline-none focus:border-amber transition-colors"
                    style={{ color: '#fff' }}
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-muted mb-1 block">SELF RATING (1 TO 5)</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-2 rounded-xl font-mono text-xs font-bold flex-1 border transition-all flex items-center justify-center gap-1 ${
                          rating >= star
                            ? 'bg-amber/20 border-amber text-amber shadow-sm'
                            : 'bg-black/40 border-white/10 text-muted hover:text-primary'
                        }`}
                      >
                        <Star size={12} className={rating >= star ? 'fill-amber' : ''} />
                        <span>{star}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !driveLink.trim()}
                  className="w-full font-mono text-xs font-bold py-3 flex items-center justify-center gap-2 rounded-xl bg-amber hover:bg-amber-hover text-black shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Award size={16} />
                  <span>{submitting ? 'RECORDING...' : 'LOG PRACTICE SESSION (+25 XP)'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* SESSION HISTORY SECTION */}
        <div className="p-5 rounded-xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-success" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                PRACTICE HISTORY ({history.length})
              </span>
            </div>

            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-black/50 text-primary border border-white/10 rounded-xl px-3 py-1.5 pl-8 font-mono text-xs focus:outline-none focus:border-amber transition-colors"
                style={{ color: '#fff' }}
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted" />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center font-mono text-xs text-muted">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-black/40 border border-dashed border-white/10">
              <Mic size={24} className="mx-auto text-muted mb-2 opacity-50" />
              <div className="font-mono text-xs text-primary font-bold">NO PRACTICE SESSIONS LOGGED YET</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history
                .filter(h => h.topic.toLowerCase().includes(searchQuery.toLowerCase()) || (h.notes && h.notes.toLowerCase().includes(searchQuery.toLowerCase())))
                .map((session, idx) => (
                  <div key={session.id || idx} className="p-4 rounded-xl bg-black/40 border border-border-color hover:border-amber/40 transition-all flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-amber/20 border border-amber/40 text-amber font-bold uppercase">
                            DAY {session.day_number || (history.length - idx)}
                          </span>
                          <span className="font-mono text-[9px] text-muted font-semibold">
                            {session.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber">
                          <Star size={11} className="fill-amber" />
                          <span className="font-mono text-[10px] font-bold">{session.rating || 5}/5</span>
                        </div>
                      </div>
                      
                      <h3 className="font-mono text-xs font-bold text-primary leading-snug line-clamp-2">
                        "{session.topic}"
                      </h3>

                      {session.notes && (
                        <p className="font-mono text-[10px] text-muted mt-2 line-clamp-3 leading-relaxed">
                          {session.notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="font-mono text-[9px] text-muted">
                        Prep: {session.prep_duration_minutes || 10}m
                      </span>

                      {session.drive_link && (
                        <a
                          href={session.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-xs font-mono text-[10px] text-amber hover:text-amber-hover flex items-center gap-1 font-bold"
                        >
                          <span>VIEW VIDEO</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
