import { NavLink } from 'react-router-dom';
import { Pencil, Code2, BarChart3, Rocket, Settings, History, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: 'edit', label: 'Edit', icon: Pencil },
  { to: 'chat', label: 'Chat', icon: MessageCircle },
  { to: 'dev', label: 'Dev', icon: Code2 },
  { to: 'analysis', label: 'Analysis', icon: BarChart3 },
  { to: 'publish', label: 'Publish', icon: Rocket },
  { to: 'settings', label: 'Settings', icon: Settings },
  { to: 'versions', label: 'Versions', icon: History },
];

const WorkspaceTabs = () => (
  <div className="border-b border-border">
    <div className="container flex gap-1 overflow-x-auto py-1">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )
          }
        >
          <tab.icon className="h-3.5 w-3.5" />
          {tab.label}
        </NavLink>
      ))}
    </div>
  </div>
);

export default WorkspaceTabs;
