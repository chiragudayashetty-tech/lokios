'use client'

import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import { getLocalDateStr } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useOS } from '@/lib/context/OSContext'
import { robustAwardXP } from '@/lib/utils/xpFallback'
import { getSpeakingRestDays, setSpeakingRestDays, isSpeakingRestDay } from '@/lib/utils/restDays'
import { evaluateProtocolAutoFail } from '@/lib/utils/protocolAutoFail'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Shuffle, Video, Link as LinkIcon,
  CheckCircle2, Calendar, Sparkles, Award, ExternalLink,
  BookOpen, Star, Search, List, LayoutGrid, Copy, Check,
  Edit3, Compass, Flame, ArrowRight, Zap, Target, X, ArrowDown, ArrowUp
} from 'lucide-react'

// Known Speaking Practice habit ID in database
const SPEAKING_HABIT_ID = '479ec4f0-01e5-4df9-8d1b-2b7b5dd56153'

// 10 Situation Challenges (Topic-Independent Modifiers)
export const SITUATION_CHALLENGES = [
  {
    id: 1,
    title: 'The 30-Second Clock',
    short: '30s Clock',
    icon: 'Clock',
    color: '#f59e0b',
    description: 'You have 30 seconds to explain your topic.',
    rules: 'No rushing. You need to decide what matters.'
  },
  {
    id: 2,
    title: 'Explain It to a 12-Year-Old',
    short: '12-Year-Old',
    icon: 'Smile',
    color: '#3b82f6',
    description: 'You have to explain the topic so a 12-year-old understands it.',
    rules: 'No jargon. Use simple analogies and zero buzzwords.'
  },
  {
    id: 3,
    title: 'The Skeptic',
    short: 'The Skeptic',
    icon: 'AlertTriangle',
    color: '#ef4444',
    description: 'Imagine the person listening says: "I don\'t think that\'s true."',
    rules: 'Continue for another 90 seconds, addressing the skepticism.'
  },
  {
    id: 4,
    title: "You're Wrong",
    short: "You're Wrong",
    icon: 'RotateCcw',
    color: '#8b5cf6',
    description: 'Halfway through your explanation, stop and say: "Actually, I might be wrong about this."',
    rules: 'Then reconsider your argument and continue. Intellectual flexibility, not pretending uncertainty.'
  },
  {
    id: 5,
    title: 'The Unexpected Question',
    short: 'Unexpected Q',
    icon: 'HelpCircle',
    color: '#ec4899',
    description: 'Stop your explanation halfway and ask yourself a completely unrelated question.',
    rules: 'Example: "How would this change if everyone suddenly had ₹10 crore?" Answer it for 30s, then return.'
  },
  {
    id: 6,
    title: 'Make It Interesting',
    short: 'Killer Hook',
    icon: 'Sparkles',
    color: '#10b981',
    description: 'You are allowed 30 seconds to create an opening hook.',
    rules: 'You CANNOT start with: "Today I\'m going to talk about...". Make someone want to keep listening.'
  },
  {
    id: 7,
    title: 'The Extreme Example',
    short: 'Extreme Ex',
    icon: 'Flame',
    color: '#f97316',
    description: 'Explain the topic using an extreme hypothetical situation.',
    rules: 'Example: "Imagine this happened to every person in India tomorrow..." Then build the explanation around it.'
  },
  {
    id: 8,
    title: 'Change Your Position',
    short: 'Change Position',
    icon: 'Repeat',
    color: '#06b6d4',
    description: 'Explain your initial position for two minutes.',
    rules: 'Then deliberately argue against your own position for one minute. Painful in exactly the useful way.'
  },
  {
    id: 9,
    title: 'No Restart',
    short: 'No Restart',
    icon: 'Video',
    color: '#eab308',
    description: 'You get one take.',
    rules: 'If you forget a word, lose structure, repeat yourself or make a mistake: recover and continue. No editing fairy.'
  },
  {
    id: 10,
    title: 'Real-World Mode',
    short: 'Real-World',
    icon: 'Compass',
    color: '#84cc16',
    description: 'You cannot use your normal desk setup.',
    rules: 'Record outside, standing, walking slowly, somewhere unfamiliar or in a different room. Poise under uncontrolled variables.'
  }
]

