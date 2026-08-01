-- ============================================================
-- LOKI OS: DEDICATED WORK HOURS LOGS TABLE (Fixes table collision)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.work_hours_logs (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                 DATE        NOT NULL,
  total_hours_worked   DECIMAL     DEFAULT 0,
  beyond_tatva_hours   DECIMAL     DEFAULT 0,
  focused_hours        DECIMAL     DEFAULT 0,
  unfocused_hours      DECIMAL     DEFAULT 0,
  deep_execution_hours DECIMAL     DEFAULT 0,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT work_hours_logs_user_date_key UNIQUE (user_id, date)
);

-- Enable RLS & Policies
ALTER TABLE public.work_hours_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_work_hours_logs_all" ON public.work_hours_logs;
CREATE POLICY "user_work_hours_logs_all" ON public.work_hours_logs FOR ALL USING (auth.uid() = user_id);

-- Also add columns to work_logs in case of fallback
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS total_hours_worked DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS beyond_tatva_hours DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS focused_hours DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS unfocused_hours DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS deep_execution_hours DECIMAL DEFAULT 0;
