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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Fetching xp_history and habit_logs...')
  const { data: xp, error: e1 } = await supabase.from('xp_history').select('*').eq('source_type', 'habit_complete')
  const { data: logs, error: e2 } = await supabase.from('habit_logs').select('*')
  
  if (e1 || e2) {
    console.error(e1, e2)
    return
  }

  let deleted = 0
  for (const item of xp) {
    const itemDate = item.created_at.split('T')[0]
    // Check if there is a corresponding habit_log
    const hasLog = logs.some(l => l.habit_id === item.source_id && l.date === itemDate)
    
    if (!hasLog) {
      console.log(`Orphaned XP found: ${item.description} on ${itemDate}`)
      await supabase.from('xp_history').delete().eq('id', item.id)
      deleted++
    }
  }
  console.log(`Cleanup complete. Deleted ${deleted} orphaned xp_history records.`)
}

run()
