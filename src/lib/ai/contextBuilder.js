/**
 * LOKI Context Builder
 * Builds a compressed, token-efficient context string from the full OS state.
 * Includes operator profile (identity, mission, weaknesses, battles, vision).
 * Page-aware: sends only relevant deep data per route.
 */

export function buildContext({ profile, habits, tasks, goals, brainDump, journal, characterStats, userConfig, blueprint, pathname }) {
  const p = profile?.profile || {}
  const cfg = userConfig?.config || {}

  // ── Operator Identity (from user_blueprints) ──
  const identity = blueprint?.identity || cfg.who_i_want_to_become || 'Operator'
  const mission = blueprint?.mission || cfg.main_mission || 'Not defined'
  const vision = blueprint?.future_vision || cfg.twelve_month_goal || 'Not defined'
  const weaknesses = (blueprint?.weaknesses || cfg.current_weaknesses || []).slice(0, 4).join(', ') || 'None logged'
  const strengths = (blueprint?.strengths || cfg.current_strengths || []).slice(0, 4).join(', ') || 'None logged'
  const values = (blueprint?.values_list || cfg.core_values || []).slice(0, 4).join(' | ') || 'None logged'
  const battles = (blueprint?.battles || [])
    .filter(b => b.hp > 0)
    .map(b => `${b.name}(HP:${b.hp},${b.severity})`)
    .join(', ') || 'None active'

  // ── Profile Stats ──
  const rank = p.rank || 'E-Rank'
  const level = p.level || 1
  const xp = p.total_xp || 0
  const streak = p.streak_days || 0

  // ── Today's Habits ──
  const todayHabits = habits?.todayLogs || []
  const totalHabits = habits?.habits?.filter(h => h.is_active)?.length || 0
  const completedHabits = todayHabits.filter(l => l.status === 'completed').length
  const habitPct = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0

  // ── Today's Tasks ──
  const todayTasks = tasks?.todayTasks || []
  const pendingTasks = todayTasks.filter(t => t.status === 'pending')
  const completedTasks = todayTasks.filter(t => t.status === 'completed')
  const overdueTasks = todayTasks.filter(t => t.status === 'pending' && t.due_date && new Date(t.due_date) < new Date()).length

  // ── Goals ──
  const mainQuest = goals?.mainQuest
  const activeGoals = goals?.goals?.filter(g => g.status === 'active') || []
  const sideQuests = goals?.sideQuests?.filter(g => g.status === 'active') || []

  // ── Brain Dump ──
  const inboxItems = brainDump?.items?.filter(i => i.status === 'inbox') || []

  // ── Journal ──
  const todayEntry = journal?.entries?.[0]
  const recentMoods = journal?.entries?.slice(0, 3).map(e => e.mood).join('→') || 'none'

  // ── Character Stats ──
  const stats = characterStats?.stats || {}
  const statLine = Object.entries(stats)
    .map(([k, v]) => `${k.toUpperCase()}:LV${v?.level || 1}`)
    .join(' ')

  // ── Base context (always sent) ──
  let ctx = `OPERATOR: ${p.full_name || 'Chirag'} | RANK: ${rank} | LV: ${level} | XP: ${xp.toLocaleString()} | STREAK: ${streak}d
IDENTITY: ${identity}
MISSION: ${mission}
VISION: ${vision}
WEAKNESSES: ${weaknesses}
STRENGTHS: ${strengths}
CODE(VALUES): ${values}
ACTIVE_BATTLES: ${battles}
TODAY: ${completedTasks.length}/${todayTasks.length} tasks done | habits: ${completedHabits}/${totalHabits}(${habitPct}%) | overdue: ${overdueTasks}
JOURNAL_TODAY: ${todayEntry ? `written(mood:${todayEntry.mood})` : 'NOT WRITTEN'}
MOOD_TREND: ${recentMoods}
STATS: ${statLine || 'not loaded'}
PAGE: ${pathname}`

  // ── Page-specific deep context ──
  if (pathname === '/dashboard') {
    if (mainQuest) ctx += `\nMAIN_QUEST: "${mainQuest.title}" (${mainQuest.progress || 0}%)`
    if (pendingTasks.length > 0) ctx += `\nPENDING_OPS: ${pendingTasks.slice(0, 5).map(t => `"${t.title}"(${t.difficulty || 'MEDIUM'})`).join(', ')}`
    if (completedTasks.length > 0) ctx += `\nCOMPLETED_TODAY: ${completedTasks.slice(0, 3).map(t => `"${t.title}"`).join(', ')}`
  }

  if (pathname === '/tasks') {
    const allPending = tasks?.tasks?.filter(t => t.status === 'pending') || []
    ctx += `\nALL_PENDING(${allPending.length}): ${allPending.slice(0, 6).map(t => `"${t.title}"(${t.difficulty},due:${t.due_date || 'none'})`).join(' | ')}`
  }

  if (pathname === '/goals') {
    ctx += `\nACTIVE_GOALS(${activeGoals.length}):`
    activeGoals.slice(0, 5).forEach(g => {
      ctx += `\n  - [${g.type.toUpperCase()}] "${g.title}" ${g.progress || 0}%${g.deadline ? ` deadline:${g.deadline.slice(0,10)}` : ''}`
    })
  }

  if (pathname === '/brain-dump') {
    ctx += `\nINBOX_ITEMS(${inboxItems.length}): ${inboxItems.slice(0, 8).map(i => `"${i.content.slice(0,50)}"(${i.type})`).join(' | ')}`
  }

  if (pathname === '/journal') {
    const recent = journal?.entries?.slice(0, 5) || []
    ctx += `\nRECENT_ENTRIES(${recent.length}): ${recent.map(e => `${e.date}(${e.mood})`).join(', ')}`
    if (todayEntry) ctx += `\nTODAY_ENTRY_PREVIEW: "${todayEntry.content?.slice(0, 100)}..."`
  }

  if (pathname === '/quests') {
    const activeHabits = habits?.habits?.filter(h => h.is_active) || []
    ctx += `\nACTIVE_HABITS(${activeHabits.length}): ${activeHabits.slice(0, 8).map(h => {
      const log = todayHabits.find(l => l.habit_id === h.id)
      return `"${h.title}"(${log?.status || 'pending'},streak:${h.current_streak || 0}d)`
    }).join(' | ')}`
  }

  if (pathname === '/profile') {
    const activeBattlesFull = blueprint?.battles?.filter(b => b.hp > 0) || []
    ctx += `\nWAR_ROOM_BATTLES: ${activeBattlesFull.map(b => `"${b.name}"(HP:${b.hp},${b.severity}): ${b.notes || ''}`).join(' | ')}`
    ctx += `\nMOTIVES: ${blueprint?.motives?.slice(0, 200) || 'Not defined'}`
  }

  if (pathname === '/xp') {
    ctx += `\nCHARACTER_STATS_DETAIL: ${Object.entries(stats).map(([k,v]) => `${k}(LV${v?.level || 1}, ${v?.xp || 0}xp)`).join(', ')}`
    ctx += `\nGOALS_COMPLETED: ${goals?.completedGoals?.length || 0} | FAILED: ${goals?.failedGoals?.length || 0}`
  }

  if (pathname === '/weekly-review') {
    const weekTasks = tasks?.tasks?.filter(t => t.status === 'completed' && isThisWeek(t.completed_at)) || []
    ctx += `\nWEEK_COMPLETED_TASKS: ${weekTasks.length} | HABIT_PCT: ${habitPct}%`
    if (sideQuests.length > 0) ctx += `\nSIDE_QUESTS_PROGRESS: ${sideQuests.slice(0, 3).map(g => `"${g.title}"(${g.progress || 0}%)`).join(', ')}`
  }

  return ctx.trim()
}

function isThisWeek(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return d >= startOfWeek
}
