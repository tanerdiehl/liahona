-- Liahona — migration 010: last-backup date + goals that update themselves.

-- When you last downloaded a full backup (drives the backup reminder).
alter table public.user_settings add column if not exists last_backup_at timestamptz;

-- 'metric' goals track a number from your data automatically:
--   e1rm       best estimated 1RM on an exercise
--   weight     heaviest weight lifted on an exercise
--   bodyweight latest logged bodyweight
-- Progress = how far you've moved from metric_start toward metric_target
-- (works for going up or down). Units follow your weight setting.
alter table public.goals drop constraint if exists goals_progress_type_check;
alter table public.goals add constraint goals_progress_type_check
  check (progress_type in ('checklist', 'percent', 'status', 'metric'));
alter table public.goals add column if not exists metric_kind text
  check (metric_kind is null or metric_kind in ('e1rm', 'weight', 'bodyweight'));
alter table public.goals add column if not exists metric_exercise_id uuid references public.exercises (id) on delete set null;
alter table public.goals add column if not exists metric_start numeric(7, 2);
alter table public.goals add column if not exists metric_target numeric(7, 2);
