

## Plan: Enforce Real Integrations & Block Fake Solutions

### Problem Analysis
The AI code generator has three critical failures:
1. When asked to integrate a library (e.g., Cesium), it creates a **visual simulation** instead of importing the real library — because the system prompt doesn't enforce real integrations strictly enough
2. The `[NEEDS_API_KEY:KEY:desc]` marker system exists but the AI model often ignores it and hardcodes empty strings or fakes the feature
3. The Sandpack preview's dependency list is hardcoded — even if the AI outputs correct import statements, the preview can't resolve packages not in the fixed list

### Architecture

```text
User asks "integrate Cesium"
         │
         ▼
  System prompt BLOCKS fake implementations
  Forces AI to output [NEEDS_DEPENDENCY:cesium] markers
         │
         ▼
  AI outputs [NEEDS_API_KEY:CESIUM_ION_TOKEN:...] — MUST appear before any code
         │
         ▼
  Frontend detects [NEEDS_DEPENDENCY:pkg] markers
  → Adds package to Sandpack dependency list dynamically
         │
         ▼
  Frontend detects [NEEDS_API_KEY:...] markers
  → Shows SecretInput BEFORE applying code
  → Blocks code application until key is provided
         │
         ▼
  Once key saved → injects it into Sandpack env → applies code files
```

### Implementation Steps

**1. Overhaul the system prompt in `supabase/functions/chat/index.ts`**

Add a new "INTEGRATION RULES" section that is the strongest-worded rule:

- **NEVER simulate or fake a library.** If the user asks to integrate Cesium, MapboxGL, Three.js, Stripe, etc., you MUST use the real library via `import` statements.
- When a library is needed that isn't in the current dependency list, output a marker: `[NEEDS_DEPENDENCY:package-name:version]` at the TOP of your response, before any code blocks.
- When an API key is required, output `[NEEDS_API_KEY:KEY_NAME:Description with URL to get the key]` at the TOP of your response, BEFORE any code. Do NOT write code that uses the key until the marker is emitted.
- If you cannot integrate a library because it requires server-side setup, Node.js runtime, or native binaries, explicitly tell the user WHY instead of faking it.
- NEVER create a "simulation", "placeholder", "mock map", or "visual approximation" of a third-party library. Either use the real thing or explain why you cannot.

Also strengthen the data persistence rules:
- For ANY data that should persist (user-created content, settings, lists), use `localStorage` at minimum. For multi-user or cross-device data, generate Supabase table schemas and CRUD operations.
- NEVER use in-memory-only arrays as the primary data source for user-facing features. Mock data is acceptable only as seed/initial data loaded into localStorage or state on first run.

**2. Add dynamic dependency injection to `SandpackPreview.tsx`**

- Accept an optional `extraDependencies` prop: `Record<string, string>`
- Merge `extraDependencies` into the `customSetup.dependencies` object
- This allows EditMode to pass dynamically-detected packages to the preview

**3. Add dependency and API key detection + blocking in `EditMode.tsx`**

- Parse `[NEEDS_DEPENDENCY:pkg:version]` markers from assistant messages (similar to existing `[NEEDS_API_KEY]` parsing)
- When detected, add them to a `dynamicDeps` state map that gets passed to `SandpackPreview`
- Parse `[NEEDS_API_KEY]` markers — but now **block code application** until ALL required keys are saved
- Track which keys are pending via a `pendingKeys` set
- Only call `applyFilesToPreview()` after all `pendingKeys` are resolved
- Show a clear banner: "This feature requires: CESIUM_ION_TOKEN — provide it below before changes are applied"

**4. Add the same dependency detection to `DevMode.tsx`**

- When auto-fix applies changes, also detect `[NEEDS_DEPENDENCY]` markers and update the Sandpack dependency list

### Files Changed
- `supabase/functions/chat/index.ts` — system prompt overhaul (integration rules, data persistence rules)
- `src/components/SandpackPreview.tsx` — accept `extraDependencies` prop, merge into Sandpack config
- `src/pages/workspace/EditMode.tsx` — parse `[NEEDS_DEPENDENCY]` markers, block code until keys saved, pass dynamic deps
- `src/pages/workspace/DevMode.tsx` — same dependency detection for auto-fix flow

