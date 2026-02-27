import type { WizardAnswers, PlanSection } from './types';

export function generatePlan(answers: WizardAnswers): PlanSection[] {
  const { buildType, codeSource, priorities, dayOneFeatures } = answers;

  const needsAuth = dayOneFeatures.includes('Auth');
  const needsPayments = dayOneFeatures.includes('Payments');
  const needsDB = dayOneFeatures.includes('Database');
  const needsAdmin = dayOneFeatures.includes('Admin panel');
  const needsAI = dayOneFeatures.includes('AI features');
  const needsUploads = dayOneFeatures.includes('File uploads');

  const stackItems = ['React', 'TypeScript', 'Tailwind CSS', 'Supabase'];
  if (needsPayments) stackItems.push('Stripe');
  if (needsAI) stackItems.push('OpenAI / Edge Functions');

  const mvpFeatures: string[] = [];
  if (needsAuth) mvpFeatures.push('User authentication (email/password)');
  if (needsDB) mvpFeatures.push('Database with Row Level Security');
  if (needsAdmin) mvpFeatures.push('Admin dashboard with data tables');
  if (needsPayments) mvpFeatures.push('Payment integration with Stripe');
  if (needsUploads) mvpFeatures.push('File upload with Supabase Storage');
  if (needsAI) mvpFeatures.push('AI features via edge functions');
  if (dayOneFeatures.includes('Custom domain')) mvpFeatures.push('Custom domain with SSL');
  if (dayOneFeatures.includes('Team collaboration')) mvpFeatures.push('Team invites and roles');
  if (mvpFeatures.length === 0) mvpFeatures.push('Core application shell', 'Landing page');

  const assumptions: string[] = [
    `Building a ${buildType || 'web application'}`,
    codeSource === 'Starting from scratch' ? 'Greenfield project — no existing code' : `Starting from: ${codeSource}`,
  ];
  if (priorities.includes('Lowest cost')) assumptions.push('Free-tier infrastructure wherever possible');
  if (priorities.includes('Fast launch')) assumptions.push('MVP-first approach, ship in days not weeks');
  if (priorities.includes('Scalability')) assumptions.push('Architecture designed for horizontal scaling');
  if (priorities.includes('Security')) assumptions.push('Security-first with RLS, input validation, and audit logging');

  const dataModel: string[] = [];
  if (needsAuth) dataModel.push('users → profiles');
  if (needsDB) dataModel.push('projects → project_data');
  if (needsPayments) dataModel.push('subscriptions → invoices');
  if (needsAdmin) dataModel.push('audit_logs');
  if (needsUploads) dataModel.push('files → storage_objects');
  if (dataModel.length === 0) dataModel.push('users → app_data');

  const routes: string[] = ['/ → Landing page', '/auth → Sign in / Sign up'];
  routes.push('/dashboard → Main view');
  if (needsAdmin) routes.push('/admin → Admin panel');
  if (needsPayments) routes.push('/billing → Subscription management');
  routes.push('/settings → User settings');

  const costItems: string[] = ['Supabase Free tier: $0/mo'];
  if (needsPayments) costItems.push('Stripe: 2.9% + 30¢ per transaction');
  if (needsAI) costItems.push('OpenAI API: ~$0.01–0.03 per request');
  costItems.push('Hosting (Vercel/Netlify free): $0/mo');
  costItems.push(`Estimated total MVP: ~$0/mo until scale`);

  return [
    { title: 'Summary', content: `A ${buildType || 'web application'} built with ${stackItems.slice(0, 3).join(', ')} and powered by ${stackItems.slice(3).join(', ')}.` },
    { title: 'Assumptions', content: 'Based on your intake answers, we assume:', items: assumptions },
    { title: 'MVP Features', content: 'Core features for launch:', items: mvpFeatures },
    { title: 'Data Model', content: 'Core tables:', items: dataModel },
    { title: 'Routes', content: 'App routing:', items: routes },
    { title: 'Cost Controls', content: 'Estimated monthly costs:', items: costItems },
  ];
}
