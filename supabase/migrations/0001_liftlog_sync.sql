-- SQLite remains the fast local source of truth. These rows are the
-- authenticated, cross-device sync mirror for user-owned LiftLog programs.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create index if not exists programs_owner_updated_idx on public.programs (owner_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.programs enable row level security;

create policy "Users manage their own profile" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage their own programs" on public.programs for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists programs_touch_updated_at on public.programs;
create trigger programs_touch_updated_at before update on public.programs
for each row execute function public.touch_updated_at();
