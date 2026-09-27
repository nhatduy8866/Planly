alter table public.planly_tasks
  add constraint planly_tasks_id_length_check
    check (char_length(id) between 1 and 128) not valid,
  add constraint planly_tasks_title_length_check
    check (title is null or char_length(title) <= 120) not valid,
  add constraint planly_tasks_description_length_check
    check (description is null or char_length(description) <= 500) not valid,
  add constraint planly_tasks_start_time_length_check
    check (start_time is null or char_length(start_time) <= 16) not valid,
  add constraint planly_tasks_color_length_check
    check (color is null or char_length(color) <= 32) not valid,
  add constraint planly_tasks_batch_id_length_check
    check (batch_id is null or char_length(batch_id) <= 128) not valid,
  add constraint planly_tasks_priority_length_check
    check (priority is null or char_length(priority) <= 16) not valid;

create table if not exists public.planly_task_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  task_count integer not null check (task_count >= 0)
);

insert into public.planly_task_usage (user_id, task_count)
select user_id, count(*)::integer
from public.planly_tasks
group by user_id
on conflict (user_id) do update
set task_count = excluded.task_count;

alter table public.planly_task_usage enable row level security;
revoke all on public.planly_task_usage from public;
revoke all on public.planly_task_usage from anon;
revoke all on public.planly_task_usage from authenticated;

create or replace function public.track_planly_task_row_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if tg_op = 'INSERT' then
    -- The counter row is the per-owner serialization point. This remains
    -- atomic for concurrent and multi-row inserts, while ON CONFLICT updates
    -- of existing task IDs do not fire this AFTER INSERT branch.
    insert into public.planly_task_usage (user_id, task_count)
    values (new.user_id, 1)
    on conflict (user_id) do update
      set task_count = public.planly_task_usage.task_count + 1
      where public.planly_task_usage.task_count < 5000
    returning task_count into updated_count;

    if updated_count is null then
      raise exception using
        errcode = 'P0001',
        message = 'PLANLY_TASK_QUOTA_EXCEEDED';
    end if;
    return new;
  end if;

  update public.planly_task_usage
  set task_count = pg_catalog.greatest(task_count - 1, 0)
  where user_id = old.user_id;
  return old;
end;
$$;

revoke all on function public.track_planly_task_row_quota() from public;
revoke all on function public.track_planly_task_row_quota() from anon;
revoke all on function public.track_planly_task_row_quota() from authenticated;

drop trigger if exists track_planly_task_row_quota on public.planly_tasks;
create trigger track_planly_task_row_quota
after insert or delete on public.planly_tasks
for each row execute function public.track_planly_task_row_quota();
