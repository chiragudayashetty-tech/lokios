// Round-2 features depend on supabase/migrations/20261006_round2.sql. Until it
// has been run, Supabase answers with "missing table / column" errors; features
// catch them, hide themselves and show a one-line hint instead of breaking.

const MISSING_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST200', 'PGRST202', '42883'])

export function isMissingSchema(error) {
  if (!error) return false
  if (MISSING_CODES.has(error.code)) return true
  return /does not exist|could not find the (table|column|function)|schema cache/i.test(error.message || '')
}

export const ROUND2_MIGRATION = 'supabase/migrations/20261006_round2.sql'
