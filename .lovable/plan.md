

## Plan: AI Screenshot Testing & Analysis Feature

### Overview
Add a testing mode where the AI can capture screenshots of the live preview, analyze visual/functional issues using a vision-capable model, and propose code fixes that the user can approve with a single click.

### Architecture

```text
User clicks "Test App" or asks "test this"
         │
         ▼
  Capture screenshot of Sandpack preview (html2canvas)
         │
         ▼
  Send base64 image + project context to new edge function
         │
         ▼
  Edge function calls Gemini 2.5 Pro (vision model)
         │
         ▼
  AI returns analysis + proposed code changes
         │
         ▼
  Render analysis in chat with [Approve Changes] button
         │
         ▼
  On approve → apply file changes to preview
```

### Implementation Steps

**1. Install html2canvas dependency**
Add `html2canvas` package to capture the Sandpack preview iframe area as a base64 image.

**2. Create edge function `supabase/functions/test-analyze/index.ts`**
- Accepts `{ screenshot: string (base64), projectFiles: string[], userRequest: string, projectId: string }`
- Sends the screenshot as an image part to `google/gemini-2.5-pro` (vision-capable) via the Lovable AI gateway
- System prompt instructs the model to: analyze the UI screenshot, identify visual bugs / layout issues / missing elements, and output proposed code fixes in the standard ```` ```tsx:path``` ```` format
- Returns the analysis text with embedded code blocks
- Handles 429/402 errors

**3. Modify `src/pages/workspace/EditMode.tsx`**
- Add a `Camera` icon button to the preview toolbar for manual screenshot capture
- Add a `captureScreenshot()` function that uses `html2canvas` on the preview container div and returns base64
- Detect when user messages contain keywords like "test", "screenshot", "check", "analyze" — automatically capture a screenshot and attach it to the request
- After AI analysis response arrives, parse it for file changes and render an **"Approve Changes"** button below the analysis
- The approve button calls `applyFilesToPreview()` with the proposed changes
- If not approved, changes are discarded (just text in chat)

**4. Add approval UI component inline in chat**
- When an assistant message is flagged as a "test analysis" (detected by a marker or by the presence of the test-analyze call), render:
  - The analysis text (markdown)
  - A highlighted "Approve & Apply Changes" button
  - A "Dismiss" button
- On approve: apply file changes, show success toast
- On dismiss: collapse the proposal

### Technical Details

- **Vision model**: `google/gemini-2.5-pro` supports image+text input via the OpenAI-compatible API format (image_url with base64 data URI in the user message content array)
- **Screenshot target**: The div wrapping the SandpackPreview component (not the iframe directly — html2canvas captures the rendered visual area)
- **Message format for vision**: `{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,..." } }, { type: "text", text: "Analyze this screenshot..." }] }`
- **Approval state**: Tracked per-message with a `pendingApproval` map keyed by message index, storing the parsed file changes until approved or dismissed
- **Edge function config**: `verify_jwt = false` in config.toml, auth validated in code like existing `chat` function

### Files Changed
- `package.json` — add `html2canvas`
- `supabase/functions/test-analyze/index.ts` — new edge function
- `src/pages/workspace/EditMode.tsx` — screenshot capture, test detection, approval UI

