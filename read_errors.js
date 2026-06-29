const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually parse .env.local
const absoluteEnvPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(absoluteEnvPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkErrors() {
  const { data, error } = await supabase.from('xp_history')
    .select('*')
    .eq('source_type', 'error_log')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Failed to query DB:", error);
    return;
  }
  
  if (data.length === 0) {
    console.log("No errors found in xp_history yet.");
  } else {
    data.forEach(log => {
      console.log(`[${log.created_at}] Habit: ${log.source_id}`);
      console.log(`ERROR: ${log.description}`);
      console.log('-----------------------------------');
    });
  }
}

checkErrors();
