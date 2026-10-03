-- Liahona — migration 006: weekly to-do list + "tracking started" date.

-- Tasks belong to a list: 'todo' (the main list) or 'week' (this week's list).
-- week_start is the Sunday of the week a weekly task was added.
alter table public.tasks add column if not exists list text not null default 'todo';
alter table public.tasks drop constraint if exists tasks_list_check;
alter table public.tasks add constraint tasks_list_check check (list in ('todo', 'week'));
alter table public.tasks add column if not exists week_start date;

-- Everything before this date is ignored by views and stats (nothing is deleted).
alter table public.user_settings add column if not exists tracking_start date;
update public.user_settings set tracking_start = '2026-09-25' where tracking_start is null;
