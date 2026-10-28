// Server side of the Claude connector: sign in as the Loki OS owner and point the
// app's shared code (createClient, getSettings) at that session for one call.
import crypto from 'node:crypto'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { setServerClient } from '@/lib/supabase/client'
import { setServerSettings } from '@/lib/settings'

// Dates in the app's XP code are local dates; Vercel runs in UTC.
process.env.TZ = process.env.LOKIOS_TIMEZONE || 'Asia/Kolkata'

// A few game helpers remember "already shown" flags in localStorage; give them memory.
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map()
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)) },
    removeItem: (k) => { mem.delete(k) },
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size },
  }
}

const url = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Which env vars are missing, so a misconfigured deploy says what to set. */
export function missingConfig() {
  return ['LOKIOS_MCP_TOKEN', 'LOKIOS_USER_ID', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
    .filter((k) => !process.env[k] && !(k === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && anonKey()))
    .concat(url() ? [] : ['NEXT_PUBLIC_SUPABASE_URL'])
}

/** Constant-time check of the connector key. */
export function keyMatches(provided) {
  const token = process.env.LOKIOS_MCP_TOKEN || ''
  const a = Buffer.from(String(provided || ''))
  const b = Buffer.from(token)
  return token.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b)
}

let cached = null // { client, expiresAt }

/** A Supabase client signed in as the owner (magic link minted with the service key, never emailed). */
async function ownerClient() {
  if (cached && cached.expiresAt - Date.now() > 5 * 60000) return cached.client
  const admin = createSupabase(url(), process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: u, error: uErr } = await admin.auth.admin.getUserById(process.env.LOKIOS_USER_ID)
  if (uErr || !u?.user?.email) throw new Error(`Owner account not found: ${uErr?.message || 'no email'}`)
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
  if (lErr) throw new Error(`Could not start a session: ${lErr.message}`)
  const client = createSupabase(url(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data: s, error: sErr } = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
  if (sErr || !s?.session) throw new Error(`Could not start a session: ${sErr?.message || 'no session'}`)
  cached = { client, expiresAt: (s.session.expires_at || 0) * 1000 }
  return client
}

let queue = Promise.resolve()

/** Runs fn(client, userId) as the owner. Calls are serialized because the shared code reads module-level state. */
export function asOwner(fn) {
  const run = queue.then(async () => {
    const client = await ownerClient()
    const userId = process.env.LOKIOS_USER_ID
    const { data: profile } = await client.from('profiles').select('settings').eq('id', userId).maybeSingle()
    setServerSettings(profile?.settings || null)
    setServerClient(client)
    try {
      return await fn(client, userId)
    } finally {
      setServerClient(null)
      setServerSettings(null)
    }
  })
  queue = run.catch(() => {})
  return run
}
