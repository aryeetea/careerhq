# CareerHQ

A warm, calm home base for your job search — save jobs you find elsewhere, decide what's worth applying to, track applications through a kanban board, manage resumes and certifications, and (optionally) share high-level progress with friends who cheer you on.

CareerHQ is a fully browser-based React + Supabase app. It deploys to Vercel and works on desktop, tablet, and mobile — no installation required.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui (Radix primitives) · React Router · TanStack Query · React Hook Form + Zod · Supabase (Postgres, Auth, Storage) · Vercel

## Project structure

```
src/
  components/
    ui/             shadcn primitives (button, dialog, select, …)
    layout/         Sidebar, TopBar, MobileNav, AppShell, notifications
    ambient/        AmbientBackground, BotanicalAccent, Celebration
    jobs/, board/   job cards, add/detail dialogs, kanban columns
    resumes/, certifications/, friends/, groups/, goals/, settings/
    shared/         EmptyState, ConfirmDialog, toast, spinner
  hooks/
    queries/        one file per domain — every Supabase read/write goes
                     through TanStack Query here, never directly in a component
    useAuth.tsx, useTheme.tsx
  services/         the repository layer — typed functions wrapping
                     supabase-js; the only files that import `supabase`
  lib/              validation (zod), constants, utils, stats, csv/json export
  pages/            one file per route
  types/database.ts hand-written types mirroring the SQL schema
supabase/
  migrations/       run these in order against your Supabase project
```

Architecture rule this app follows throughout: **components never call `supabase` directly.** They call a hook in `hooks/queries/`, which calls a function in `services/`, which is the only place that touches `@supabase/supabase-js`. This keeps caching, error handling, and RLS assumptions in one place per domain.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project. Pick any name/region/password (the DB password isn't used by this app directly).
2. Once it's provisioned, open **SQL Editor** and run the four migration files from `supabase/migrations/` **in order**, each as its own run:
   - `0001_core_schema.sql`
   - `0002_social_schema.sql`
   - `0003_storage.sql`
   - `0004_shared_profiles.sql`

   Each file is idempotent (safe to re-run) and has comments explaining what it does.
3. Go to **Authentication → Providers → Email** and confirm Email is enabled (it is by default). Optionally turn off "Confirm email" while testing locally so sign-up logs you straight in — leave it on for production.
4. Go to **Authentication → URL Configuration** and set:
   - **Site URL**: your deployed URL (e.g. `https://your-app.vercel.app`), or `http://localhost:5173` while developing.
   - **Redirect URLs**: add both your local (`http://localhost:5173/**`) and production URL patterns — the app redirects to `/login`, `/reset-password`, and `/onboarding` after email actions.
5. Go to **Project Settings → API** and copy the **Project URL** and **anon public** key — you'll need them in step 2. Never copy the `service_role` key into this app.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173, sign up with a real or disposable email, complete onboarding, and start adding jobs.

`npm run build` type-checks and produces a production build in `dist/`. `npm run preview` serves that build locally.

## 4. Push to GitHub

```bash
git add -A
git commit -m "CareerHQ: web app rewrite on Supabase"
git branch -M main
git remote add origin https://github.com/<your-username>/careerhq.git
git push -u origin main
```

(No repo yet? Create an empty one at github.com/new — no README/gitignore/license — then run the commands above.)

## 5. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
2. Framework preset: **Vite** (auto-detected; `vercel.json` in this repo also pins it explicitly).
3. Add environment variables (Project Settings → Environment Variables), same two as your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. `vercel.json` includes a SPA rewrite (`/* → /index.html`) so refreshing a nested route like `/app/board` works instead of 404ing.
5. Back in Supabase → Authentication → URL Configuration, add your new `https://your-app.vercel.app` URL to Site URL / Redirect URLs if you hadn't already.

## Theming

Three themes, switchable from Settings → Appearance, stored in `localStorage`: **Floral** (warm ivory/rose/sage, default), **Neutral** (calmer, less saturated), **Dark** (warm charcoal, not pure black). All three are CSS custom properties in `src/index.css`.

## Known limitations

- Interview tracking lives on the `jobs` row (one date + stage per job) rather than a separate multi-interview log with time/interviewer/questions-asked.
- "Selected friends" privacy visibility uses one shared allow-list per user rather than a separate list per individual field.
- No email notifications yet — in-app only, as scoped.
- No dedicated group activity feed.
- AI-assisted fit score / verdict is not built; the fields are there (fit_score, verdict) and entirely manual today, ready for an AI pass later without a schema change.
