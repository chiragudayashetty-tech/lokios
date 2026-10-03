-- ════════════════════════════════════════════════════════════════════════════
-- XP ENGINE v2 — atomic awards, local dates, working streaks
-- See docs/xp-gamification-plan.md (Phase 1).
--
-- Safe to run more than once. Existing XP and totals are not changed:
-- verified 2026-10-03 that xp_history has no duplicate (user_id, source_id)
-- pairs and that SUM(amount) = profiles.total_xp.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Local calendar date of each XP event (replaces UTC timestamp windows)
alter table public.xp_history add column if not exists occurred_on date;

update public.xp_history
set occurred_on = (created_at at time zone 'Asia/Kolkata')::date
where occurred_on is null;

-- 2. Exactly one ledger row per action. Rows without a source_id (legacy) are exempt.
create unique index if not exists xp_history_user_source_uidx
  on public.xp_history (user_id, source_id)
  where source_id is not null;

create index if not exists xp_history_user_occurred_idx
  on public.xp_history (user_id, occurred_on);

-- 3. Streak columns the app reads (current_streak never existed, so streak saves failed)
alter table public.profiles add column if not exists current_streak integer not null default 0;
alter table public.profiles add column if not exists longest_streak integer not null default 0;
update public.profiles set current_streak = coalesce(streak_days, 0) where current_streak = 0;

-- 4. award_xp: insert or replace the action's XP and move the balance by the
--    difference, in one transaction. Re-awarding the same source_id is idempotent.
create or replace function public.award_xp(
  p_amount integer,
  p_source_type text,
  p_source_id text,
  p_description text default null,
  p_stat_category text default 'discipline',
  p_occurred_on date default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old integer := 0;
  v_date date := coalesce(p_occurred_on, (now() at time zone 'Asia/Kolkata')::date);
  v_created timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_source_id is null or length(p_source_id) = 0 then
    raise exception 'award_xp requires a source_id';
  end if;

  -- Today's events keep the real time; back-dated ones sit at local noon.
  v_created := case
    when v_date = (now() at time zone 'Asia/Kolkata')::date then now()
    else (v_date + time '12:00') at time zone 'Asia/Kolkata'
  end;

  select amount into v_old
  from xp_history
  where user_id = v_uid and source_id = p_source_id
  for update;

  insert into xp_history (user_id, amount, source_type, source_id, description, stat_category, occurred_on, created_at)
  values (v_uid, p_amount, p_source_type, p_source_id, p_description, coalesce(p_stat_category, 'discipline'), v_date, v_created)
  on conflict (user_id, source_id) where source_id is not null
  do update set
    amount = excluded.amount,
    source_type = excluded.source_type,
    description = excluded.description,
    stat_category = excluded.stat_category,
    occurred_on = excluded.occurred_on,
    created_at = excluded.created_at;

  update profiles
  set total_xp = coalesce(total_xp, 0) + p_amount - coalesce(v_old, 0)
  where id = v_uid;

  return p_amount - coalesce(v_old, 0);
end;
$$;

-- 5. revoke_xp: remove an action's XP entirely and give the balance back.
create or replace function public.revoke_xp(p_source_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from xp_history
  where user_id = v_uid and source_id = p_source_id
  returning amount into v_old;

  if v_old is not null then
    update profiles set total_xp = coalesce(total_xp, 0) - v_old where id = v_uid;
  end if;

  return coalesce(v_old, 0);
end;
$$;

grant execute on function public.award_xp(integer, text, text, text, text, date) to authenticated;
grant execute on function public.revoke_xp(text) to authenticated;
