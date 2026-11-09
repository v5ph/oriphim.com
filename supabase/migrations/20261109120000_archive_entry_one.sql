-- Entry No. 01 began as a static page (archive/catalogue-01). This moves it into archive_entries so the
-- archive editor can change it like every other entry. entry_number is "generated always", so the number
-- is set explicitly. The cover image is not copied: upload assets/archive-catalog-01-large.jpg from the editor.
-- Safe to run twice: an existing entry 1 (or id) is left alone. Does nothing if there is no archive editor.
insert into public.archive_entries (id, entry_number, title, body, tag, cover_alt, author_id, created_at, updated_at)
overriding system value
select
  '69419960-1f93-484f-a9d7-4ba5059a69ef',
  1,
  'The Archive is live.',
  $body$This is where build notes, research notes, and honest status updates will live - what's shipped, what's roadmap, and everything in between. Starting now.

This will soon turn into a complete library where research done with Oriphim can be seen, discussed, shared, and replicated.$body$,
  'Announcement',
  'Engraved archive room with columns, scholars, and catalog shelves',
  user_id,
  timestamptz '2026-07-23 00:00:00-04',
  timestamptz '2026-07-23 00:00:00-04'
from public.archive_editors
order by user_id
limit 1
on conflict do nothing;
