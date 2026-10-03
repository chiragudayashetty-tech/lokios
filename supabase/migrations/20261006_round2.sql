-- ════════════════════════════════════════════════════════════════════════════
-- ROUND 2 — tasks board, today timeline, missions roadmap, calendar blocks,
-- brain dump inbox, habit chains, sleep, subscriptions, savings jars, profile,
-- portfolio, achievements, screen-time import.
--
-- Safe to run more than once (everything is "if not exists" / "or replace").
-- The app hides each feature with a one-line hint until its part has run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── #36 Tasks board ─────────────────────────────────────────────────────────
alter table public.tasks add column if not exists subtasks jsonb not null default '[]'::jsonb; -- [{id,title,done}]
alter table public.tasks add column if not exists estimate_minutes int;
alter table public.tasks add column if not exists actual_minutes int;
alter table public.tasks add column if not exists position int; -- order inside a column

-- ── #41 Today timeline / #24 / Insights ────────────────────────────────────
alter table public.habits add column if not exists time_of_day text default 'anytime';
do $$ begin
  alter table public.habits add constraint habits_time_of_day_chk
    check (time_of_day in ('morning', 'afternoon', 'evening', 'anytime'));
exception when duplicate_object then null; end $$;

create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  win text,
  intention text,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- ── #37 Missions roadmap / #22 tree ─────────────────────────────────────────
create table if not exists public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  target_date date,
  done_at timestamptz,
  position int default 0,
  created_at timestamptz default now()
);
create index if not exists goal_milestones_goal_idx on public.goal_milestones (goal_id, position);

alter table public.goals add column if not exists why text;
alter table public.goals add column if not exists cover text; -- emoji or colour token
alter table public.habits add column if not exists goal_id uuid references public.goals(id) on delete set null;
alter table public.tasks add column if not exists milestone_id uuid references public.goal_milestones(id) on delete set null;

-- ── #39 Brain dump inbox ────────────────────────────────────────────────────
alter table public.brain_dump add column if not exists tags text[] default '{}';
alter table public.brain_dump add column if not exists kind text default 'inbox';
do $$ begin
  alter table public.brain_dump add constraint brain_dump_kind_chk
    check (kind in ('inbox', 'note', 'idea', 'archived'));
exception when duplicate_object then null; end $$;
alter table public.brain_dump add column if not exists converted_to text; -- 'task:<id>' | 'goal:<id>'

-- ── #40 Calendar time blocks ────────────────────────────────────────────────
alter table public.calendar_events add column if not exists task_id uuid references public.tasks(id) on delete set null;
alter table public.calendar_events add column if not exists category text;
alter table public.calendar_events add column if not exists completed boolean default false;

-- ── #17 Habit chains ────────────────────────────────────────────────────────
alter table public.habits add column if not exists after_habit_id uuid references public.habits(id) on delete set null;
alter table public.habit_logs add column if not exists completed_at timestamptz;

-- ── #24 Sleep ───────────────────────────────────────────────────────────────
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null, -- the wake-up date
  bedtime timestamptz,
  wake_time timestamptz,
  duration_minutes int,
  quality int check (quality between 1 and 5),
  score int,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- ── #25 Subscriptions ───────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  currency text default 'INR',
  cycle text not null default 'monthly' check (cycle in ('weekly', 'monthly', 'yearly')),
  billing_day int,
  next_charge_date date not null,
  category text default 'subscriptions',
  active boolean default true,
  created_at timestamptz default now()
);

-- ── #26 Savings jars ────────────────────────────────────────────────────────
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  target_amount numeric not null,
  saved_amount numeric not null default 0,
  target_date date,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric not null,
  note text,
  created_at timestamptz default now()
);

-- ── #43 Profile ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists mission_statement text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists is_public boolean default false;
create unique index if not exists profiles_public_slug_uidx on public.profiles (lower(public_slug)) where public_slug is not null;

-- ── #38 Portfolio ───────────────────────────────────────────────────────────
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  impact text,
  cover_url text,
  links jsonb default '[]'::jsonb,
  tags text[] default '{}',
  shipped_on date,
  goal_id uuid references public.goals(id) on delete set null,
  created_at timestamptz default now()
);

-- ── #29 Achievements ────────────────────────────────────────────────────────
create table if not exists public.achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

-- ── #44 Screen intel ────────────────────────────────────────────────────────
alter table public.screen_time_logs add column if not exists categories jsonb; -- {"social":45,"video":30,...} minutes
alter table public.screen_time_logs add column if not exists source text default 'manual';

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  label text,
  created_at timestamptz default now(),
  last_used_at timestamptz
);
create index if not exists api_tokens_hash_idx on public.api_tokens (token_hash);

-- ── Row level security: owner-only on every new table ───────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'daily_reviews', 'goal_milestones', 'sleep_logs', 'subscriptions', 'savings_goals',
    'savings_entries', 'portfolio_items', 'achievements', 'api_tokens'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_owner') then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        t || '_owner', t
      );
    end if;
  end loop;
end $$;

-- ── Storage buckets: avatars/ and portfolio/ (public read, owner write) ────
-- Files are stored under "<user_id>/<file>", so the first folder is the owner.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true) on conflict (id) do nothing;

do $$
declare b text;
begin
  foreach b in array array['avatars', 'portfolio'] loop
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = b || '_public_read') then
      execute format('create policy %I on storage.objects for select using (bucket_id = %L)', b || '_public_read', b);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = b || '_owner_insert') then
      execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', b || '_owner_insert', b);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = b || '_owner_update') then
      execute format('create policy %I on storage.objects for update to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', b || '_owner_update', b);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = b || '_owner_delete') then
      execute format('create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', b || '_owner_delete', b);
    end if;
  end loop;
end $$;

-- ── Public profile (#43 / #38): whitelisted fields only, null unless is_public ──
-- security definer so anonymous visitors never touch the private tables directly.
create or replace function public.get_public_profile(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_out jsonb;
begin
  select * into v_profile from profiles where lower(public_slug) = lower(p_slug) and is_public = true limit 1;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'name', coalesce(to_jsonb(v_profile) ->> 'full_name', to_jsonb(v_profile) ->> 'username'),
      'avatar_url', v_profile.avatar_url,
      'bio', v_profile.bio,
      'mission_statement', v_profile.mission_statement,
      'total_xp', coalesce((to_jsonb(v_profile) ->> 'total_xp')::int, 0),
      'longest_streak', coalesce((to_jsonb(v_profile) ->> 'longest_streak')::int, 0),
      'member_since', to_jsonb(v_profile) ->> 'created_at'
    ),
    'stats', coalesce((
      select jsonb_object_agg(cat, xp) from (
        select coalesce(stat_category, 'discipline') as cat, sum(amount) filter (where amount > 0) as xp
        from xp_history where user_id = v_profile.id group by 1
      ) s
    ), '{}'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('id', achievement_id, 'earned_at', earned_at) order by earned_at)
      from achievements where user_id = v_profile.id
    ), '[]'::jsonb),
    'portfolio', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', title, 'description', description, 'impact', impact, 'cover_url', cover_url,
        'links', links, 'tags', tags, 'shipped_on', shipped_on
      ) order by shipped_on desc nulls last)
      from portfolio_items where user_id = v_profile.id
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object('title', title, 'completed_at', to_jsonb(g) ->> 'completed_at', 'type', to_jsonb(g) ->> 'type'))
      from goals g where g.user_id = v_profile.id and g.status = 'completed'
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
