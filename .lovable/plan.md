

## Plan: Secure API Key Input in Chat + Persisted Project Secrets

### Problem
- Settings page secrets are mock (not saved to database)
- No way for the AI chat to ask users for API keys inline
- Projects don't have persisted environment variables

### Changes

**1. Database: Create `project_secrets` table**
- Columns: `id`, `project_id` (FK), `key` (text), `value` (text, encrypted at rest), `created_at`
- RLS: only project owner can CRUD
- Unique constraint on `(project_id, key)`

**2. Edge function: `supabase/functions/chat/index.ts`**
- Load project secrets from `project_secrets` table and inject available key names into the system prompt
- Add system prompt section: `API KEY HANDLING` — when a feature needs an API key (e.g. Mapbox, Stripe, OpenAI), the AI should output a special marker `[NEEDS_API_KEY:KEY_NAME:description]` instead of hardcoding a placeholder
- The marker tells the frontend to render a secure input widget

**3. Frontend: `src/components/SecretInput.tsx`** (new)
- A masked input component rendered inline in chat when `[NEEDS_API_KEY:...]` is detected
- User types the key, clicks Save → inserts into `project_secrets` table
- Once saved, the component shows a green checkmark with the key name

**4. Frontend: `src/pages/workspace/EditMode.tsx`**
- Parse assistant messages for `[NEEDS_API_KEY:KEY_NAME:description]` markers
- Render `SecretInput` inline instead of the raw marker text
- After user saves a key, auto-send a follow-up message: "API key KEY_NAME is now configured. Continue building."

**5. Frontend: `src/pages/workspace/SettingsPage.tsx`**
- Replace mock secrets array with real data from `project_secrets` table
- Add/remove secrets persists to database
- Values shown masked by default, toggle to reveal

### Technical Details

- `project_secrets` table uses RLS via project ownership (same pattern as `project_files`)
- Secret values stored as plain text in the DB column (Supabase encrypts at rest)
- The chat edge function reads secrets using service role to list key names only (not values) for the system prompt
- The AI marker format: `[NEEDS_API_KEY:MAPBOX_TOKEN:Get your token at mapbox.com/account]`
- Frontend regex to detect markers: `/\[NEEDS_API_KEY:([^:]+):([^\]]+)\]/g`

