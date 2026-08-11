-- ============================================================
-- LOKI OS: Speaking Logs Table + Work Logs Schema Fix
-- Run this in Supabase SQL Editor to fix cross-device sync
-- ============================================================

-- 1. Create speaking_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.speaking_logs (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                   DATE        NOT NULL,
  topic                  TEXT,
  category               TEXT        DEFAULT 'General',
  day_number             INT         DEFAULT 1,
  prep_duration_minutes  INT         DEFAULT 10,
  drive_link             TEXT,
  notes                  TEXT,
  rating                 INT         DEFAULT 5,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on speaking_logs
ALTER TABLE public.speaking_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_speaking_logs_all" ON public.speaking_logs;
CREATE POLICY "user_speaking_logs_all" ON public.speaking_logs FOR ALL USING (auth.uid() = user_id);

-- 2. Add missing columns to work_logs that the app tries to insert
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'project_work';
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS duration_hours DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS work_type TEXT;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS hours DECIMAL DEFAULT 0;

-- 3. Add missing columns to work_hours_logs
ALTER TABLE public.work_hours_logs ADD COLUMN IF NOT EXISTS hours DECIMAL DEFAULT 0;
ALTER TABLE public.work_hours_logs ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'General';

-- Done! Now speaking_logs and work_logs both have the correct schema.
-- The app can now save and fetch data across phone and desktop.
