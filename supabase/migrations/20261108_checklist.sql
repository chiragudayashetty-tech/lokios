-- Checklist: to-dos with a deadline, no XP; optionally linked to a task and/or a mission (goal).
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_date date,
  done_at timestamptz,
  task_id uuid references public.tasks(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists checklist_items_user_due_idx on public.checklist_items (user_id, due_date);

alter table public.checklist_items enable row level security;
drop policy if exists checklist_items_owner on public.checklist_items;
create policy checklist_items_owner on public.checklist_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
