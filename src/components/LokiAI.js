'use client'

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, X, Settings, ChevronRight, Send, AlertTriangle, 
  Sunrise, Moon, Target, Cpu, BookOpen, Activity, Flame,
  TrendingUp, Swords, Crosshair, Layers, Monitor, ClipboardList,
  ShieldAlert, CheckSquare, User, BarChart2, Eye, MessageSquare
} from 'lucide-react'
import { useOS } from '@/lib/context/OSContext'
import { buildContext } from '@/lib/ai/contextBuilder'
import { getActionsForPage } from '@/lib/ai/quickActions'
import { lokiQuery, getApiKey, saveApiKey, clearApiKey } from '@/lib/gemini'
import { createClient } from '@/lib/supabase/client'

// ── Icon map for quick actions ──
const ICON_MAP = {
  Sunrise, Moon, Target, Cpu, BookOpen, Activity, Flame,
  TrendingUp, Swords, Crosshair, Layers, Monitor, ClipboardList,
  ShieldAlert, CheckSquare, User, BarChart2, Eye, AlertTriangle,
  Zap, MessageSquare
}

// ── Static insights (no API key needed) ──
function buildStaticInsights({ profile, habits, tasks, goals, brainDump, journal }) {
  const insights = []
  const p = profile?.profile || {}
  const todayTasks = tasks?.todayTasks || []
  const pending = todayTasks.filter(t => t.status === 'pending')
  const completedT = todayTasks.filter(t => t.status === 'completed')
  const totalHabits = habits?.habits?.filter(h => h.is_active)?.length || 0
  const completedH = habits?.todayLogs?.filter(l => l.status === 'completed')?.length || 0
  const inboxCount = brainDump?.items?.filter(i => i.status === 'inbox')?.length || 0
  const mainQuest = goals?.mainQuest

  if (completedT.length === 0 && pending.length > 0) {
    insights.push({ type: 'warning', text: `${pending.length} operations pending. Nothing completed yet today.` })
  } else if (completedT.length > 0) {
    insights.push({ type: 'success', text: `${completedT.length}/${todayTasks.length} operations completed today.` })
  }

  const habitPct = totalHabits > 0 ? Math.round((completedH / totalHabits) * 100) : 0
  if (habitPct < 50 && totalHabits > 0) {
    insights.push({ type: 'warning', text: `Habits at ${habitPct}% — ${totalHabits - completedH} routines unexecuted.` })
  } else if (habitPct >= 80) {
    insights.push({ type: 'success', text: `Habit compliance strong: ${habitPct}% today.` })
  }

  if (!journal?.entries?.[0] || journal.entries[0].date !== new Date().toISOString().slice(0, 10)) {
    insights.push({ type: 'info', text: 'No journal entry today. Reflection data missing.' })
  }

  if (inboxCount >= 3) {
    insights.push({ type: 'info', text: `${inboxCount} brain dump items awaiting organization.` })
  }

  if (mainQuest) {
    insights.push({ type: 'info', text: `Main Quest "${mainQuest.title}" at ${mainQuest.progress || 0}% progress.` })
  }

  if (p.streak_days >= 7) {
    insights.push({ type: 'success', text: `${p.streak_days}-day streak active. Don't break it.` })
  }

  return insights.slice(0, 4)
}

