import { Link } from 'react-router-dom';
import { Plus, Upload, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import ProjectCard from '@/components/ProjectCard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status as any,
        stack: p.stack ?? [],
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Your Projects</h1>
            <p className="text-sm text-muted-foreground">{projects.length} projects</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/import"><Upload className="mr-1.5 h-4 w-4" />Import</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/new-project"><Plus className="mr-1.5 h-4 w-4" />New Project</Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-1 font-display text-lg font-semibold">No projects yet</h2>
            <p className="mb-4 text-sm text-muted-foreground">Create your first project or import an existing one.</p>
            <Button asChild><Link to="/new-project">Start Building</Link></Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(p => <ProjectCard key={p.id} project={p} onDeleted={() => refetch()} onRemixed={() => refetch()} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
