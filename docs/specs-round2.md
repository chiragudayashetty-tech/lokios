# ChiragOS — Round 2 feature specs

Written 2026-10-03 for implementation in a separate (cloud) session.
Features: 17, 22, 24, 25, 26, 29, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45.

## Read first (project conventions)

- **Next.js 16** (App Router). Read `node_modules/next/dist/docs/` before using framework APIs (`AGENTS.md`). Middleware is `proxy.js` in this version.
- **Styling:** Tailwind v4 utilities (unlayered, `src/app/tailwind.css`) + design tokens in `src/app/opal.css`. Feature CSS goes in `src/app/game.css` / `src/app/app-features.css` (or a new file imported in `src/app/layout.js` *before* `tailwind.css`). Use tokens: `--surface`, `--border-color`, `--accent-primary`, `--accent-gradient`, `--opal-gradient`, `--success/--danger/--warning/--info`, `--font-display`. Sentence-case copy. Cards: `.hud-panel` / `.arena-card` look (radius 18–22px).
- **Season skin:** `ACTIVE_SEASON` in `src/lib/theme/levelTheme.js` → `<html data-season>`; winter overrides in `opal.css`.
- **State:** `OSProvider` (`src/lib/context/OSContext.js`). Prefer `useOSSlice('habits' | 'tasks' | 'goals' | 'xp' | 'profile' | 'journal' | 'calendar' | 'brainDump' | 'auth' | 'focus' | 'characterStats')` over `useOS()` to avoid re-renders. Game data: `useGameState()` (`src/lib/hooks/useGameState.js`) — streak model, boss, season, records, insights.
- **XP:** always `robustAwardXP(userId, amount, sourceType, sourceId, description, statCategory, customCreatedAt)` / `robustRemoveXP(userId, sourceType, sourceId)` from `src/lib/utils/xpFallback.js`. Every award needs a **stable, unique `sourceId`** (idempotent upsert via `award_xp` RPC). Rule constants live in `src/lib/utils/xpRules.js` (settings-driven live bindings).
- **Rewards/celebration:** `data-celebrate` attribute on a button → confetti at tap; `emitGame('toast', {icon,title,sub,tone})` from `src/lib/utils/gamification.js` for game toasts.
- **Offline:** writes that matter should go through `enqueue()` / `registerOfflineHandler()` (`src/lib/utils/offlineQueue.js`) when `isOffline()`.
- **Settings:** `getSettings()/saveSettings()` in `src/lib/settings.js` (localStorage + `profiles.settings` jsonb).
- **Pages** wrap content in `<AppShell>` (pass-through; shell is persistent). Loading: `<WinterLoader label="…" />`.
- **DB migrations:** add files to `supabase/migrations/` named `YYYYMMDD_name.sql`, idempotent (`if not exists`), RLS on every new table: `using (auth.uid() = user_id) with check (auth.uid() = user_id)`. The user runs them in the Supabase SQL editor — the UI must degrade gracefully if a table/column doesn't exist yet (catch the error, hide the feature, show a one-line hint).
- **Deploy:** push to `main` → Vercel auto-deploys. Verify with `npx next build`, lint, and a real browser check (desktop 1280px + phone 390px) before pushing.

Shared migration for this round (one file, `supabase/migrations/2026XXXX_round2.sql`) is listed per feature below; combine them.

---

## 36. Tasks — Kanban overhaul (`/tasks`)

**Goal:** make task management visual and fast; replace the tab list as the default view (keep a "List" toggle).

