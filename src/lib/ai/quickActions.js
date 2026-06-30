/**
 * LOKI Quick Actions
 * Page-aware preset prompts. Each returns a tight prompt string for Gemini.
 */

export const QUICK_ACTIONS = {
  '/dashboard': [
    {
      id: 'morning_briefing',
      label: 'Morning Briefing',
      icon: 'Sunrise',
      description: 'Tactical priorities for today',
      prompt: (ctx) => `${ctx}\n\nACTION: Morning Briefing. Based on my pending tasks, habit completion, main quest progress, and active battles — give me a sharp tactical briefing for today. Max 5 bullet points. Mention my biggest risk and #1 priority. Be direct, use my actual task/goal names.`
    },
    {
      id: 'end_of_day',
      label: 'End of Day Review',
      icon: 'Moon',
      description: 'Analyze what got done',
      prompt: (ctx) => `${ctx}\n\nACTION: End of Day Debrief. Analyze what I completed today vs what was pending. Was it a good day? What momentum do I carry into tomorrow? What failed and why might that be? Max 4 bullet points. Be honest, not motivational.`
    },
    {
      id: 'threat_analysis',
      label: 'Threat Analysis',
      icon: 'AlertTriangle',
      description: 'Where am I at risk?',
      prompt: (ctx) => `${ctx}\n\nACTION: Threat Analysis. Looking at my active battles, weaknesses, and today's habit/task performance — where am I most at risk right now? What pattern is emerging? Max 3 points, brutally honest.`
    }
  ],
  '/tasks': [
    {
      id: 'prioritize',
      label: 'Prioritize Ops',
      icon: 'Crosshair',
      description: 'Execution order for my tasks',
      prompt: (ctx) => `${ctx}\n\nACTION: Prioritize my pending operations. Given deadlines, difficulty, and alignment with my main quest and mission, give me a numbered execution order. Explain briefly why for top 3 items. Be tactical.`
    },
    {
      id: 'momentum_check',
      label: 'Momentum Check',
      icon: 'Zap',
      description: 'Am I on track this week?',
      prompt: (ctx) => `${ctx}\n\nACTION: Momentum check. Given my completed vs pending tasks, overdue items, and streak — is my execution momentum strong or breaking down? Give a 1-line verdict and 2 specific actions to improve. Be concise.`
    }
  ],
  '/goals': [
    {
      id: 'mission_report',
      label: 'Mission Status Report',
      icon: 'Target',
      description: 'Full goals analysis',
      prompt: (ctx) => `${ctx}\n\nACTION: Mission Status Report. Analyze all my active goals — progress, deadlines, alignment with my main mission. Which goals are on track, at risk, or stalling? Give 1 recommendation per goal type. Be specific.`
    },
    {
      id: 'generate_milestones',
      label: 'Goal Breakdown',
      icon: 'Layers',
      description: 'Break main quest into steps',
      prompt: (ctx) => `${ctx}\n\nACTION: Break down my main quest into 5 concrete weekly milestones I can execute in the next 5 weeks. Each milestone should be specific, measurable, and directly advance the mission. Format as numbered list.`
    }
  ],
  '/brain-dump': [
    {
      id: 'organize_inbox',
      label: 'Organize Inbox',
      icon: 'Cpu',
      description: 'Categorize + prioritize captures',
      prompt: (ctx) => `${ctx}\n\nACTION: Analyze my brain dump inbox items. For each: should it become a Task (actionable, specific), a Goal (bigger outcome), or be discarded (noise)? Group them. Be decisive. Flag any that align with my main quest.`
    },
    {
      id: 'extract_actions',
      label: 'Extract Actions',
      icon: 'CheckSquare',
      description: 'What needs to happen first?',
      prompt: (ctx) => `${ctx}\n\nACTION: From my inbox items, extract the top 3 highest-leverage actions I should take this week. Ignore noise. Focus on items that move my mission forward. Output as numbered action items.`
    }
  ],
  '/journal': [
    {
      id: 'reflection_prompts',
      label: 'Reflection Prompts',
      icon: 'BookOpen',
      description: 'Personalized journal questions',
      prompt: (ctx) => `${ctx}\n\nACTION: Generate 3 deep journal reflection prompts for today. Based on my mood trend, active battles (especially ${getTopBattle(ctx)}), and mission. Make them introspective, not generic. Questions only, no answers.`
    },
    {
      id: 'mood_analysis',
      label: 'Mood Pattern',
      icon: 'Activity',
      description: 'What my mood trend means',
      prompt: (ctx) => `${ctx}\n\nACTION: Analyze my recent mood trend. What pattern do you see? What's likely driving it based on my battles and current execution level? What's one practical shift to improve it? Keep it under 4 sentences.`
    }
  ],
  '/quests': [
    {
      id: 'habit_intel',
      label: 'Habit Intelligence',
      icon: 'Flame',
      description: 'Which habits need attention',
      prompt: (ctx) => `${ctx}\n\nACTION: Analyze my habit performance. Which routines are slipping? Which are strong? Given my active battles (especially phone addiction and inconsistency), what habit adjustment would have the highest impact right now? Be specific.`
    },
    {
      id: 'streak_risk',
      label: 'Streak Risk Assessment',
      icon: 'ShieldAlert',
      description: 'What threatens my streak',
      prompt: (ctx) => `${ctx}\n\nACTION: Streak Risk Assessment. Given my current ${extractStreak(ctx)}-day streak, what behaviors from my battle list and weaknesses most threaten to break it today? Give me 2 specific defensive actions to protect it.`
    }
  ],
  '/xp': [
    {
      id: 'xp_strategy',
      label: 'XP Growth Strategy',
      icon: 'TrendingUp',
      description: 'How to level up faster',
      prompt: (ctx) => `${ctx}\n\nACTION: Analyze my XP and stat distribution. Which stat categories am I neglecting? What combination of habits, tasks, and goals would give me the most XP gains this week while aligning with my mission? Give a specific 3-point strategy.`
    }
  ],
  '/profile': [
    {
      id: 'battle_strategy',
      label: 'Battle Strategy',
      icon: 'Swords',
      description: 'Tactical advice for my battles',
      prompt: (ctx) => `${ctx}\n\nACTION: War Room Analysis. For each of my active battles, give one specific, concrete countermeasure I haven't tried yet. Be tactical. Reference my linked habits and known weaknesses. No generic advice.`
    },
    {
      id: 'identity_audit',
      label: 'Identity Audit',
      icon: 'User',
      description: 'Am I living my mission?',
      prompt: (ctx) => `${ctx}\n\nACTION: Identity Audit. Compare what I say I am (identity/mission) with what I'm actually doing (tasks done, habits, battles). Am I living in alignment? Where is the biggest gap? Be brutally honest in 3 sentences.`
    }
  ],
  '/weekly-review': [
    {
      id: 'weekly_summary',
      label: 'Generate Summary',
      icon: 'ClipboardList',
      description: 'Auto-draft your weekly debrief',
      prompt: (ctx) => `${ctx}\n\nACTION: Generate my weekly review. Wins, losses, habit performance, key lesson, and the #1 focus for next week. Format with clear sections. Use my actual data. Be concise but complete.`
    }
  ],
  '/screen-time': [
    {
      id: 'screen_strategy',
      label: 'Screen Time Strategy',
      icon: 'Monitor',
      description: 'Beat the phone addiction',
      prompt: (ctx) => `${ctx}\n\nACTION: Screen time strategy. Given that phone addiction is one of my active battles, give me 3 specific behavioral interventions for this week that I can implement immediately. Make them specific, not generic.`
    }
  ]
}

// Default actions for any page not explicitly mapped
export const DEFAULT_ACTIONS = [
  {
    id: 'status_check',
    label: 'Status Check',
    icon: 'Activity',
    description: 'How am I doing right now?',
    prompt: (ctx) => `${ctx}\n\nACTION: Quick status check. Given all my data, give me a 3-line summary: overall momentum, biggest win, biggest risk. Be direct.`
  },
  {
    id: 'focus_advice',
    label: 'What To Focus On',
    icon: 'Crosshair',
    description: 'Top priority right now',
    prompt: (ctx) => `${ctx}\n\nACTION: What single thing should I focus on right now to best advance my mission? Consider my pending tasks, energy (mood trend), and battles. One answer only, with a brief reason.`
  }
]

export function getActionsForPage(pathname) {
  return QUICK_ACTIONS[pathname] || DEFAULT_ACTIONS
}

// Helper to extract streak from context string
function extractStreak(ctx) {
  const match = ctx.match(/STREAK: (\d+)d/)
  return match ? match[1] : '?'
}

// Helper to extract top battle name from context
function getTopBattle(ctx) {
  const match = ctx.match(/ACTIVE_BATTLES: ([^(,\n]+)/)
  return match ? match[1].trim() : 'your battles'
}
