alter table public.planly_tasks
  drop constraint if exists planly_tasks_reminder_check,
  drop column if exists reminder_minutes;
