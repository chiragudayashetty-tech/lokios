import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function check() {
  const { data, error } = await supabase.from('habit_logs').select('*').eq('date', '2026-07-08')
  console.log('Data:', data)
  console.log('Error:', error)
}
check()
