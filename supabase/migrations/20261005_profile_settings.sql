-- Settings page sync: user-tunable rules and preferences stored on the profile.
-- Without this column the app keeps settings per device (localStorage).
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