**UX**
- Columns: **Today** (due today + overdue, overdue pinned on top with red edge), **This week** (due within the current Mon–Sun), **Later** (future or no date), **Done** (completed in the last 7 days, collapsed to the most recent 10 with "show more").
- Header: view toggle *Board / List*, filter chips (category, priority, linked mission), search, "+ Task" button.
- Card: title, priority colour bar on the left (Extreme red, Hard amber, Medium violet, Easy blue), category chip, due date ("Today", "Tomorrow", "Fri", overdue "2d late" in red), XP chip, subtask progress "2/5", linked mission chip, estimate badge ("45m").
- Drag a card between columns → updates `due_date` (Today = today, This week = next free day this week or Friday, Later = clear or +7d, Done = complete via existing completion flow with proof modal).
- Phone: columns become a horizontal swipe carousel (snap per column) with column tabs; on cards, **swipe right = complete**, **swipe left = push to tomorrow**.
- Card tap opens a side drawer (desktop) / bottom sheet (phone): title, description, subtasks checklist (add/reorder/check), estimate vs actual time, priority, category, mission link, due date, delete.
- Empty column states with a small illustration and a CTA.

**Data**
```sql
alter table tasks add column if not exists subtasks jsonb not null default '[]'::jsonb;   -- [{id,title,done}]
alter table tasks add column if not exists estimate_minutes int;
alter table tasks add column if not exists actual_minutes int;
alter table tasks add column if not exists position int;                                  -- order inside a column
```

**Logic**
- Column assignment is derived from `due_date`/`status`, never stored.
- Ordering inside a column: `position` asc, then due date, then priority.
- Completing still uses `completeOperation` (XP, mission progress). Subtasks don't pay XP; completing all subtasks shows "Complete task?" prompt.
- Actual time: optional manual entry in the drawer, or auto-filled from the focus timer when it's linked (future).
- Drag & drop: use native HTML5 DnD on desktop + pointer events for touch (no new heavy library; `framer-motion` `Reorder` is acceptable for within-column reorder).

**Files:** `src/app/tasks/page.js` (split into `src/components/tasks/TaskBoard.js`, `TaskCard.js`, `TaskDrawer.js`, `TaskList.js`), `src/lib/hooks/useTasksInternal.js` (update/reorder helpers).

**Acceptance:** drag between columns updates due date and persists after reload; swipe gestures work on phone; subtasks persist; overdue tasks always visible at the top of Today; list view still available; no layout overflow at 390px.

---

## 41. Today — timeline overhaul (`/today`)

**Goal:** turn Today into a time-of-day timeline with one obvious "next" action.

