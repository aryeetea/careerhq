# Bloom

Bloom is a career-growth and job-search workspace. It helps people organize opportunities, keep applications moving, build career materials, set goals, and optionally share progress with friends and groups.

Bloom is a responsive React web app backed by Supabase. It can be installed as a progressive web app (PWA); an app-store installation is not required.

## What Bloom does

### Job search and applications

- Save job opportunities with company, role, location, salary, source, URL, job description, recruiter details, and notes.
- Track each opportunity through its application status and organize work in the applications board.
- Record priorities, fit scores, deadlines, follow-up dates, interview dates, offer dates, and rejection dates.
- Keep strengths and missing qualifications alongside each opportunity.
- View dashboard totals and progress summaries, including application activity and weekly goals.
- Analyze job listings with AI for fit, requirements, and recommendations when the AI Edge Functions are configured.
- Generate cover letters and tailor a resume to a job using the AI tools.

### Career profile and materials

- Maintain a profile with a username, bio, career goal and status, skills, target job titles, preferred locations, and weekly application goal.
- Create and manage resumes, attach files, and use resume tailoring tools.
- Generate and download resume or cover-letter documents where supported by the relevant workflow.
- Track certifications, providers, status, progress, important dates, course links, notes, and certificate files.

### Goals and reflection

- Create personal goals with a target count, unit, deadline, and progress.
- Share selected goals with other members where enabled.
- Write dated journal entries with optional title and mood. Entries can be private or shared using the available visibility options.
- Save an unfinished journal entry as a local draft in the current browser.

### Friends and groups

- Find and connect with other Bloom users using the available friend search, codes, and invitation links.
- Review incoming and outgoing friend requests and manage blocked users.
- Join or create groups, invite members, and view group details and shared progress.
- Control profile and activity visibility through privacy settings. Some profile surfaces intentionally expose only basic display information.
- React to supported shared activity and receive in-app notifications.

### Account, preferences, and portability

- Create an account, sign in, verify email, and recover or reset a password.
- Complete onboarding before entering the main application.
- Change appearance preferences, including themes and fonts, and replay the guided product tour.
- Subscribe to browser push notifications and manage registered devices when push is configured and supported by the browser.
- Export job data to CSV and jobs, certifications, and goals to a versioned JSON backup.
- Permanently delete an account and its associated data through the account deletion flow.

## Application routes

- `/` and `/about`: public landing and product information.
- `/login`, `/signup`, `/forgot-password`, `/reset-password`: authentication and recovery.
- `/onboarding`: profile setup for a new account.
- `/app`: dashboard.
- `/app/applications`: application tracking.
- `/app/profile` and `/app/people/:userId`: own profile and visible community profiles.
- `/app/resumes`, `/app/certifications`, `/app/goals`, `/app/journal`: career materials and planning.
- `/app/community/friends`, `/app/community/groups`, `/app/community/invites`: community workspace.
- `/app/groups/:groupId`: group details.
- `/app/settings`: account, privacy, appearance, notification, and help preferences.

Protected routes require a signed-in user; the main app also requires completed onboarding.

## Technology

- React 18 and TypeScript
- Vite and Tailwind CSS
- React Router for navigation
- TanStack Query for server state and caching
- React Hook Form and Zod for forms and validation
- Radix UI primitives and Lucide icons
- Supabase Auth, Postgres, Row Level Security (RLS), Storage, Realtime, and Edge Functions
- Vite PWA / Workbox for installability, asset precaching, and push notifications
- Vercel for hosting and SPA route rewrites

## Repository layout

```text
src/
  components/       Feature UI, shared UI primitives, and app layout
  hooks/            Auth, theme, viewport, and domain query hooks
  lib/              Supabase client, validation, utilities, AI and export helpers
  pages/            Route-level screens
  routes/           Authentication and onboarding route gates
  services/         Supabase data-access functions by domain
  types/            Application and database TypeScript types
  sw.ts             Workbox service worker and push notification handlers
supabase/
  functions/        Server-side endpoints and shared Edge Function utilities
  migrations/       Database schema, RLS, storage, and feature migrations
```

