const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const absoluteEnvPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(absoluteEnvPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function test() {
  console.log('--- 1. WORK LOGS (Weekly Debriefs) ---');
  const { data: logs, error: e1 } = await supabase
    .from('work_logs')
    .select('id, title, description, created_at')
    .ilike('title', 'Weekly Debrief%')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (e1) console.error('Error fetching work_logs:', e1);
  else console.log('Latest Work Logs:', JSON.stringify(logs, null, 2));

  console.log('\n--- 2. TASKS (category=weekly_goal or title matches) ---');
  const { data: tasks, error: e2 } = await supabase
    .from('tasks')
    .select('id, title, status, category, due_date, description, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (e2) console.error('Error fetching tasks:', e2);
  else console.log('Latest Tasks:', JSON.stringify(tasks, null, 2));

  console.log('\n--- 3. XP HISTORY (latest 5) ---');
  const { data: xp, error: e3 } = await supabase
    .from('xp_history')
    .select('id, amount, source_type, source_id, description, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (e3) console.error('Error fetching xp_history:', e3);
  else console.log('Latest XP History:', JSON.stringify(xp, null, 2));
}

test();
