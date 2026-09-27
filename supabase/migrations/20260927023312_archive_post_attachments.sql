-- Attachment metadata is saved atomically with the post. Existing editor RLS remains in force.
create function public.archive_attachments_valid(files jsonb, owner_id uuid)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;
begin
  if files is null or jsonb_typeof(files) <> 'array' then return false; end if;
  if jsonb_array_length(files) > 10 then return false; end if;
  for item in select value from jsonb_array_elements(files) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if not (item ?& array['path','name','kind','size']) then return false; end if;
    if jsonb_typeof(item->'path') <> 'string' or jsonb_typeof(item->'name') <> 'string'
       or jsonb_typeof(item->'kind') <> 'string' or jsonb_typeof(item->'size') <> 'number' then return false; end if;
    if item->>'kind' not in ('pdf','zip') or char_length(btrim(item->>'name')) not between 1 and 255 then return false; end if;
    if (item->>'size')::numeric not between 1 and 26214400 or trunc((item->>'size')::numeric) <> (item->>'size')::numeric then return false; end if;
    if item->>'path' !~ ('^' || owner_id::text || '/[0-9a-f-]{36}\.' || (item->>'kind') || '$') then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.archive_attachments_valid(jsonb,uuid) from public;
grant execute on function public.archive_attachments_valid(jsonb,uuid) to authenticated;
alter table public.archive_entries add column attachments jsonb not null default '[]'::jsonb;
alter table public.archive_entries add constraint archive_entries_attachments_check check (public.archive_attachments_valid(attachments,author_id));
grant insert(attachments), update(attachments) on public.archive_entries to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('archive-attachments','archive-attachments',true,26214400,array['application/pdf','application/zip']);
create policy archive_attachments_editor_upload on storage.objects for insert to authenticated with check (
  bucket_id='archive-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|zip)$'
  and exists (select 1 from public.archive_editors where user_id=(select auth.uid()))
);
