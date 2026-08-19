export const QUEST_CATEGORIES = [
  { id: 'beyond_tatva', name: 'Beyond Tatva', icon: 'Rocket', color: '#d4a843', stat_category: 'founder' },
  { id: 'personal_mission', name: 'Personal Mission', icon: 'Target', color: '#e74c3c', stat_category: 'discipline' },
  { id: 'learning', name: 'Learning', icon: 'BookOpen', color: '#3498db', stat_category: 'learning' },
  { id: 'other', name: 'Other', icon: 'Sparkles', color: '#9b59b6', stat_category: 'creation' },
  { id: 'founder', name: 'Founder (Legacy)', icon: 'Rocket', color: '#d4a843', stat_category: 'founder' },
  { id: 'discipline', name: 'Discipline (Legacy)', icon: 'Target', color: '#e74c3c', stat_category: 'discipline' },
  { id: 'personal_care', name: 'Personal Care (Legacy)', icon: 'Sparkles', color: '#9b59b6', stat_category: 'creation' },
  { id: 'fitness', name: 'Fitness (Legacy)', icon: 'Dumbbell', color: '#2ecc71', stat_category: 'fitness' }
];

export const STAT_CATEGORIES = [
  { id: 'founder', name: 'Founder', icon: 'Rocket', color: '#d4a843' },
  { id: 'discipline', name: 'Discipline', icon: 'Target', color: '#e74c3c' },
  { id: 'communication', name: 'Communication', icon: 'MessageSquare', color: '#2ecc71' },
  { id: 'learning', name: 'Learning', icon: 'BookOpen', color: '#3498db' },
  { id: 'creation', name: 'Creation', icon: 'Palette', color: '#9b59b6' },
  { id: 'strength', name: 'Strength', icon: 'Dumbbell', color: '#e67e22' },
];

export const RANK_CONFIG = {
  Fallen: { code: 'Fallen', name: 'The Fallen', minXp: -999999, maxXp: -1, minLvl: 0, maxLvl: 0, icon: '💀', color: '#EF4444' },
  I:      { code: 'I',      name: 'The Awakening', minXp: 0, maxXp: 4999, minLvl: 1, maxLvl: 10, icon: '🛡️', color: '#5267FF' },
  II:     { code: 'II',     name: 'The Discipline Rebuild', minXp: 5000, maxXp: 14449, minLvl: 11, maxLvl: 17, icon: '🗡️', color: '#30D6A0' },
  III:    { code: 'III',    name: 'The Spark', minXp: 14450, maxXp: 33799, minLvl: 18, maxLvl: 26, icon: '◆', color: '#FF7418' },
  IV:     { code: 'IV',     name: 'The Architect', minXp: 33800, maxXp: 72199, minLvl: 27, maxLvl: 38, icon: '⬡', color: '#805CFF' },
  V:      { code: 'V',      name: 'The King', minXp: 72200, maxXp: 145799, minLvl: 39, maxLvl: 54, icon: '✦', color: '#FFD166' },
  VI:     { code: 'VI',     name: 'The Empire', minXp: 145800, maxXp: 296449, minLvl: 55, maxLvl: 77, icon: '★', color: '#E63CFF' },
  VII:    { code: 'VII',    name: 'The Legacy', minXp: 296450, maxXp: 490049, minLvl: 78, maxLvl: 99, icon: '♛', color: '#D8E4F5' },
  VIII:   { code: 'VIII',   name: 'Beyond', minXp: 490050, maxXp: 99999999, minLvl: 100, maxLvl: 999, icon: '∞', color: '#FFFFFF' }
};

export const SAGA_TITLES = {
  Fallen: 'The Fallen',
  I: 'The Awakening',
  II: 'The Discipline Rebuild',
  III: 'The Spark',
  IV: 'The Architect',
  V: 'The King',
  VI: 'The Empire',
  VII: 'The Legacy',
  VIII: 'Beyond',
};

