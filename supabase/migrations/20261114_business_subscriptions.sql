-- Recurring business subscriptions: same subscriptions table, scope picks the ledger.
-- personal -> budget_logs (as before), business -> business_expenses.
alter table public.subscriptions add column if not exists scope text not null default 'personal';
alter table public.subscriptions add column if not exists vendor text;
alter table public.subscriptions add column if not exists payment_mode text;
do $$ begin
  alter table public.subscriptions add constraint subscriptions_scope_check check (scope in ('personal', 'business'));
exception when duplicate_object then null; end $$;
create index if not exists subscriptions_user_scope_idx on public.subscriptions (user_id, scope);