// 90 Curated High-Impact Topics across 3 Mastery Seasons
const CURATED_TOPICS = [
  // ── PHASE 1: FOUNDATION & CONCEPTUAL CLARITY (DAYS 1–30) ──
  { id: 1, phase: 1, topic: 'Explain quantum computing to a 12-year-old.', category: 'Tech & Science' },
  { id: 2, phase: 1, topic: 'Why do countries have inflation?', category: 'Economics' },
  { id: 3, phase: 1, topic: 'How does CRISPR gene editing work?', category: 'BioTech & Science' },
  { id: 4, phase: 1, topic: 'Why do airplanes fly?', category: 'Engineering' },
  { id: 5, phase: 1, topic: 'How does GPS know your location?', category: 'Technology' },
  { id: 6, phase: 1, topic: 'Explain the Internet from scratch.', category: 'Technology' },
  { id: 7, phase: 1, topic: 'Why did the Roman Empire collapse?', category: 'History' },
  { id: 8, phase: 1, topic: 'How does a nuclear power plant work?', category: 'Physics & Energy' },
  { id: 9, phase: 1, topic: 'What makes a great teacher?', category: 'Education & Human' },
  { id: 10, phase: 1, topic: 'Why do humans procrastinate?', category: 'Psychology' },
  { id: 11, phase: 1, topic: 'How does Bitcoin actually work?', category: 'Finance & Crypto' },
  { id: 12, phase: 1, topic: 'Why do startups fail?', category: 'Business & Entrepreneurship' },
  { id: 13, phase: 1, topic: 'Explain machine learning without using the words "AI" or "computer."', category: 'Technology' },
  { id: 14, phase: 1, topic: 'How do vaccines train the immune system?', category: 'Biology & Health' },
  { id: 15, phase: 1, topic: 'Why do tsunamis happen?', category: 'Earth Science' },
  { id: 16, phase: 1, topic: 'What is game theory?', category: 'Strategy & Math' },
  { id: 17, phase: 1, topic: 'How does Formula 1 make a pit stop in under 2 seconds?', category: 'Engineering & Operations' },
  { id: 18, phase: 1, topic: 'Why do people trust brands?', category: 'Marketing & Psychology' },
  { id: 19, phase: 1, topic: 'Explain evolution without mentioning monkeys.', category: 'Biology' },
  { id: 20, phase: 1, topic: 'How does the stock market work?', category: 'Finance' },
  { id: 21, phase: 1, topic: 'Why do black holes exist?', category: 'Astrophysics' },
  { id: 22, phase: 1, topic: 'What makes ideas go viral?', category: 'Media & Marketing' },
  { id: 23, phase: 1, topic: 'How do Pixar movies tell stories so well?', category: 'Storytelling & Art' },
  { id: 24, phase: 1, topic: 'Explain cloud computing to your grandparents.', category: 'Technology' },
  { id: 25, phase: 1, topic: 'Why do civilizations rise and fall?', category: 'History & Philosophy' },
  { id: 26, phase: 1, topic: 'How does Google Search find answers in milliseconds?', category: 'Computer Science' },
  { id: 27, phase: 1, topic: 'What makes a speech memorable?', category: 'Communication & Oratory' },
  { id: 28, phase: 1, topic: 'Explain the greenhouse effect simply.', category: 'Environment & Climate' },
  { id: 29, phase: 1, topic: 'How does SpaceX land rockets?', category: 'Aerospace Engineering' },
  { id: 30, phase: 1, topic: 'What is leverage, and why is it Naval Ravikant\'s favorite concept?', category: 'Mental Models & Wealth' },

  // ── PHASE 2: PERSUASION, ARGUMENT STRUCTURE & CRITICAL REASONING (DAYS 31–60) ──
  { id: 31, phase: 2, topic: 'Why do people pay for convenience?', category: 'Business & Psychology' },
  { id: 32, phase: 2, topic: 'What makes an AI product genuinely useful?', category: 'AI & Product Utility' },
  { id: 33, phase: 2, topic: 'Why do some businesses grow while others stay small?', category: 'Business Strategy' },
  { id: 34, phase: 2, topic: 'Will AI make creativity more valuable or less valuable?', category: 'Creativity & AI' },
  { id: 35, phase: 2, topic: 'Why do people buy something they don\'t actually need?', category: 'Consumer Psychology' },
  { id: 36, phase: 2, topic: 'How does a company decide what NOT to build?', category: 'Product Strategy' },
  { id: 37, phase: 2, topic: 'Why is distribution so difficult?', category: 'Go-To-Market & Sales' },
  { id: 38, phase: 2, topic: 'Can education become a product?', category: 'Education & Markets' },
  { id: 39, phase: 2, topic: 'Why do people abandon products after initially liking them?', category: 'Product Retention' },
  { id: 40, phase: 2, topic: 'What makes an idea commercially valuable?', category: 'Economics & Wealth' },
  { id: 41, phase: 2, topic: 'Will AI reduce the value of memorization?', category: 'Cognition & Learning' },
  { id: 42, phase: 2, topic: 'Why do people trust experts?', category: 'Social Psychology' },
  { id: 43, phase: 2, topic: 'What makes a customer switch from one product to another?', category: 'Customer Behavior' },
  { id: 44, phase: 2, topic: 'Why do free products sometimes make more money than paid products?', category: 'Business Models' },
  { id: 45, phase: 2, topic: 'What happens when technology moves faster than education?', category: 'Future & Society' },
  { id: 46, phase: 2, topic: 'Why is attention becoming an economic resource?', category: 'Attention Economy' },
  { id: 47, phase: 2, topic: 'How would you build a business around a problem nobody thinks is important?', category: 'Contrarian Innovation' },
  { id: 48, phase: 2, topic: 'Why do people confuse popularity with quality?', category: 'Critical Thinking' },
  { id: 49, phase: 2, topic: 'What makes a product addictive without being harmful?', category: 'Product Design & Ethics' },
  { id: 50, phase: 2, topic: 'Should every teenager learn how to use AI?', category: 'AI & Education' },
  { id: 51, phase: 2, topic: 'Why can having too many features make a product worse?', category: 'Product Simplicity' },
  { id: 52, phase: 2, topic: 'How do you know whether a problem is worth solving?', category: 'Problem Selection' },
  { id: 53, phase: 2, topic: 'Why do some people learn faster than others?', category: 'Learning & Cognition' },
  { id: 54, phase: 2, topic: 'What happens when everyone has access to the same AI tools?', category: 'AI & Competition' },
  { id: 55, phase: 2, topic: 'Why does pricing change how people perceive value?', category: 'Pricing Psychology' },
  { id: 56, phase: 2, topic: 'What makes someone good at selling without being pushy?', category: 'Sales & Influence' },
  { id: 57, phase: 2, topic: 'Can a small company compete with a much larger company?', category: 'Strategy & Agility' },
  { id: 58, phase: 2, topic: 'What would make an AI education business difficult to scale?', category: 'EdTech & Scaling' },
  { id: 59, phase: 2, topic: 'Why do people resist learning things that could benefit them?', category: 'Human Psychology' },
  { id: 60, phase: 2, topic: 'If you had ₹1 crore to build a company, what would you do first?', category: 'Capital Allocation' },

  // ── PHASE 3: HIGH-STAKES VISION, DEEP DEBATE & MASTERY (DAYS 61–90) ──
  { id: 61, phase: 3, topic: 'What is an economic moat, and how do modern tech companies construct them?', category: 'Business & Moats' },
  { id: 62, phase: 3, topic: 'Can artificial intelligence ever possess authentic subjective consciousness?', category: 'Cognitive Science & AI' },
  { id: 63, phase: 3, topic: 'How did the Gutenberg printing press spark both enlightenment and 100 years of war?', category: 'History & Media' },
  { id: 64, phase: 3, topic: 'Explain second-order thinking and why most people only react to first-order effects.', category: 'Mental Models' },
  { id: 65, phase: 3, topic: 'How does the adaptive immune system store memory for viruses decades later?', category: 'Immunology & Health' },
  { id: 66, phase: 3, topic: 'What is the tragedy of the commons, and how can governance solve it?', category: 'Economics & Governance' },
  { id: 67, phase: 3, topic: 'Why do high-performers suffer catastrophic burnout, and how is it prevented?', category: 'Peak Performance' },
  { id: 68, phase: 3, topic: 'Explain entropy and the arrow of time to someone with no physics background.', category: 'Thermodynamics' },
  { id: 69, phase: 3, topic: 'How does central banking use interest rates to steer an entire nation\'s economy?', category: 'Macroeconomics' },
  { id: 70, phase: 3, topic: 'What makes Steve Jobs\' 2005 Stanford commencement address so timeless?', category: 'Oratory Analysis' },
  { id: 71, phase: 3, topic: 'The Dunbar Number: Why humans can only maintain 150 stable relationships.', category: 'Anthropology & Sociology' },
  { id: 72, phase: 3, topic: 'What is asymmetry of risk and reward, and how do you position for positive black swans?', category: 'Risk & Wealth' },
  { id: 73, phase: 3, topic: 'How does utility-scale grid battery storage balance solar and wind intermittency?', category: 'Clean Energy' },
  { id: 74, phase: 3, topic: 'Why is clarity of speech impossible without clarity of thought?', category: 'Cognition & Writing' },
  { id: 75, phase: 3, topic: 'Explain the bystander effect and how an individual leader breaks the paralysis.', category: 'Social Psychology' },
  { id: 76, phase: 3, topic: 'How do satellite constellations like Starlink achieve low-latency global broadband?', category: 'Aerospace & Networks' },
  { id: 77, phase: 3, topic: 'Goodhart\'s Law: "When a metric becomes the target, it ceases to be a good metric."', category: 'Systems Dynamics' },
  { id: 78, phase: 3, topic: 'How can ancient Stoic principles cure modern digital overwhelm and anxiety?', category: 'Practical Philosophy' },
  { id: 79, phase: 3, topic: 'Why do lean startups frequently defeat incumbents with 100x more capital?', category: 'Disruptive Innovation' },
  { id: 80, phase: 3, topic: 'Explain the Doppler effect using sounds we hear on a city street.', category: 'Physics' },
  { id: 81, phase: 3, topic: 'What is the strategic power of vulnerability in high-stakes executive leadership?', category: 'Executive Leadership' },
  { id: 82, phase: 3, topic: 'How does the human gut microbiome directly regulate mood and neurotransmitters?', category: 'Biology & Brain' },
  { id: 83, phase: 3, topic: 'Why do sovereign nations run trillion-dollar debts, and when does it become dangerous?', category: 'Public Finance' },
  { id: 84, phase: 3, topic: 'How does the Socratic method systematically dismantle dogmatic assumptions?', category: 'Philosophy & Debate' },
  { id: 85, phase: 3, topic: 'What is the distinction between a missionary founder and a mercenary founder?', category: 'Company Culture' },
  { id: 86, phase: 3, topic: 'How do deep-sea creatures survive under thousands of atmospheres of pressure?', category: 'Oceanography' },
  { id: 87, phase: 3, topic: 'Parkinson\'s Law: "Work expands to fill the time available for its completion."', category: 'Execution & Time' },
  { id: 88, phase: 3, topic: 'Why is emotional regulation under public scrutiny the ultimate executive skill?', category: 'Emotional Mastery' },
  { id: 89, phase: 3, topic: 'How do semiconductor photolithography machines turn pure silicon into intelligence?', category: 'Hardware Engineering' },
  { id: 90, phase: 3, topic: 'Day 90 Capstone: Reflect on your speaking evolution from Day 1 to Day 90.', category: 'Mastery Capstone' }
]