export const SAGA_IMAGES = {
  Fallen: '/sagas/discipline-rebuild.png',
  I: '/sagas/discipline-rebuild.png',
  II: '/sagas/discipline-rebuild.png',
  III: '/sagas/the-spark.png',
  IV: '/sagas/the-architect.png',
  V: '/sagas/the-king.png',
  VI: '/sagas/the-empire.png',
  VII: '/sagas/the-legacy.png',
  VIII: '/sagas/Beyond.png',
  Beyond: '/sagas/Beyond.png',
};

export const ARC_CONFIG = [
  { rank: 'I',       name: 'The Awakening',          title: 'The Awakening',          flavor: 'The moment I stopped drifting and chose the life I wanted to build.', minLvl: 1, maxLvl: 10 },
  { rank: 'II',      name: 'The Discipline Rebuild', title: 'The Discipline Rebuild', flavor: 'I rebuilt my mind, habits, and identity one day at a time.', minLvl: 11, maxLvl: 17 },
  { rank: 'III',     name: 'The Spark',              title: 'The Spark',              flavor: 'Small actions became unstoppable momentum.', minLvl: 18, maxLvl: 26 },
  { rank: 'IV',      name: 'The Architect',          title: 'The Architect',          flavor: 'I stopped chasing success and started designing systems, businesses, and a better future.', minLvl: 27, maxLvl: 38 },
  { rank: 'V',       name: 'The King',               title: 'The King',               flavor: 'I learned to lead myself first, then earned the trust to lead others.', minLvl: 39, maxLvl: 54 },
  { rank: 'VI',      name: 'The Empire',             title: 'The Empire',             flavor: 'My work grew beyond me into companies, teams, and communities that create lasting value.', minLvl: 55, maxLvl: 77 },
  { rank: 'VII',     name: 'The Legacy',             title: 'The Legacy',             flavor: 'My greatest achievement became the people I inspired and the lives I changed.', minLvl: 78, maxLvl: 99 },
  { rank: 'VIII',    name: 'Beyond',                 title: 'Beyond',                 flavor: 'There is no finish line. Every summit reveals a higher mountain.', minLvl: 100, maxLvl: 999 },
];

