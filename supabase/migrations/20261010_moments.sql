-- Moments: one photo or ≤5-second video per day, stitched into a monthly film.
-- Media lives in a PRIVATE bucket; the app reads it through short-lived signed URLs.

create table if not exists public.daily_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('photo', 'video')),
  path text not null,
  thumb_path text,
  duration_ms int check (duration_ms is null or duration_ms between 0 and 5000),
  caption text,
  created_at timestamptz default now(),
  unique (user_id, date)
);
create index if not exists daily_moments_user_date_idx on public.daily_moments (user_id, date desc);

alter table public.daily_moments enable row level security;
drop policy if exists daily_moments_owner on public.daily_moments;
create policy daily_moments_owner on public.daily_moments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('moments', 'moments', false, 26214400)
on conflict (id) do update set public = false;

do $$
declare op text;
begin
  foreach op in array array['select', 'insert', 'update', 'delete'] loop
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'moments_owner_' || op) then
      if op = 'insert' then
        execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', 'moments_owner_' || op, 'moments');
      else
        execute format('create policy %I on storage.objects for %s to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', 'moments_owner_' || op, op, 'moments');
      end if;
    end if;
  end loop;
end $$;
