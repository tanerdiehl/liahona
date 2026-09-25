-- Liahona — Phase 1 schema: habits, habit logs, protein entries.
-- Run once in Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Every table has row-level security so each signed-in user only ever
-- sees and changes their own rows.

-- ---------- habits ----------
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null default '#7F77DD',
  why         text not null default '',
  system      text not null default '',
  minimum     text not null default '',
  stretch     text not null default '',
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  start_date  date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists habits_user_idx on public.habits (user_id, sort_order);

alter table public.habits enable row level security;

drop policy if exists "habits: owner full access" on public.habits;
create policy "habits: owner full access" on public.habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- habit_logs ----------
-- One row per habit per day. No row = blank cell.
create table if not exists public.habit_logs (
  habit_id    uuid not null references public.habits (id) on delete cascade,
  date        date not null,
  status      text not null check (status in ('done', 'missed')),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (habit_id, date)
);

create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, date);

alter table public.habit_logs enable row level security;

drop policy if exists "habit_logs: owner full access" on public.habit_logs;
create policy "habit_logs: owner full access" on public.habit_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- protein_entries ----------
create table if not exists public.protein_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  grams       numeric(6, 1) not null check (grams > 0 and grams < 1000),
  created_at  timestamptz not null default now()
);

create index if not exists protein_user_date_idx on public.protein_entries (user_id, date);

alter table public.protein_entries enable row level security;

drop policy if exists "protein: owner full access" on public.protein_entries;
create policy "protein: owner full access" on public.protein_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
