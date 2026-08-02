-- SQL Script to ensure tasks and xp_history tables are fully set up with proper RLS for Chirag OS
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'custom',
  category TEXT DEFAULT 'weekly_goal',
  due_date DATE,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
CREATE POLICY "Users can manage their own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.xp_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  description TEXT,
  stat_category TEXT DEFAULT 'discipline',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own xp_history" ON public.xp_history;
CREATE POLICY "Users can manage their own xp_history" ON public.xp_history FOR ALL USING (auth.uid() = user_id);
