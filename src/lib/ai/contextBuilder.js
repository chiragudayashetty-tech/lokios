/**
 * LOKI Context Builder
 * Builds a compressed, token-efficient context string from the full OS state.
 * Includes operator profile, prioritizing daily habits, tasks, and full recent journal entries.
 */

export function buildContext({ profile, habits, tasks, goals, brainDump, journal, characterStats, userConfig, blueprint, pathname }) {
  const p = profile?.profile || {}
  const cfg = userConfig?.config || {}

  // ── Operator Identity (from user_blueprints) ──
  const identity = blueprint?.identity || cfg.who_i_want_to_become || 'Operator'
  const mission = blueprint?.mission || cfg.main_mission || 'Not defined'
  const weaknesses = (blueprint?.weaknesses || cfg.current_weaknesses || []).slice(0, 4).join(', ') || 'None logged'
  const strengths = (blueprint?.strengths || cfg.current_strengths || []).slice(0, 4).join(', ') || 'None logged'
  const battles = (blueprint?.battles || [])
    .filter(b => b.hp > 0)
    .map(b => `${b.name}(HP:${b.hp},${b.severity})`)
    .join(', ') || 'None active'

  // ── Profile Stats ──
  const rank = p.rank || 'E-Rank'
  const level = p.level || 1
  const streak = p.streak_days || 0

  // ── Today's Habits (HIGH PRIORITY) ──
  const todayHabits = habits?.todayLogs || []
  const activeHabitsList = habits?.habits?.filter(h => h.is_active) || []
  const totalHabits = activeHabitsList.length
  const completedHabits = todayHabits.filter(l => l.status === 'completed').length
  const habitPct = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0
  
  const habitsDetail = activeHabitsList.map(h => {
    const log = todayHabits.find(l => l.habit_id === h.id)
    return `${h.title}: ${log?.status || 'pending'} (${h.current_streak || 0}d streak)`
  }).join(' | ') || 'No active habits'

  // ── Today's Tasks (HIGH PRIORITY) ──
  const todayTasks = tasks?.todayTasks || []
  const pendingTasks = todayTasks.filter(t => t.status === 'pending')
  const completedTasks = todayTasks.filter(t => t.status === 'completed')
  
  const tasksDetail = pendingTasks.length > 0 
    ? pendingTasks.map(t => `"${t.title}"`).join(', ') 
    : 'All done!'

  // ── Journal (FULL RECENT ENTRIES) ──
  const recentEntries = journal?.entries?.slice(0, 3) || []
  let journalContext = 'No recent journal entries.'
  if (recentEntries.length > 0) {
    journalContext = recentEntries.map(e => `[Date: ${e.date} | Mood: ${e.mood}]\n${e.content}`).join('\n\n')
  }

  // ── Build Context String ──
  let ctx = `OPERATOR: ${p.full_name || 'Chirag'} | RANK: ${rank} | LV: ${level} | STREAK: ${streak}d
IDENTITY: ${identity}
MISSION: ${mission}
WEAKNESSES: ${weaknesses}
STRENGTHS: ${strengths}
ACTIVE_BATTLES: ${battles}

=== DAILY EXECUTION ===
HABITS (${completedHabits}/${totalHabits} done, ${habitPct}%):
${habitsDetail}

TODAY'S PENDING TASKS:
${tasksDetail}
${completedTasks.length} tasks already completed today.

=== RECENT JOURNAL ENTRIES (READ THIS TO UNDERSTAND MY CURRENT LIFE) ===
${journalContext}

PAGE: ${pathname}`

  return ctx.trim()
}
