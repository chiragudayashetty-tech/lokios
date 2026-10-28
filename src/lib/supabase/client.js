import { createBrowserClient } from '@supabase/ssr'

// The Claude connector (/api/mcp) runs the app's own XP code on the server,
// signed in as the owner; it swaps in that client for the length of a call.
let serverClient = null
export function setServerClient(client) { serverClient = client }

export function createClient() {
  if (serverClient) return serverClient
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  )
}
