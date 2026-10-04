-- Repair for databases where Round 2 tables already existed with other columns or
-- security rules ("Could not find the 'x' column", "new row violates row-level
-- security policy"). Adds every missing column, the unique keys saves rely on, and an
-- owner-only policy on each table. Safe to run more than once, before or after
-- 20261006_round2.sql.
-- Only tables that already exist are touched; run 20261006_round2.sql afterwards to create any that are missing.

-- daily_reviews
do $$
begin
  if to_regclass('public.daily_reviews') is not null then
    execute $q$alter table public.daily_reviews add column if not exists id uuid default gen_random_uuid()$q$;
    execute $q$alter table public.daily_reviews add column if not exists user_id uuid$q$;
    execute $q$alter table public.daily_reviews add column if not exists date date$q$;
    execute $q$alter table public.daily_reviews add column if not exists mood int$q$;
    execute $q$alter table public.daily_reviews add column if not exists energy int$q$;
    execute $q$alter table public.daily_reviews add column if not exists win text$q$;
    execute $q$alter table public.daily_reviews add column if not exists intention text$q$;
    execute $q$alter table public.daily_reviews add column if not exists created_at timestamptz default now()$q$;
  end if;
end $$;

-- goal_milestones
do $$
begin
  if to_regclass('public.goal_milestones') is not null then
    execute $q$alter table public.goal_milestones add column if not exists id uuid default gen_random_uuid()$q$;
    execute $q$alter table public.goal_milestones add column if not exists user_id uuid$q$;
    execute $q$alter table public.goal_milestones add column if not exists goal_id uuid$q$;
    execute $q$alter table public.goal_milestones add column if not exists title text$q$;
    execute $q$alter table public.goal_milestones add column if not exists target_date date$q$;
    execute $q$alter table public.goal_milestones add column if not exists done_at timestamptz$q$;
    execute $q$alter table public.goal_milestones add column if not exists position int default 0$q$;
    execute $q$alter table public.goal_milestones add column if not exists created_at timestamptz default now()$q$;
  end if;
end $$;

-- sleep_logs
do $$
begin
  if to_regclass('public.sleep_logs') is not null then
    execute $q$alter table public.sleep_logs add column if not exists id uuid default gen_random_uuid()$q$;
    execute $q$alter table public.sleep_logs add column if not exists user_id uuid$q$;
    execute $q$alter table public.sleep_logs add column if not exists date date$q$;
    execute $q$alter table public.sleep_logs add column if not exists bedtime timestamptz$q$;
    execute $q$alter table public.sleep_logs add column if not exists wake_time timestamptz$q$;
    execute $q$alter table public.sleep_logs add column if not exists duration_minutes int$q$;
    execute $q$alter table public.sleep_logs add column if not exists quality int$q$;
    execute $q$alter table public.sleep_logs add column if not exists score int$q$;
    execute $q$alter table public.sleep_logs add column if not exists created_at timestamptz default now()$q$;
  end if;
end $$;

-- subscriptions
do $$
begin
  if to_regclass('public.subscriptions') is not null then
    execute $q$alter table public.subscriptions add column if not exists id uuid default gen_random_uuid()$q$;
    execute $q$alter table public.subscriptions add column if not exists user_id uuid$q$;
    execute $q$alter table public.subscriptions add column if not exists name text$q$;
    execute $q$alter table public.subscriptions add column if not exists amount numeric$q$;
    execute $q$alter table public.subscriptions add column if not exists currency text default 'INR'$q$;
    execute $q$alter table public.subscriptions add column if not exists cycle text default 'monthly'$q$;
    execute $q$alter table public.subscriptions add column if not exists billing_day int$q$;
    execute $q$alter table public.subscriptions add column if not exists next_charge_date date$q$;
    execute $q$alter table public.subscriptions add column if not exists category text default 'subscriptions'$q$;
    execute $q$alter table public.subscriptions add column if not exists active boolean default true$q$;
    execute $q$alter table public.subscriptions add column if not exists created_at timestamptz default now()$q$;
  end if;
end $$;

-- savings_goals
do $$
begin
  if to_regclass('public.savings_goals') is not null then
    execute $q$alter table public.savings_goals add column if not exists id uuid default gen_random_uuid()$q$;
    execute $q$alter table public.savings_goals add column if not exists user_id uuid$q$;
    execute $q$alter table public.savings_goals add column if not exists name text$q$;
    execute $q$alter table public.savings_goals add column if not exists emoji text$q$;
    execute $q$alter table public.savings_goals add column if not exists target_amount numeric$q$;
    execute $q$alter table public.savings_goals add column if not exists saved_amount numeric default 0$q$;
    execute $q$alter table public.savings_goals add column if not exists target_date date$q$;
    execute $q$alter table public.savings_goals add column if not exists completed_at timestamptz$q$;
    execute $q$alter table public.savings_goals add column if not exists created_at timestamptz default now()$q$;
  end if;
end $$;

-- savings_entries
do $$
begin
  if to_regclass('public.savings_entries') is not null then
    execute $q$alter table public.savings_entries add column if not exists id uuid default gen_random_uuid()$q$;
    execute $q$alter table public.savings_entries add column if not exists user_id uuid$q$;
    execute $q$alter table public.savings_entries add column if not exists goal_id uuid$q$;
    execute $q$alter table public.savings_entries add column if not exists amount numeric$q$;
    execute $q$alter table public.savings_entries add column if not exists note text$q$;
    execute $q$alter table public.savings_entries add column if not exists created_at timestamptz default now()$q$;
  end if;
end $$;

-- portfolio_items
do $$
begin
  if to_regclass('public.portfolio_items') is not null then
    execute $q$alter table public.portfolio_items add column if not exists id uuid default gen_random_uuid()$q$;
    execute $q$alter table public.portfolio_items add column if not exists user_id uuid$q$;
    execute $q$alter table public.portfolio_items add column if not exists title text$q$;
    execute $q$alter table public.portfolio_items add column if not exists description text$q$;
    execute $q$alter table public.portfolio_items add column if not exists impact text$q$;
    execute $q$alter table public.portfolio_items add column if not exists cover_url text$q$;
    execute $q$alter table public.portfolio_items add column if not exists links jsonb default '[]'::jsonb$q$;
    execute $q$alter table public.portfolio_items add column if not exists tags text[] default '{}'$q$;
    execute $q$alter table public.portfolio_items add column if not exists shipped_on date$q$;
    execute $q$alter table public.portfolio_items add column if not exists goal_id uuid$q$;
    execute $q$alter table public.portfolio_items add column if not exists created_at timestamptz default now()$q$;
  end if;
end $$;

-- achievements
do $$
begin
  if to_regclass('public.achievements') is not null then
    execute $q$alter table public.achievements add column if not exists user_id uuid$q$;
    execute $q$alter table public.achievements add column if not exists achievement_id text$q$;
    execute $q$alter table public.achievements add column if not exists earned_at timestamptz default now()$q$;
  end if;
end $$;

-- Unique keys the app upserts on (skipped when the table is missing or has duplicate rows)
do $$
declare k record; dup boolean;
begin
  for k in select * from (values
    ('daily_reviews', 'user_id, date'),
    ('sleep_logs', 'user_id, date'),
    ('achievements', 'user_id, achievement_id')
  ) as v(tbl, cols) loop
    continue when to_regclass('public.' || k.tbl) is null;
    continue when exists (
      select 1 from pg_index i
      where i.indrelid = ('public.' || k.tbl)::regclass and i.indisunique
        and (select string_agg(a.attname, ', ' order by array_position(i.indkey::int2[], a.attnum))
             from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any(i.indkey)) = k.cols);
    execute format('select exists (select 1 from public.%I group by %s having count(*) > 1)', k.tbl, k.cols) into dup;
    if dup then
      raise notice 'Skipped unique key on %(%): duplicate rows exist', k.tbl, k.cols;
    else
      execute format('create unique index %I on public.%I (%s)', k.tbl || '_' || replace(k.cols, ', ', '_') || '_key', k.tbl, k.cols);
    end if;
  end loop;
end $$;

-- Owner-only access on every Round 2 table
do $$
declare t text;
begin
  foreach t in array array['daily_reviews', 'goal_milestones', 'sleep_logs', 'subscriptions', 'savings_goals', 'savings_entries', 'portfolio_items', 'achievements'] loop
    continue when to_regclass('public.' || t) is null;
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_owner') then
      execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_owner', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
