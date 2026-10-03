-- Screen-time auto-import was removed. Only needed if 20261006_round2.sql was
-- already run before that change; safe to run either way.
drop table if exists public.api_tokens;
alter table public.screen_time_logs drop column if exists source;