Data access follows this path: page/component -> query hook -> service -> Supabase. Database policies are the actual access boundary; client-side checks are not a substitute for RLS.

## Run locally

### Prerequisites

- Node.js and npm
- A Supabase project

### 1. Configure Supabase

Create a Supabase project, then apply every SQL migration in `supabase/migrations/` in filename order. You can use the Supabase SQL Editor or the Supabase CLI. Migrations define the database schema, policies, helper functions, storage buckets, and later features.

In Supabase Authentication settings:

- Enable email authentication.
- Set the Site URL to your local URL during development, normally `http://localhost:5173`.
- Add `http://localhost:5173/**` to the allowed redirect URLs.
- For production, set the deployed app URL and add its redirect pattern as well.
- Keep email confirmation enabled in production.

Use the project URL and **anon/public** key from Project Settings -> API. Never put a Supabase `service_role` key in frontend code or in any `VITE_` variable.

### 2. Configure environment variables

Copy the example file and set the Supabase values:

```sh
cp .env.example .env
```

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`VITE_VAPID_PUBLIC_KEY` is optional. It enables the client-side push subscription workflow; configure the matching private key on the server as described below. Keep `.env` out of version control.

### 3. Install and start

```sh
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Sign up, complete onboarding, and then add a job or explore the other workspace areas.

## Common commands

```sh
npm run dev             # Start the Vite development server
npm run typecheck       # Run the TypeScript check
npm run build           # Type-check and create the production build in dist/
npm run build:skip-check # Build without running the TypeScript check
npm run preview         # Serve the production build locally
```

## Supabase Edge Functions

The AI, account, and notification workflows use functions in `supabase/functions/`. Deploy the functions required by the product features you enable. Functions that call external AI providers need server-side secrets configured in Supabase, including `OPENAI_API_KEY`; functions that use Supabase administrative access need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-side secrets. Do not expose these values to the browser.

For web push, generate a VAPID key pair and configure:

- `VITE_VAPID_PUBLIC_KEY` in the frontend build environment.
- `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` as Supabase Edge Function secrets.

Push requires browser support, user permission, a secure deployed origin (HTTPS), deployed service worker, and the matching VAPID configuration. Without the optional push configuration, the rest of the application remains usable.

## Deploy to Vercel

1. Import the repository into Vercel and use the Vite framework preset.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project environment. Add `VITE_VAPID_PUBLIC_KEY` only if push is enabled.
3. Deploy. The build runs `npm run build` and outputs to `dist/`.
4. Set the deployed URL in Supabase Authentication's Site URL and allowed redirect URLs.
5. Deploy/configure any Supabase Edge Functions and secrets needed for AI, account management, and push workflows.

`vercel.json` supplies the SPA rewrite for nested routes, security headers, and long-lived caching for fingerprinted assets.

## Security and privacy

- User records are protected by Supabase Row Level Security policies; storage buckets are private and use user-scoped paths.
- The browser uses only the Supabase anon/public key. Never ship the service-role key or other server secrets to the frontend.
- Community visibility is governed by privacy settings and database policies. Only share information you intend other users to see.
- Signing out clears the client query cache and browser storage used by the app. Account deletion is permanent.
- Client-side file validation improves safety and usability, but server-side bucket limits and policies should also be configured and maintained.

## Current scope and limitations

- Interview history is represented by fields on a job rather than a separate timeline of multiple interviews.
- Selected-friend visibility is an allow-list, not a separate audience list for every profile field.
- Notifications include in-app activity and optional browser push; Bloom does not send general-purpose email notifications.
- Group features include membership, invitations, and shared information, but there is no dedicated group activity feed.
- The application is a personal-data workspace and does not include seeded demo accounts or demo data.
