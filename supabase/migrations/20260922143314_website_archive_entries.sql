-- Website-only publishing. Does not alter desktop-app tables or account roles.
create table public.archive_editors (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.archive_editors enable row level security;
revoke all on public.archive_editors from anon, authenticated;
grant select on public.archive_editors to authenticated;
create policy archive_editor_self on public.archive_editors for select to authenticated using (user_id = (select auth.uid()));

insert into public.archive_editors (user_id)
select id from auth.users where lower(email) = 'pc5.carrington@gmail.com' and email_confirmed_at is not null;

create table public.archive_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number bigint generated always as identity (start with 2) unique,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 100000),
  tag text not null check (tag in ('Announcement', 'Research', 'Build Log')),
  cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  cover_alt text not null default '' check (char_length(cover_alt) <= 300),
  author_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B')
  ) stored
);
alter table public.archive_entries enable row level security;
revoke all on public.archive_entries from anon, authenticated;
grant select on public.archive_entries to anon, authenticated;
grant insert (id,title,body,tag,cover_path,cover_alt) on public.archive_entries to authenticated;
grant update (title,body,tag,cover_path,cover_alt) on public.archive_entries to authenticated;
grant usage on sequence public.archive_entries_entry_number_seq to authenticated;
create policy archive_public_read on public.archive_entries for select to anon, authenticated using (true);
create policy archive_editor_insert on public.archive_entries for insert to authenticated with check (
  author_id = (select auth.uid()) and exists (select 1 from public.archive_editors where user_id = (select auth.uid()))
  and (cover_path is null or split_part(cover_path,'/',1) = (select auth.uid())::text)
);
create policy archive_editor_update on public.archive_entries for update to authenticated using (
  exists (select 1 from public.archive_editors where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.archive_editors where user_id = (select auth.uid()))
  and (cover_path is null or split_part(cover_path,'/',1) = (select auth.uid())::text)
);
create index archive_entries_recent_idx on public.archive_entries (created_at desc, id desc);
create index archive_entries_tag_recent_idx on public.archive_entries (tag, created_at desc);
create index archive_entries_search_idx on public.archive_entries using gin (search_document);
create index archive_entries_author_idx on public.archive_entries(author_id);
create function public.archive_set_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.archive_set_updated_at() from public, anon, authenticated;
create trigger archive_updated_at before update on public.archive_entries for each row execute function public.archive_set_updated_at();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('archive-covers','archive-covers',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy archive_covers_editor_read on storage.objects for select to authenticated using (
  bucket_id='archive-covers' and exists (select 1 from public.archive_editors where user_id=(select auth.uid()))
);
create policy archive_covers_editor_upload on storage.objects for insert to authenticated with check (
  bucket_id='archive-covers' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.archive_editors where user_id=(select auth.uid()))
);
create policy archive_covers_editor_cleanup on storage.objects for delete to authenticated using (
  bucket_id='archive-covers' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.archive_editors where user_id=(select auth.uid()))
);
