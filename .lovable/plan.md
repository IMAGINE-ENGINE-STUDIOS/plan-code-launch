
Goal: make Dev mode actually usable (open files, see code, preview app, live console), and stop the “clicking files does nothing” behavior.

Implementation steps:

1) Fix workspace landing behavior
- Update project workspace index redirect from `plan` to `dev` so users land directly in the coding workspace.
- Keep all tabs accessible.

2) Replace mock explorer with real source-driven file list
- Remove `mockFileTree` usage in `DevMode.tsx`.
- Build file inventory from real project sources using a raw file loader and generate a nested tree from paths.
- Add selectable file nodes (not just expandable folders).

3) Implement file open + editor panel
- Add `selectedFilePath` state and open file content when a file is clicked.
- Replace placeholder with a real code pane (monospace, scrollable, line numbers).
- Add file header (path, modified indicator), and empty-state only when no file selected.

4) Add device preview panel (mobile/tablet/desktop)
- Add viewport toggle controls in Dev mode: mobile, tablet, desktop.
- Render app preview in an iframe with responsive width presets and scaling.
- Add route input (default `/`) so user can preview specific pages.

5) Make console actually live
- Replace hardcoded console lines with runtime logs captured from the preview iframe (`console.log/warn/error`, runtime errors, unhandled rejections).
- Add timestamp + level badges, clear button, and auto-scroll.
- Keep this fully local to avoid paid AI usage for console actions.

6) Add command input for Dev console
- Add command bar supporting `/build`, `/status`, `/deploy`.
- `/status`: print current project status + timestamp.
- `/build`: set status to building, emit progress logs, then complete/fail state.
- `/deploy`: show deployment guidance/status message in console.
- Command handlers run without AI calls unless explicitly needed.

7) Connect project status to backend data
- Read/write `projects.status` for build lifecycle changes from Dev commands.
- Reflect current status in Dev header badge.

8) QA pass with screenshots
- Verify: click file → code opens immediately.
- Verify: preview switches correctly between mobile/tablet/desktop sizes.
- Verify: console captures live preview logs/errors.
- Verify: `/build` changes status and prints progress logs.
- Capture screenshots for: file open state, each device mode, and live console output.

Technical details:
- Files loading:
  - Use Vite raw source loading (`import.meta.glob(..., { eager: true, as: 'raw' })`) to read actual code files into the Dev explorer/editor.
  - Exclude heavy/unnecessary paths and non-text assets.
- File tree model:
  - Normalize paths -> build hierarchical nodes -> stable sort (folders first, then files).
- Preview isolation:
  - Same-origin iframe for reliable log capture and route preview.
  - Guard against recursive preview of `/project/:id/dev`.
- Console bridge:
  - Attach listeners on iframe load.
  - Capture `console.*`, `window.onerror`, `unhandledrejection`.
  - Convert args safely to strings for readable output.
- Performance:
  - Memoize file tree generation.
  - Virtualize long log list if needed.
- Safety/cost:
  - No AI call for file open, preview, console, or command parsing.
  - AI only invoked in chat flows when explicitly sent by user.
