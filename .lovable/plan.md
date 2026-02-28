

## Plan: Expand Library Catalog + Improve Route Navigator in Preview

### Part 1: Expand Sandpack Default Dependencies

**File: `src/components/SandpackPreview.tsx`** (lines 341-354)

Add all libraries from the host project that the AI should be able to use freely. Replace the current dependency list with:

```
react, react-dom, react-router-dom, lucide-react, framer-motion,
class-variance-authority, clsx, tailwind-merge, date-fns, recharts,
sonner, cmdk, @tanstack/react-query, react-hook-form, @hookform/resolvers,
zod, @supabase/supabase-js, react-markdown, @radix-ui/react-dialog,
@radix-ui/react-popover, @radix-ui/react-tabs, @radix-ui/react-tooltip,
@radix-ui/react-select, @radix-ui/react-checkbox, @radix-ui/react-switch,
@radix-ui/react-accordion, @radix-ui/react-avatar, @radix-ui/react-progress,
@radix-ui/react-slider, @radix-ui/react-label, @radix-ui/react-slot,
@radix-ui/react-separator, @radix-ui/react-toggle, @radix-ui/react-toggle-group,
@radix-ui/react-dropdown-menu, @radix-ui/react-context-menu,
@radix-ui/react-alert-dialog, @radix-ui/react-hover-card,
@radix-ui/react-navigation-menu, @radix-ui/react-radio-group,
@radix-ui/react-scroll-area, @radix-ui/react-aspect-ratio,
@radix-ui/react-collapsible, @radix-ui/react-menubar,
embla-carousel-react, vaul, input-otp, react-day-picker,
next-themes, react-resizable-panels, html2canvas
```

### Part 2: Update System Prompt with Library Catalog

**File: `supabase/functions/chat/index.ts`** (lines 98-106)

Expand the ENVIRONMENT section to list all available libraries grouped by category, with explicit instruction: "These are PRE-INSTALLED. Use them freely without [NEEDS_DEPENDENCY] markers."

Categories:
- **UI Primitives**: All @radix-ui/* components
- **Forms**: react-hook-form + zod + @hookform/resolvers
- **Data**: @tanstack/react-query, @supabase/supabase-js
- **Layout**: react-resizable-panels, embla-carousel-react, vaul
- **Utilities**: date-fns, clsx, tailwind-merge, class-variance-authority, next-themes, react-markdown
- **Charts**: recharts
- **Notifications**: sonner

### Part 3: Improve RouteNavigator in Preview

**File: `src/components/SandpackPreview.tsx`**

The existing RouteNavigator injection (lines 163-330) already works but has fragile regex-based App.tsx patching. Improvements:
- Make the navigator more visually polished (match the host app's PageNavigator style)
- Add current path display in the button tooltip
- Handle edge cases where Router is wrapped in providers
- Add collapse animation

### Files Changed
- `src/components/SandpackPreview.tsx` — expanded dependencies + improved navigator
- `supabase/functions/chat/index.ts` — full library catalog in system prompt

