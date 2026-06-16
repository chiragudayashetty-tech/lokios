import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: users } = await supabase.from('profiles').select('id, total_xp').limit(1)
  const user = users[0]
  console.log('USER:', user)

  // Find latest task_complete
  const { data: historyItems } = await supabase.from('xp_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)
  
  console.log('LATEST HISTORY:', historyItems)
}

test()
