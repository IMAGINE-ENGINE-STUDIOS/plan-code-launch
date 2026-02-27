import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Project } from '@/lib/types';
import { ProjectStatusBadge } from './StatusBadge';

const ProjectCard = ({ project }: { project: Project }) => (
  <Link
    to={`/project/${project.id}/plan`}
    className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/40 hover:glow"
  >
    <div className="flex items-start justify-between">
      <h3 className="font-display font-semibold">{project.name}</h3>
      <ProjectStatusBadge status={project.status} />
    </div>
    <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
    <div className="flex items-center gap-2 flex-wrap">
      {project.stack.map(s => (
        <span key={s} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{s}</span>
      ))}
    </div>
    <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
      <span>Updated {project.updatedAt}</span>
      <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  </Link>
);

export default ProjectCard;
