insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('analysis-artifacts', 'analysis-artifacts', false, 10485760, array['application/json'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read own analysis artifacts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'analysis-artifacts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete own analysis artifacts"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'analysis-artifacts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
