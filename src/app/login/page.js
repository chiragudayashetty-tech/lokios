'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import TypewriterText from '@/components/ui/TypewriterText'

const AUTH_PILLARS = [
  { value: '1', label: 'Private console' },
  { value: '2', label: 'Focus tools' },
  { value: '3', label: 'Execution loops' },
]

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()

  useEffect(() => {
    // Check for auth error in URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      setError('Authentication failed. Please try again.')
    }

    // Check if already logged in
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/dashboard')
    }
    checkUser()
  }, [router])

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: email.split('@')[0] } }
        })
        if (error) throw error
        // Auto sign-in logic depends on Supabase email confirmation settings
        // Currently the user has auto-confirm enabled, so they should be logged in
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      if (error) throw error
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-grid">
        <motion.section
          className="auth-intro glass-panel-strong"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <p className="auth-kicker">Private command surface</p>
            <h1>ChiragOS</h1>
            <p className="auth-lede">
              A focused operating system for planning the day, protecting attention, and turning intent into execution.
            </p>
          </div>

          <div className="auth-metrics">
            {AUTH_PILLARS.map((item) => (
              <div key={item.label} className="auth-metric">
                <span className="auth-metric-value">0{item.value}</span>
                <span className="auth-metric-label">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="auth-note">Focused by design. No extra noise.</div>
        </motion.section>

        <motion.div
          className="hud-panel hud-glow auth-card"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          <div className="scan-line" />

          <div className="auth-card-header">
            <div className="auth-card-icon">
              <Shield size={22} color="var(--accent-primary)" />
            </div>
            <div>
              <p className="auth-kicker">Secure entry</p>
              <h2 className="auth-card-title">Access the console</h2>
              <TypewriterText
                text="Initializing command center..."
                speed={42}
                className="auth-subtitle"
              />
            </div>
          </div>

          <div className="auth-tabs">
            <button
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              type="button"
            >
              Sign in
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              type="button"
            >
              Create account
            </button>
          </div>

          {error && (
            <div className="auth-error">
              [ERROR]: {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="auth-form">
            <label className="auth-field">
              <Mail size={16} className="auth-field-icon" />
              <input
                type="email"
                placeholder="operator@email.com"
                className="input font-mono text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <Lock size={16} className="auth-field-icon" />
              <input
                type="password"
                placeholder="access code"
                className="input font-mono text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="btn btn-primary btn-full auth-remote" disabled={loading}>
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Initialize login' : 'Create profile'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>Or continue with</span>
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="btn btn-secondary btn-full font-display tracking-wide"
          >
            Google OAuth
          </button>
        </motion.div>
      </div>
    </div>
  )
}
