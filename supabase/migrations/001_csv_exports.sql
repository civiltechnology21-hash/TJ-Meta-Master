-- TJ Meta Master - Phase 2
-- The ONLY application table: saved CSV exports. Nothing else is stored.
-- Run this once in: Supabase Dashboard -> SQL Editor.

create table if not exists public.csv_exports (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('single', 'batch')),
  file_count  integer     not null check (file_count > 0),
  file_name   text        not null check (char_length(file_name) between 1 and 200),
  csv_content text        not null check (char_length(csv_content) <= 5000000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.csv_exports is
  'Generated metadata CSV files (single or batch). Hard-deleted on user request.';

-- Fast "my files, newest first" listing.
create index if not exists csv_exports_user_created_idx
  on public.csv_exports (user_id, created_at desc);

-- Keep updated_at fresh when a CSV is updated (e.g. after a Retry succeeds).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists csv_exports_set_updated_at on public.csv_exports;
create trigger csv_exports_set_updated_at
  before update on public.csv_exports
  for each row execute function public.set_updated_at();

-- Row Level Security: every user can only touch their own rows.
alter table public.csv_exports enable row level security;

drop policy if exists "csv_exports_select_own" on public.csv_exports;
create policy "csv_exports_select_own" on public.csv_exports
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "csv_exports_insert_own" on public.csv_exports;
create policy "csv_exports_insert_own" on public.csv_exports
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "csv_exports_update_own" on public.csv_exports;
create policy "csv_exports_update_own" on public.csv_exports
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- DELETE is a real, permanent delete (no soft-delete, no backup copy).
drop policy if exists "csv_exports_delete_own" on public.csv_exports;
create policy "csv_exports_delete_own" on public.csv_exports
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Logged-out (anon) visitors get no access at all.
revoke all on public.csv_exports from anon;
grant select, insert, update, delete on public.csv_exports to authenticated;
