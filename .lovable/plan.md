

## Plan: Enable Lovable Cloud and Wire Up Full Project Flow

### Step 1 — Enable Lovable Cloud
Connect Lovable Cloud to get Supabase backend (auth, database, edge functions). This is a prerequisite for everything else.

### Step 2 — Create database tables via migrations
- **`projects`** table: `id` (uuid, PK), `user_id` (uuid, FK to auth.users, ON DELETE CASCADE), `name` (text), `description` (text), `status` (text, default 'draft'), `build_type` (text), `code_source` (text), `priorities` (text[]), `day_one_features` (text[]), `stack` (text[]), `created_at` (timestamptz), `updated_at` (timestamptz)
- **`plans`** table: `id` (uuid, PK), `project_id` (uuid, FK to projects, ON DELETE CASCADE), `sections` (jsonb), `created_at` (timestamptz)
- RLS policies: users can only CRUD their own projects/plans (filter by `user_id` or join through `projects`)

### Step 3 — Add Supabase client integration
- Create `src/integrations/supabase/client.ts` with typed Supabase client
- Generate TypeScript types for the new tables

### Step 4 — Add authentication
- Wire up the existing `Auth.tsx` page to use real Supabase auth (signUp, signInWithPassword)
- Add auth state management (context or hook) with `onAuthStateChange`
- Protect `/dashboard`, `/new-project`, and `/project/*` routes behind auth
- Add sign-out to Navbar

### Step 5 — Wire "Build Project" button to Supabase
- In `PlanReview.tsx`, on "Build Project" click:
  1. Insert a row into `projects` with wizard answers
  2. Insert a row into `plans` with generated plan sections as JSONB
  3. Navigate to `/project/{new-id}/plan`

### Step 6 — Load real data in workspace
- **`PlanMode.tsx`**: Fetch plan from Supabase by `project_id` instead of using `mockPlan`
- **`ProjectWorkspace.tsx`**: Fetch project from Supabase by `id` instead of using `mockProjects`
- **`Dashboard.tsx`**: Query user's projects from Supabase instead of `mockProjects`

### Step 7 — Update Settings page
- Wire "Save Changes" in `SettingsPage.tsx` to update project name/description in Supabase

### Technical details
- All Supabase queries use the typed client with RLS — no service role key needed on the client
- Auth state is checked via `onAuthStateChange` listener set up before `getSession()`
- The WizardContext remains for passing data between `/new-project` and `/project/new/plan` within a session; Supabase persists it permanently on "Build"

