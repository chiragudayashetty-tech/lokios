-- xp_history.source_id was a uuid column, but source ids are text keys like
-- "habit_<id>_2026-10-03" / "perfect_day_2026-10-03", so award_xp / revoke_xp
-- failed with "operator does not exist: uuid = text". Existing uuids are kept as text.
alter table public.xp_history alter column source_id type text using source_id::text;
