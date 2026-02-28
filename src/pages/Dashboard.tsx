import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, FolderOpen, Loader2, Search, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/Navbar';
import ProjectCard from '@/components/ProjectCard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'alpha'>('newest');

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

  const filtered = useMemo(() => {
    let result = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }
    if (sortBy === 'alpha') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [projects, search, statusFilter, sortBy]);

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

        {/* Search & Filter */}
        {projects.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="imported">Imported</SelectItem>
                <SelectItem value="needs_attention">Needs Attention</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(s => s === 'newest' ? 'alpha' : 'newest')}
              className="gap-1.5"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortBy === 'newest' ? 'Newest' : 'A–Z'}
            </Button>
          </div>
        )}

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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20">
            <Search className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No projects match your search.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => <ProjectCard key={p.id} project={p} onDeleted={() => refetch()} onRemixed={() => refetch()} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
