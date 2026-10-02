-- Budget Logs Schema
-- Run in Supabase SQL editor or via migrations

CREATE TABLE IF NOT EXISTS public.budget_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL,
  custom_category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for rapid querying by user, date, and category
CREATE INDEX IF NOT EXISTS idx_budget_logs_user_date ON public.budget_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_user_category ON public.budget_logs(user_id, category);

-- Row Level Security
ALTER TABLE public.budget_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget logs"
  ON public.budget_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget logs"
  ON public.budget_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget logs"
  ON public.budget_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget logs"
  ON public.budget_logs FOR DELETE
  USING (auth.uid() = user_id);