export const LEVEL_THEMES = {
  // Saga I: The Awakening (LV 1–10)
  1:  { bg: '#05070D', accent: '#5267FF', secondary: '#252D52', border: '#12182A' },
  2:  { bg: '#060812', accent: '#5267FF', secondary: '#252D52', border: '#141B2E' },
  3:  { bg: '#070917', accent: '#5267FF', secondary: '#252D52', border: '#161E32' },
  4:  { bg: '#080A1C', accent: '#5267FF', secondary: '#252D52', border: '#182136' },
  5:  { bg: '#090B21', accent: '#5267FF', secondary: '#252D52', border: '#1A243A' },
  6:  { bg: '#0A0C26', accent: '#5267FF', secondary: '#252D52', border: '#1C273E' },
  7:  { bg: '#0B0D2B', accent: '#5267FF', secondary: '#252D52', border: '#1E2A42' },
  8:  { bg: '#0C0E30', accent: '#5267FF', secondary: '#252D52', border: '#202D46' },
  9:  { bg: '#0D0F35', accent: '#5267FF', secondary: '#252D52', border: '#222F4A' },
  10: { bg: '#0E103A', accent: '#5267FF', secondary: '#252D52', border: '#25324E' },

  // Saga II: The Discipline Rebuild (LV 11–17)
  11: { bg: '#07100F', accent: '#30D6A0', secondary: '#1D4B42', border: '#15302C' },
  12: { bg: '#08130F', accent: '#30D6A0', secondary: '#1D4B42', border: '#17342F' },
  13: { bg: '#091611', accent: '#30D6A0', secondary: '#1D4B42', border: '#193832' },
  14: { bg: '#0A1912', accent: '#30D6A0', secondary: '#1D4B42', border: '#1B3C35' },
  15: { bg: '#0B1C13', accent: '#30D6A0', secondary: '#1D4B42', border: '#1D4038' },
  16: { bg: '#0D1F15', accent: '#30D6A0', secondary: '#1D4B42', border: '#1F443B' },
  17: { bg: '#0F2217', accent: '#30D6A0', secondary: '#1D4B42', border: '#21483E' },

  // Saga III: The Spark (LV 18–26)
  18: { bg: '#100804', accent: '#FF7418', secondary: '#66300D', border: '#351B0C' },
  19: { bg: '#130904', accent: '#FF7418', secondary: '#66300D', border: '#3B1E0D' },
  20: { bg: '#160A04', accent: '#FF7418', secondary: '#66300D', border: '#41210E' },
  21: { bg: '#190B04', accent: '#FF7418', secondary: '#66300D', border: '#47240F' },
  22: { bg: '#1C0C04', accent: '#FF7418', secondary: '#66300D', border: '#4D2710' },
  23: { bg: '#200D04', accent: '#FF7418', secondary: '#66300D', border: '#532A11' },
  24: { bg: '#240E04', accent: '#FF7418', secondary: '#66300D', border: '#592D12' },
  25: { bg: '#280F04', accent: '#FF7418', secondary: '#66300D', border: '#5F3013' },
  26: { bg: '#2C1004', accent: '#FF7418', secondary: '#66300D', border: '#653313' },

  // Saga IV: The Architect (LV 27–38)
  27: { bg: '#090713', accent: '#805CFF', secondary: '#35265F', border: '#201638' },
  28: { bg: '#0B0816', accent: '#805CFF', secondary: '#35265F', border: '#24193D' },
  29: { bg: '#0D0919', accent: '#805CFF', secondary: '#35265F', border: '#281C42' },
  30: { bg: '#0F0A1C', accent: '#805CFF', secondary: '#35265F', border: '#2C1F47' },
  31: { bg: '#110B1F', accent: '#805CFF', secondary: '#35265F', border: '#30224C' },
  32: { bg: '#130C22', accent: '#805CFF', secondary: '#35265F', border: '#342551' },
  33: { bg: '#150D25', accent: '#805CFF', secondary: '#35265F', border: '#382856' },
  34: { bg: '#170E28', accent: '#805CFF', secondary: '#35265F', border: '#3C2B5B' },
  35: { bg: '#190F2B', accent: '#805CFF', secondary: '#35265F', border: '#402E60' },
  36: { bg: '#1B102E', accent: '#805CFF', secondary: '#35265F', border: '#443165' },
  37: { bg: '#1D1131', accent: '#805CFF', secondary: '#35265F', border: '#48346A' },
  38: { bg: '#1F1234', accent: '#805CFF', secondary: '#35265F', border: '#4C376F' },

  // Saga V: The King (LV 39–54)
  39: { bg: '#100C07', accent: '#FFD166', secondary: '#70531A', border: '#3A2B10' },
  40: { bg: '#120E07', accent: '#FFD166', secondary: '#70531A', border: '#403010' },
  41: { bg: '#140F07', accent: '#FFD166', secondary: '#70531A', border: '#463510' },
  42: { bg: '#161107', accent: '#FFD166', secondary: '#70531A', border: '#4C3A10' },
  43: { bg: '#181307', accent: '#FFD166', secondary: '#70531A', border: '#523F10' },
  44: { bg: '#1A1507', accent: '#FFD166', secondary: '#70531A', border: '#584410' },
  45: { bg: '#1C1707', accent: '#FFD166', secondary: '#70531A', border: '#5E4910' },
  46: { bg: '#1E1907', accent: '#FFD166', secondary: '#70531A', border: '#644E10' },
  47: { bg: '#201B07', accent: '#FFD166', secondary: '#70531A', border: '#6A5310' },
  48: { bg: '#221D07', accent: '#FFD166', secondary: '#70531A', border: '#705810' },
  49: { bg: '#241F07', accent: '#FFD166', secondary: '#70531A', border: '#765D10' },
  50: { bg: '#262107', accent: '#FFD166', secondary: '#70531A', border: '#7C6210' },
  51: { bg: '#282307', accent: '#FFD166', secondary: '#70531A', border: '#826710' },
  52: { bg: '#2A2507', accent: '#FFD166', secondary: '#70531A', border: '#886C10' },
  53: { bg: '#2C2707', accent: '#FFD166', secondary: '#70531A', border: '#8E7110' },
  54: { bg: '#2E2907', accent: '#FFD166', secondary: '#70531A', border: '#947610' },

  // Saga VI: The Empire (LV 55–77)
  55: { bg: '#09060B', accent: '#E63CFF', secondary: '#641C70', border: '#32113A' },
  56: { bg: '#0B0710', accent: '#E63CFF', secondary: '#641C70', border: '#38133F' },
  57: { bg: '#0D0815', accent: '#E63CFF', secondary: '#641C70', border: '#3E1544' },
  58: { bg: '#0F091A', accent: '#E63CFF', secondary: '#641C70', border: '#441749' },
  59: { bg: '#110A1F', accent: '#E63CFF', secondary: '#641C70', border: '#4A194E' },
  60: { bg: '#130B24', accent: '#E63CFF', secondary: '#641C70', border: '#501B53' },
  61: { bg: '#150C29', accent: '#E63CFF', secondary: '#641C70', border: '#561D58' },
  62: { bg: '#170D2E', accent: '#E63CFF', secondary: '#641C70', border: '#5C1F5D' },
  63: { bg: '#190E33', accent: '#E63CFF', secondary: '#641C70', border: '#622162' },
  64: { bg: '#1B0F38', accent: '#E63CFF', secondary: '#641C70', border: '#682367' },
  65: { bg: '#1D103D', accent: '#E63CFF', secondary: '#641C70', border: '#6E256C' },
  66: { bg: '#1F1142', accent: '#E63CFF', secondary: '#641C70', border: '#742771' },
  67: { bg: '#211247', accent: '#E63CFF', secondary: '#641C70', border: '#7A2976' },
  68: { bg: '#23134C', accent: '#E63CFF', secondary: '#641C70', border: '#802B7B' },
  69: { bg: '#251451', accent: '#E63CFF', secondary: '#641C70', border: '#862D80' },
  70: { bg: '#271556', accent: '#E63CFF', secondary: '#641C70', border: '#8C2F85' },
  71: { bg: '#29165B', accent: '#E63CFF', secondary: '#641C70', border: '#92318A' },
  72: { bg: '#2B1760', accent: '#E63CFF', secondary: '#641C70', border: '#98338F' },
  73: { bg: '#2D1865', accent: '#E63CFF', secondary: '#641C70', border: '#9E3594' },
  74: { bg: '#2F196A', accent: '#E63CFF', secondary: '#641C70', border: '#A43799' },
  75: { bg: '#311A6F', accent: '#E63CFF', secondary: '#641C70', border: '#AA399E' },
  76: { bg: '#331B74', accent: '#E63CFF', secondary: '#641C70', border: '#B03BA3' },
  77: { bg: '#351C79', accent: '#E63CFF', secondary: '#641C70', border: '#B63DA8' },

  // Saga VII: The Legacy (LV 78–99)
  78: { bg: '#080A0D', accent: '#D8E4F5', secondary: '#566476', border: '#252D37' },
  79: { bg: '#0A0C0F', accent: '#D8E4F5', secondary: '#566476', border: '#29323D' },
  80: { bg: '#0C0E11', accent: '#D8E4F5', secondary: '#566476', border: '#2D3743' },
  81: { bg: '#0E1013', accent: '#D8E4F5', secondary: '#566476', border: '#313C49' },
  82: { bg: '#101215', accent: '#D8E4F5', secondary: '#566476', border: '#35414F' },
  83: { bg: '#121417', accent: '#D8E4F5', secondary: '#566476', border: '#394555' },
  84: { bg: '#141619', accent: '#D8E4F5', secondary: '#566476', border: '#3D495B' },
  85: { bg: '#16181B', accent: '#D8E4F5', secondary: '#566476', border: '#414D61' },
  86: { bg: '#181A1D', accent: '#D8E4F5', secondary: '#566476', border: '#455167' },
  87: { bg: '#1A1C1F', accent: '#D8E4F5', secondary: '#566476', border: '#49556D' },
  88: { bg: '#1C1E21', accent: '#D8E4F5', secondary: '#566476', border: '#4D5973' },
  89: { bg: '#1E2023', accent: '#D8E4F5', secondary: '#566476', border: '#515D79' },
  90: { bg: '#202225', accent: '#D8E4F5', secondary: '#566476', border: '#55617F' },
  91: { bg: '#222427', accent: '#D8E4F5', secondary: '#566476', border: '#596585' },
  92: { bg: '#242629', accent: '#D8E4F5', secondary: '#566476', border: '#5D698B' },
  93: { bg: '#26282B', accent: '#D8E4F5', secondary: '#566476', border: '#616D91' },
  94: { bg: '#282A2D', accent: '#D8E4F5', secondary: '#566476', border: '#657197' },
  95: { bg: '#2A2C2F', accent: '#D8E4F5', secondary: '#566476', border: '#69759D' },
  96: { bg: '#2C2E31', accent: '#D8E4F5', secondary: '#566476', border: '#6D79A3' },
  97: { bg: '#2E3033', accent: '#D8E4F5', secondary: '#566476', border: '#717DA9' },
  98: { bg: '#303235', accent: '#D8E4F5', secondary: '#566476', border: '#7581AF' },
  99: { bg: '#323437', accent: '#D8E4F5', secondary: '#566476', border: '#7985B5' },

  // Saga VIII: Beyond (LV 100+)
  100: { bg: '#020204', accent: '#FFFFFF', secondary: '#8A8D98', border: '#595B63' },
};

