

## Problem

After clicking **Build Project**, `PlanReview.tsx` line 59 navigates to `/project/${project.id}/plan` — which renders `PlanMode`, a read-only view of the same plan. So it looks like it just "reloads" the plan.

Additionally, line 20-22 calls `navigate()` during render (a React anti-pattern that can cause loop issues).

## Fix

1. **Change post-build navigation** in `PlanReview.tsx` line 59: navigate to `/project/${project.id}/dev` instead of `/plan` so the user lands in the Dev workspace after building.

2. **Fix the render-time navigate call** on lines 20-23: wrap it in a `useEffect` so it doesn't fire during render and cause potential loops.

Two lines changed, one `useEffect` added. No new files needed.

