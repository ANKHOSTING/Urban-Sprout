-- Atomic, order-safe write of a RevenueCat event into public.subscriptions.
-- Returns 1 when the event was applied (inserted or newer/equal than the stored row), NULL when it was stale
-- (stored updated_at is newer than the event's), so the webhook can ack stale events with 200.
create or replace function public.apply_subscription_event(
  p_user_id uuid,
  p_is_pro boolean,
  p_expires_at timestamptz,
  p_updated_at timestamptz
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  applied integer;
begin
  insert into public.subscriptions as s (user_id, is_pro, expires_at, updated_at)
  values (p_user_id, p_is_pro, p_expires_at, p_updated_at)
  on conflict (user_id) do update
    set is_pro = excluded.is_pro,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    where s.updated_at <= excluded.updated_at
  returning 1 into applied;
  return applied; -- NULL if the conflict update was skipped (stale event)
end;
$$;

revoke execute on function public.apply_subscription_event(uuid, boolean, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, boolean, timestamptz, timestamptz) to service_role;
