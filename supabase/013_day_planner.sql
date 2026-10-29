-- Liahona — migration 013: day planner (modeled on the Preach My Gospel
-- app's daily planner). One row per planned block of time, plus one row
-- per day for that day's priorities and end-of-day review.

create table if not exists public.plan_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  title       text not null default '',
  category    text not null default 'other',
  location    text not null default '',
  notes       text not null default '',
  backup      text not null default '',
  status      text not null default 'planned' check (status in ('planned', 'done', 'missed')),
  task_id     uuid references public.tasks (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists plan_events_user_date_idx on public.plan_events (user_id, date, start_time);

create table if not exists public.day_plans (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  priorities  text not null default '',
  review      text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.plan_events enable row level security;
drop policy if exists "plan_events: owner full access" on public.plan_events;
create policy "plan_events: owner full access" on public.plan_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.day_plans enable row level security;
drop policy if exists "day_plans: owner full access" on public.day_plans;
create policy "day_plans: owner full access" on public.day_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
