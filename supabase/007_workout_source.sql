-- Liahona — migration 007: where a workout came from.
-- liahona = logged in the app, hevy = imported from a Hevy export.
alter table public.workouts add column if not exists source text not null default 'liahona';
