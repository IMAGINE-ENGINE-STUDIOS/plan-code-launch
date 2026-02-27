import { cn } from '@/lib/utils';
import type { ProjectStatus, SupportLevel } from '@/lib/types';

const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  imported: { label: 'Imported', className: 'bg-info/15 text-info' },
  compatible: { label: 'Compatible', className: 'bg-success/15 text-success' },
  needs_attention: { label: 'Needs Attention', className: 'bg-warning/15 text-warning' },
  published: { label: 'Published', className: 'bg-primary/15 text-primary' },
};

const levelConfig: Record<SupportLevel, { label: string; className: string }> = {
  A: { label: 'A — Fully Supported', className: 'bg-success/15 text-success' },
  B: { label: 'B — Partial Support', className: 'bg-warning/15 text-warning' },
  C: { label: 'C — Manual Review', className: 'bg-destructive/15 text-destructive' },
};

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => {
  const config = statusConfig[status];
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>{config.label}</span>;
};

export const SupportLevelBadge = ({ level }: { level: SupportLevel }) => {
  const config = levelConfig[level];
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-mono', config.className)}>{config.label}</span>;
};
