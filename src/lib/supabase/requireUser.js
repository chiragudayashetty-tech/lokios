import { createClient } from '@/lib/supabase/server'

// Route handlers must validate the caller themselves. Proxy redirects improve
// navigation, but they are not a substitute for authorization at a data boundary.
export async function getRequestUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}
