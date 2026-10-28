// Task category → character stat that its XP feeds.
const TASK_CATEGORY_TO_STAT = {
  beyond_tatva: 'founder',
  founder: 'founder',
  personal_mission: 'discipline',
  discipline: 'discipline',
  learning: 'learning',
  communication: 'communication',
  creation: 'creation',
  other: 'creation',
  personal_care: 'creation',
  fitness: 'strength',
  strength: 'strength',
  weekly_goal: 'discipline',
}
export const toStatCat = (cat) => TASK_CATEGORY_TO_STAT[(cat || '').toLowerCase()] || 'discipline'