// ── Main Component ──
export default function LokiAI() {
  const pathname = usePathname()
  const os = useOS()
  const { profile, habits, tasks, goals, brainDump, journal, characterStats, userConfig } = os

  const [isOpen, setIsOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [activeActionId, setActiveActionId] = useState(null)
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [blueprint, setBlueprint] = useState(null)
  const [sessionCache, setSessionCache] = useState({})
  const responseRef = useRef(null)
  const inputRef = useRef(null)

  const actions = getActionsForPage(pathname)
  const hasKey = !!apiKey
  const staticInsights = buildStaticInsights({ profile, habits, tasks, goals, brainDump, journal })

  // Load API key + blueprint on mount
  useEffect(() => {
    const key = getApiKey()
    if (key) {
      setApiKey(key)
      setApiKeyInput(key)
    }
    fetchBlueprint()
  }, [])

  // Scroll response into view
  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [response])

  const fetchBlueprint = async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase.from('user_blueprints').select('*').limit(1).single()
      if (data) setBlueprint(data)
    } catch (e) {
      // Blueprint optional
    }
  }

  const buildCtx = useCallback(() => {
    return buildContext({
      profile, habits, tasks, goals, brainDump, journal,
      characterStats, userConfig, blueprint, pathname
    })
  }, [profile, habits, tasks, goals, brainDump, journal, characterStats, userConfig, blueprint, pathname])

  const runAction = async (action) => {
    setActiveActionId(action.id)
    setResponse('')
    setShowSettings(false)
    
    const cacheKey = `${pathname}_${action.id}`
    if (sessionCache[cacheKey]) {
      setResponse(sessionCache[cacheKey])
      return
    }

    if (!hasKey) {
      setResponse('⚡ Add your Gemini API key in LOKI Settings to activate AI analysis.')
      return
    }

    setIsLoading(true)
    try {
      const ctx = buildCtx()
      const prompt = action.prompt(ctx)
      const result = await lokiQuery(prompt, apiKey)
      if (result) {
        setResponse(result)
        setSessionCache(prev => ({ ...prev, [cacheKey]: result }))
      }
    } catch (e) {
      setResponse(`⚠ Error: ${e.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const runCustom = async (e) => {
    e.preventDefault()
    if (!customPrompt.trim()) return
    setActiveActionId('custom')
    setResponse('')
    
    if (!hasKey) {
      setResponse('⚡ Add your Gemini API key in LOKI Settings to activate AI analysis.')
      return
    }

    setIsLoading(true)
    try {
      const ctx = buildCtx()
      const fullPrompt = `${ctx}\n\nOPERATOR QUESTION: ${customPrompt}`
      const result = await lokiQuery(fullPrompt, apiKey)
      if (result) setResponse(result)
    } catch (e) {
      setResponse(`⚠ Error: ${e.message}`)
    } finally {
      setIsLoading(false)
      setCustomPrompt('')
    }
  }

  const handleSaveKey = (e) => {
    e.preventDefault()
    if (!apiKeyInput.trim()) return
    saveApiKey(apiKeyInput)
    setApiKey(apiKeyInput)
    setShowSettings(false)
    setResponse('')
  }

  const handleClearKey = () => {
    clearApiKey()
    setApiKey('')
    setApiKeyInput('')
  }

  const p = profile?.profile || {}
  const rank = p.rank || 'E-RANK'
  const level = p.level || 1

  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="loki-trigger"
        title="Open LOKI Intelligence"
      >
        <Zap size={13} className="loki-trigger-icon" />
        <span>LOKI</span>
        {!hasKey && <span className="loki-trigger-dot" />}
      </button>

      {/* ── Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="loki-backdrop"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="loki-panel"
            >
              {/* ── Header ── */}
              <div className="loki-header">
                <div className="loki-header-left">
                  <div className="loki-logo">
                    <Zap size={16} />
                  </div>
                  <div>
                    <div className="loki-title">LOKI INTELLIGENCE</div>
                    <div className="loki-subtitle">{rank} · LV.{level}</div>
                  </div>
                </div>
                <div className="loki-header-actions">
                  <button
                    onClick={() => setShowSettings(s => !s)}
                    className={`loki-icon-btn ${showSettings ? 'active' : ''}`}
                    title="Settings"
                  >
                    <Settings size={14} />
                  </button>
                  <button onClick={() => setIsOpen(false)} className="loki-icon-btn" title="Close">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* ── Scan line ── */}
              <div className="loki-scanline" />

              {/* ── Settings Panel ── */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="loki-settings"
                  >
                    <form onSubmit={handleSaveKey} className="loki-settings-form">
                      <div className="loki-settings-label">
                        <Eye size={11} />
                        GEMINI API KEY {hasKey && <span className="loki-key-status">● ACTIVE</span>}
                      </div>
                      <div className="loki-settings-row">
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={e => setApiKeyInput(e.target.value)}
                          placeholder="AIzaSy..."
                          className="loki-key-input"
                          autoComplete="off"
                        />
                        <button type="submit" className="loki-save-btn">SAVE</button>
                      </div>
                      {hasKey && (
                        <button type="button" onClick={handleClearKey} className="loki-clear-btn">
                          CLEAR KEY
                        </button>
                      )}
                      <p className="loki-settings-note">
                        Stored in browser only. Never sent anywhere except Google's API.
                        Get a free key at <strong>aistudio.google.com</strong>
                      </p>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Static Insights (no API needed) ── */}
              {!hasKey && (
                <div className="loki-no-key-banner">
                  <Zap size={12} />
                  <span>Add API key to unlock AI analysis. Showing live data below.</span>
                </div>
              )}

              <div className="loki-body">

                {/* ── Static Data Insights ── */}
                {staticInsights.length > 0 && (
                  <div className="loki-section">
                    <div className="loki-section-label">
                      <Activity size={11} />
                      LIVE STATUS
                    </div>
                    <div className="loki-insights">
                      {staticInsights.map((insight, i) => (
                        <div key={i} className={`loki-insight loki-insight--${insight.type}`}>
                          <span className="loki-insight-dot" />
                          {insight.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Quick Actions ── */}
                <div className="loki-section">
                  <div className="loki-section-label">
                    <Crosshair size={11} />
                    {pathname.replace('/', '').toUpperCase() || 'DASHBOARD'} INTEL
                  </div>
                  <div className="loki-actions">
                    {actions.map(action => {
                      const Icon = ICON_MAP[action.icon] || Zap
                      const isActive = activeActionId === action.id
                      return (
                        <button
                          key={action.id}
                          onClick={() => runAction(action)}
                          className={`loki-action-btn ${isActive && isLoading ? 'loading' : ''} ${isActive && !isLoading && response ? 'active' : ''}`}
                          disabled={isLoading}
                        >
                          <Icon size={13} className="loki-action-icon" />
                          <div className="loki-action-text">
                            <span className="loki-action-label">{action.label}</span>
                            <span className="loki-action-desc">{action.description}</span>
                          </div>
                          <ChevronRight size={12} className="loki-action-chevron" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── AI Response ── */}
                <AnimatePresence>
                  {(isLoading || response) && (
                    <motion.div
                      ref={responseRef}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="loki-response"
                    >
                      <div className="loki-response-header">
                        <Zap size={11} />
                        LOKI ANALYSIS
                        {!isLoading && (
                          <button
                            onClick={() => { setResponse(''); setActiveActionId(null) }}
                            className="loki-response-clear"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                      {isLoading ? (
                        <div className="loki-loading">
                          <span className="loki-loading-dot" />
                          <span className="loki-loading-dot" style={{ animationDelay: '0.2s' }} />
                          <span className="loki-loading-dot" style={{ animationDelay: '0.4s' }} />
                          <span className="loki-loading-text">PROCESSING...</span>
                        </div>
                      ) : (
                        <div className="loki-response-text">
                          {formatResponse(response)}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Custom Query ── */}
                <div className="loki-section">
                  <div className="loki-section-label">
                    <MessageSquare size={11} />
                    DIRECT QUERY
                  </div>
                  <form onSubmit={runCustom} className="loki-chat-form">
                    <input
                      ref={inputRef}
                      type="text"
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      placeholder={hasKey ? 'Ask LOKI anything about your OS...' : 'Add API key in settings to query LOKI...'}
                      className="loki-chat-input"
                      disabled={isLoading || !hasKey}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !customPrompt.trim() || !hasKey}
                      className="loki-chat-send"
                    >
                      <Send size={13} />
                    </button>
                  </form>
                </div>

              </div>

              {/* ── Footer ── */}
              <div className="loki-footer">
                <span>LOKI v1 · gemini-2.5-flash · context-aware</span>
                <span className={`loki-status-dot ${hasKey ? 'online' : 'offline'}`}>
                  {hasKey ? '● ONLINE' : '○ OFFLINE'}
                </span>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Format AI response with basic markdown ──
function formatResponse(text) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <div key={i} className="loki-resp-heading">{line.replace(/\*\*/g, '')}</div>
    }
    if (line.match(/^\*\*(.+)\*\*/)) {
      return <div key={i} className="loki-resp-line" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
    }
    if (line.match(/^[\*\-•]\s/)) {
      return <div key={i} className="loki-resp-bullet">
        <span className="loki-resp-bullet-dot">▸</span>
        {line.replace(/^[\*\-•]\s/, '')}
      </div>
    }
    if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\./)[1]
      return <div key={i} className="loki-resp-numbered">
        <span className="loki-resp-num">{num}</span>
        {line.replace(/^\d+\.\s/, '')}
      </div>
    }
    if (line.startsWith('#')) {
      return <div key={i} className="loki-resp-heading">{line.replace(/^#+\s/, '')}</div>
    }
    if (!line.trim()) return <div key={i} className="loki-resp-spacer" />
    return <div key={i} className="loki-resp-line">{line}</div>
  })
}
