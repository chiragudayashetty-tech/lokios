-- Migration: Add exclude_daily column to budget_logs
-- Supports separate tracking for Subscriptions & Bills outside daily allowance
ALTER TABLE public.budget_logs ADD COLUMN IF NOT EXISTS exclude_daily BOOLEAN DEFAULT false;

-- Create index on exclude_daily for rapid querying
CREATE INDEX IF NOT EXISTS idx_budget_logs_exclude_daily ON public.budget_logs(user_id, exclude_daily);
