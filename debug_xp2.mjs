import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: users, error } = await supabase.from('profiles').select('id, total_xp, full_name').limit(3)
  if (error) {
    console.error('Fetch error:', error)
    return
  }
  
  if (!users || users.length === 0) {
    console.log('No users found.')
    return
  }

  const user = users[0]
  console.log('USER:', user)

  const { data: historyItems } = await supabase.from('xp_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log('LATEST HISTORY:', historyItems)
}

test()
