import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MoreVertical, Trash2, Copy, Loader2 } from 'lucide-react';
import type { Project } from '@/lib/types';
import { ProjectStatusBadge } from './StatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectCardProps {
  project: Project;
  onDeleted?: () => void;
  onRemixed?: (newId: string) => void;
}

const ProjectCard = ({ project, onDeleted, onRemixed }: ProjectCardProps) => {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete related data first (cascade should handle project_files via FK)
      await supabase.from('chat_messages').delete().eq('project_id', project.id);
      await supabase.from('plans').delete().eq('project_id', project.id);
      await supabase.from('project_files').delete().eq('project_id', project.id);
      const { error } = await supabase.from('projects').delete().eq('id', project.id);
      if (error) throw error;
      toast({ title: 'Project deleted', description: `"${project.name}" has been removed.` });
      onDeleted?.();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const handleRemix = async () => {
    if (!user) return;
    setRemixing(true);
    try {
      // Get full project data
      const { data: orig, error: origErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project.id)
        .single();
      if (origErr || !orig) throw new Error('Could not load project');

      // Create new project
      const { data: newProj, error: createErr } = await supabase
        .from('projects')
        .insert({
          name: `${orig.name} (remix)`,
          description: orig.description,
          user_id: user.id,
          status: orig.status,
          build_type: orig.build_type,
          code_source: orig.code_source,
          stack: orig.stack,
          priorities: orig.priorities,
          day_one_features: orig.day_one_features,
          source_repo: orig.source_repo,
        })
        .select('id')
        .single();
      if (createErr || !newProj) throw new Error(createErr?.message || 'Failed to create remix');

      // Copy project files
      const { data: files } = await supabase
        .from('project_files')
        .select('file_path, content')
        .eq('project_id', project.id);

      if (files && files.length > 0) {
        const rows = files.map(f => ({
          project_id: newProj.id,
          file_path: f.file_path,
          content: f.content,
        }));
        for (let i = 0; i < rows.length; i += 20) {
          await supabase.from('project_files').insert(rows.slice(i, i + 20));
        }
      }

      toast({ title: 'Remixed!', description: `Created "${orig.name} (remix)"` });
      onRemixed?.(newProj.id);
      navigate(`/project/${newProj.id}/edit`);
    } catch (e: any) {
      toast({ title: 'Remix failed', description: e.message, variant: 'destructive' });
    } finally {
      setRemixing(false);
    }
  };

  return (
    <>
      <div className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/40 hover:glow">
        {/* Menu */}
        <div className="absolute right-3 top-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={e => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRemix} disabled={remixing}>
                {remixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                Remix (duplicate)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link to={`/project/${project.id}/plan`} className="flex flex-col gap-3">
          <div className="flex items-start justify-between pr-8">
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
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project, all its files, chat history, and plans. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectCard;