export default function SpeakingPracticePage() {
  const { user } = useAuth()
  const { xp: { awardXP, fetchMomentum } = {}, habits: { toggleHabitForDate, habits: osHabits } = {} } = useOS() || {}

  // Topics & Active State
  const [topics] = useState(CURATED_TOPICS)
  const [selectedTopic, setSelectedTopic] = useState(CURATED_TOPICS[30] || CURATED_TOPICS[0]) // Default to Phase 2 (Day 31)
  const [activePhase, setActivePhase] = useState(2) // Default to Phase 2
  const [selectedSituation, setSelectedSituation] = useState(null)
  const [isCustomTopic, setIsCustomTopic] = useState(false)
  const [customTopicInput, setCustomTopicInput] = useState('')
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [isShuffling, setIsShuffling] = useState(false)
  
  // Data State
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [restDays, setRestDaysState] = useState(getSpeakingRestDays())

  // Form State
  const [driveLink, setDriveLink] = useState('')
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // View & Filter State
  const [activeTab, setActiveTab] = useState('directory') // 'directory' | 'cards'
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' (New to Old) | 'asc' (Old to New)
  const [topicBankPhase, setTopicBankPhase] = useState(2)
  const [copiedAll, setCopiedAll] = useState(false)

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

        // Build a date-keyed map (date is the canonical dedup key)
        const mapByDate = new Map()

        // 1. Add speaking_logs (indexed by date)
        speakingData.forEach(item => {
          if (item.date) {
            if (!mapByDate.has(item.date) || (!mapByDate.get(item.date).drive_link && item.drive_link)) {
              mapByDate.set(item.date, item)
            }
          }
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
              drive_link: (w.media_urls && w.media_urls[0]) || '',
              notes: w.description || '',
              rating: 5,
              created_at: w.created_at || new Date().toISOString()
            })
          }
        })

        // 3. Sync any genuinely missing local logs
        const cloudDates = new Set(speakingData.map(s => s.date).filter(Boolean))
        for (const item of localLogs) {
          if (!item.date) continue
          if (cloudDates.has(item.date)) {
            if (!mapByDate.has(item.date)) mapByDate.set(item.date, item)
          } else {
            mapByDate.set(item.date, item)
            const { error: pushErr } = await sb.from('speaking_logs').insert({
              user_id: userId,
              date: item.date,
              topic: item.topic || 'Speaking Practice',
              category: item.category || 'General',
              day_number: item.day_number || 1,
              prep_duration_minutes: 0,
              drive_link: item.drive_link || '',
              notes: item.notes || '',
              rating: item.rating || 5,
              created_at: item.created_at || new Date().toISOString()
            })
            if (!pushErr) {
              cloudDates.add(item.date)
            }
          }
        }

        const merged = Array.from(mapByDate.values()).sort((a, b) =>
          new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
        )

        setHistory(merged)
        localStorage.setItem(`lokios_speaking_logs_${userId}`, JSON.stringify(merged))

        // Set default next topic based on uncompleted topics
        const completedTopicTitles = new Set(merged.map(h => h.topic))
        const nextTopic = CURATED_TOPICS.find(t => !completedTopicTitles.has(t.topic))
        if (nextTopic) {
          setSelectedTopic(nextTopic)
        }
      } catch (err) {
        console.warn('Fallback loading speaking logs', err)
        const localRaw = localStorage.getItem(`lokios_speaking_logs_${userId}`)
        if (localRaw) setHistory(JSON.parse(localRaw))
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-Time Sync Listener
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

  // Switch Phase Dropdown Handler (Locks Phase 3)
  const handlePhaseChange = (newPhase) => {
    if (newPhase === 3 && history.length < 60) return // Phase 3 is locked!
    setActivePhase(newPhase)
    setTopicBankPhase(newPhase)
    const completedSet = new Set(history.map(h => h.topic))
    const phaseTopics = topics.filter(t => t.phase === newPhase)
    const uncompleted = phaseTopics.filter(t => !completedSet.has(t.topic))
    const nextPick = uncompleted.length > 0 ? uncompleted[0] : phaseTopics[0]
    if (nextPick) {
      setSelectedTopic(nextPick)
      setIsCustomTopic(false)
    }
  }

  // Pick Next / Random Topic (Picks ONLY from uncompleted topics in activePhase)
  const handleSelectTodaysTopic = () => {
    setIsShuffling(true)
    setIsCustomTopic(false)
    let count = 0
    const completedSet = new Set(history.map(h => h.topic))
    const uncompletedInPhase = topics.filter(t => t.phase === activePhase && !completedSet.has(t.topic))
    const pool = uncompletedInPhase.length > 0 
      ? uncompletedInPhase 
      : topics.filter(t => !completedSet.has(t.topic))

    if (pool.length === 0) {
      setIsShuffling(false)
      return
    }

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * pool.length)
      setSelectedTopic(pool[randomIndex])
      count++
      if (count > 10) {
        clearInterval(interval)
        setIsShuffling(false)
      }
    }, 80)
  }

  // Apply Custom Topic
  const handleApplyCustomTopic = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!customTopicInput.trim()) return
    setSelectedTopic({
      id: 999,
      topic: customTopicInput.trim(),
      category: customCategoryInput.trim() || 'Custom Topic',
      phase: history.length < 30 ? 1 : 2
    })
    setIsCustomTopic(false)
  }

  // Submit Practice Session with 100% Reliable XP & Habit Sync
  const handleSubmitSession = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!user || !selectedTopic) return
    setSubmitting(true)

    const sb = createClient()
    const currentDayNumber = history.length + 1

    let formattedLink = driveLink.trim()
    if (formattedLink && !formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
      formattedLink = `https://${formattedLink}`
    }

    // Attach Situation Challenge to notes if selected
    const situationPrefix = selectedSituation ? `[Challenge: ${selectedSituation.title}] ` : ''
    const combinedNotes = (situationPrefix + notes.trim()).trim()

    const newLog = {
      user_id: user.id,
      date: todayStr,
      topic: selectedTopic.topic,
      category: selectedTopic.category || 'General',
      day_number: currentDayNumber,
      prep_duration_minutes: 0,
      drive_link: formattedLink,
      notes: combinedNotes,
      rating: parseInt(rating) || 5,
      created_at: new Date().toISOString()
    }

    // 1. Instant Optimistic UI Update & Local Cache
    const localRaw = localStorage.getItem(`lokios_speaking_logs_${user.id}`)
    const localLogs = localRaw ? JSON.parse(localRaw) : []
    const updatedLocal = [newLog, ...localLogs.filter(l => l.date !== todayStr)]
    localStorage.setItem(`lokios_speaking_logs_${user.id}`, JSON.stringify(updatedLocal))
    setHistory(updatedLocal)
    setSubmitSuccess(true)
    setDriveLink('')
    setNotes('')
    setSubmitting(false)
    setTimeout(() => setSubmitSuccess(false), 5000)

    // 2. Perform authoritative saves concurrently in background without blocking UI
    ;(async () => {
      try {
        const speakingHabit = (osHabits || []).find(h => h.id === SPEAKING_HABIT_ID || h.title?.toLowerCase().includes('speaking')) || { id: SPEAKING_HABIT_ID }
        const habitId = speakingHabit.id

        await Promise.allSettled([
          sb.from('speaking_logs').insert(newLog),
          robustAwardXP(
            user.id,
            25,
            'habit_complete',
            `habit_${habitId}_${todayStr}`,
            `Completed routine: Speaking Practice - Day ${currentDayNumber}`,
            'founder',
            new Date().toISOString()
          ),
          sb.from('habit_logs').upsert({
            user_id: user.id,
            habit_id: habitId,
            date: todayStr,
            status: 'completed',
            completed: true
          }, { onConflict: 'habit_id,date' })
        ])

        if (toggleHabitForDate) {
          try { await toggleHabitForDate(habitId, todayStr, 'completed') } catch (e) {}
        }
        if (fetchMomentum) {
          try { await fetchMomentum() } catch (e) {}
        }
      } catch (err) {
        console.error('[Speaking Background Sync] Error:', err)
      }
    })()
  }

  // Calculate statistics
  const totalSessions = history.length
  const uniqueTopicsCompleted = new Set(history.map(h => h.topic)).size
  const avgRating = totalSessions > 0
    ? (history.reduce((acc, h) => acc + (h.rating || 5), 0) / totalSessions).toFixed(1)
    : '5.0'

  // Completed Topics Set
  const completedTopicTitles = useMemo(() => new Set(history.map(h => h.topic)), [history])

  // Available Topics in Active Phase (Excludes Completed Topics!)
  const availableTopicsInPhase = useMemo(() => {
    return topics.filter(t => t.phase === activePhase && !completedTopicTitles.has(t.topic))
  }, [topics, activePhase, completedTopicTitles])

  // Chronological Completed Topics (Day 1 -> Day N) with persistent computed_day
  const completedTopicsChronological = useMemo(() => {
    const sorted = [...history].sort((a, b) => {
      const dayA = a.day_number || 0
      const dayB = b.day_number || 0
      if (dayA !== 0 && dayB !== 0 && dayA !== dayB) return dayA - dayB
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
    return sorted.map((item, idx) => ({
      ...item,
      computed_day: item.day_number || idx + 1
    }))
  }, [history])

  // Filtered and Sorted Completed Topics (Search + New-to-Old / Old-to-New)
  const filteredCompletedTopics = useMemo(() => {
    let list = completedTopicsChronological

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(item =>
        (item.topic && item.topic.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        String(item.computed_day || item.day_number).includes(q)
      )
    }

    if (sortOrder === 'desc') {
      // New to Old (Latest date / highest day first)
      return [...list].sort((a, b) => {
        const timeA = new Date(a.date).getTime()
        const timeB = new Date(b.date).getTime()
        if (timeA !== timeB) return timeB - timeA
        return (b.computed_day || b.day_number || 0) - (a.computed_day || a.day_number || 0)
      })
    } else {
      // Old to New (Earliest date / lowest day first)
      return [...list].sort((a, b) => {
        const timeA = new Date(a.date).getTime()
        const timeB = new Date(b.date).getTime()
        if (timeA !== timeB) return timeA - timeB
        return (a.computed_day || a.day_number || 0) - (b.computed_day || b.day_number || 0)
      })
    }
  }, [completedTopicsChronological, searchQuery, sortOrder])

  // Helper to extract challenge title from notes if present
  const extractChallengeFromNotes = (notesText = '') => {
    if (!notesText) return null
    const match = notesText.match(/\[Challenge:\s*([^\]]+)\]/i)
    return match ? match[1] : null
  }

  // Clean notes without the [Challenge: ...] prefix for display
  const cleanNotesDisplay = (notesText = '') => {
    if (!notesText) return ''
    return notesText.replace(/\[Challenge:\s*[^\]]+\]\s*/i, '')
  }

  // Copy Completed Topics List to Clipboard
  const handleCopyCompletedList = () => {
    const lines = [
      `# Loki OS — Speaking Practice Completed Topics (${filteredCompletedTopics.length} Sessions)`,
      `Average Rating: ${avgRating} / 5.0 ⭐ | Order: ${sortOrder === 'desc' ? 'Newest to Oldest' : 'Oldest to Newest'}`,
      '',
      ...filteredCompletedTopics.map((item, idx) => {
        const dayNum = item.computed_day || item.day_number || idx + 1
        const challenge = extractChallengeFromNotes(item.notes)
        const challengeStr = challenge ? ` | Challenge: ${challenge}` : ''
        const video = item.drive_link ? ` | [Video Recording](${item.drive_link})` : ''
        const ratingStr = item.rating ? ` | ${item.rating}★` : ''
        return `Day ${dayNum} (${item.date}): "${item.topic}" [${item.category || 'General'}]${challengeStr}${ratingStr}${video}`
      })
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 3000)
  }

  // Current Season / Phase calculation
  const currentPhaseNumber = totalSessions < 30 ? 1 : totalSessions < 60 ? 2 : 3
  const phaseTarget = currentPhaseNumber * 30
  const phaseProgress = Math.min(100, Math.round(((totalSessions % 30) || (totalSessions >= 30 ? 30 : totalSessions)) / 30 * 100))

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        
        {/* EXECUTIVE HEADER BANNER */}
        <div className="p-6 rounded-2xl border border-amber/30 bg-gradient-to-r from-amber-950/40 via-black to-amber-950/20 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber/20 border border-amber/40 text-amber uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <Mic size={12} /> SPEAKING
                </span>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 font-bold uppercase tracking-wider">
                  {currentPhaseNumber === 1 ? 'SEASON 1' : currentPhaseNumber === 2 ? 'SEASON 2' : 'SEASON 3'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-black text-primary uppercase tracking-tight flex items-center gap-2">
                SPEAKING PRACTICE
              </h1>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-3.5 rounded-xl bg-black/60 border border-amber/30 text-center min-w-[105px] shadow-lg">
                <div className="font-mono text-2xl font-black text-amber flex items-center justify-center gap-1">
                  <span>{totalSessions}</span>
                  <span className="text-xs text-muted font-normal">/ 90</span>
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">DAYS</div>
              </div>
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 text-center min-w-[105px] shadow-lg">
                <div className="font-mono text-2xl font-black text-success">
                  {uniqueTopicsCompleted}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">COMPLETED</div>
              </div>
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 text-center min-w-[105px] shadow-lg">
                <div className="font-mono text-2xl font-black text-purple-300 flex items-center justify-center gap-1">
                  <Star size={16} className="fill-amber text-amber" />
                  <span>{avgRating}</span>
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">RATING</div>
              </div>
            </div>
          </div>

          {/* Phase Progress Bar */}
          <div className="mt-5 pt-4 border-t border-white/10 relative z-10">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase font-bold text-muted mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-amber">PHASE {currentPhaseNumber}:</span>
                <span className="text-primary font-bold">{totalSessions} / {phaseTarget} Days</span>
                {totalSessions >= 29 && totalSessions < 31 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px]">
                    🔥 DAY {totalSessions}/30 COMPLETE — PHASE 2 UNLOCKED
                  </span>
                )}
              </div>
              <span className="text-amber font-mono">{phaseProgress}%</span>
            </div>
            <div className="w-full h-2 bg-black/70 rounded-full overflow-hidden border border-white/10">
              <motion.div 
                className="h-full bg-gradient-to-r from-amber via-yellow-400 to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(3, (totalSessions / 30) * 100))}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>

          {/* Rest Day Config Bar */}
          <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-muted uppercase tracking-wider font-bold text-[10px]">REST DAYS:</span>
              <div className="flex items-center gap-1 bg-black/60 p-1 border border-border-color rounded-lg">
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
                      title={`Toggle ${dObj.label}`}
                    >
                      {dObj.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {todayIsRestDay && (
              <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-300 text-[10px] font-bold flex items-center gap-1.5">
                <span>REST DAY</span>
              </div>
            )}
          </div>
        </div>

        {/* WORKFLOW GRID: TOPIC GENERATOR (LEFT) + VIDEO PROOF FORM (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 7 COLS: TOPIC GENERATOR & BANK */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* TOPIC SELECTOR HERO CARD */}
            <div className="p-6 rounded-2xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-xl relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 mb-5 gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-amber" />
                  <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                    TOPIC
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  {/* Phase Dropdown */}
                  <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-xl border border-amber/30">
                    <span className="font-mono text-[9px] text-muted uppercase font-bold">PHASE:</span>
                    <select
                      value={activePhase}
                      onChange={(e) => handlePhaseChange(Number(e.target.value))}
                      className="bg-transparent text-amber font-mono text-xs font-bold focus:outline-none cursor-pointer"
                    >
                      <option value={1} className="bg-zinc-950 text-white">Phase 1 (Days 1–30)</option>
                      <option value={2} className="bg-zinc-950 text-white">Phase 2 (Days 31–60)</option>
                      <option value={3} disabled className="bg-zinc-950 text-muted/60">Phase 3 (Locked)</option>
                    </select>
                  </div>

                  <div className="font-mono text-xs font-black text-amber bg-amber/15 border border-amber/30 px-3 py-0.5 rounded-full shadow-sm">
                    DAY {history.length + 1}
                  </div>
                </div>
              </div>

              {/* ACTIVE TOPIC & SITUATION DISPLAY */}
              <AnimatePresence mode="wait">
                <motion.div 
                  key={(selectedTopic?.id || selectedTopic?.topic) + (selectedSituation?.id || '')}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="p-6 sm:p-8 rounded-xl bg-black/60 border border-amber/30 text-center relative overflow-hidden space-y-4 shadow-2xl"
                >
                  {/* Badges */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-amber/15 text-amber border border-amber/30 font-bold">
                      {selectedTopic?.category || 'General'}
                    </span>
                    {selectedTopic?.phase && (
                      <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/5 text-muted border border-white/10 font-bold">
                        Phase {selectedTopic.phase}
                      </span>
                    )}
                    {selectedSituation && (
                      <span className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 font-black flex items-center gap-1">
                        <Zap size={10} /> {selectedSituation.title}
                      </span>
                    )}
                  </div>
                  
                  {/* Main Topic Question */}
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-mono font-black text-primary leading-tight px-2">
                    "{selectedTopic?.topic}"
                  </h2>

                  {/* Situation Constraint Banner inside Active Prompt if Spun */}
                  {selectedSituation && (
                    <motion.div
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 max-w-lg mx-auto text-left flex items-start gap-2.5"
                    >
                      <Zap size={16} className="text-purple-400 mt-0.5 shrink-0" />
                      <div className="text-left">
                        <div className="font-mono text-[10px] font-black uppercase text-purple-300">
                          CHALLENGE: {selectedSituation.title}
                        </div>
                        <div className="font-mono text-xs text-primary/90 mt-0.5 font-medium leading-snug">
                          {selectedSituation.rules}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ACTION CONTROLS */}
                  <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleSelectTodaysTopic}
                      disabled={isShuffling}
                      className="btn font-mono text-xs flex items-center gap-2 font-black tracking-wider uppercase shadow-xl px-6 py-2.5 bg-amber text-black hover:bg-amber-hover border border-amber-hover transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <Shuffle size={15} className={isShuffling ? 'animate-spin' : ''} />
                      <span>{isShuffling ? 'SHUFFLING...' : 'SHUFFLE'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCustomTopic(!isCustomTopic)}
                      className={`btn font-mono text-xs flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl border transition-all ${
                        isCustomTopic
                          ? 'bg-purple-500/20 text-purple-300 border-purple-400'
                          : 'bg-black/50 text-muted hover:text-primary border-white/10 hover:border-white/20'
                      }`}
                    >
                      <Edit3 size={14} />
                      <span>{isCustomTopic ? 'CANCEL' : 'CUSTOM'}</span>
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* CUSTOM TOPIC INPUT DRAWER */}
              {isCustomTopic && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleApplyCustomTopic}
                  className="mt-4 p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3"
                >
                  <div className="font-mono text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Edit3 size={14} /> CUSTOM TOPIC ENTRY
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. Why we pivoted our business model in Q3..."
                      value={customTopicInput}
                      onChange={e => setCustomTopicInput(e.target.value)}
                      className="w-full bg-black/60 border border-purple-400/40 rounded-xl px-3.5 py-2 font-mono text-xs text-primary focus:outline-none focus:border-purple-400"
                      style={{ color: '#fff' }}
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Category (e.g. Business Strategy, Impromptu, Pitch)"
                      value={customCategoryInput}
                      onChange={e => setCustomCategoryInput(e.target.value)}
                      className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono text-xs text-primary focus:outline-none focus:border-purple-400"
                      style={{ color: '#fff' }}
                    />
                    <button
                      type="submit"
                      disabled={!customTopicInput.trim()}
                      className="btn font-mono text-xs font-bold px-4 py-1.5 bg-purple-500 text-black hover:bg-purple-400 rounded-xl transition-all disabled:opacity-50"
                    >
                      SET TOPIC
                    </button>
                  </div>
                </motion.form>
              )}

              {/* TOPIC BANK DIAL */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary uppercase tracking-wider font-bold">
                      Phase {activePhase} Topic Bank:
                    </span>
                    <span className="font-mono text-[11px] text-amber font-bold">
                      {availableTopicsInPhase.length} Available
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted">
                    Click number to load prompt
                  </span>
                </div>

                {/* Numbered Topic Dial (Completed topics do not appear) */}
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {availableTopicsInPhase.length === 0 ? (
                    <div className="p-4 text-center font-mono text-xs text-success font-bold w-full bg-success/10 rounded-xl border border-success/30">
                      🎉 ALL TOPICS IN PHASE {activePhase} COMPLETED!
                    </div>
                  ) : (
                    availableTopicsInPhase.map((t) => {
                      const isSelected = selectedTopic?.topic === t.topic
                      const topicNum = t.id
                      return (
                        <button
                          key={topicNum}
                          onClick={() => {
                            setSelectedTopic(t)
                            setIsCustomTopic(false)
                          }}
                          className={`w-7 h-7 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center relative ${
                            isSelected
                              ? 'bg-amber text-black scale-110 shadow-md ring-2 ring-amber/50 font-black z-10'
                              : 'bg-bg-tertiary text-muted hover:text-primary hover:border-amber/50 border border-border-color'
                          }`}
                          title={`#${topicNum} [Phase ${t.phase}]: ${t.topic}`}
                        >
                          {topicNum}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT 5 COLS: PROOF & LOG SUBMISSION FORM */}
          <div className="lg:col-span-5">
            <div className="p-6 rounded-2xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-purple-400">
                  <Video size={18} />
                  <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                    LOG PROOF
                  </span>
                </div>
              </div>

              {submitSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-success/20 border border-success/40 text-success font-mono text-xs flex items-center gap-2 shadow-lg"
                >
                  <CheckCircle2 size={16} />
                  <span>Session logged.</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmitSession} className="space-y-4">
                {/* Active Session Context Pill */}
                <div className="p-3 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[9px] font-black text-amber bg-amber/15 px-2 py-0.5 rounded border border-amber/30 shrink-0">
                        DAY {history.length + 1}
                      </span>
                      {selectedSituation && (
                        <span className="font-mono text-[9px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-400/30 shrink-0 flex items-center gap-1">
                          <Zap size={10} /> #{selectedSituation.id} {selectedSituation.title}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-primary font-bold truncate" title={selectedTopic?.topic}>
                      {selectedTopic?.topic || 'Select a topic'}
                    </div>
                  </div>
                  {selectedSituation && (
                    <button
                      type="button"
                      onClick={() => setSelectedSituation(null)}
                      className="text-muted hover:text-red-400 text-xs font-mono font-bold shrink-0 p-1 rounded hover:bg-white/5 cursor-pointer"
                      title="Remove Challenge"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-muted mb-1 block">
                    VIDEO URL
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="https://drive.google.com/file/d/..."
                      value={driveLink}
                      onChange={e => setDriveLink(e.target.value)}
                      className="w-full font-mono text-xs bg-black/60 text-primary border border-white/10 rounded-xl px-3.5 py-2.5 pl-9 focus:outline-none focus:border-amber transition-colors"
                      style={{ color: '#fff' }}
                    />
                    <LinkIcon size={14} className="absolute left-3 top-3 text-muted" />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-muted mb-1 block">
                    NOTES
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Notes, takeaways, delivery..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full font-mono text-xs bg-black/60 text-primary border border-white/10 rounded-xl p-3 focus:outline-none focus:border-amber transition-colors leading-relaxed resize-y"
                    style={{ color: '#fff' }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-muted">
                      RATING
                    </label>
                    <span className="font-mono text-xs font-bold text-amber">
                      {rating ? `${rating} / 5` : 'Rate'}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`py-2 rounded-xl font-mono text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          rating >= star
                            ? 'bg-amber text-black border-amber shadow-md shadow-amber/20 scale-[1.02]'
                            : 'bg-black/50 border-white/10 text-muted hover:text-primary hover:border-amber/40'
                        }`}
                      >
                        <Star size={13} className={rating >= star ? 'fill-black' : ''} />
                        <span>{star}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !driveLink.trim()}
                  className="w-full font-mono text-xs font-black py-3.5 flex items-center justify-center gap-2 rounded-xl bg-amber hover:bg-amber-hover text-black shadow-xl transition-all transform hover:scale-[1.01] active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                >
                  <Award size={16} />
                  <span>{submitting ? 'SAVING...' : 'LOG PRACTICE'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* COMPLETED TOPICS DIRECTORY & PRACTICE ARCHIVE */}
        <div className="p-6 rounded-2xl border border-border-color bg-bg-secondary/90 backdrop-blur-md shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-amber" />
                <h2 className="font-mono text-sm uppercase tracking-widest text-primary font-black">
                  COMPLETED ARCHIVE ({completedTopicsChronological.length})
                </h2>
              </div>
            </div>

            {/* Controls: Search, View Mode, Copy List */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative w-full sm:w-56">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-black/60 text-primary border border-white/10 rounded-xl px-3 py-1.5 pl-8 font-mono text-xs focus:outline-none focus:border-amber transition-colors"
                  style={{ color: '#fff' }}
                />
                <Search size={13} className="absolute left-2.5 top-2.5 text-muted" />
              </div>

              {/* Sort Order Filter: New to Old vs Old to New */}
              <div className="flex items-center bg-black/60 p-1 border border-white/10 rounded-xl font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setSortOrder('desc')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                    sortOrder === 'desc'
                      ? 'bg-amber text-black shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                  title="Filter New to Old (Newest First)"
                >
                  <ArrowDown size={13} />
                  <span>New → Old</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder('asc')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                    sortOrder === 'asc'
                      ? 'bg-amber text-black shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                  title="Filter Old to New (Oldest First)"
                >
                  <ArrowUp size={13} />
                  <span>Old → New</span>
                </button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-black/60 p-1 border border-white/10 rounded-xl font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                    activeTab === 'directory'
                      ? 'bg-amber text-black shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                  title="Directory List View"
                >
                  <List size={13} />
                  <span>List View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cards')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                    activeTab === 'cards'
                      ? 'bg-amber text-black shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                  title="Cards Grid View"
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
              </div>

              {/* Copy List Button */}
              <button
                type="button"
                onClick={handleCopyCompletedList}
                className="btn btn-ghost font-mono text-xs px-3 py-1.5 rounded-xl border border-white/10 hover:border-amber/50 text-muted hover:text-amber flex items-center gap-1.5 font-bold transition-all"
                title="Copy all completed topics to clipboard as Markdown"
              >
                {copiedAll ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                <span>{copiedAll ? 'COPIED!' : 'COPY LIST'}</span>
              </button>
            </div>
          </div>

          {loading ? (
            <WinterLoader label="Loading speaking logs" compact />
          ) : filteredCompletedTopics.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-black/40 border border-dashed border-white/10 space-y-2">
              <Mic size={28} className="mx-auto text-muted opacity-40" />
              <div className="font-mono text-xs text-primary font-bold">NO PRACTICE SESSIONS FOUND</div>
              <p className="font-mono text-[10px] text-muted">
                {searchQuery ? 'Try a different search query.' : 'Complete your first camera practice session above!'}
              </p>
            </div>
          ) : activeTab === 'directory' ? (
            /* TAB 1: STRUCTURED DIRECTORY LIST TABLE */
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-[10px] uppercase font-bold text-muted tracking-wider">
                    <th className="py-3 px-4 w-20">DAY #</th>
                    <th className="py-3 px-4 w-28">DATE</th>
                    <th className="py-3 px-4">TOPIC / PROMPT</th>
                    <th className="py-3 px-4 w-40">MODIFIER / CATEGORY</th>
                    <th className="py-3 px-4 w-24">RATING</th>
                    <th className="py-3 px-4 w-28 text-right">PROOF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCompletedTopics.map((session, idx) => {
                    const dayNum = session.computed_day || session.day_number || idx + 1
                    const challenge = extractChallengeFromNotes(session.notes)
                    const cleanNotes = cleanNotesDisplay(session.notes)

                    return (
                      <tr 
                        key={session.id || idx}
                        className="hover:bg-white/[0.03] transition-colors group"
                      >
                        <td className="py-3 px-4 font-bold text-amber">
                          <span className="px-2 py-0.5 rounded bg-amber/15 border border-amber/30 text-[10px]">
                            DAY {dayNum}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted text-[11px] whitespace-nowrap">
                          {session.date}
                        </td>
                        <td className="py-3 px-4 font-medium text-primary">
                          <div className="leading-snug">
                            "{session.topic}"
                          </div>
                          {cleanNotes && (
                            <div className="text-[10px] text-muted mt-1 font-normal line-clamp-1 group-hover:line-clamp-none transition-all">
                              {cleanNotes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            {challenge && (
                              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-300 font-bold whitespace-nowrap w-fit">
                                ⚡ {challenge}
                              </span>
                            )}
                            <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted uppercase font-bold whitespace-nowrap w-fit">
                              {session.category || 'General'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-amber font-bold text-[11px]">
                            <Star size={12} className="fill-amber" />
                            <span>{session.rating || 5}/5</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {session.drive_link ? (
                            <a
                              href={session.drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber/15 hover:bg-amber text-amber hover:text-black border border-amber/30 transition-all shadow-sm"
                            >
                              <span>VIDEO</span>
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-muted text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* TAB 2: VISUAL CARDS GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompletedTopics.map((session, idx) => {
                const challenge = extractChallengeFromNotes(session.notes)
                const cleanNotes = cleanNotesDisplay(session.notes)

                return (
                  <div 
                    key={session.id || idx} 
                    className="p-4 rounded-xl bg-black/50 border border-border-color hover:border-amber/40 transition-all flex flex-col justify-between gap-3 shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-amber/20 border border-amber/40 text-amber font-bold uppercase">
                            DAY {session.computed_day || session.day_number || (idx + 1)}
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
                      
                      <h3 className="font-mono text-xs font-bold text-primary leading-snug">
                        "{session.topic}"
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {challenge && (
                          <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-300 font-bold">
                            ⚡ {challenge}
                          </span>
                        )}
                        <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted uppercase font-bold">
                          {session.category || 'General'}
                        </span>
                      </div>

                      {cleanNotes && (
                        <p className="font-mono text-[10px] text-muted mt-2.5 line-clamp-3 leading-relaxed border-t border-white/5 pt-2">
                          {cleanNotes}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="font-mono text-[9px] text-success font-bold flex items-center gap-1">
                        <CheckCircle2 size={11} /> COMPLETED
                      </span>

                      {session.drive_link && (
                        <a
                          href={session.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-xs font-mono text-[10px] text-amber hover:text-amber-hover flex items-center gap-1 font-bold"
                        >
                          <span>VIDEO</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}
