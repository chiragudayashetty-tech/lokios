export const XP_RULES = {
  HABIT: {
    COMPLETION: 25,
    MISS: -15, 
  },
  TASK: {
    EASY: 15,
    MEDIUM: 30,
    HARD: 60,
    EXTREME: 120,
    LATE_MULTIPLIER: 0.5, 
  },
  SCREEN_TIME: {
    PERFECT_DAY: 30, // 0 doomscroll
    MODERATE: 10,    // < 30 mins doomscroll
    PENALTY: -30,    // > 60 mins doomscroll
  }
}
