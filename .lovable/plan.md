

## Gap Analysis: BuildStack vs Lovable — and Plan to Go Fully Independent

### What Lovable Has That BuildStack Doesn't

**CRITICAL GAPS (Core Platform Features)**

1. **No real deployment/hosting** — Publish tab just sets a DB flag. No actual serving of built apps. Lovable compiles and hosts apps on real infrastructure.

2. **No GitHub integration (push/pull)** — Import exists (read-only scan of public repos), but no bidirectional sync, no push-to-repo, no branch management.

3. **No file storage** — No image uploads, no asset management. Users can't add images/fonts to their projects.

4. **No real-time collaboration** — No multi-user editing, no presence indicators, no shared workspaces.

5. **No project export/download** — Can't download project as ZIP for self-hosting.

6. **No visual edit (direct manipulation)** — The select mode only populates a chat prompt. Lovable's Visual Edit allows direct text/color/font changes without AI credits.

7. **No database management UI** — No way for end users to create tables, view data, or manage their project's database schema.

8. **No edge function authoring** — End users can't write/deploy backend functions for their generated apps.

9. **Currently depends on Lovable AI gateway** — All AI calls go through `ai.gateway.lovable.dev`. If Lovable revokes access or you leave the platform, AI stops working.

10. **No project templates/starters** — No gallery of pre-built templates to clone.

**MODERATE GAPS**

11. **No undo/redo within edit session** — Version History exists but no granular undo.
12. **No mobile preview via QR code** — Viewport switcher exists but no way to preview on actual phone.
13. **No environment variables management for generated apps** — Secret management exists for API keys but not for the generated app's own env vars.
14. **No custom domain SSL verification** — DNS config is shown but never verified.
15. **No team/workspace features** — Single-user only.

---

### Plan: Replace Lovable AI Gateway with Direct Gemini API

#### Step 1: Add Google Gemini API Key Support
- Add a secret `GOOGLE_GEMINI_API_KEY` via the secrets tool
- Update `supabase/functions/chat/index.ts` to call `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent` directly instead of `ai.gateway.lovable.dev`
- Update `supabase/functions/analyze-prompt/index.ts` similarly
- Update `supabase/functions/test-analyze/index.ts` similarly
- Keep `LOVABLE_API_KEY` as fallback — try Gemini first, fall back to Lovable gateway if no key configured
- Update model names: `google/gemini-2.5-flash` → `gemini-2.5-flash` (Gemini API format)

#### Step 2: Update Settings to Configure AI Provider
- Add "AI Provider" section to `SettingsPage.tsx` with toggle: "Lovable Gateway" vs "Google Gemini (direct)"
- Store provider preference in `projects.ai_model` field (already exists)
- Show cost comparison between providers
- Add link to Google AI Studio for key generation

#### Step 3: Add Project Export (ZIP Download)
- Create edge function `supabase/functions/export-project/index.ts` that:
  - Reads all `project_files` for a project
  - Generates a proper `package.json`, `vite.config.ts`, `tsconfig.json`
  - Returns a ZIP blob
- Add "Export as ZIP" button to Dev tab and Settings tab
- Include a README with setup instructions

#### Step 4: Add Direct Text/Color Editing (Visual Edit Mode)
- Enhance the existing select mode in `EditMode.tsx`:
  - When element is selected, show a floating panel with:
    - Editable text content (direct inline editing)
    - Color pickers for text/background
    - Font size/weight controls
    - Padding/margin sliders
  - Apply changes directly to the file AST without consuming AI credits
  - Use regex-based find/replace on the source file to update text and Tailwind classes

#### Step 5: Add File Upload & Asset Management
- Create a storage bucket `project-assets`
- Add an "Assets" panel to Dev tab sidebar
- Allow drag-and-drop image uploads
- Generate import paths that work in Sandpack preview
- Store uploaded assets in storage, reference via public URLs in generated code

#### Step 6: Add Team/Workspace Support
- New DB table: `workspaces` (id, name, owner_id, created_at)
- New DB table: `workspace_members` (workspace_id, user_id, role)
- Update `projects` to have optional `workspace_id`
- Add invite flow in Settings
- Update RLS policies for shared access

### Files Changed
- `supabase/functions/chat/index.ts` — dual AI provider support (Gemini direct + Lovable fallback)
- `supabase/functions/analyze-prompt/index.ts` — same dual provider
- `supabase/functions/test-analyze/index.ts` — same dual provider
- New: `supabase/functions/export-project/index.ts` — ZIP export
- `src/pages/workspace/SettingsPage.tsx` — AI provider config + export button
- `src/pages/workspace/EditMode.tsx` — visual direct-edit panel
- `src/pages/workspace/DevMode.tsx` — asset management panel
- New DB migration: `workspaces`, `workspace_members` tables + storage bucket

