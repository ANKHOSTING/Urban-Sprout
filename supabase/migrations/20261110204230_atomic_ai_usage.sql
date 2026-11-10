-- Atomic check-and-consume for the free daily AI limit (shared by plant-advice and identify-plant).
-- Returns the new count for today (UTC), or NULL if the user is already at/over p_limit. No race between check and increment.
create or replace function public.try_consume_ai_usage(p_user uuid, p_limit int) returns int
language sql security definer set search_path = public as $$
  insert into public.ai_usage as u (user_id, day, count)
  select p_user, (now() at time zone 'utc')::date, 1 where p_limit >= 1
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning count;
$$;

-- Give back one unit when the AI call fails after a successful consume.
-- Same signature as the version in main's 20261103000000_private_photos_bucket.sql (already live), so this is idempotent.
create or replace function public.refund_ai_usage(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.ai_usage set count = greatest(count - 1, 0)
  where user_id = p_user and day = (now() at time zone 'utc')::date;
$$;

revoke all on function public.try_consume_ai_usage(uuid, int) from public, anon, authenticated;
revoke all on function public.refund_ai_usage(uuid) from public, anon, authenticated;
grant execute on function public.try_consume_ai_usage(uuid, int) to service_role;
grant execute on function public.refund_ai_usage(uuid) to service_role;
