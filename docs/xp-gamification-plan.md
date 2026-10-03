# XP & Gamification — Audit and Rebuild Plan

_Audit date: 2026-10-03 · Data: 1,414 `xp_history` rows (2026-06-29 → 2026-10-03), Lv 18, 16,134 XP_

---

## 1. How it works today

| Piece | Where | What it does |
|---|---|---|
| Level curve | `lib/utils/xp.js` | `level = floor(sqrt(xp / 50)) + 1` → Lv N needs `50·(N-1)²` XP |
| Sagas (ranks) | `lib/constants.js` `RANK_CONFIG` | 8 sagas by level band (I: 1–10 … VIII: 100+) |
| Award / remove | `lib/utils/xpFallback.js` | Client inserts into `xp_history`, then reads `profiles.total_xp` and writes `total ± amount` |
| Habits | `hooks/useHabitsInternal.js` | +base XP on complete, −1.5× (escalating ×N) on fail, auto-fail missed days (30-day backfill) |
| Tasks | `hooks/useTasksInternal.js` | +difficulty XP (−5/day overdue), fail = −1.5× escalating by days overdue |
| Priority goals | `app/dashboard/page.js` | +25 / −38 |
| Screen time | `lib/utils/screenTimeXP.js` | Linear ± vs targets (6h total, 60m doom, 3h focus, 1h stream), uncapped |
| Bonuses | `useHabitsInternal.js` | All-habits-done +25, streak milestones 7/30/100 days |
| Momentum | `lib/utils/dailyMomentum.js` | SURGING / STEADY / RECOVERY / AT RISK from today + 3-day net |
| Streaks | `lib/utils/streakCalc.js` | Global (any habit done that day) + per habit |

### What the data says

| Source | Rows | Gained | Lost |
|---|---:|---:|---:|
| habit_complete | 957 | **+18,125** | |
| habit_failed | 270 | | **−4,555** |
| task_complete | 87 | +2,352 | |
| screen_time | 76 | +1,913 | −1,941 |
| goal_complete | 8 | +550 | |
| task_failed / goal_failed / pushed | 14 | | −310 |
| **Total** | | **+22,940** | **−6,806 (30%)** |

- **79%** of all XP comes from habits; tasks 10%, goals 2%.
- **Journal, speaking log, work log, focus, brain dump, budget, weekly debrief: 0 XP ever.**
- **All-habits bonus: 0 times. Streak milestones: 0 times.**
- Screen time is net **−28 XP** over 76 logs: a pure noise generator. Worst day: **−265**.
- Average net **+172 XP/day**; 15 of 94 days negative; 2 net-negative weeks.
- Profile `longest_streak` = **2** after 94 days, while the "No Substance" habit alone has a 50-day streak.

---

## 2. Flaws found

### A. Broken (bugs: things that are supposed to work and don't)

1. **Global streak never saves.** `streakCalc.js` writes `current_streak`, which doesn't exist on `profiles`, so the whole update fails and `longest_streak` is frozen at 2. Meanwhile the milestone check reads `streak_days`, which nothing writes (stuck at 1). → **Streak milestones can never fire.**
2. **Streak window capped at 60 days.** The 100-day milestone is unreachable even once (1) is fixed.
3. **All-habits bonus is impossible.** It requires *every active habit* to be done, including habits not scheduled today (Workout = 5 days/week), and it's gated by `localStorage` (per-device). It's also never revoked if you un-tick a habit.
4. **Milestones are once-per-lifetime per device.** `localStorage` gate + non-dated `source_id` (`streak_7`) means rebuilding a streak after a break gives nothing.
5. **Timezone mismatch.** Day windows are queried as `YYYY-MM-DDT00:00:00Z` (UTC) but the dates are local (IST). Anything logged between 00:00 and 05:30 lands in the wrong day for dedupe, momentum and the 7-day query.
6. **`character_stats` is never written.** The 6 stats (founder, discipline, learning…) are permanently 0. `stat_category` is stored on every XP row but never aggregated.
7. **Protocol auto-fail is dead code.** `protocolAutoFail.js` had a crash bug (fixed today); its loop now computes penalties and throws them away. Harmless, but it confuses anyone reading it.

### B. Fragile (works today, will eventually corrupt data)

