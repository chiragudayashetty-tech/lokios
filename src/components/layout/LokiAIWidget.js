'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrainCircuit, Send, ShieldCheck, Sparkles, X } from 'lucide-react'

const starterPrompts = [
  'Give me a snapshot of my current state.',
  'What patterns are hurting my progress?',
  'What should I focus on today?',
]

export default function LokiAIWidget() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function ask(text = message) {
    const prompt = String(text || '').trim()
    if (!prompt || loading) return
    setMessage('')
    setError('')
    setMessages((current) => [...current, { role: 'user', content: prompt }])
    setLoading(true)
    try {
      const response = await fetch('/api/loki-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: messages.slice(-10) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Loki AI could not respond.')
      setMessages((current) => [...current, { role: 'assistant', content: data.response }])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open read-only Loki AI"
        className="fixed bottom-20 right-4 z-[900] flex items-center gap-2 rounded-full border border-amber/60 bg-bg-tertiary px-4 py-3 font-mono text-xs uppercase tracking-widest text-amber shadow-lg shadow-amber/10 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        <BrainCircuit size={17} />
        <span className="hidden sm:inline">Loki AI</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.section className="flex max-h-[min(720px,calc(100dvh-24px))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-amber/40 bg-bg-secondary shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 28, scale: 0.98 }} onClick={(event) => event.stopPropagation()}>
              <header className="flex items-center justify-between border-b border-border-color px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl border border-amber/40 bg-amber/10 p-2 text-amber"><Sparkles size={18} /></span>
                  <div>
                    <h2 className="font-display text-sm uppercase tracking-widest text-primary">Loki AI</h2>
                    <p className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted"><ShieldCheck size={12} className="text-success" /> Read-only intelligence</p>
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-bg-tertiary hover:text-primary" aria-label="Close Loki AI"><X size={18} /></button>
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                {messages.length === 0 && <div className="rounded-xl border border-border-color bg-bg-tertiary p-4"><p className="font-mono text-xs leading-relaxed text-secondary">Ask me to review your Loki OS state. I can read your modules and identify patterns, but I cannot change anything.</p><div className="mt-4 flex flex-col gap-2">{starterPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => ask(prompt)} className="rounded-lg border border-border-color px-3 py-2 text-left font-mono text-xs text-primary transition-colors hover:border-amber/60 hover:bg-amber/5">{prompt}</button>)}</div></div>}
                {messages.map((item, index) => <div key={`${item.role}-${index}`} className={`rounded-xl px-3 py-3 text-sm leading-relaxed ${item.role === 'user' ? 'ml-8 border border-amber/20 bg-amber/10 text-primary' : 'mr-3 border border-border-color bg-bg-tertiary text-secondary'}`}><div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted">{item.role === 'user' ? 'You' : 'Loki AI'}</div><div className="whitespace-pre-wrap">{item.content}</div></div>)}
                {loading && <div className="mr-3 rounded-xl border border-border-color bg-bg-tertiary px-3 py-3 font-mono text-xs text-muted">Reading Loki OS<span className="animate-pulse">...</span></div>}
                {error && <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-3 font-mono text-xs text-danger">{error}</div>}
              </div>

              <form onSubmit={(event) => { event.preventDefault(); ask() }} className="flex gap-2 border-t border-border-color p-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
                <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Review my current state..." className="min-w-0 flex-1 rounded-xl border border-border-color bg-bg-primary px-3 py-3 text-sm text-primary outline-none placeholder:text-muted focus:border-amber" disabled={loading} />
                <button type="submit" className="rounded-xl bg-amber px-4 text-bg-primary transition-transform active:scale-95 disabled:opacity-50" disabled={loading || !message.trim()} aria-label="Ask Loki AI"><Send size={17} /></button>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
