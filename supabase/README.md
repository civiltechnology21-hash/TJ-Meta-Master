# Supabase setup (one time)

## 1. Create the project
1. https://supabase.com -> New project (free plan).
2. Wait until it is ready.

## 2. Create the table
1. Dashboard -> **SQL Editor** -> New query.
2. Paste the full content of `migrations/001_csv_exports.sql` -> **Run**.
3. Check: **Table Editor** shows `csv_exports` with the RLS badge enabled.

## 3. Lock down sign-up (only your people can log in)
1. **Authentication -> Sign In / Providers** (or *Providers -> Email*):
   - Email provider: **enabled**
   - **Allow new users to sign up: OFF**
2. Do not enable any other provider (no Google, no magic link / OTP is used).

## 4. Create the users
1. **Authentication -> Users -> Add user -> Create new user**
2. Enter email + password, tick **Auto Confirm User**, create.
3. Repeat for each person. Share the password privately.

## 5. Get the keys for `.env.local`
- **Project Settings -> API**
  - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Never use the `service_role` key in this project.

## 6. After deploying to Vercel
- **Authentication -> URL Configuration -> Site URL** = your Vercel URL.

## What is stored
| Where | What |
|---|---|
| `auth.users` | login accounts (required by Supabase Auth) |
| `public.csv_exports` | generated CSV files only |
| Nothing else | no images, previews, API keys or settings |

## Good to know
- Delete from the app = row permanently removed.
- Free projects are **paused after ~1 week of inactivity**; restore it from the dashboard if that happens.
- Free DB limit is 500 MB; a 1000-row CSV is about 1 MB, so it is plenty.