8. **Non-atomic balance.** Every award reads `total_xp`, adds, then writes it back from the browser. Two awards at once (two devices, or auto-fail + a click) → one is lost. Today's drift is 0 only because of earlier cleanup scripts (`Fix duplicates`, `cleanupAllDuplicateXP`).
9. **Fuzzy dedupe deletes real XP.** `robustAwardXP` deletes any same-day row whose *description* normalizes to the same task/routine name. Two tasks named "Edit video" on one day → the first one's XP vanishes.
10. **Type-wide deletes.** `robustRemoveXP(user, 'task_complete', null)` deletes *every* `task_complete` row ever. No caller does this today, but one missing id is all it takes. The description fallback also substring-matches the last 100 rows.
11. **Client can write any `total_xp`.** No server rule stops a bad write. Low risk (single user) but it's the root of 8–10.
12. **Clamping hides debt.** `Math.max(0, total − x)` means the "Fallen" saga (negative XP) can't happen, and ledger ≠ balance after any clamp.

### C. Design (the economy works against motivation)

13. **Punishment-heavy.** A miss costs 1.5× a completion, so one miss erases 1.5 wins. 30% of everything earned has been taken back.
14. **Unbounded escalation (latent).** Consecutive misses scale ×2, ×3, ×4… with no cap, and auto-fail backfills **30 days** on return. A week off sick across 15 habits ≈ **−9,000 XP** (≈ 2 months of progress, a full saga chapter). It hasn't fired yet only because of luck in how logs line up.
15. **Logging bad days is punished.** Screen time can cost −265 for an honest log, but skipping the log costs 0. The system teaches you to not log.
16. **Core protocols aren't rewarded.** The dashboard's "Daily protocols" (work session, journal, screen intel, speaking, budget, debrief) earn nothing on their own; Journaling and Speaking only pay via duplicate habits.
17. **One reward type.** Everything is fixed-ratio XP. No surprise, no collection, no "almost there": the things that create the dopamine loop.
18. **Level-ups slow down fast.** ~10 days per level now, ~17 days at Lv 30, ~28 days at Lv 50; Lv 100 is ~7.5 years out at the current pace. The long game is fine; the problem is nothing fills the gaps between level-ups.
19. **Momentum is shallow.** SURGING at +80 XP happens after ~3 habits in the morning, so it stops meaning anything.

---

## 3. Design principles for the new system

1. **One source of truth, enforced by the database.** The ledger *is* the balance.
2. **Reward more than you punish.** Target losses ≤ 15% of gains. The main cost of missing should be *losing a streak*, not XP.
3. **Never punish honesty.** Logging always earns something, even on a bad day.
4. **Every core action pays.** If it's on the dashboard, it gives XP.
5. **Fixed + variable rewards.** Predictable base XP, plus streak multipliers, perfect-day bonuses and occasional surprises.
6. **Always show the next reward.** "2 habits to Perfect Day (+50)".
7. **Don't demote anyone.** Keep the level curve and current 16,134 XP; changes apply going forward.

---

## 4. The plan

### Phase 1 — Integrity foundation _(bugs; do first; ~1–2 sessions)_

**1.1 Atomic XP in Postgres** (fixes 8–12)

```sql
-- One row per action; local date stored explicitly
alter table xp_history add column if not exists occurred_on date;
update xp_history set occurred_on = (created_at at time zone 'Asia/Kolkata')::date where occurred_on is null;
create unique index if not exists xp_history_user_source on xp_history(user_id, source_id) where source_id is not null;

-- Upsert an award and move the balance by the delta, in one transaction
create or replace function award_xp(p_amount int, p_source_type text, p_source_id text,
  p_description text, p_stat text default 'discipline', p_occurred_on date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare v_old int := 0; v_uid uuid := auth.uid();
begin
  select amount into v_old from xp_history where user_id = v_uid and source_id = p_source_id for update;
  insert into xp_history(user_id, amount, source_type, source_id, description, stat_category, occurred_on)
  values (v_uid, p_amount, p_source_type, p_source_id, p_description, p_stat, p_occurred_on)
  on conflict (user_id, source_id) where source_id is not null
  do update set amount = excluded.amount, source_type = excluded.source_type,
                description = excluded.description, occurred_on = excluded.occurred_on;
  update profiles set total_xp = total_xp + p_amount - coalesce(v_old, 0) where id = v_uid;
  return p_amount - coalesce(v_old, 0);
end $$;

create or replace function revoke_xp(p_source_id text) returns int ... -- delete by source_id, subtract amount
```

- Replace `robustAwardXP` / `robustRemoveXP` with thin wrappers around `supabase.rpc('award_xp' | 'revoke_xp')`. **Delete** the fuzzy description matching and type-wide deletes.
- Every caller passes a stable `source_id` (most already do: `habit_<id>_<date>`, task id, `screen_time_<date>`).
- Remove the `Math.max(0, …)` clamps (re-enables "Fallen" as designed).
- Optional hardening: revoke client `update(total_xp)` via column privileges.

**1.2 Streaks that actually work** (fixes 1, 2, 4)

