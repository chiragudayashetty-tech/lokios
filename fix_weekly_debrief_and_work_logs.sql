-- ==============================================================================
-- LOKI OS: FIX WEEKLY DEBRIEF & WORK LOGS CONFLICT MIGRATION
-- ==============================================================================
-- Run this in your Supabase SQL Editor to resolve:
-- 1. Weekly debriefs not saving due to date collision with work sessions on Sundays.
-- 2. Tasks table weekly_goal category compatibility.
-- 3. RLS permissions for smooth cross-device sync between Phone & Laptop.
-- ==============================================================================

-- 1. DROP the restrictive UNIQUE (user_id, date) constraint from public.work_logs.
-- Daily work hours are already uniquely constrained in public.work_hours_logs.
-- public.work_logs is a multi-event log (holding weekly debriefs, tasks, portfolio items),
-- so it must allow multiple entries per user on the same date (e.g. Sunday work + debrief).
ALTER TABLE public.work_logs DROP CONSTRAINT IF EXISTS work_logs_user_date_key;

-- 2. DROP type check constraint if present so any log type is accepted
ALTER TABLE public.work_logs DROP CONSTRAINT IF EXISTS work_logs_type_check;

-- 3. Ensure category column exists in tasks table for weekly debrief priorities
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'weekly_goal';

-- 4. Ensure full RLS policies on public.work_logs for all actions
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_work_logs_all" ON public.work_logs;
CREATE POLICY "user_work_logs_all" ON public.work_logs 
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 5. Ensure full RLS policies on public.tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
CREATE POLICY "Users can manage their own tasks" ON public.tasks 
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 6. Indexes for instant debrief retrieval on Phone & Desktop
CREATE INDEX IF NOT EXISTS idx_work_logs_debrief_user 
  ON public.work_logs (user_id, title) 
  WHERE title ILIKE 'Weekly Debrief%';

CREATE INDEX IF NOT EXISTS idx_tasks_weekly_goal 
  ON public.tasks (user_id, category) 
  WHERE category = 'weekly_goal';
