

## Plan: Harden AI System Prompt for Robust, Complete Builds

### Problem
The AI sometimes generates placeholder buttons, incomplete integrations, and unnecessarily modifies existing working UI when building new features.

### Approach
Update the system prompt in `supabase/functions/chat/index.ts` to add three new directive sections that enforce MVP-complete builds and protect existing code.

### Changes

**File: `supabase/functions/chat/index.ts`** — Add the following rules to the system prompt (after the existing `COMPLETENESS — CRITICAL` section):

1. **NO PLACEHOLDER UI** block:
   - Every button, link, form, and interactive element must have a working handler
   - If a button can't do anything meaningful yet, don't render it
   - No `onClick={() => {}}` or `// TODO` handlers — wire it up or remove it
   - If integrating a third-party library (e.g. Cesium, Mapbox, Three.js), build a fully functional MVP — import the library, initialize it, render real output

2. **PROTECT EXISTING CODE** block:
   - Only modify files the user explicitly asks to change or that need updating to support the new feature
   - Never redesign existing layouts, navigation, or styling unless asked
   - Never remove or rename existing components, routes, or features
   - If adding a new tool/page, add it alongside existing ones — don't restructure
   - If existing code works and wasn't mentioned, don't touch it

3. **ROBUST NEW FEATURES** block:
   - When building a new tool or feature on an existing project, build it completely — full CRUD, all states (loading, empty, error, success), working data flow
   - New features must be self-contained and not break existing functionality
   - Include realistic mock data, proper TypeScript types, and all necessary routing
   - Each new feature should be production-ready on delivery, not a skeleton

### Technical Details
- Single file edit to `supabase/functions/chat/index.ts`, lines ~88-94 area (appending after existing completeness rules)
- No database changes, no new files, no UI changes
- Edge function will be redeployed automatically