- Rename to one column: `profiles.current_streak` (+ `longest_streak`). Migrate `streak_days` → `current_streak`.
- **Redefine a streak day:** ≥ 70% of *scheduled* habits completed (instead of "any one habit").
- Compute over full history (no 60-day cap). Best done as a SQL function `recompute_streak()` called after each habit change.
- Milestones keyed per streak run: `streak_7_<run_start_date>` → you re-earn them after rebuilding. No `localStorage`.

**1.3 Fix the all-habits bonus** (fixes 3)

- Count only habits scheduled for that weekday. Key: `perfect_day_<date>`. Award *and revoke* through the RPC.

**1.4 Local dates everywhere** (fixes 5)

- Bucket by `occurred_on` (local date) instead of UTC timestamp windows: momentum, dedupe, XP page timeline.

**1.5 Cut dead code** (fixes 6, 7)

- Delete the protocol auto-fail loop (or wire it to real rewards in Phase 2). Prune unused `XP_REWARDS` entries.

### Phase 2 — Rebalanced economy _(~1 session)_

| Rule | Today | New |
|---|---|---|
| Habit miss | −1.5× base, escalating ×N, uncapped | **−0.5× base, flat**; the real cost is the streak |
| Auto-fail backfill | 30 days | **3 days**, then the habit is marked "dormant", not penalized |
| Rest / sick days | none | **Streak freeze**: earn 1 per 7-day streak (max 3), auto-used on a missed day |
| Vacation | none | **Pause mode** toggle: no penalties, streak frozen |
| Habit streak bonus | none | **+2% per streak day, cap +50%** (25 XP habit at 25-day streak → 37 XP) |
| Perfect day (100% scheduled) | +25 (never fires) | **+50** · ≥ 80% → **+20** |
| Screen time | linear, uncapped, −265 possible | **+10 for logging**, performance **clamped to −40…+60** |
| Journal entry | 0 | **+15** (auto-ticks the "Journaling" habit; no double pay) |
| Speaking log | 0 | **+25** (auto-ticks "Speaking Practice" habit) |
| Work log | 0 | **+10 per focused hour, cap +60/day** |
| Budget within daily limit | 0 | **+10** |
| Weekly debrief | 0 | **+50** |
| Task fail | −1.5× escalating by days overdue | **−0.5× base flat**; overdue completion keeps the −5/day decay (min 50%) |

Expected effect at current behaviour: losses drop from 30% → ~10% of gains, daily average rises from ~+172 to ~+230. That's ~7 days per level at Lv 18 instead of 10: noticeably more frequent level-ups without inflating the long curve.

### Phase 3 — Dopamine layer _(~2 sessions)_

1. **Daily quests (3/day).** Rotating, small and specific: "Log screen time before 10 pm", "Finish 2 tasks before noon", "Hit Deep Work Block 1". +30 each, +50 for all three. Shown as a card on Home.
2. **Mystery chest.** On a Perfect Day there's a ~25% chance of a chest: 1.5×–3× the day's bonus, with a dedicated open animation. Variable reward = the strongest habit hook.
3. **Combo meter.** Consecutive completions within the same day build ×1.1 → ×1.5 on the HUD; it resets at midnight, never punishes.
4. **Achievements (badges).** A server-side `achievements` table: First Perfect Day, 7/30/100-day streaks, 100 habits, 10 deep-work days, Saga unlocks… plus a badge shelf on Progress with locked silhouettes ("almost there").
5. **Character stats, revived.** A SQL view summing `xp_history` by `stat_category` → 6 stat levels and a radar chart on Progress. No new writes needed.
6. **"Next reward" hints.** HUD line: "2 habits → Perfect Day +50" / "3 days → 30-day streak +200".
7. **Weekly Wrapped.** Sunday card: XP, best streak, perfect days, top stat, level progress, shareable. Feeds the Weekly Debrief.
8. **Streak-at-risk nudge.** After 8 pm, if today would break a streak ≥ 3, the HUD pill pulses with "Save your 12-day streak".

### Phase 4 — Polish

- XP preview chips on every action before tapping (+25 · ×1.3 streak).
- XP history shows multipliers and bonuses as separate, labelled lines.
- Momentum thresholds scale with your 14-day average instead of a fixed +80.

---

## 5. Order of work

| # | Item | Why first |
|---|---|---|
| 1 | 1.1 Atomic RPC + `occurred_on` + unique index | Everything else writes through it |
| 2 | 1.2–1.4 Streaks, perfect day, local dates | Restores the two bonuses that never fired |
| 3 | Phase 2 economy table | Small code changes once the RPC exists |
| 4 | 1.5 Dead code cleanup | Easier after the rewrite |
| 5 | Phase 3: perfect-day chest, next-reward hints, achievements | Highest dopamine per effort |
| 6 | Phase 3: daily quests, combo, Wrapped, stats view | Bigger features |
| 7 | Phase 4 polish | |

