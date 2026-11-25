-- Archive editors can delete entries and set an entry's release date (2026-11-25).
-- "Editor" is the existing archive_editors list; nobody else gains anything.

-- Delete: editors only. Readers and other signed-in accounts still can't.
grant delete on public.archive_entries to authenticated;
create policy archive_editor_delete on public.archive_entries for delete to authenticated using (
  exists (select 1 from public.archive_editors where user_id = (select auth.uid()))
);

-- Release date: the date the archive shows is created_at, so editors may set it when
-- publishing or editing. The existing insert and update policies still decide who may.
grant insert (created_at), update (created_at) on public.archive_entries to authenticated;

-- A deleted entry's attachments are public files, so editors may remove the ones in their
-- own folder (as they already can for covers). Removing a file needs read access too.
create policy archive_attachments_editor_read on storage.objects for select to authenticated using (
  bucket_id = 'archive-attachments'
  and exists (select 1 from public.archive_editors where user_id = (select auth.uid()))
);
create policy archive_attachments_editor_cleanup on storage.objects for delete to authenticated using (
  bucket_id = 'archive-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.archive_editors where user_id = (select auth.uid()))
);
