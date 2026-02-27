import { Link } from 'react-router-dom';
import { Plus, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import ProjectCard from '@/components/ProjectCard';
import { mockProjects } from '@/lib/mock-data';

const Dashboard = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Your Projects</h1>
          <p className="text-sm text-muted-foreground">{mockProjects.length} projects</p>
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

      {mockProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20">
          <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-1 font-display text-lg font-semibold">No projects yet</h2>
          <p className="mb-4 text-sm text-muted-foreground">Create your first project or import an existing one.</p>
          <Button asChild><Link to="/new-project">Start Building</Link></Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  </div>
);

export default Dashboard;
