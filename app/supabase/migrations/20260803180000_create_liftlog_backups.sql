-- Private, user-scoped snapshots for the complete local GainsLab database.
-- The payload itself lives in a private Storage bucket; this table is only
-- metadata used to find and deduplicate the latest snapshot.

create table if not exists public.user_backup_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  byte_size bigint not null check (byte_size > 0),
  content_hash text not null,
  include_feed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, content_hash)
);

create index if not exists user_backup_metadata_latest_idx
  on public.user_backup_metadata (user_id, created_at desc);

alter table public.user_backup_metadata enable row level security;

drop policy if exists "Users can read their own backup metadata"
  on public.user_backup_metadata;
create policy "Users can read their own backup metadata"
  on public.user_backup_metadata
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own backup metadata"
  on public.user_backup_metadata;
create policy "Users can create their own backup metadata"
  on public.user_backup_metadata
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own backup metadata"
  on public.user_backup_metadata;
create policy "Users can delete their own backup metadata"
  on public.user_backup_metadata
  for delete
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('liftlog-backups', 'liftlog-backups', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read their own GainsLab backups"
  on storage.objects;
create policy "Users can read their own GainsLab backups"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'liftlog-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can upload their own GainsLab backups"
  on storage.objects;
create policy "Users can upload their own GainsLab backups"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'liftlog-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can update their own GainsLab backups"
  on storage.objects;
create policy "Users can update their own GainsLab backups"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'liftlog-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'liftlog-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can delete their own GainsLab backups"
  on storage.objects;
create policy "Users can delete their own GainsLab backups"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'liftlog-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
