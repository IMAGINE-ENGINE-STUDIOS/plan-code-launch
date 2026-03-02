

## Plan: Password Recovery, Publish Fix, and Project Import Enhancements

This plan covers 4 areas you requested. No existing features, titles, or UI will be modified.

---

### 1. Password Recovery on Login Page

**What:** Add a "Forgot password?" link to `src/pages/Auth.tsx` and create a `/reset-password` page.

- Add a "Forgot password?" button below the password field that triggers `supabase.auth.resetPasswordForEmail()` with `redirectTo: window.location.origin + '/reset-password'`
- Create `src/pages/ResetPassword.tsx` — detects `type=recovery` in URL hash, shows a "Set new password" form, calls `supabase.auth.updateUser({ password })`
- Add `/reset-password` as a public route in `App.tsx`

---

### 2. Platform URL / Publish Tab Fix

**What:** The publish button currently only updates the database status but doesn't actually deploy anything. The generated URL (`imagineengine.app`) doesn't resolve.

**Fix approach:**
- The publish flow needs to actually build and deploy the project files. This requires a backend function that takes project files, bundles them, and deploys to a hosting target
- Create an edge function `publish-project` that: takes project files from `project_files` table, generates a static build artifact, and stores it in a storage bucket
- Create a storage bucket `published-sites` to serve static files
- Update `PublishPage.tsx` to call this edge function instead of just updating the DB status
- The published URL will point to the storage bucket's public URL (e.g., `https://<supabase-url>/storage/v1/object/public/published-sites/<project-id>/index.html`)

**Note:** Full production hosting (custom domains, SSL) would require additional infrastructure beyond what can be done here. The initial implementation will provide a working preview URL via storage.

---

### 3. Supabase Project Connector (Settings Page)

**What:** Add a "Backend Connection" section to the project Settings page allowing users to connect their own Supabase project to an Imagine Engine project.

- Add fields in Settings: Supabase URL, Anon Key, Service Role Key (stored in `project_secrets`)
- Create an edge function `connect-supabase` that validates the connection by querying the remote Supabase instance
- Store connection details as project secrets (`CONNECTED_SUPABASE_URL`, `CONNECTED_SUPABASE_ANON_KEY`, `CONNECTED_SUPABASE_SERVICE_KEY`)
- Show connection status (connected/disconnected) with a test button

---

### 4. GitHub Import Enhancement (Lovable Project Compatibility)

**What:** Improve the existing GitHub import to handle Lovable-exported projects properly so they preview and work correctly.

- The current import already fetches files from GitHub — the issue is that imported Lovable projects may have dependencies and configurations that aren't being installed/applied in the Sandpack preview
- Update `ImportProject.tsx` to detect `package.json` in imported files and extract dependencies
- Pass detected dependencies to the project so `SandpackPreview` installs them
- Add a `dependencies` column to `projects` table (jsonb) to store detected dependencies from imported projects
- Update `EditMode.tsx` / `SandpackPreview` to load project-specific dependencies from the DB
- Ensure all file paths are correctly mapped for Sandpack (e.g., `/src/App.tsx` format)

---

### Technical Details

**Database changes:**
- Add `dependencies jsonb DEFAULT '{}'` column to `projects` table

**New files:**
- `src/pages/ResetPassword.tsx` — password reset form
- `supabase/functions/publish-project/index.ts` — build & deploy edge function
- `supabase/functions/connect-supabase/index.ts` — validate remote Supabase connection

**Modified files:**
- `src/pages/Auth.tsx` — add forgot password link
- `src/App.tsx` — add `/reset-password` route
- `src/pages/workspace/PublishPage.tsx` — call publish edge function
- `src/pages/workspace/SettingsPage.tsx` — add backend connection section
- `src/pages/ImportProject.tsx` — detect and store dependencies from imported projects
- `src/pages/workspace/EditMode.tsx` — load project dependencies for preview

**New storage bucket:**
- `published-sites` (public) — stores deployed project builds

