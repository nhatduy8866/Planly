create or replace function public.apply_planly_sync_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Keep the existing row and avoid a redundant row version for stale or
  -- already-applied mutations.
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null;
  end if;

  new.server_updated_at = now();
  return new;
end;
$$;