Each step ships on its own and is reversible. Phase 1 needs one Supabase migration (run in the SQL editor or via `supabase/migrations/`).

## 6. Decisions (2026-10-03)

| Question | Decision |
|---|---|
| Penalties | **Painful but capped**: miss ×1, 2nd in a row ×1.5, 3rd+ capped at **×2** (habits, tasks, priority goals) |
| Streak day | **≥ 90%** of that day's scheduled habits (rest/blocked days excused) |
| Streak rewards | Milestones at **3, 7, 10, 15, 21, 30, 45, 60, 75, 100, 150, 200, 365** days = 10 XP × days, re-earnable every new run |
| History | **Forward only**: no recalculation of existing XP |
| Habits ↔ protocols | **Yes**: saving a journal entry / speaking log ticks the matching habit |

## 7. Status

**Built (Phase 1 + decided rules):**
- `supabase/migrations/20261004_xp_engine_v2.sql`: `award_xp` / `revoke_xp` atomic functions, `occurred_on` local date, one row per `source_id`, `current_streak` column. **Must be run in the Supabase SQL editor.** Until then the app uses the old client-side path automatically.
- `lib/utils/xpRules.js`: single source for penalties, streak threshold, milestones, perfect-day XP, 7-day auto-fail backfill cap.
- `lib/utils/xpFallback.js`: `robustAwardXP` / `robustRemoveXP` call the RPCs (same signatures, no call-site changes); fuzzy description matching and type-wide deletes are no longer used.
- `lib/utils/streakCalc.js`: 90% rule, ~400-day window, longest streak saved, milestones per run, Perfect Day +50 (revoked if un-ticked).
- Also fixed: `XP_REWARDS` was never imported (bonus code always threw), momentum used UTC midnight, journal auto-ticks its habit, HUD shows streak + next milestone.

**Next:** Phase 2 economy items not yet decided (screen-time cap and +10 logging reward, rewards for work log / budget / debrief, streak freezes, pause mode), then Phase 3.

## 8. Idea bank

**Variable rewards (the strongest hook)**
1. **Mystery chest** on Perfect Days: 25% chance, 1.5×–3× bonus, with its own opening animation.
2. **First win of the day ×2**: the first habit each day pays double to kick-start momentum.
3. **Critical hits**: 1-in-20 chance any completion pays ×2, with a gold confetti burst.

**Streak protection & comebacks**
4. **Streak freezes**: earn 1 per 7-day run (max 3); auto-used on a sub-90% day.
5. **Phoenix bonus**: rebuild a 3-day streak within a week of losing one (+50, badge).
6. **Pause mode**: travel/sick toggle; no penalties, streak frozen (max 7 days/month).

**Challenge & mastery**
7. **Weekly boss**: your weakest habit becomes the boss (it plugs into the existing War Room battles). Hit it 6/7 days to defeat it for +200 and a trophy.
8. **Habit mastery tiers** per habit: Bronze 30 → Silver 60 → Gold 100 → Diamond 200 completions, with a tier icon next to the habit.
9. **Daily quests**: 3 per day picked from your weak spots ("Log screen time before 10 pm", "Deep Work Block 1 before noon").
10. **Self-staked wagers**: bet 100–500 XP on a weekly goal; hit it for double, miss it and lose the stake.
11. **Recovery quest** on AT RISK days: "3 habits to stop the bleed" (+40).

**Progress you can see**
12. **Personal records**: best XP day, longest deep-work day, lowest doom-scroll → "New PR!" toast.
13. **Streak heatmap**: GitHub-style year grid of 90% days on the Progress page.
14. **Character stats revived** as a radar chart (data already exists in `stat_category`); stat levels unlock perks (Discipline Lv 5 = +1 streak freeze slot).
15. **Achievement shelf** with rarities and locked silhouettes ("almost there" pull).
16. **Monthly report card**: S / A / B / C grade from completion %, streak and net XP.
17. **Weekly Wrapped**: shareable Sunday summary that feeds the Weekly Debrief.

**Seasons & identity**
18. **Winter Arc season pass**: 10 tiers of seasonal rewards (badge, frame, title "Survived Winter") from XP earned during the arc.
19. **Double-XP weekends** a few times per season, announced on the HUD.
20. **Level-up unlocks**: saga art, themes, completion sounds, titles under your name.
21. **Early-bird bonus**: +10% on habits completed before 9 am.
22. **Optional sounds**: soft chime on completion, bigger one on level-up (off by default).
