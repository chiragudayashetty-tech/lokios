-- Business expenses: kept apart from personal budget_logs.
create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'other',
  vendor text,
  description text,
  payment_mode text,            -- upi | card | cash | bank
  receipt_url text,
  created_at timestamptz default now()
);
create index if not exists business_expenses_user_date_idx on public.business_expenses (user_id, date desc);

alter table public.business_expenses enable row level security;
drop policy if exists business_expenses_owner on public.business_expenses;
create policy business_expenses_owner on public.business_expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
