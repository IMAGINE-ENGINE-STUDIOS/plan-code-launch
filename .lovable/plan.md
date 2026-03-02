

## Fix: Dashboard Black Screen

**Root cause:** The GOGO project has `status: 'active'` in the database, but `ProjectStatusBadge` only handles 5 specific statuses (`draft`, `imported`, `compatible`, `needs_attention`, `published`). When it tries to access `statusConfig['active']`, the result is `undefined`, and accessing `.className` on `undefined` crashes React — causing the black screen.

**Fix (2 changes):**

1. **`src/components/StatusBadge.tsx`** — Add a fallback so unknown statuses don't crash:
   - If `statusConfig[status]` is undefined, fall back to a generic grey badge displaying the raw status text

2. **Database** — Update the GOGO project's status from `'active'` to `'draft'` (or another valid status) so it renders correctly going forward

This is a one-line defensive fix plus a data correction. No UI changes, no new files.

