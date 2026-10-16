-- Discipline games: lights-out bet, FC fuel tank, ship-day pledge (estimate duel uses tasks.estimate_minutes / actual_minutes).

-- Lights-out bet: one pledge per evening
create table if not exists public.game_pledges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'lights_out',
  date date not null,              -- the evening the pledge was made
  target text not null,            -- 'HH:MM' bedtime
  stake int not null check (stake between 0 and 500),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  actual text,                     -- 'HH:MM' bedtime from the sleep log
  created_at timestamptz default now(),
  unique (user_id, kind, date)
);

-- Fuel tank: every logged play session
create table if not exists public.fuel_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  minutes int not null check (minutes > 0 and minutes <= 720),
  overdraft int not null default 0,  -- minutes played beyond the tank
  note text,
  created_at timestamptz default now()
);
create index if not exists fuel_sessions_user_date_idx on public.fuel_sessions (user_id, date desc);

-- Ship-day pledge: remember the first promised date and how often it moved
alter table public.goals add column if not exists original_deadline date;
alter table public.goals add column if not exists deadline_pushes int not null default 0;

alter table public.game_pledges enable row level security;
alter table public.fuel_sessions enable row level security;
drop policy if exists game_pledges_owner on public.game_pledges;
create policy game_pledges_owner on public.game_pledges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists fuel_sessions_owner on public.fuel_sessions;
create policy fuel_sessions_owner on public.fuel_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
