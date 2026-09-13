create table if not exists public.planly_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text,
  description text,
  date date,
  start_time text,
  reminder_minutes integer,
  color text,
  batch_id text,
  completed boolean,
  order_index integer,
  priority text,
  created_at timestamptz,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint planly_tasks_live_data_check check (
    deleted_at is not null
    or (
      title is not null
      and description is not null
      and date is not null
      and start_time is not null
      and completed is not null
      and order_index is not null
      and created_at is not null
    )
  ),
  constraint planly_tasks_priority_check check (
    priority is null or priority in ('none', 'low', 'medium', 'high')
  ),
  constraint planly_tasks_reminder_check check (
    reminder_minutes is null
    or reminder_minutes between 0 and 10080
  ),
  constraint planly_tasks_start_time_check check (
    start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  )
);

create table if not exists public.planly_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text,
  content text,
  created_at timestamptz,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint planly_notes_live_data_check check (
    deleted_at is not null
    or (title is not null and content is not null and created_at is not null)
  )
);

create index if not exists planly_tasks_user_server_updated_idx
  on public.planly_tasks (user_id, server_updated_at);

create index if not exists planly_notes_user_server_updated_idx
  on public.planly_notes (user_id, server_updated_at);

create or replace function public.apply_planly_sync_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;

  new.server_updated_at = now();
  return new;
end;
$$;

drop trigger if exists planly_tasks_sync_timestamp on public.planly_tasks;
create trigger planly_tasks_sync_timestamp
before insert or update on public.planly_tasks
for each row execute function public.apply_planly_sync_timestamp();

drop trigger if exists planly_notes_sync_timestamp on public.planly_notes;
create trigger planly_notes_sync_timestamp
before insert or update on public.planly_notes
for each row execute function public.apply_planly_sync_timestamp();

alter table public.planly_tasks enable row level security;
alter table public.planly_notes enable row level security;

revoke all on public.planly_tasks from anon;
revoke all on public.planly_notes from anon;
grant select, insert, update, delete on public.planly_tasks to authenticated;
grant select, insert, update, delete on public.planly_notes to authenticated;

drop policy if exists "Users can read their own Planly tasks" on public.planly_tasks;
create policy "Users can read their own Planly tasks"
on public.planly_tasks for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own Planly tasks" on public.planly_tasks;
create policy "Users can insert their own Planly tasks"
on public.planly_tasks for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own Planly tasks" on public.planly_tasks;
create policy "Users can update their own Planly tasks"
on public.planly_tasks for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own Planly tasks" on public.planly_tasks;
create policy "Users can delete their own Planly tasks"
on public.planly_tasks for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own Planly notes" on public.planly_notes;
create policy "Users can read their own Planly notes"
on public.planly_notes for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own Planly notes" on public.planly_notes;
create policy "Users can insert their own Planly notes"
on public.planly_notes for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own Planly notes" on public.planly_notes;
create policy "Users can update their own Planly notes"
on public.planly_notes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own Planly notes" on public.planly_notes;
create policy "Users can delete their own Planly notes"
on public.planly_notes for delete
to authenticated
using ((select auth.uid()) = user_id);
