'use client'

import { useState, useEffect, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import { getLocalDateStr } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useOS } from '@/lib/context/OSContext'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Play, Pause, RotateCcw, Shuffle, Video, Link as LinkIcon,
  CheckCircle2, Clock, Calendar, Sparkles, Award, ExternalLink,
  BookOpen, Star, Search
} from 'lucide-react'

// Pre-loaded 30-Day Speaking Challenge Topics
const DEFAULT_30_TOPICS = [
  { day: 1, topic: 'Explain quantum computing to a 12-year-old.', category: 'Tech & Science' },
  { day: 2, topic: 'Why do countries have inflation?', category: 'Economics' },
  { day: 3, topic: 'How does CRISPR gene editing work?', category: 'BioTech & Science' },
  { day: 4, topic: 'Why do airplanes fly?', category: 'Engineering' },
  { day: 5, topic: 'How does GPS know your location?', category: 'Technology' },
  { day: 6, topic: 'Explain the Internet from scratch.', category: 'Technology' },
  { day: 7, topic: 'Why did the Roman Empire collapse?', category: 'History' },
  { day: 8, topic: 'How does a nuclear power plant work?', category: 'Physics & Energy' },
  { day: 9, topic: 'What makes a great teacher?', category: 'Education & Human' },
  { day: 10, topic: 'Why do humans procrastinate?', category: 'Psychology' },
  { day: 11, topic: 'How does Bitcoin actually work?', category: 'Finance & Crypto' },
  { day: 12, topic: 'Why do startups fail?', category: 'Business & Entrepreneurship' },
  { day: 13, topic: 'Explain machine learning without using the words "AI" or "computer."', category: 'Technology' },
  { day: 14, topic: 'How do vaccines train the immune system?', category: 'Biology & Health' },
  { day: 15, topic: 'Why do tsunamis happen?', category: 'Earth Science' },
  { day: 16, topic: 'What is game theory?', category: 'Strategy & Math' },
  { day: 17, topic: 'How does Formula 1 make a pit stop in under 2 seconds?', category: 'Engineering & Operations' },
  { day: 18, topic: 'Why do people trust brands?', category: 'Marketing & Psychology' },
  { day: 19, topic: 'Explain evolution without mentioning monkeys.', category: 'Biology' },
  { day: 20, topic: 'How does the stock market work?', category: 'Finance' },
  { day: 21, topic: 'Why do black holes exist?', category: 'Astrophysics' },
  { day: 22, topic: 'What makes ideas go viral?', category: 'Media & Marketing' },
  { day: 23, topic: 'How do Pixar movies tell stories so well?', category: 'Storytelling & Art' },
  { day: 24, topic: 'Explain cloud computing to your grandparents.', category: 'Technology' },
  { day: 25, topic: 'Why do civilizations rise and fall?', category: 'History & Philosophy' },
  { day: 26, topic: 'How does Google Search find answers in milliseconds?', category: 'Computer Science' },
  { day: 27, topic: 'What makes a speech memorable?', category: 'Communication & Oratory' },
  { day: 28, topic: 'Explain the greenhouse effect simply.', category: 'Environment & Climate' },
  { day: 29, topic: 'How does SpaceX land rockets?', category: 'Aerospace Engineering' },
  { day: 30, topic: 'What is leverage, and why is it Naval Ravikant\'s favorite concept?', category: 'Mental Models & Wealth' }
]

