-- Sleep logging (#24) on databases where sleep_logs existed before Round 2 with
-- other columns ("Could not find the 'duration_minutes' column"). Safe to re-run.
alter table public.sleep_logs add column if not exists bedtime timestamptz;
alter table public.sleep_logs add column if not exists wake_time timestamptz;
alter table public.sleep_logs add column if not exists duration_minutes int;
alter table public.sleep_logs add column if not exists quality int;
alter table public.sleep_logs add column if not exists score int;
alter table public.sleep_logs add column if not exists created_at timestamptz default now();

-- Saving upserts on (user_id, date): needs a unique index (skipped if duplicates exist)
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'sleep_logs' and indexname = 'sleep_logs_user_date_key')
     and not exists (select 1 from public.sleep_logs group by user_id, date having count(*) > 1) then
    create unique index sleep_logs_user_date_key on public.sleep_logs (user_id, date);
  end if;
end $$;

alter table public.sleep_logs enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sleep_logs' and policyname = 'sleep_logs_owner') then
    create policy sleep_logs_owner on public.sleep_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

notify pgrst, 'reload schema';
