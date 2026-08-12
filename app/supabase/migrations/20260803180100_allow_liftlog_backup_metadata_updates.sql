drop policy if exists "Users can update their own backup metadata"
  on public.user_backup_metadata;
create policy "Users can update their own backup metadata"
  on public.user_backup_metadata
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
