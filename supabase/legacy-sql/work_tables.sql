-- ============================================================
-- LOKI OS: WORK & CONTENT LOGS TABLE MIGRATION
-- ============================================================

-- 1. Create work_logs table
CREATE TABLE IF NOT EXISTS public.work_logs (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                 DATE        NOT NULL,
  total_hours_worked   DECIMAL     DEFAULT 0,
  beyond_tatva_hours   DECIMAL     DEFAULT 0,
  focused_hours        DECIMAL     DEFAULT 0,
  deep_execution_hours DECIMAL     DEFAULT 0,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT work_logs_user_date_key UNIQUE (user_id, date)
);

-- 2. Create content_logs table
CREATE TABLE IF NOT EXISTS public.content_logs (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                  DATE        NOT NULL,
  shoot_hours           DECIMAL     DEFAULT 0,
  shoot_raw_minutes     DECIMAL     DEFAULT 0,
  edit_hours            DECIMAL     DEFAULT 0,
  edit_finished_minutes DECIMAL     DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT content_logs_user_date_key UNIQUE (user_id, date)
);

-- 3. Enable RLS
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "user_work_logs_all" ON public.work_logs;
CREATE POLICY "user_work_logs_all" ON public.work_logs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_content_logs_all" ON public.content_logs;
CREATE POLICY "user_content_logs_all" ON public.content_logs FOR ALL USING (auth.uid() = user_id);
