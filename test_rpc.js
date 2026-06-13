const fs = require('fs')
const envContent = fs.readFileSync('d:/Loki os/chiragos/.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v) env[k.trim()] = v.join('=').trim()
})

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Testing award_xp RPC...')
  
  // We need a valid user ID. Let's fetch one from profiles.
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id').limit(1)
  if (pErr || !profiles || profiles.length === 0) {
    console.log("Could not fetch user id", pErr)
    return
  }
  const userId = profiles[0].id
  
  const { data, error } = await supabase.rpc('award_xp', {
    p_user_id: userId,
    p_amount: 10,
    p_source_type: 'test',
    p_source_id: 'test-123',
    p_description: 'Test XP',
    p_stat_category: 'discipline'
  })
  
  if (error) {
    console.error("RPC Error:", error)
  } else {
    console.log("RPC Success:", data)
  }
}

run()
