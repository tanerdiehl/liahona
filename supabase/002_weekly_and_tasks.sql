-- Liahona — migration 002: weekly habits + to-do list.
-- Run once in Supabase -> SQL Editor (after 001_phase1.sql).

-- ---------- weekly habits ----------
-- 'daily' habits log one row per day; 'weekly' habits log one row per week,
-- dated to the Sunday that starts the week.
alter table public.habits
  add column if not exists frequency text not null default 'daily';

alter table public.habits drop constraint if exists habits_frequency_check;
alter table public.habits
  add constraint habits_frequency_check check (frequency in ('daily', 'weekly'));

-- Move the starting "Weekly planning" habit into the weekly section.
update public.habits set frequency = 'weekly' where name = 'Weekly planning';

-- ---------- tasks ----------
-- completed_at null = open task. Completed tasks are never removed; they
-- form the permanent "done" log.
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists tasks_user_open_idx on public.tasks (user_id, completed_at);

alter table public.tasks enable row level security;

drop policy if exists "tasks: owner full access" on public.tasks;
create policy "tasks: owner full access" on public.tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
