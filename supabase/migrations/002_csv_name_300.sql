-- TJ Meta Master - allow renamed CSV files up to 300 characters.
-- Run once in: Supabase Dashboard -> SQL Editor.
alter table public.csv_exports
  drop constraint if exists csv_exports_file_name_check;

alter table public.csv_exports
  add constraint csv_exports_file_name_check
  check (char_length(file_name) between 1 and 300);
