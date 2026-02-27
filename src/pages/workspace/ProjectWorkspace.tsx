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
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="container flex items-center gap-3 py-4">
        <h1 className="font-display text-lg font-bold">{project?.name ?? 'Project'}</h1>
      </div>
      <WorkspaceTabs />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
};

export default ProjectWorkspace;
