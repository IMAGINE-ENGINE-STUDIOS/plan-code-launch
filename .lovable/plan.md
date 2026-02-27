

## Plan: AI Chat Feature for Edit Tab + Device Preview + Fixes

### Confirmed: The app builds and works
I tested end-to-end: sign up, wizard, Build Project — all succeed. The project saves to the database and loads in the workspace. The Edit tab is currently a **static mockup** with no real functionality.

### What we're building

The Edit tab becomes a real AI-powered chat interface with:
- **AI chat** using Lovable AI (Gemini) via an edge function
- **Persistent messages** stored in a `chat_messages` table
- **Command system** (`/build`, `/deploy`, `/status`) with parsed responses
- **Device preview panel** with mobile/tablet/desktop viewport toggles
- **Changed files sidebar** (kept)
- **Build status indicator**

### Implementation Steps

**Step 1 — Database: Create `chat_messages` table**
- Columns: `id`, `project_id`, `user_id`, `role` (user/assistant/system), `content`, `created_at`
- RLS: users can only read/write messages for their own projects
- Add the `updated_at` trigger to `projects` table (still missing)

**Step 2 — Edge function: `chat` endpoint**
- Accepts `{ messages, projectId }` from the client
- Adds a system prompt with project context
- Streams response from Lovable AI gateway using SSE
- Handles `/build`, `/deploy`, `/status` commands server-side
- Returns streamed tokens to the client
- Handles 429/402 errors

**Step 3 — Rewrite `EditMode.tsx`**
- Replace static mockup with real chat:
  - Load persisted messages from `chat_messages` on mount
  - Send new messages to the edge function
  - Stream AI responses token-by-token, update UI progressively
  - Save both user and assistant messages to database
  - Parse commands (`/build`, `/deploy`, `/status`) and show structured responses
- Add device preview panel:
  - Three viewport toggle buttons: mobile (375px), tablet (768px), desktop (1280px)
  - An iframe or preview container that resizes to simulate the selected device
  - Show the current project's preview URL in the iframe
- Keep the changed files sidebar
- Add a build status indicator (icon + text showing draft/building/published)

**Step 4 — Fix the forwardRef warning**
- The warning persists because `App` is still being rendered via `createRoot(<App />)` — the issue is actually from React Router internally. Fix by wrapping `App` export with `React.forwardRef` or restructuring the render tree so the ref isn't forwarded to a function component.

### Technical Details

```text
┌─────────────────────────────────────────────────────┐
│ Edit Tab Layout                                      │
├──────────────┬───────────────────────┬───────────────┤
│              │                       │               │
│   Chat       │   Device Preview      │  Changed      │
│   Panel      │   ┌─────────────┐    │  Files        │
│              │   │ Mobile │Tab│PC│   │  Sidebar      │
│   AI msgs    │   │             │    │               │
│   User msgs  │   │  iframe     │    │  file1.tsx    │
│   Commands   │   │  preview    │    │  file2.tsx    │
│              │   │             │    │               │
│              │   └─────────────┘    │               │
├──────────────┤   Build: ● draft     │               │
│ [input] [⏎]  │                       │               │
└──────────────┴───────────────────────┴───────────────┘
```

**Database migration SQL:**
- `chat_messages` table with `project_id` FK, `role`, `content`, `created_at`
- RLS policies scoped to project owner
- Trigger for `updated_at` on `projects`

**Edge function:** `supabase/functions/chat/index.ts`
- Uses `LOVABLE_API_KEY` (already configured)
- Streams via SSE
- System prompt includes project type and features from the project record

