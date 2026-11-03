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
