-- Liahona — migration 005: workout tracker + blank to-do items.
-- Run once in Supabase -> SQL Editor (after 004). Safe to re-run.
--
-- Principle: store raw records only. Every set is its own row and is never
-- summarised away; volume, 1RM, PRs and weekly totals are computed from sets.

-- ---------- to-do: allow blank spacer items (like Google Keep) ----------
alter table public.tasks drop constraint if exists tasks_title_check;

-- ---------- settings ----------
create table if not exists public.user_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  weight_unit       text not null default 'lbs' check (weight_unit in ('lbs', 'kg')),
  rest_seconds      integer not null default 90 check (rest_seconds between 0 and 1800),
  exercises_seeded  boolean not null default false,
  updated_at        timestamptz not null default now()
);

-- ---------- exercise library ----------
-- exercise_type decides which fields a set uses:
--   weight_reps          weight + reps          (barbell bench, curls…)
--   bodyweight_reps      reps                   (push-ups, pull-ups)
--   weighted_bodyweight  added weight + reps    (weighted pull-ups)
--   assisted_bodyweight  assistance weight + reps (assisted pull-up machine)
--   duration             time                   (plank)
--   distance_duration    distance + time        (running, rowing)
create table if not exists public.exercises (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  muscle_group   text not null default 'Other',
  equipment      text not null default 'Other',
  exercise_type  text not null default 'weight_reps' check (exercise_type in
                   ('weight_reps', 'bodyweight_reps', 'weighted_bodyweight',
                    'assisted_bodyweight', 'duration', 'distance_duration')),
  is_custom      boolean not null default true,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- workouts (sessions) ----------
-- ended_at null = in progress (this is what "Resume workout" looks for).
create table if not exists public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_date  date not null default current_date,
  name          text not null default '',
  notes         text not null default '',
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  routine_id    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists workouts_user_date_idx on public.workouts (user_id, workout_date desc);

-- An exercise's slot within a workout (order + per-exercise notes).
create table if not exists public.workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id   uuid not null references public.workouts (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  position     integer not null default 0,
  notes        text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id, position);

-- ---------- sets: one row per set, forever ----------
create table if not exists public.workout_sets (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id           uuid not null references public.workouts (id) on delete cascade,
  workout_exercise_id  uuid not null references public.workout_exercises (id) on delete cascade,
  exercise_id          uuid not null references public.exercises (id) on delete restrict,
  set_order            integer not null default 0,
  set_type             text not null default 'normal' check (set_type in ('warmup', 'normal', 'drop', 'failure')),
  weight               numeric(7, 2),
  weight_unit          text not null default 'lbs' check (weight_unit in ('lbs', 'kg')),
  reps                 integer check (reps >= 0),
  duration_seconds     integer check (duration_seconds >= 0),
  distance             numeric(8, 3),
  distance_unit        text not null default 'mi' check (distance_unit in ('mi', 'km', 'm')),
  rpe                  numeric(3, 1) check (rpe between 1 and 10),
  notes                text not null default '',
  completed            boolean not null default false,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists workout_sets_exercise_idx on public.workout_sets (user_id, exercise_id, completed_at desc);
create index if not exists workout_sets_workout_idx on public.workout_sets (workout_exercise_id, set_order);

-- ---------- routines (templates) in folders ----------
create table if not exists public.routine_folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id   uuid references public.routine_folders (id) on delete set null,
  name        text not null check (length(trim(name)) > 0),
  notes       text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.routine_exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id    uuid not null references public.routines (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete restrict,
  position      integer not null default 0,
  target_sets   integer not null default 3,
  target_reps   text not null default '',
  rest_seconds  integer,
  notes         text not null default ''
);

-- ---------- body log ----------
create table if not exists public.body_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date      date not null default current_date,
  bodyweight    numeric(6, 2),
  weight_unit   text not null default 'lbs' check (weight_unit in ('lbs', 'kg')),
  chest         numeric(5, 2),
  waist         numeric(5, 2),
  hips          numeric(5, 2),
  arms          numeric(5, 2),
  thighs        numeric(5, 2),
  calves        numeric(5, 2),
  shoulders     numeric(5, 2),
  neck          numeric(5, 2),
  measure_unit  text not null default 'in' check (measure_unit in ('in', 'cm')),
  notes         text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists body_logs_user_date_idx on public.body_logs (user_id, log_date);

-- ---------- progress photos (images live in Storage; this is the index) ----------
create table if not exists public.progress_photos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  taken_on      date not null default current_date,
  storage_path  text not null,
  note          text not null default '',
  created_at    timestamptz not null default now()
);

-- ---------- row-level security: you only ever see your own rows ----------
do $$
declare t text;
begin
  foreach t in array array['user_settings', 'exercises', 'workouts', 'workout_exercises', 'workout_sets',
                           'routine_folders', 'routines', 'routine_exercises', 'body_logs', 'progress_photos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: owner full access" on public.%I', t, t);
    execute format('create policy "%s: owner full access" on public.%I for all
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;
