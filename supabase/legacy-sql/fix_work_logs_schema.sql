-- SQL Script to ensure work_logs and content_logs tables are properly structured for Chirag OS
CREATE TABLE IF NOT EXISTS public.work_logs (
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
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist if table was previously created for portfolio logs
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS total_hours_worked DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS beyond_tatva_hours DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS focused_hours DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS unfocused_hours DECIMAL DEFAULT 0;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS deep_execution_hours DECIMAL DEFAULT 0;

-- Drop existing unique constraint if present before adding
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_logs_user_date_key'
  ) THEN
    ALTER TABLE public.work_logs ADD CONSTRAINT work_logs_user_date_key UNIQUE (user_id, date);
  END IF;
END $$;

-- Enable RLS & Policies
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_work_logs_all" ON public.work_logs;
CREATE POLICY "user_work_logs_all" ON public.work_logs FOR ALL USING (auth.uid() = user_id);

-- Ensure content_logs table exists
CREATE TABLE IF NOT EXISTS public.content_logs (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                  DATE        NOT NULL,
  shoot_hours           DECIMAL     DEFAULT 0,
  shoot_raw_minutes     DECIMAL     DEFAULT 0,
  edit_hours            DECIMAL     DEFAULT 0,
  edit_finished_minutes DECIMAL     DEFAULT 0,
  notes                 TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_logs_user_date_key'
  ) THEN
    ALTER TABLE public.content_logs ADD CONSTRAINT content_logs_user_date_key UNIQUE (user_id, date);
  END IF;
END $$;

ALTER TABLE public.content_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_content_logs_all" ON public.content_logs;
CREATE POLICY "user_content_logs_all" ON public.content_logs FOR ALL USING (auth.uid() = user_id);
