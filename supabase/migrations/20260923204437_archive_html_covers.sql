-- HTML covers share the existing owner-only upload and publishing policies.
alter table public.archive_entries drop constraint archive_entries_cover_path_check;
alter table public.archive_entries add constraint archive_entries_cover_path_check
  check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|html)$');
update storage.buckets
set allowed_mime_types=array['image/jpeg','image/png','image/webp','text/html']
where id='archive-covers';
