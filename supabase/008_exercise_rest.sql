-- Liahona — migration 008: per-exercise rest time for the rest timer.
-- Rest used after a set: routine's rest_seconds > exercise's rest_seconds >
-- user_settings.rest_seconds (default 90). null = use the next one down.
alter table public.exercises add column if not exists rest_seconds integer
  check (rest_seconds is null or rest_seconds between 0 and 1800);