**UX**
- **Hero "Next up" card:** the single most urgent item (overdue task > boss habit > earliest-time habit > due task > unlogged protocol), big title, one big ✓ button, "Skip / later" link.
- Sections: **Morning** (before 12:00), **Afternoon** (12–17), **Evening** (after 17), **Anytime**. Current section expanded and highlighted; past sections collapse to a summary ("Morning · 4/5 done").
- Habits appear in their section by their time slot; tasks by their time block (from Calendar #40) or in Anytime.
- Progress ring at the top: % of today's items done; streak/perfect-day/boss chips stay.
- **End-of-day review** (shown after 20:00 or when everything is done): 3 taps — mood (1–5), energy (1–5), "today's win" one-liner → saves to `daily_reviews`; +10 XP once per day (`review_<date>`).

**Data**
```sql
alter table habits add column if not exists time_of_day text check (time_of_day in ('morning','afternoon','evening','anytime')) default 'anytime';
create table if not exists daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  win text,
  intention text,
  created_at timestamptz default now(),
  unique (user_id, date)
);
```
(`daily_reviews` is shared with Insights and #24.)

**Logic:** section membership from `habits.time_of_day`; habit edit modal gets a time-of-day picker. Reviews feed `computeInsights` (mood/energy vs completion).

**Files:** `src/app/today/page.js` (split into `src/components/today/NextUpHero.js`, `TimelineSection.js`, `EndOfDayReview.js`), habit edit modal in `src/app/quests/page.js`, `src/lib/utils/gamification.js` (insights: add energy).

**Acceptance:** hero always shows exactly one item; sections reflect time_of_day; review saves once per day, editable later that day; XP awarded once.

---

## 37. Missions (Goals) — roadmap overhaul (`/goals`)

**Goal:** goals become visual journeys with milestones.

**UX**
- Grid of mission cards: progress ring (% of milestones/linked tasks done), title, type chip (Main / Side / Long range / Weekly), deadline countdown ("12 days left", red under 3), "why it matters" quote line, cover colour or emoji.
- Mission detail page `/goals/[id]`:
  - Header with big ring, deadline, XP reward.
  - **Why it matters** card (editable text).
  - **Roadmap**: vertical timeline of milestones (title, target date, done state); current milestone glowing; add/reorder/complete milestones.
  - **Linked tasks** (tasks with `goal_id`) and **linked habits** (habits supporting this mission) with quick tick.
  - Activity log (completed tasks/milestones with dates).
- Completing a mission: full-screen celebration (reuse `levelup-backdrop` styling), proof/reflection modal (existing flow), confetti.

**Data**
```sql
create table if not exists goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  target_date date,
  done_at timestamptz,
  position int default 0,
  created_at timestamptz default now()
);
alter table goals add column if not exists why text;
alter table goals add column if not exists cover text;          -- emoji or colour token
alter table habits add column if not exists goal_id uuid references goals(id) on delete set null;
```

**Logic:** progress = weighted: milestones 60% + linked tasks 40% (if no milestones, tasks 100%; if neither, manual progress as today). Milestone completion pays XP: `milestone_<id>` = 30% of the mission's XP ÷ number of milestones (min 10). Feeds #22.

**Files:** `src/app/goals/page.js`, new `src/app/goals/[id]/page.js`, `src/lib/hooks/useGoalsInternal.js` (milestone CRUD), `src/components/goals/*`.

**Acceptance:** milestones CRUD + reorder persist; ring updates live; deadline colours; celebration on completion; works with existing goals that have no milestones.

---

## 22. Goal → milestone → task tree

**Goal:** see how daily work rolls up into missions.

**UX:** on the mission detail page a collapsible tree: Mission → Milestones → Tasks (tasks can be attached to a milestone). Each node shows its own progress bar; ticking a task updates milestone and mission progress immediately. A "Roadmap" toggle on `/goals` shows all active missions as horizontal timelines (milestones as dots on a date axis, today marker).

**Data:** `alter table tasks add column if not exists milestone_id uuid references goal_milestones(id) on delete set null;`

**Logic:** milestone auto-completes when all its tasks are done (asks to confirm); mission progress formula from #37.

**Files:** `src/components/goals/GoalTree.js`, `GoalRoadmap.js`; task drawer (#36) gets a milestone picker.

**Acceptance:** completing the last task of a milestone completes it (with confirm) and pays XP once; roadmap view renders all active missions without overflow.

---

## 39. Brain dump — inbox-zero overhaul (`/brain-dump`)

**Goal:** capture fast, process to zero.

**UX**
- Capture bar at top (multi-line, Enter to save, `#tag` parsing).
- **Inbox** as a card stack: each card shows text, tags, age ("3d"). Actions: **swipe right → Task** (opens prefilled quick task form), **swipe left → Trash**, **swipe up → Mission idea** (creates a draft goal), tap → note editor; buttons for the same on desktop.
- Tabs: Inbox (count badge), Notes, Ideas, Archive. Search across all; tag filter chips.
- **Inbox zero** celebration when empty (+15 XP once per day: `inbox_zero_<date>`).
- **Stale review**: items older than 14 days surface in a "Still relevant?" carousel on Sunday (and inside the weekly debrief page).

**Data**
```sql
alter table brain_dump add column if not exists tags text[] default '{}';
alter table brain_dump add column if not exists kind text default 'inbox' check (kind in ('inbox','note','idea','archived'));
alter table brain_dump add column if not exists converted_to text;   -- 'task:<id>' | 'goal:<id>'
```

**Logic:** existing `status/topic` fields map to `kind` on first load (migration-free fallback). Conversion creates the task/goal then sets `kind='archived'`, `converted_to`.

**Files:** `src/app/brain-dump/page.js` → `src/components/braindump/CaptureBar.js`, `InboxStack.js`, `NoteEditor.js`; `src/lib/hooks/useBrainDumpInternal.js`.

**Acceptance:** swipe gestures on phone, buttons on desktop; conversion creates the right record; inbox count accurate; tags searchable.

---

## 40. Calendar — week view with time blocks (`/calendar`)

**Goal:** plan the week visually and time-block tasks.

**UX**
- Views: **Week** (default, 7 columns × hours 6:00–24:00, 30-min grid), Month (existing), Agenda (list).
- Events (calendar_events + Google) as coloured blocks; **drag tasks** from a side "Unscheduled" panel onto the grid to create a time block; drag/resize blocks to change time.
- Habit dots row under each day header (done / missed / scheduled).
- Category colours (Work, Personal, Health, Learning…), current-time red line, today column highlighted.
- Google sync status chip (connected / last synced / sync now), using existing `/api/google/*` routes.
- Phone: 3-day view with horizontal swipe; long-press to create a block.

**Data**
```sql
alter table calendar_events add column if not exists task_id uuid references tasks(id) on delete set null;
alter table calendar_events add column if not exists category text;
alter table calendar_events add column if not exists completed boolean default false;
```

**Logic:** a task block is a `calendar_events` row with `task_id`; completing the task marks the block completed; unfinished past blocks show a "Roll to next free slot" button (finds the next empty 30-min window that fits the block's duration). Honoring a block (task completed within or before the block end) pays +5 XP (`block_<eventId>`). Sync creates/updates Google events via existing sync-event route.

**Files:** `src/app/calendar/page.js` → `src/components/calendar/WeekGrid.js`, `EventBlock.js`, `UnscheduledPanel.js`, `MonthView.js`, `AgendaView.js`; `src/lib/hooks/useCalendarInternal.js`.

**Acceptance:** drag-create, move and resize persist; Google sync still works; no horizontal page overflow on phone (grid scrolls inside its card).

---

## 43. Profile — identity page (`/profile`)

**Goal:** a page you're proud to look at (and optionally share).

**UX**
- Hero: avatar (upload to Supabase Storage `avatars/`, fallback initials on opal gradient), name, saga title, level, season tier title, member since.
- Stats radar (6 character stats from `xp_history.stat_category` sums → levels via the same curve), total XP, longest streak, perfect days, bosses defeated.
- Trophy case (reuse ProgressExtras trophies, larger).
- "Mission statement" + "About me" (editable), current main mission card.
- Keep the existing blueprint content (values, strengths, weaknesses, future vision) restyled as cards.
- **Public share** toggle → `/p/[slug]` shows a read-only version (no private data: no budget, no journal).

**Data**
```sql
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists mission_statement text;
alter table profiles add column if not exists public_slug text unique;
alter table profiles add column if not exists is_public boolean default false;
```
Storage bucket `avatars` (public read, owner write policy).

**Files:** `src/app/profile/page.js` → `src/components/profile/*`; `src/app/p/[slug]/page.js` (server component, reads only public fields; check RLS/public policy or service-role route).

**Acceptance:** avatar upload works on phone; radar renders from real data; public page only shows whitelisted fields and 404s when `is_public=false`.

---

## 38. Portfolio — proof-of-work overhaul (`/portfolio-log`)

**Goal:** a living portfolio and résumé.

**UX**
- Tabs: **Work** (gallery), **Timeline**, **Books**, **Résumé**.
- Work gallery: masonry cards with cover image, title, tags, date, link buttons (live, repo, video), impact line ("+12% conversions"). Add/edit modal with image upload (Storage `portfolio/`).
- Timeline: vertical by month — shipped work, completed missions, books finished, level-ups.
- Books: shelf of covers (Open Library cover API by ISBN/title), rating, takeaways, pages/day if tracked.
- Résumé: auto-generated from profile + work + missions; printable (uses #42 print styles); public at `/p/[slug]/resume` when profile is public.

**Data**
```sql
create table if not exists portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text, impact text,
  cover_url text, links jsonb default '[]'::jsonb, tags text[] default '{}',
  shipped_on date, goal_id uuid references goals(id) on delete set null,
  created_at timestamptz default now()
);
```
(Keep existing books/work-log sources; migrate visible items lazily.)

**Files:** `src/app/portfolio-log/page.js` → `src/components/portfolio/*`.

**Acceptance:** CRUD with images; timeline merges sources chronologically; résumé prints cleanly on A4.

---

## 44. Screen intel — overhaul (`/screen-time`)

**Goal:** richer analysis and near-automatic logging.

**UX**
- Today card: total, doomscroll, focus, streaming vs targets as 4 rings; XP impact line.
- Charts: 7/30/90-day stacked bars (by category), doomscroll trend line with 7-day average, focus-vs-screen ratio, best/worst day.
- Category breakdown (Social, Video, Productivity, Messaging, Games, Other) if per-app data exists.
- Goals: daily caps per category with streaks ("12 days under 1h social").
- **Auto-import**: settings card with a personal token and copy-paste instructions for an iOS Shortcut / Android Tasker automation that POSTs daily totals at 23:30.

**Data**
```sql
alter table screen_time_logs add column if not exists categories jsonb;     -- {"social":45,"video":30,...} minutes
alter table screen_time_logs add column if not exists source text default 'manual';
create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null, label text, created_at timestamptz default now(), last_used_at timestamptz
);
```

**API:** `POST /api/screen-time/import` with `Authorization: Bearer <token>`; body `{date,total_hours,doom_scroll_minutes,focus_hours,streaming_hours,categories}`; hash-compare token, upsert the day, then call the existing screen-time XP sync server-side (service role). Rate-limit 10/min.

**Files:** `src/app/screen-time/page.js` → `src/components/screentime/*`, `src/app/api/screen-time/import/route.js`, settings token UI (#45).

**Acceptance:** manual logging unchanged; import endpoint upserts and awards XP exactly once per day; charts render with 0–90 days of data.

---

## 42. Export PDF — designed reports

**Goal:** beautiful, shareable reports.

**UX**
- Export modal (existing `IntelExportModal`) redesigned: choose **Weekly / Monthly / Custom range**, sections (Overview, Habits, Tasks & missions, XP, Budget, Screen time, Journal highlights), theme (**Print light** / **Dark**), then **Download PDF** / **Share**.
- Report layout (A4): cover page (name, period, grade, level/saga art), KPI tiles, charts (XP area, habit heatmap, completion by habit bars, budget donut, screen time bars), highlights (wins, MVP habit, boss results), next-week focus.

**Implementation:** render the report as a hidden route `/report?from=&to=&sections=&theme=` with print CSS (`@page size: A4`, page breaks per section) and charts as inline SVG (Recharts with `isAnimationActive={false}`); trigger `window.print()` in a new window for "Download PDF" (browser saves as PDF). Share = Web Share API with the report URL (private, requires login). No server-side PDF dependency.

**Files:** `src/app/report/page.js`, `src/components/report/*`, `src/components/ui/IntelExportModal.js`, `src/app/report.css` (print styles).

**Acceptance:** A4 output with no cut-off charts, clean page breaks, both themes; works from phone (print → Save as PDF).

---

## 34. Theme picker

**Goal:** personalise the look.

**UX (Settings → Appearance):** season (Winter Arc / None — Opal / future Spring, Summer), accent override (6 swatches + "level-based"), snowfall on/off, reduced motion toggle, density (comfortable / compact).

**Implementation:** persist in settings (`theme: {season, accent, snow, motion, density}`); `OSContext` theme effect reads settings: sets `data-season`, overrides `--accent-primary/--accent-2` when accent ≠ level-based, toggles `data-snow="off"` and `data-density`. CSS: `:root[data-snow='off'] body::after{display:none}`, compact density reduces card padding/gaps. `ACTIVE_SEASON` becomes the default value only.

**Acceptance:** changes apply instantly without reload, persist across reloads/devices (profiles.settings).

---

## 24. Sleep logging + sleep score

**Goal:** track sleep and see its effect.

**UX:** morning card on Today ("How did you sleep?"): bedtime + wake time pickers (pre-filled from yesterday), quality 1–5 → sleep score (0–100). Sleep tab on Progress: 30-day chart (duration bars, score line, target band 7–9h), consistency (bedtime variance), and Insights entries.

**Data**
```sql
create table if not exists sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,               -- the wake-up date
  bedtime timestamptz, wake_time timestamptz,
  duration_minutes int, quality int check (quality between 1 and 5), score int,
  created_at timestamptz default now(),
  unique (user_id, date)
);
```

**Score:** duration (50 pts: 7.5–9h = full, linear falloff to 0 at 4h/12h) + consistency (25 pts: bedtime within ±30 min of 7-day median) + quality (25 pts: quality×5). If a "Sleep" habit exists, a score ≥ 70 auto-completes it for that date. XP: +10 for logging (`sleep_<date>`).

**Insights:** add "7h+ sleep → next-day completion" and "score ≥ 70" comparisons in `computeInsights`.

**Acceptance:** one log per day (editable), score computed client-side and stored, habit auto-tick works, insights appear after ≥ 10 logs.

---

## 17. Habit chains (stacking)

**Goal:** reward doing habits in sequence ("after Meditation → Journaling").

**UX:** habit edit modal: "Do this after…" picker (one predecessor). Habits page and Today show chains as linked rows with a connector line. Completing a habit whose predecessor was completed earlier the same day shows "Chain ×2!" and a small bonus. Full chain (3+ links) done in order → "Chain complete" toast.

**Data:** `alter table habits add column if not exists after_habit_id uuid references habits(id) on delete set null;`

**Logic:** order is inferred from completion times (`habit_logs.created_at`/`updated_at` — add `completed_at timestamptz` to habit_logs if needed). Bonus: +5 XP per link done in order (`chain_<habitId>_<date>`), +25 for a complete chain of ≥ 3 (`chain_full_<rootId>_<date>`); revoked when the habit is un-ticked. Prevent cycles in the picker.

**Acceptance:** cycles impossible; bonus only when order is correct; revocation works.

---

## 25. Subscription autopilot

**Goal:** stop manually logging recurring bills.

**UX:** Budget → **Subscriptions** tab: list with name, amount, cycle (monthly/yearly/weekly), billing day, next charge date, category, active toggle; monthly total vs bills limit; "upcoming in 7 days" strip. On the billing date the expense is logged automatically and a toast says "Claude ₹2,400 logged".

**Data**
```sql
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, amount numeric not null, currency text default 'INR',
  cycle text not null default 'monthly' check (cycle in ('weekly','monthly','yearly')),
  billing_day int, next_charge_date date not null,
  category text default 'subscriptions', active boolean default true,
  created_at timestamptz default now()
);
```

**Logic:** on app load (once per day), for each active subscription with `next_charge_date <= today`: insert a `budget_logs` row (`exclude_daily = true`, description `[SUB:<id>:<date>]` for idempotency), advance `next_charge_date` by cycle; repeat while still ≤ today (catches missed months). Optional later: Supabase cron.

**Acceptance:** each charge logged exactly once even with multiple devices (check the `[SUB:id:date]` marker before insert); counts toward the monthly bills limit, not the daily allowance.

---

## 26. Savings goals (jars)

**Goal:** visible progress toward purchases/funds.

**UX:** Budget → **Savings** tab: jar cards (name, emoji, target ₹, saved ₹, % with an animated liquid-fill jar, target date, required ₹/week to hit it). "Add money" / "Withdraw" buttons; completion celebration (+50 XP, `jar_<id>_done`). Dashboard Arena can show the closest jar.

**Data**
```sql
create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, emoji text, target_amount numeric not null,
  saved_amount numeric not null default 0, target_date date,
  completed_at timestamptz, created_at timestamptz default now()
);
create table if not exists savings_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references savings_goals(id) on delete cascade,
  amount numeric not null, note text, created_at timestamptz default now()
);
```

**Logic:** `saved_amount` = sum of entries (update both in one call or compute on read). Deposits don't count as spending.

**Acceptance:** history per jar, accurate totals, celebration once.

---

## 29. Achievements gallery

**Goal:** 50+ collectible badges with rarity.

**UX:** Progress → **Achievements** (or `/achievements`): grid grouped by category (Streaks, Habits, Tasks, Missions, XP & levels, Bosses & bets, Budget, Journal, Screen time, Season). Earned = full colour + date; locked = silhouette + progress bar ("23/30"); rarity border (Common grey, Rare blue, Epic violet, Legendary gold with shimmer). Unlock → toast + confetti; badge detail sheet.

**Definitions** live in code (`src/lib/achievements.js`): `{id, name, description, category, rarity, check(stats) → {earned, progress, target}}`, computed from `useGameState` data (xpRows, streak model, habits, records) plus small extra queries (journal count, budget days). Examples: First Blood (first habit), Perfect Week (7 perfect days in a week), Iron Will (30-day streak), Centurion (100 habit completions), Boss Slayer ×1/×5/×10, High Roller (win a 500 XP bet), Penny Wise (7 days under daily budget), Night Owl Reformed (7 sleep scores ≥ 70), Scribe (30 journal entries), Season tiers, Level 10/25/50, Mastery Diamond, Inbox Zero ×10, Ghost Buster (beat your best week).

**Data:** `create table if not exists achievements (user_id uuid, achievement_id text, earned_at timestamptz default now(), primary key (user_id, achievement_id));` + RLS. XP: Common 10, Rare 25, Epic 50, Legendary 100 (`ach_<id>`).

**Acceptance:** evaluation runs after game-state load (idempotent), unlock toasts once, ≥ 50 definitions, trophy case (#43) uses the same data.

---

## 45. Settings 2.0 (`/settings`)

**Goal:** one place for every preference.

**Sections**
- **Rules** (existing): streak threshold, penalty cap, auto-fail look-back, perfect-day XP.
- **Habits:** default XP for new habits, default time of day (#41), per-habit reminder times (list of habits with a time picker + on/off).
- **Calendar & time:** week start (Mon/Sun — `getStartOfWeek` must respect it everywhere), time format 12/24h, day boundary (e.g. day ends at 03:00 for night owls — affects `getLocalDateStr` usage; implement as a helper `getAppDateStr()`).
- **Money:** currency symbol (₹ default), daily allowance, monthly bills limit.
- **Appearance:** theme picker (#34).
- **Notifications:** evening reminder, per-habit reminders, Sunday scorecard, streak-at-risk nudge time.
- **Integrations:** Google Calendar connection, screen-time import token (#44: generate/revoke, copy instructions).
- **Privacy & sharing:** public profile toggle + slug (#43).
- **Data:** export JSON/CSV of all tables, import from JSON (validated), delete all data (typed confirmation).

**Implementation:** extend `DEFAULT_SETTINGS` in `src/lib/settings.js`; per-habit reminders stored in settings (`habitReminders: {[habitId]: 'HH:MM'}`) and scheduled by `AppServices`. Split the page into `src/components/settings/*Section.js`. Export uses paginated reads of every user table into one JSON blob download.

**Acceptance:** every setting persists (local + profile), applies without reload, and is respected by the features that use it (week start, currency, day boundary); export file re-imports cleanly.

---

## Suggested build order

1. One round-2 migration covering all tables/columns above (idempotent).
2. **36 Tasks** → **41 Today** (daily-use surfaces).
3. **37 Missions** + **22 Tree** (shared milestones).
4. **40 Calendar** (depends on tasks).
5. **39 Brain dump**, **17 Chains**, **24 Sleep** (+ insights).
6. **25 Subscriptions**, **26 Savings** (budget tabs).
7. **43 Profile**, **38 Portfolio**, **29 Achievements** (shared trophies).
8. **44 Screen intel** (API + token), **45 Settings 2.0**, **34 Theme**, **42 PDF**.
