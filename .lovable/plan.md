

## Why it looks bad

Three root causes:

1. **Tailwind via CDN is the pre-built CSS** — only includes default utility classes. Custom classes like `bg-gray-950`, `backdrop-blur-md`, gradients, etc. don't exist in the CDN build. Most AI-generated styling silently fails.

2. **StackBlitz WebContainers are slow and unreliable** — cold boot takes 15-30s, dependency installs often stall, and the embedded preview frequently shows loading spinners or blank screens. This is a fundamental limitation of running a full Node.js environment in-browser.

3. **Chat dumps raw code blocks** — the AI response shows hundreds of lines of code inline in a tiny chat panel. There's no separate code viewer, no diff view, no way to inspect individual files. It's unreadable.

## What "like Lovable" actually requires

Lovable runs a real cloud build pipeline (Vite dev server on a remote VM), not an in-browser sandbox. Replicating that is out of scope. But we can get **dramatically closer** with these changes:

## Plan

### 1. Replace StackBlitz with a Sandpack-based preview
- Use CodeSandbox's **Sandpack** (`@codesandbox/sandpack-react`) instead of StackBlitz
- Sandpack boots in ~2 seconds (vs 15-30s), runs entirely in-browser with no Node.js, and has native Vite support
- It includes a built-in Tailwind JIT compiler via `@tailwindcss/browser` — all utility classes work
- The scaffold becomes a Sandpack `files` prop that updates reactively — no VM API needed

### 2. Hide code from chat, show in a tabbed code viewer
- Strip code blocks from the rendered chat messages (show only the explanatory text + an "Applied N files" badge)
- Replace the "Changed Files" sidebar with a **tabbed code viewer** that shows actual file contents with syntax highlighting
- Clicking a file tab shows its content; the active file is highlighted

### 3. Improve the AI system prompt for higher quality output
- Add explicit instructions: use `className` not `class`, use Tailwind JIT-compatible classes, use proper TypeScript types
- Include a richer scaffold with a `types.ts` file and sample data so the AI has structure to build on
- Tell the AI to output a file manifest summary (e.g. "Created 3 files: Navbar.tsx, PropertyCard.tsx, types.ts") before the code blocks

### 4. Auto-apply files on history reload
- When loading persisted chat messages, replay all file changes into Sandpack so the preview shows the latest state

## Technical details

**Sandpack integration** replaces `StackBlitzPreview.tsx`:
- `@codesandbox/sandpack-react` with `vite` template
- Files passed as `Record<string, string>` prop — React-native updates, no imperative API
- Dark theme via `sandpackDark` theme
- Tailwind works via the Sandpack Tailwind add-on or by including the CDN with `@tailwindcss/browser` script

**Chat rendering** changes in `EditMode.tsx`:
- Before rendering markdown, strip ` ```lang:path ``` ` blocks from display content
- Show a collapsed "N files changed" summary with expand toggle
- Pass extracted files to the code viewer component

**Code viewer** — new component `CodeViewer.tsx`:
- Uses `<pre><code>` with basic syntax highlighting (or Sandpack's built-in `SandpackCodeViewer`)
- Tab bar showing changed file names
- Read-only view of file contents

