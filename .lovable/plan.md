

## Problem

The wizard flow ends at step 4 with "Generate Plan" but navigates to `/project/new/plan` — a route that doesn't exist. There's no intermediate "plan review" screen with a **"Build Project"** button, and no Supabase connection to persist projects.

## Plan

### 1. Connect Supabase to the project
- Use the Supabase connector to link an external Supabase project for Auth, Database, and Storage
- This gives us a typed Supabase client and edge functions support

### 2. Create a Plan Review page (`/project/new/plan`)
- New page at `src/pages/PlanReview.tsx`
- Receives wizard answers (via URL state or a simple context/store)
- Generates a mock plan from the answers (using the existing `mockPlan` logic, tailored to the selected `buildType`, `priorities`, and `dayOneFeatures`)
- Displays the plan sections (Summary, Assumptions, MVP Features, Data Model, Routes, Cost Controls)
- Has a prominent **"Build Project"** button at the bottom
- Has a "Back to Questions" link to go back and edit answers

### 3. Add a wizard answers context
- Create `src/contexts/WizardContext.tsx` — a simple React context to pass `WizardAnswers` from the wizard to the plan review page without URL params
- Wrap the relevant routes with this provider

### 4. Wire up the "Build Project" button
- On click: create a new project record in Supabase (`projects` table) with the wizard answers and generated plan
- Save the plan sections to a `plans` table
- Navigate to `/project/{new-id}/plan` (the workspace)
- Show a loading/building animation during creation

### 5. Add the route in App.tsx
- Add `<Route path="/project/new/plan" element={<PlanReview />} />` **before** the `/project/:id` route so it doesn't get caught by the param route

### 6. Create Supabase tables (migrations)
- `projects` table: id, user_id, name, description, status, build_type, code_source, priorities, day_one_features, stack, created_at, updated_at
- `plans` table: id, project_id, sections (jsonb), created_at
- RLS policies: users can only read/write their own projects

### 7. Update PlanMode in workspace
- Load the real plan from Supabase instead of `mockPlan`
- Show the plan that was generated during project creation

This gives you a complete flow: **Wizard → Plan Review → "Build Project" button → Project saved to Supabase → Workspace opens**.

