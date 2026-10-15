-- Liahona — migration 012: "minimum" habit status (did just the bare minimum).
-- Counts toward streaks and completion; analytics also show it separately.
alter table habit_logs drop constraint if exists habit_logs_status_check;
alter table habit_logs add constraint habit_logs_status_check check (status in ('done', 'minimum', 'missed'));
