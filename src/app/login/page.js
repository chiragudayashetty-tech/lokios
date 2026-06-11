'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import TypewriterText from '@/components/ui/TypewriterText'

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
    <div className="flex-center tactical-grid" style={{ minHeight: '100vh', width: '100%', padding: '1rem' }}>
      
      <motion.div 
        className="hud-panel hud-glow"
        style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', position: 'relative' }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="scan-line" />
        
        {/* Header */}
        <div className="flex-col flex-center mb-8">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Shield size={48} color="var(--accent-primary)" style={{ filter: 'drop-shadow(0 0 10px var(--amber-glow))' }} />
          </motion.div>
          <h1 className="font-display tracking-wider mt-4 glow-amber text-amber" style={{ fontSize: '2rem', lineHeight: 1 }}>
            CHIRAGOS
          </h1>
          <TypewriterText 
            text="Initializing Command Center..." 
            speed={50} 
            className="text-xs mt-2 text-muted uppercase" 
          />
        </div>

        {/* Tabs */}
        <div className="flex mb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`flex-1 pb-2 font-display uppercase tracking-wide text-sm transition-all ${isLogin ? 'text-amber' : 'text-muted'}`}
            style={{ borderBottom: `2px solid ${isLogin ? 'var(--accent-primary)' : 'transparent'}` }}
          >
            Authenticate
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`flex-1 pb-2 font-display uppercase tracking-wide text-sm transition-all ${!isLogin ? 'text-amber' : 'text-muted'}`}
            style={{ borderBottom: `2px solid ${!isLogin ? 'var(--accent-primary)' : 'transparent'}` }}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 border border-danger bg-danger-subtle text-danger font-mono text-xs">
            [ERROR]: {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} className="flex-col gap-4">
          <div style={{ position: 'relative' }}>
            <Mail size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="email" 
              placeholder="OPERATOR EMAIL" 
              className="input font-mono text-sm" 
              style={{ paddingLeft: '2.5rem' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="password" 
              placeholder="ACCESS CODE" 
              className="input font-mono text-sm" 
              style={{ paddingLeft: '2.5rem' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full mt-2" disabled={loading} style={{ height: '44px' }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : (
              <>
                {isLogin ? 'INITIATE LOGIN' : 'CREATE PROTOCOL'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="flex-center my-6" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'var(--border-color)' }} />
          <span className="font-mono text-xs text-muted bg-secondary px-2" style={{ position: 'relative', zIndex: 1 }}>OR OVERRIDE WITH</span>
        </div>

        <button 
          onClick={handleGoogleLogin} 
          type="button" 
          className="btn btn-secondary btn-full font-display tracking-wide"
        >
          GOOGLE OAUTH PROTOCOL
        </button>

      </motion.div>
    </div>
  )
}
