'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, X, Settings, Send, Eye, Trash2, ChevronRight
} from 'lucide-react'
import { useOS } from '@/lib/context/OSContext'
import { buildContext } from '@/lib/ai/contextBuilder'
import { getActionsForPage } from '@/lib/ai/quickActions'
import { lokiChat, getApiKey, saveApiKey, clearApiKey } from '@/lib/gemini'
import { createClient } from '@/lib/supabase/client'

export default function LokiAI() {
  const pathname = usePathname()
  const os = useOS()
  const { profile, habits, tasks, goals, brainDump, journal, characterStats, userConfig } = os

  const [isOpen, setIsOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  
  // Chat state
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [blueprint, setBlueprint] = useState(null)
  
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const actions = getActionsForPage(pathname)
  const hasKey = !!apiKey

  // Load API key, blueprint, and chat history on mount
  useEffect(() => {
    const key = getApiKey()
    if (key) {
      setApiKey(key)
      setApiKeyInput(key)
    }
    fetchBlueprint()
    
    const savedHistory = localStorage.getItem('loki_chat_history')
    if (savedHistory) {
      try {
        setMessages(JSON.parse(savedHistory))
      } catch (e) {
        console.error('Failed to parse loki chat history', e)
      }
    } else {
      setMessages([{ role: 'model', content: "I'm LOKI. Your journal and habits are loaded. Let's get to work. What's the block right now?" }])
    }
  }, [])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Save history on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('loki_chat_history', JSON.stringify(messages))
    }
  }, [messages])

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

  const handleSend = async (text, isQuickAction = false) => {
    if (!text.trim()) return
    if (!hasKey) {
      setMessages(prev => [...prev, 
        { role: 'user', content: text },
        { role: 'model', content: '⚡ Please add your Gemini API key in Settings to continue.' }
      ])
      setInputValue('')
      return
    }

    const newMsg = { role: 'user', content: text }
    const updatedMessages = [...messages, newMsg]
    setMessages(updatedMessages)
    if (!isQuickAction) setInputValue('')
    setIsLoading(true)

    try {
      const ctx = buildCtx()
      const response = await lokiChat(updatedMessages, ctx, apiKey)
      if (response) {
        setMessages(prev => [...prev, { role: 'model', content: response }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', content: `⚠ Error: ${e.message}` }])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    handleSend(inputValue)
  }

  const clearHistory = () => {
    if (confirm("Clear LOKI conversation history?")) {
      const initial = [{ role: 'model', content: "I'm LOKI. Your journal and habits are loaded. Let's get to work. What's the block right now?" }]
      setMessages(initial)
      localStorage.setItem('loki_chat_history', JSON.stringify(initial))
    }
  }

  const handleSaveKey = (e) => {
    e.preventDefault()
    if (!apiKeyInput.trim()) return
    saveApiKey(apiKeyInput)
    setApiKey(apiKeyInput)
    setShowSettings(false)
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

      {/* ── Full Screen Premium Modal ── */}
      <AnimatePresence>
        {isOpen && (
          <div className="loki-modal-overlay">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="loki-modal-backdrop"
            />

            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="loki-modal-window"
            >
              {/* ── Header ── */}
              <div className="loki-header">
                <div className="loki-header-left">
                  <div className="loki-logo">
                    <Zap size={16} />
                  </div>
                  <div>
                    <div className="loki-title">LOKI</div>
                    <div className="loki-subtitle">{rank} · LV.{level}</div>
                  </div>
                </div>
                <div className="loki-header-actions">
                  <button onClick={clearHistory} className="loki-icon-btn" title="Clear Chat">
                    <Trash2 size={14} />
                  </button>
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

              {/* ── Settings Panel ── */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
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
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Chat History Body ── */}
              <div className="loki-chat-body">
                {messages.map((msg, i) => (
                  <div key={i} className={`loki-msg-row ${msg.role === 'user' ? 'loki-msg-user' : 'loki-msg-model'}`}>
                    {msg.role === 'model' && (
                      <div className="loki-msg-avatar">
                        <Zap size={12} />
                      </div>
                    )}
                    <div className="loki-msg-bubble">
                      {formatResponse(msg.content)}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="loki-msg-row loki-msg-model">
                    <div className="loki-msg-avatar"><Zap size={12} /></div>
                    <div className="loki-msg-bubble loki-msg-loading">
                      <span className="loki-loading-dot" />
                      <span className="loki-loading-dot" style={{ animationDelay: '0.2s' }} />
                      <span className="loki-loading-dot" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Input Area ── */}
              <div className="loki-input-area">
                {/* Quick Actions Array - horizontally scrollable above input */}
                {!isLoading && (
                  <div className="loki-quick-actions">
                    {actions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => handleSend(action.prompt(''), true)}
                        className="loki-quick-btn"
                        title={action.description}
                      >
                        {action.label} <ChevronRight size={10} />
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="loki-chat-form">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={hasKey ? 'Message LOKI...' : 'Add API key in settings...'}
                    className="loki-chat-input"
                    disabled={isLoading || !hasKey}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !inputValue.trim() || !hasKey}
                    className="loki-chat-send"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>

            </motion.div>
          </div>
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
