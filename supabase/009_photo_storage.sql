-- Liahona — migration 009: private storage for progress photos.
-- Photos live in Supabase Storage (not the database). Each user's files sit
-- in a folder named after their user id, and only that user can see them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "progress photos: owner select" on storage.objects;
drop policy if exists "progress photos: owner insert" on storage.objects;
drop policy if exists "progress photos: owner update" on storage.objects;
drop policy if exists "progress photos: owner delete" on storage.objects;

create policy "progress photos: owner select" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress photos: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress photos: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress photos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
