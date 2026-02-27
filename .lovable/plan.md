

## Plan: Command Queue, Plan Mode, and Visual Edit Mode

### 1. Command Queue in Edit Mode
Add a queued prompt system to `EditMode.tsx`:
- New state: `queue: string[]` — holds pending prompts
- When user submits while AI is streaming, push to queue instead of blocking
- Show queue visually below the input (numbered list with X to remove)
- After each AI response completes, auto-pop the next item from queue and send it
- Queue persists only in-memory (session-scoped)

### 2. Plan Mode — Interactive AI Planning
Replace the current read-only `PlanMode.tsx` with an interactive planning page:
- Chat-like input where user describes what they want to build
- AI generates a structured plan (sections with tasks) using a dedicated edge function or the existing chat function with a "plan" system prompt
- Plan sections render as editable cards — user can approve, edit, or remove items
- "Build This Plan" button converts approved plan items into queued prompts and navigates to Edit mode with the queue pre-filled
- Save/update plans to the existing `plans` table

### 3. Visual Edit Mode (Select-to-Edit)
Add a new "Select" interaction mode to the Edit tab:
- Toggle button in the preview toolbar: "Select Mode" (crosshair icon)
- When active, the Sandpack preview iframe listens for clicks and highlights hovered elements with an outline overlay
- On click, capture the element's tag, text content, and CSS classes
- Populate the chat input with a context-aware prompt like: "Edit the [Button] with text 'Sign Up' in the hero section — "
- User completes the sentence with what they want changed, then sends
- Deactivate select mode after selection

### Technical Details

**Command Queue** — all in `EditMode.tsx`:
- `const [queue, setQueue] = useState<string[]>([])` 
- Modified `sendMessage`: if `isStreaming`, push to queue and return
- New `useEffect` watching `isStreaming`: when it becomes `false` and queue has items, shift and send
- Queue UI: collapsible list between chat and input showing pending items

**Plan Mode** — rewrite `PlanMode.tsx`:
- Uses the existing `chat` edge function but with a planning-specific user prompt wrapper
- Parse AI response into sections, render as interactive cards
- "Build Plan" button maps sections to prompt strings, navigates to `/project/:id/edit?queue=encoded`
- EditMode reads queue from URL params on mount

**Visual Select** — additions to `EditMode.tsx` + iframe messaging:
- Inject a script into Sandpack's `index.html` that posts `{ type: 'element-selected', tag, text, classes }` on click when select mode is active
- `EditMode` listens for this message, populates input with contextual prompt
- Toggle button with `MousePointer2` icon in the preview toolbar

