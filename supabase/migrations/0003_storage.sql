-- =====================================================================
-- CareerHQ — Supabase Storage buckets + RLS policies.
--
-- Run AFTER 0001_core_schema.sql and 0002_social_schema.sql.
--
-- All three buckets are PRIVATE. Files are stored under a path that
-- starts with the owner's auth.uid(), e.g. resumes/<user_id>/<file>.
-- Policies below only allow a user to read/write/delete objects inside
-- their own folder. The app always fetches files via short-lived signed
-- URLs (createSignedUrl) — never public URLs.
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('resumes', 'resumes', false),
  ('certificates', 'certificates', false),
  ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- ---- resumes bucket ----
drop policy if exists "resumes_select_own" on storage.objects;
create policy "resumes_select_own" on storage.objects for select
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "resumes_insert_own" on storage.objects;
create policy "resumes_insert_own" on storage.objects for insert
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "resumes_update_own" on storage.objects;
create policy "resumes_update_own" on storage.objects for update
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "resumes_delete_own" on storage.objects;
create policy "resumes_delete_own" on storage.objects for delete
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- certificates bucket ----
drop policy if exists "certificates_select_own" on storage.objects;
create policy "certificates_select_own" on storage.objects for select
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "certificates_insert_own" on storage.objects;
create policy "certificates_insert_own" on storage.objects for insert
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "certificates_update_own" on storage.objects;
create policy "certificates_update_own" on storage.objects for update
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "certificates_delete_own" on storage.objects;
create policy "certificates_delete_own" on storage.objects for delete
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- avatars bucket ----
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
