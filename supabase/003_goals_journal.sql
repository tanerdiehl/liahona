-- Liahona — migration 003: goals (+ checklist items, habit/task links) and journal.
-- Run once in Supabase -> SQL Editor (after 002).

-- ---------- goals ----------
-- tier: 'medium' (1–2 years) or 'long' (5+ years / life-level).
-- progress_type decides which progress field is used:
--   'checklist' -> goal_items, 'percent' -> percent, 'status' -> status text.
create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tier           text not null check (tier in ('medium', 'long')),
  title          text not null check (length(trim(title)) > 0),
  why            text not null default '',
  progress_type  text not null default 'checklist' check (progress_type in ('checklist', 'percent', 'status')),
  percent        integer not null default 0 check (percent between 0 and 100),
  status         text not null default '',
  sort_order     integer not null default 0,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists goals_user_idx on public.goals (user_id, tier, sort_order);

alter table public.goals enable row level security;
drop policy if exists "goals: owner full access" on public.goals;
create policy "goals: owner full access" on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- goal checklist items ----------
create table if not exists public.goal_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id     uuid not null references public.goals (id) on delete cascade,
  text        text not null check (length(trim(text)) > 0),
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists goal_items_goal_idx on public.goal_items (goal_id, created_at);

alter table public.goal_items enable row level security;
drop policy if exists "goal_items: owner full access" on public.goal_items;
create policy "goal_items: owner full access" on public.goal_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- optional links: habit -> goal, task -> goal ----------
-- Deleting a goal just unlinks; the habit/task and its history stay.
alter table public.habits add column if not exists goal_id uuid references public.goals (id) on delete set null;
alter table public.tasks  add column if not exists goal_id uuid references public.goals (id) on delete set null;

-- ---------- journal ----------
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date  date not null,
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists journal_user_date_idx on public.journal_entries (user_id, entry_date desc);

alter table public.journal_entries enable row level security;
drop policy if exists "journal: owner full access" on public.journal_entries;
create policy "journal: owner full access" on public.journal_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
