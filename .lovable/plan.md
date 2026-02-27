

## AI Chat + Device Preview for Edit Tab

### Step 1 — Database Migration

Create `supabase/migrations/20260227_create_chat_messages.sql`:
- `chat_messages` table: `id` (uuid PK), `project_id` (FK to projects), `user_id` (uuid), `role` (text, check user/assistant/system), `content` (text), `created_at` (timestamptz)
- RLS policies: SELECT, INSERT, DELETE scoped to project owner via `auth.uid()`
- `updated_at` trigger on `projects` table using existing `update_updated_at_column` function
- Enable realtime for `chat_messages`

### Step 2 — Chat Edge Function

Create `supabase/functions/chat/index.ts`:
- CORS headers, OPTIONS handler
- Auth: extract user from Authorization header
- Verify user owns the project via projects table query
- Build system prompt with project name, description, stack, features, status
- Call Lovable AI gateway (`https://api.lovable.dev/v1/chat/completions`) with `google/gemini-2.5-flash`, streaming enabled
- Pass SSE stream through to client
- Set `verify_jwt = false` in config.toml, validate auth in code

### Step 3 — Rewrite `EditMode.tsx`

Replace entire static mockup with three resizable panels:

**Left: Chat Panel (30%)**
- Load persisted messages from `chat_messages` on mount
- Send user messages to the chat edge function via `fetch` with SSE streaming
- Parse SSE chunks, update assistant message content progressively
- Save both user and assistant messages to database after completion
- Clear chat button deletes from DB
- Empty state with prompt suggestions
- Enter to send, Shift+Enter for newline

**Center: Device Preview (55%)**
- Viewport toggle buttons: Mobile (375px), Tablet (768px), Desktop (1280px)
- Route input for previewing specific pages
- iframe with sandbox, resizes to selected viewport width

**Right: Changed Files Sidebar (15%)**
- Keep existing static file list (to be connected to real data later)

### Files Created/Modified
1. `supabase/migrations/20260227_create_chat_messages.sql` — new
2. `supabase/functions/chat/index.ts` — new
3. `supabase/config.toml` — add `[functions.chat] verify_jwt = false`
4. `src/pages/workspace/EditMode.tsx` — full rewrite

