import { Outlet, useParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import WorkspaceTabs from '@/components/WorkspaceTabs';
import { mockProjects } from '@/lib/mock-data';

const ProjectWorkspace = () => {
  const { id } = useParams();
  const project = mockProjects.find(p => p.id === id) || { name: 'New Project', description: 'AI-generated project' };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="container flex items-center gap-3 py-4">
        <h1 className="font-display text-lg font-bold">{project.name}</h1>
      </div>
      <WorkspaceTabs />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
};

export default ProjectWorkspace;