export const XP_REWARDS = {
  task_complete: 10,
  habit_complete: 5,
  journal_full: 10,
  journal_partial: 10,
  goal_complete_main: 100,
  goal_complete_side: 50,
  goal_complete_weekly: 30,
  goal_complete_long_term: 200,
  brain_dump_capture: 2,
  streak_7_days: 50,
  streak_30_days: 200,
  streak_100_days: 500,
  daily_all_habits: 25,
  weekly_review: 5,
  FOCUS_HOUR: 60
};

export const DIFFICULTY_LEVELS = {
  NONE: { id: 'NONE', label: 'NONE', xp: 0, penalty: 0, color: 'var(--text-muted)' },
  EASY: { id: 'EASY', label: 'EASY', xp: 15, penalty: 0, color: 'var(--info)' },
  MEDIUM: { id: 'MEDIUM', label: 'MEDIUM', xp: 30, penalty: 10, color: 'var(--accent-primary)' },
  HARD: { id: 'HARD', label: 'HARD', xp: 60, penalty: 25, color: 'var(--warning)' },
  EXTREME: { id: 'EXTREME', label: 'EXTREME', xp: 120, penalty: 50, color: 'var(--danger)' }
};

export const MOOD_EMOJIS = [
  { value: 1, emoji: '😞', label: 'Terrible' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' }
];

export const TASK_TYPES = ['one_time', 'recurring', 'quest'];
export const GOAL_TYPES = ['main_quest', 'side_quest', 'long_term', 'weekly', 'daily'];
export const BRAIN_DUMP_TYPES = ['idea', 'task', 'goal', 'note', 'random'];
