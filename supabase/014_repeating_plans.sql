-- Liahona — migration 014: repeating plans (scripture study, workouts,
-- class until the end of the semester).
-- A series describes the pattern; days without a plan_events row just show
-- the pattern. When you check one off, move it, or change just that day, a
-- plan_events row with series_id + date is saved for that day.

create table if not exists public.plan_series (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '',
  category    text not null default 'other',
  location    text not null default '',
  notes       text not null default '',
  backup      text not null default '',
  start_time  time not null,
  end_time    time not null,
  days        smallint[] not null,          -- 0 = Sunday … 6 = Saturday
  start_date  date not null,
  end_date    date,                          -- null = repeats forever
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.plan_series enable row level security;
drop policy if exists "plan_series: owner full access" on public.plan_series;
create policy "plan_series: owner full access" on public.plan_series
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- History stays even if a series is deleted.
alter table public.plan_events add column if not exists series_id uuid references public.plan_series (id) on delete set null;
create unique index if not exists plan_events_series_date_idx on public.plan_events (series_id, date) where series_id is not null;

-- 'skipped' = one day of a repeating plan removed.
alter table public.plan_events drop constraint if exists plan_events_status_check;
alter table public.plan_events add constraint plan_events_status_check check (status in ('planned', 'done', 'missed', 'skipped'));
