import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthRedirectGate from '@/components/auth/AuthRedirectGate'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  }

  // If server cookies don't contain the user (common on mobile browsers / PWAs where session is in localStorage),
  // don't immediately redirect to /login. Use client gate to check localStorage session.
  return <AuthRedirectGate />
}
