-- Liahona — migration 015: where a to-do came from.
-- 'todo' = typed into the to-do list; 'plan' = a planner block you checked
-- off, added to the to-do list's completed section automatically.
alter table public.tasks add column if not exists source text not null default 'todo';
