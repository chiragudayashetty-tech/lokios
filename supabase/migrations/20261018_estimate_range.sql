-- Estimate duel: optional upper bound for a range estimate ("2–5h"). Null = single-number estimate.
alter table public.tasks add column if not exists estimate_max_minutes int check (estimate_max_minutes is null or estimate_max_minutes >= 0);
