# Liahona

Personal habits, protein, goals, tasks and journal tracker.
React + Vite front end, Supabase for login and data.

## One-time Supabase setup

1. Go to <https://supabase.com>, sign up (free), and click **New project**.
   Pick any name (e.g. `liahona`), set a database password (save it in your
   password manager; the app doesn't need it), choose the region closest to you.
2. When the project is ready, open **SQL Editor → New query**, paste the whole
   contents of `supabase/001_phase1.sql`, and click **Run**.
3. Create your login: **Authentication → Users → Add user → Create new user**.
   Enter your email and a password, and tick **Auto Confirm User**.
4. Lock the door: **Authentication → Sign In / Providers** (or **Settings**)
   → turn **off** "Allow new users to sign up". Only the account you just
   made can ever sign in.
5. Get the keys: **Project Settings → API** (or the **Connect** button).
   Copy the **Project URL** and the **anon / publishable** key.
   Never use the `service_role` / secret key in this app.
6. In this folder, copy `.env.example` to `.env.local` and paste those two
   values in.

## Running locally

```
npm install
npm run dev
```

Then open <http://localhost:5173>.

## Data model

| Table             | What it holds                                               |
| ----------------- | ----------------------------------------------------------- |
| `habits`          | Name, color, why/system/minimum/stretch, order, archived    |
| `habit_logs`      | One row per habit per day: `done` or `missed` (no row = blank) |
| `protein_entries` | Each quick-add: date + grams                                |

Every table uses row-level security, so a signed-in user can only read
and write their own rows.

## Scoring

Every habit is scored daily. Completion % = ✓ days ÷ days since the habit
started. Blank and ✕ both count as a miss. A streak is consecutive ✓ days.
