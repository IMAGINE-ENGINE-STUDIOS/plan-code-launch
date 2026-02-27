

## Plan: Import and Continue Building Lovable Projects

### Problem
Users can't load existing Lovable projects (from GitHub) into the workspace to continue building them with AI chat. The current system only works with files generated from scratch via AI messages.

### Approach
Add a GitHub import flow that fetches a Lovable project's source files, stores them persistently, and loads them into the Sandpack preview so the AI can iterate on top of existing code.

### 1. Database: Add `project_files` table
- New table `project_files` with columns: `id`, `project_id`, `file_path`, `content`, `created_at`, `updated_at`
- RLS: users can only access files for projects they own
- This stores the current file state for each project (both imported and AI-generated)
- Migration also adds `source_repo` (nullable text) column to `projects` for tracking import origin

### 2. Edge function: `import-github-repo`
- Accepts a GitHub repo URL (e.g. `https://github.com/user/repo`)
- Uses GitHub API (no auth needed for public repos) to fetch the file tree recursively
- Filters to relevant source files: `.tsx`, `.ts`, `.css`, `.html`, `.json` in `src/`, `public/`
- Fetches content for each file (up to ~50 files, skip large files >100KB)
- Returns the file map as `Record<string, string>`

### 3. New Import page: `src/pages/ImportProject.tsx`
- Replace the mock `ImportReport.tsx` with a real import flow
- Input field for GitHub repo URL (validates format)
- "Scan Repository" button calls the edge function
- Shows file tree preview with file count and size
- "Import & Start Building" button creates a new project, saves files to `project_files`, and navigates to Edit mode

### 4. Update EditMode to load persisted files
- On mount, load files from `project_files` table (in addition to replaying chat messages)
- Imported files become the base layer; AI-generated files overlay on top
- After each AI response, upsert changed files to `project_files` so the file state is always persisted
- This means refreshing the page preserves the full project state (not just chat replay)

### 5. Update SandpackPreview for compatibility
- Map Lovable project file paths to Sandpack-compatible paths
- Handle common Lovable patterns: `@/` import aliases → relative paths
- Add `shadcn/ui` component stubs or CDN links for common dependencies
- Add more dependencies to Sandpack's `customSetup` (recharts, date-fns, etc.)

### 6. Update AI system prompt for imported projects
- When a project has imported files, include the file list in the system prompt context
- Tell the AI which files exist so it can modify them correctly instead of creating from scratch
- Add instruction: "This is an imported project. Maintain existing patterns, component naming, and file structure."

### Technical Details

**GitHub API fetching** (edge function):
- `GET https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1` for file tree
- `GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` for file contents
- Rate limit: 60 req/hr unauthenticated (sufficient for import)

**File path mapping** for Sandpack compatibility:
- `src/components/ui/button.tsx` → `/src/components/ui/button.tsx`
- `@/components/X` imports → `./components/X` (rewrite in content)
- `@/lib/utils` → `./lib/utils`

**Sandpack dependency expansion**:
- Add common Lovable deps: `class-variance-authority`, `clsx`, `tailwind-merge`, `cmdk`, `date-fns`, `recharts`, `react-day-picker`
- Include a `cn()` utility stub automatically

