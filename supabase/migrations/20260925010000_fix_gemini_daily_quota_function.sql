create or replace function public.consume_gemini_daily_quota(p_user_id uuid)
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  daily_limit integer,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  quota_day date := (now() at time zone 'utc')::date;
  current_count integer;
  request_allowed boolean;
begin
  insert into planly_private.gemini_daily_usage as usage (
    user_id,
    usage_date,
    request_count,
    updated_at
  )
  values (p_user_id, quota_day, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = usage.request_count + 1,
        updated_at = now()
    where usage.request_count < 50
  returning request_count into current_count;

  request_allowed := found;
  if not request_allowed then
    select request_count
      into current_count
      from planly_private.gemini_daily_usage
      where user_id = p_user_id and usage_date = quota_day;
  end if;

  return query
  select
    request_allowed,
    current_count,
    greatest(50 - current_count, 0),
    50,
    ((quota_day + 1)::timestamp at time zone 'utc');
end;
$$;

revoke all on function public.consume_gemini_daily_quota(uuid)
  from public, anon, authenticated;
grant execute on function public.consume_gemini_daily_quota(uuid)
  to service_role;
