-- Liahona — migration 004: custom order for to-do items.
-- Run once in Supabase -> SQL Editor (after 003).

-- Fractional ordering: moving an item gives it a value between its new
-- neighbours, so only that one row changes.
alter table public.tasks add column if not exists sort_order double precision;

-- Existing tasks keep their current (oldest-first) order.
update public.tasks t
set sort_order = s.rn
from (select id, row_number() over (partition by user_id order by created_at) as rn from public.tasks) s
where t.id = s.id and t.sort_order is null;

alter table public.tasks alter column sort_order set default 0;
alter table public.tasks alter column sort_order set not null;
