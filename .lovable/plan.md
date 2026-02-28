

## Comprehensive Audit: What's Incomplete & Plan to Fix

### Issues Found Across All Tabs

**1. Analysis Tab — Entirely Mock Data (CRITICAL)**
- Uses `mockAnalysis` from `mock-data.ts` — hardcoded static findings
- "Re-scan" button just shows the same mock data after a fake 2s delay
- No real analysis of project files — should scan actual `project_files` content via AI
- "Dismiss" only removes from local state, not persisted

**2. Version History Tab — Entirely Mock Data (CRITICAL)**
- Uses `mockVersions` from `mock-data.ts` — 4 hardcoded fake versions
- "Rollback" does nothing real — just changes local state after a fake delay
- No `versions` table in the database — versions are never created or stored
- Should auto-create a version snapshot whenever files change (or on user action)

**3. Publish Tab — Mostly Fake (CRITICAL)**
- "Publish" button just does a fake 1.5s delay and sets local state
- Hardcoded subdomain `my-saas-app` / domain `buildstack.app` — not dynamic
- Custom domain verification is a fake 2s delay
- SSL status is purely cosmetic
- No actual deployment mechanism exists

**4. Dev Tab — File Explorer Shows Host App Files, Not Project Files**
- `file-tree.ts` uses `import.meta.glob` to read the *host application's* source files
- The file tree and code viewer show BuildStack's own source code, not the user's generated project files
- Should read from `project_files` table instead

**5. Plan Tab — No Auto-Save, No "Build This" Integration with Existing Files**
- Plan generated in PlanMode doesn't consider existing project files
- "Build This Plan" creates duplicate command queue entries without checking what's already built

**6. Edit Tab — Minor Gaps**
- Screenshot capture uses `html2canvas` on the container div, which captures the Sandpack wrapper, not the actual iframe content (cross-origin limitation)
- No file export/download capability

**7. Settings Tab — Missing Stack/Features Editing**
- Can edit name and description but not stack, priorities, or day_one_features
- No way to change the AI model used for the project

**8. Dashboard — No Search or Filter**
- No search bar, no status filter, no sort options

---

### Implementation Plan

#### Step 1: Create `project_versions` Table
- Add migration: `project_versions` table with `id, project_id, version_label, note, snapshot (jsonb of file paths→content), created_at, user_id`
- Add RLS policies for user-owned access
- Auto-create a version snapshot in EditMode whenever files are applied (debounced, or via explicit "Save Version" button)

#### Step 2: Rebuild Version History Tab with Real Data
- Replace `mockVersions` with a query to `project_versions`
- "Rollback" loads snapshot files back into `project_files` and updates `previewFiles`
- Add "Create Snapshot" button for manual version saves
- Show actual file diff count between versions

#### Step 3: Rebuild Analysis Tab with Real AI Analysis
- Replace mock data with an AI-powered scan: send project files to the chat edge function with an analysis prompt
- Parse structured JSON findings from the response
- Persist findings to a `project_analysis` table (or store in the project row)
- "Re-scan" triggers a new AI analysis
- "Dismiss" persists dismissal so findings don't reappear

#### Step 4: Fix Dev Tab File Explorer
- Replace `import.meta.glob` file tree with data from `project_files` table
- Build tree from project file paths, show actual project code in the viewer
- Make the code viewer read-only but show the user's generated files

#### Step 5: Make Publish Tab Functional
- Generate a real preview URL using the project ID (e.g., `{projectId}.preview.buildstack.app`)
- Store publish status and custom domain in the `projects` table (add `custom_domain`, `published_url` columns)
- "Publish" updates project status and generates a shareable link
- Custom domain stores the configuration (actual DNS verification would need infrastructure)

#### Step 6: Add Dashboard Search & Filter
- Add search input filtering by project name/description
- Add status filter dropdown (All, Draft, Published, Needs Attention)
- Add sort toggle (newest first / alphabetical)

#### Step 7: Enhance Settings Tab
- Add editable fields for stack tags, priorities, day_one_features
- Add AI model selector dropdown (from the supported models list)
- Store selected model in project row, use it in chat function

### Files Changed
- **New migration**: `project_versions` table + `published_url`/`custom_domain` columns on `projects`
- `src/pages/workspace/VersionHistory.tsx` — full rewrite with real data
- `src/pages/workspace/AnalysisMode.tsx` — full rewrite with AI-powered scanning
- `src/pages/workspace/DevMode.tsx` — replace host file tree with project files
- `src/pages/workspace/PublishPage.tsx` — dynamic URLs, persist publish state
- `src/pages/workspace/EditMode.tsx` — add version snapshot creation on file apply
- `src/pages/workspace/SettingsPage.tsx` — add stack/model editing
- `src/pages/Dashboard.tsx` — add search, filter, sort
- `src/lib/file-tree.ts` — add function to build tree from project_files data
- `src/lib/mock-data.ts` — remove mock versions and mock analysis (no longer needed)

