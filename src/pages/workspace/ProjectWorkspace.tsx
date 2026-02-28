import { Outlet, useParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import WorkspaceTabs from '@/components/WorkspaceTabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const ProjectWorkspace = () => {
  const { id } = useParams();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <Navbar />
      <div className="container flex items-center gap-3 py-2 shrink-0">
        <h1 className="font-display text-lg font-bold">{project?.name ?? 'Project'}</h1>
      </div>
      <div className="shrink-0">
        <WorkspaceTabs />
      </div>
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
};

export default ProjectWorkspace;
