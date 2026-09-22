-- All test rows roll back. Run with a database-admin connection.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1363f93-72fa-440c-897b-22e0fedb442f","role":"authenticated"}', true);
insert into public.archive_entries(id,title,body,tag) values ('11111111-1111-4111-8111-111111111111','Permission test','Plasma convergence research','Research');
update public.archive_entries set title='Updated permission test' where id='11111111-1111-4111-8111-111111111111';
do $$ begin
  if not exists(select 1 from public.archive_entries where id='11111111-1111-4111-8111-111111111111' and search_document @@ websearch_to_tsquery('english','plasma')) then raise exception 'Owner publish or search failed'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$ declare affected integer; begin
  begin
    insert into public.archive_entries(title,body,tag) values ('Unauthorized','No','Research');
    raise exception 'Non-editor publish was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.archive_editors(user_id) values ('22222222-2222-4222-8222-222222222222');
    raise exception 'Self-promotion was allowed';
  exception when insufficient_privilege then null; end;
  update public.archive_entries set title='Unauthorized change' where id='11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Non-editor update was allowed'; end if;
  if exists(select 1 from public.archive_editors) then raise exception 'Editor list leaked'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('archive-covers','22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png');
    raise exception 'Non-editor cover upload allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  if not exists(select 1 from public.archive_entries where id='11111111-1111-4111-8111-111111111111') then raise exception 'Public reader cannot read'; end if;
  begin
    insert into public.archive_entries(title,body,tag) values ('Anonymous','No','Announcement');
    raise exception 'Anonymous publish allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Owner publishing, public reading, search, non-editor denial, self-promotion denial, cover-upload denial: passed' as result;
rollback;
