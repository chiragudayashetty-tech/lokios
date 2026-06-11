require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Starting seed process...");

  // 1. Get the user
  const { data: profiles, error: profileErr } = await supabase.from('profiles').select('*').limit(1);
  if (profileErr || !profiles.length) {
    console.error("Could not find a user profile. Make sure you have logged in at least once.", profileErr);
    process.exit(1);
  }

  const userId = profiles[0].id;
  console.log(`Found user: ${profiles[0].username} (${userId})`);

  // 2. Update Profile Blueprint
  const notificationPrefs = {
    who_i_want_to_become: "A highly disciplined founder operating at peak performance.",
    class: "Founder",
    current_arc: "Discipline Rebuild",
    current_mission: "Launch Beyond Tatva",
    twelve_month_goal: "20 paid students, ₹30,000/month income, Complete Beyond Tatva course, Improve communication skills, Build portfolio, Reduce phone addiction",
    battles: [
      { name: "Phone Addiction", metric: "Hours/Day", current: 13, target: 6 },
      { name: "Communication", metric: "Confidence", current: 20, target: 100 },
      { name: "Fitness", metric: "Workouts/Week", current: 2, target: 5 },
      { name: "Personal Care", metric: "Consistency", current: 40, target: 100 }
    ],
    skills_to_master: ["AI", "Marketing", "Sales", "Content Creation", "Video Editing", "Automation", "Business"],
    vision: "To build a suite of successful products and operate as an elite founder.",
    purpose: "To push boundaries and create massive value."
  };

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ 
      full_name: "Chirag Shetty",
      notification_prefs: notificationPrefs
    })
    .eq('id', userId);

  if (updateErr) {
    console.error("Error updating profile:", updateErr);
  } else {
    console.log("Successfully updated User Blueprint!");
  }

  // 3. Clear existing habits
  console.log("Clearing existing routines...");
  await supabase.from('habits').delete().eq('user_id', userId);

  // 4. Insert Routines
  console.log("Injecting permanent routines...");
  
  const routines = [
    // Weekday
    { user_id: userId, title: "Beyond Tatva task", category: "business", frequency: "daily", stat_category: "founder", xp_per_completion: 15, icon: "Rocket" },
    { user_id: userId, title: "Workout", category: "health", frequency: "daily", stat_category: "strength", xp_per_completion: 20, icon: "Dumbbell" },
    { user_id: userId, title: "Read 10 pages", category: "learning", frequency: "daily", stat_category: "learning", xp_per_completion: 10, icon: "BookOpen" },
    { user_id: userId, title: "Learn one skill", category: "learning", frequency: "daily", stat_category: "learning", xp_per_completion: 15, icon: "Sparkles" },
    { user_id: userId, title: "Hair treatment", category: "personal", frequency: "daily", stat_category: "discipline", xp_per_completion: 5, icon: "Target" },
    { user_id: userId, title: "Skin care", category: "personal", frequency: "daily", stat_category: "discipline", xp_per_completion: 5, icon: "Target" },
    { user_id: userId, title: "Grooming", category: "personal", frequency: "daily", stat_category: "discipline", xp_per_completion: 5, icon: "Target" },
    { user_id: userId, title: "Screen time target", category: "health", frequency: "daily", stat_category: "discipline", xp_per_completion: 20, icon: "Flame" },
    { user_id: userId, title: "Journal entry", category: "personal", frequency: "daily", stat_category: "discipline", xp_per_completion: 10, icon: "BookOpen" },
    
    // Weekend
    { user_id: userId, title: "Weekly review", category: "business", frequency: "weekly", stat_category: "founder", xp_per_completion: 30, icon: "Target" },
    { user_id: userId, title: "Portfolio update", category: "business", frequency: "weekly", stat_category: "creation", xp_per_completion: 30, icon: "Rocket" },
    { user_id: userId, title: "Deep cleaning of tasks", category: "personal", frequency: "weekly", stat_category: "discipline", xp_per_completion: 15, icon: "Flame" },
    { user_id: userId, title: "Learning project", category: "learning", frequency: "weekly", stat_category: "learning", xp_per_completion: 50, icon: "Sparkles" },
    { user_id: userId, title: "Weekly planning", category: "business", frequency: "weekly", stat_category: "founder", xp_per_completion: 30, icon: "Target" },
    { user_id: userId, title: "Goal review", category: "business", frequency: "weekly", stat_category: "founder", xp_per_completion: 20, icon: "Target" },
    { user_id: userId, title: "Calendar planning", category: "business", frequency: "weekly", stat_category: "discipline", xp_per_completion: 20, icon: "Target" },
    { user_id: userId, title: "Recovery and rest", category: "health", frequency: "weekly", stat_category: "strength", xp_per_completion: 25, icon: "Dumbbell" }
  ];

  const { error: habitsErr } = await supabase.from('habits').insert(routines);
  
  if (habitsErr) {
    console.error("Error inserting routines:", habitsErr);
  } else {
    console.log("Successfully injected all permanent routines!");
  }

  console.log("Seed process complete!");
}

seed();
