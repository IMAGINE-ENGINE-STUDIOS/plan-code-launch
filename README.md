# BuildStack — AI App Builder Platform

An AI-powered platform for building, editing, analyzing, and deploying production-ready web applications.

## What This Platform Does

BuildStack lets you go from idea to deployed app through AI-assisted modes:
- **Plan Mode** — AI generates structured app plans from a 4-question intake
- **Edit Mode** — AI applies scoped diffs/patches to your codebase
- **Dev Mode** — Manual coding with file tree, editor, logs, and preview
- **Analysis Mode** — Architecture, cost, performance, and security analysis
- **Import** — Bring existing GitHub repos or codebases with compatibility reports
- **Publish** — Deploy to platform subdomain or connect custom domains

## Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- TanStack Query + Framer Motion
- Supabase (Auth, Postgres, Storage) — to be connected

## Setup

```bash
npm install
npm run dev
```

## Supabase Schema (Future)

Tables: `users`, `organizations`, `projects`, `project_versions`, `plans`, `conversations`, `messages`, `import_reports`, `deployments`, `domains`, `settings`, `audit_logs`

All tables will have RLS policies for project ownership/member access.

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `STRIPE_SECRET_KEY` | Stripe API key (optional) |

## 4-Question Intake

1. **What are you building?** — App type
2. **Do you have code?** — Starting point
3. **What matters most?** — Top 2 priorities
4. **Day one features?** — Multi-select

After Q4, AI generates a full plan with assumptions.

## Import Compatibility Levels

| Level | Meaning |
|---|---|
| **A** | Fully supported — no changes needed |
| **B** | Partial support — migration needed |
| **C** | Manual review required |

## Implemented vs Placeholder

### ✅ Implemented
- All core screens and navigation
- 4-question wizard, workspace tabs, version history
- Dark theme design system, responsive layout

### 🔲 Future
- Supabase backend, real AI, deployments, team collaboration
