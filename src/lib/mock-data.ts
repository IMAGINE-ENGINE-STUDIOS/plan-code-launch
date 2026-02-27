import type { Project, ProjectVersion, PlanSection, ImportFinding, AnalysisFinding } from './types';

export const mockProjects: Project[] = [
  { id: '1', name: 'SaaS Dashboard', description: 'Analytics dashboard with real-time metrics', status: 'published', stack: ['Next.js', 'TypeScript', 'Tailwind'], createdAt: '2026-02-20', updatedAt: '2026-02-26' },
  { id: '2', name: 'E-Commerce Store', description: 'Online store with Stripe payments', status: 'draft', stack: ['React', 'Supabase', 'Stripe'], createdAt: '2026-02-24', updatedAt: '2026-02-25' },
  { id: '3', name: 'CRM Internal Tool', description: 'Customer management for sales team', status: 'needs_attention', stack: ['Next.js', 'Prisma', 'PostgreSQL'], createdAt: '2026-02-15', updatedAt: '2026-02-22' },
];

export const mockVersions: ProjectVersion[] = [
  { id: 'v1', version: 'v0.3.0', note: 'Added payment integration', createdAt: '2026-02-26T14:30:00Z', author: 'You' },
  { id: 'v2', version: 'v0.2.1', note: 'Fixed auth redirect bug', createdAt: '2026-02-24T10:15:00Z', author: 'You' },
  { id: 'v3', version: 'v0.2.0', note: 'Implemented dashboard charts', createdAt: '2026-02-22T16:00:00Z', author: 'You' },
  { id: 'v4', version: 'v0.1.0', note: 'Initial scaffold with auth', createdAt: '2026-02-20T09:00:00Z', author: 'You' },
];

export const mockPlan: PlanSection[] = [
  { title: 'Summary', content: 'A SaaS analytics dashboard with real-time metrics, user management, and billing integration.' },
  { title: 'Assumptions', content: 'Based on your intake answers, we assume:', items: ['Single-tenant architecture for MVP', 'Supabase for auth and database', 'Stripe for payments', 'Email-based auth (no SSO in v1)'] },
  { title: 'MVP Features', content: 'Core features for launch:', items: ['User authentication (email/password)', 'Dashboard with key metrics', 'Settings page', 'Billing integration with Stripe'] },
  { title: 'Data Model', content: 'Core tables:', items: ['users → profiles', 'organizations', 'projects → metrics', 'subscriptions → invoices'] },
  { title: 'Routes', content: 'App routing:', items: ['/ → Landing', '/auth → Sign in/up', '/dashboard → Main view', '/settings → User settings', '/billing → Subscription management'] },
  { title: 'Cost Controls', content: 'Estimated monthly costs:', items: ['Supabase Free tier: $0', 'Vercel Hobby: $0', 'Stripe: 2.9% + 30¢ per transaction', 'Total MVP: ~$0/mo until scale'] },
];

export const mockImportFindings: ImportFinding[] = [
  { category: 'Framework', item: 'Next.js 14 (App Router)', level: 'A', note: 'Fully supported' },
  { category: 'Language', item: 'TypeScript 5.x', level: 'A', note: 'Fully supported' },
  { category: 'Styling', item: 'Tailwind CSS', level: 'A', note: 'Fully supported' },
  { category: 'Database', item: 'Prisma ORM', level: 'B', note: 'Supported with migration needed' },
  { category: 'Auth', item: 'NextAuth.js', level: 'B', note: 'Will migrate to Supabase Auth' },
  { category: 'Scripts', item: 'Custom build scripts', level: 'C', note: 'Manual review required' },
  { category: 'Env', item: '.env.local (12 vars)', level: 'A', note: 'Auto-mapped to secrets' },
  { category: 'Dependencies', item: '47 packages', level: 'B', note: '3 packages need alternatives' },
];

export const mockAnalysis: AnalysisFinding[] = [
  { category: 'cost', severity: 'info', title: 'Low-cost architecture', description: 'Current setup uses free tiers effectively.', recommendation: 'Monitor usage as you scale past 50K MAU.' },
  { category: 'performance', severity: 'warning', title: 'No CDN configured', description: 'Static assets are served without CDN caching.', recommendation: 'Enable Vercel Edge or Cloudflare for static assets.' },
  { category: 'security', severity: 'error', title: 'Missing RLS policies', description: '2 tables lack Row Level Security policies.', recommendation: 'Add RLS policies to projects and metrics tables.' },
  { category: 'quality', severity: 'info', title: 'Good TypeScript coverage', description: '94% of files use strict TypeScript.', recommendation: 'Enable strictNullChecks for remaining files.' },
  { category: 'architecture', severity: 'warning', title: 'Large component files', description: '3 components exceed 300 lines.', recommendation: 'Extract sub-components for maintainability.' },
];

export const mockFileTree = [
  { name: 'src', type: 'dir' as const, children: [
    { name: 'app', type: 'dir' as const, children: [
      { name: 'layout.tsx', type: 'file' as const },
      { name: 'page.tsx', type: 'file' as const },
      { name: 'dashboard', type: 'dir' as const, children: [
        { name: 'page.tsx', type: 'file' as const },
      ]},
    ]},
    { name: 'components', type: 'dir' as const, children: [
      { name: 'Navbar.tsx', type: 'file' as const },
      { name: 'Chart.tsx', type: 'file' as const },
    ]},
    { name: 'lib', type: 'dir' as const, children: [
      { name: 'utils.ts', type: 'file' as const },
      { name: 'supabase.ts', type: 'file' as const },
    ]},
  ]},
  { name: 'package.json', type: 'file' as const },
  { name: 'tailwind.config.ts', type: 'file' as const },
];