export default function SpeakingPracticePage() {
  const { user } = useAuth()
  const { xp: { awardXP } } = useOS()

  // State Management
  const [topics] = useState(DEFAULT_30_TOPICS)
  const [selectedTopic, setSelectedTopic] = useState(DEFAULT_30_TOPICS[0])
  const [isShuffling, setIsShuffling] = useState(false)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

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

  // Fetch History from Supabase
  useEffect(() => {
    async function loadData() {
      if (!user) return
      setLoading(true)
      const sb = createClient()

      try {
        const { data, error } = await sb
          .from('speaking_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!error && data) {
          setHistory(data)
        } else {
          // Fallback to local storage if table doesn't exist yet
          const localData = localStorage.getItem(`lokios_speaking_logs_${user.id}`)
          if (localData) setHistory(JSON.parse(localData))
        }
      } catch (err) {
        console.warn('Fallback loading speaking logs', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

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

  // Random Topic Picker
  const handleRandomTopic = () => {
    setIsShuffling(true)
    let count = 0
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * topics.length)
      setSelectedTopic(topics[randomIndex])
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
    e.preventDefault()
    if (!user || !selectedTopic) return
    setSubmitting(true)

    const sb = createClient()
    const prepDurationMinutes = Math.round((600 - timerSeconds) / 60)

    const newLog = {
      user_id: user.id,
      date: todayStr,
      topic: selectedTopic.topic,
      category: selectedTopic.category || 'General',
      day_number: selectedTopic.day || null,
      prep_duration_minutes: prepDurationMinutes > 0 ? prepDurationMinutes : 10,
      drive_link: driveLink.trim(),
      notes: notes.trim(),
      rating: parseInt(rating) || 5,
      created_at: new Date().toISOString()
    }

    try {
      const { data, error } = await sb
        .from('speaking_logs')
        .insert(newLog)
        .select()
        .single()

      if (!error && data) {
        setHistory(prev => [data, ...prev])
      } else {
        // Fallback local persistence
        const updated = [newLog, ...history]
        setHistory(updated)
        localStorage.setItem(`lokios_speaking_logs_${user.id}`, JSON.stringify(updated))
      }

      setSubmitSuccess(true)
      setDriveLink('')
      setNotes('')
      setTimeout(() => setSubmitSuccess(false), 4000)
    } catch (err) {
      console.error('Failed to log speaking session', err)
    } finally {
      setSubmitting(false)
    }
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
              <p className="font-mono text-xs text-muted max-w-xl mt-1 leading-relaxed">
                Select a topic, hit the 10-minute countdown to prep your ideas, record yourself in front of the camera, and paste your video proof link!
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-center min-w-[100px]">
                <div className="font-mono text-xl font-bold text-amber">{uniqueTopicsCompleted}/30</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Days Done</div>
              </div>
              <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-center min-w-[100px]">
                <div className="font-mono text-xl font-bold text-success">{totalSessions}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Total Videos</div>
              </div>
              <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-center min-w-[100px]">
                <div className="font-mono text-xl font-bold text-purple-400">⭐ {avgRating}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Avg Self Score</div>
              </div>
            </div>
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
                    TOPIC SELECTOR // DAY {selectedTopic.day || '?'} OF 30
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRandomTopic}
                  disabled={isShuffling}
                  className="btn btn-primary btn-sm font-mono text-xs flex items-center gap-1.5 font-bold shadow-lg"
                >
                  <Shuffle size={14} className={isShuffling ? 'animate-spin' : ''} />
                  <span>{isShuffling ? 'SHUFFLING...' : 'RANDOM TOPIC'}</span>
                </button>
              </div>

              {/* ACTIVE TOPIC DISPLAY */}
              <motion.div 
                key={selectedTopic.day}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl bg-black/60 border border-amber/30 text-center relative overflow-hidden"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber/15 text-amber border border-amber/30 font-bold mb-3 inline-block">
                  {selectedTopic.category} • DAY {selectedTopic.day}
                </span>
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-primary leading-snug">
                  "{selectedTopic.topic}"
                </h2>
              </motion.div>

              {/* TOPIC QUICK PICK DIAL */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-muted uppercase tracking-wider">Jump to Day (1–30):</span>
                  <span className="font-mono text-[10px] text-amber">{topics.length} topics available</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {topics.map((t) => {
                    const isDone = history.some(h => h.topic === t.topic)
                    const isSelected = selectedTopic.day === t.day
                    return (
                      <button
                        key={t.day}
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
                        title={`Day ${t.day}: ${t.topic}`}
                      >
                        {t.day}
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
                    PREPARATION TIMER // 10 MINUTES
                  </span>
                </div>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  isTimerRunning ? 'bg-success/20 text-success border border-success/30 animate-pulse' : 'bg-white/10 text-muted'
                }`}>
                  {isTimerRunning ? 'PREP IN PROGRESS' : 'PAUSED / READY'}
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
                      <Play size={16} /> START 10-MIN PREP
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseTimer}
                      className="btn btn-warning btn-md font-mono text-xs font-bold px-6 flex items-center gap-2"
                    >
                      <Pause size={16} /> PAUSE PREP
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
                  <span>Practice Session Recorded! 🎉</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmitSession} className="space-y-4">
                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">ACTIVE TOPIC</label>
                  <input
                    type="text"
                    readOnly
                    value={`Day ${selectedTopic.day}: ${selectedTopic.topic}`}
                    className="input w-full font-mono text-xs bg-black/40 text-muted cursor-not-allowed border-white/10"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">GOOGLE DRIVE / VIDEO URL *</label>
                  <div className="relative">
                    <input
                      type="url"
                      required
                      placeholder="https://drive.google.com/file/d/..."
                      value={driveLink}
                      onChange={e => setDriveLink(e.target.value)}
                      className="input w-full font-mono text-xs pl-8"
                    />
                    <LinkIcon size={14} className="absolute left-2.5 top-3 text-muted" />
                  </div>
                  <span className="font-mono text-[9px] text-muted mt-1 block">Upload your recording to Google Drive & paste public link here</span>
                </div>

                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">SPEAKING NOTES & TAKEAWAYS</label>
                  <textarea
                    rows={3}
                    placeholder="Key talking points, main argument, or areas for delivery improvement..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="textarea w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted mb-1 block">SELF-RATING / CONFIDENCE (1 TO 5)</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-2 rounded-lg font-mono text-xs font-bold flex-1 border transition-all flex items-center justify-center gap-1 ${
                          rating >= star
                            ? 'bg-amber/20 border-amber text-amber'
                            : 'bg-black/40 border-border-color text-muted'
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
                  className="btn btn-primary btn-md w-full font-mono text-xs font-bold py-3 flex items-center justify-center gap-2 shadow-xl"
                >
                  <Award size={16} />
                  <span>{submitting ? 'RECORDING SESSION...' : 'LOG PRACTICE SESSION'}</span>
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
                PRACTICE HISTORY & VIDEO PROOF ARCHIVE ({history.length})
              </span>
            </div>

            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search topic or notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input w-full font-mono text-xs pl-8 py-1.5"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted" />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center font-mono text-xs text-muted">Loading speaking history...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-black/40 border border-dashed border-white/10">
              <Mic size={24} className="mx-auto text-muted mb-2 opacity-50" />
              <div className="font-mono text-xs text-primary font-bold">NO PRACTICE SESSIONS LOGGED YET</div>
              <p className="font-mono text-[10px] text-muted mt-1">Pick Day 1 topic above, prep for 10 minutes, and paste your video link!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history
                .filter(h => h.topic.toLowerCase().includes(searchQuery.toLowerCase()) || (h.notes && h.notes.toLowerCase().includes(searchQuery.toLowerCase())))
                .map((session, idx) => (
                  <div key={session.id || idx} className="p-4 rounded-xl bg-black/40 border border-border-color hover:border-amber/40 transition-all flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-white/10 text-muted font-bold">
                          {session.date}
                        </span>
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
