-- Make the photos bucket private. Files live under <user_id>/...
-- Clients now use createSignedUrl (short-lived) instead of public URLs.
update storage.buckets set public = false where id = 'photos';

-- Replace the world-readable policy.
drop policy if exists "read photos" on storage.objects;
drop policy if exists "read own photos" on storage.objects;
drop policy if exists "read marketplace listing photos" on storage.objects;

-- Owners can read (and therefore sign URLs for) their own files, e.g. journal photos.
create policy "read own photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Marketplace: signed-in users may read a photo only if a listing they can see (listings RLS already
-- hides moderated/hidden listings and blocked users) references it. Journal photos are never exposed.
create policy "read marketplace listing photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (select 1 from public.listings l where l.photo_path = storage.objects.name)
  );

-- Profiles: do not derive the public display name from the user's email address.
-- (profiles are readable by all signed-in users for the marketplace "Posted by" label.)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, 'Gardener');
  return new;
end $$;
-- Scrub names that were derived from emails by the old trigger.
update public.profiles p set display_name = 'Gardener'
  from auth.users u where u.id = p.id and p.display_name = split_part(u.email, '@', 1);

-- Account deletion: storage objects are removed by the client via the Storage API BEFORE calling this
-- (deleting storage.objects rows in SQL leaves the underlying files behind). Cascades remove all user rows.
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Gives back one unit of today's free AI quota (used by plant-advice when the AI call fails after the atomic reserve).
create or replace function public.refund_ai_usage(p_user uuid) returns void language sql security definer set search_path = public as $$
  update public.ai_usage set count = greatest(count - 1, 0) where user_id = p_user and day = (now() at time zone 'utc')::date;
$$;
revoke all on function public.refund_ai_usage(uuid) from public, anon, authenticated;
