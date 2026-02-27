import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map, X, Home, LogIn, LayoutDashboard, PlusCircle, FileText,
  FileSearch, Sparkles, Pencil, Code2, BarChart3, Rocket,
  Settings, History, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const pages = [
  { label: 'Landing', path: '/', icon: Home, group: 'Public' },
  { label: 'Auth', path: '/auth', icon: LogIn, group: 'Public' },
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, group: 'App' },
  { label: 'New Project', path: '/new-project', icon: PlusCircle, group: 'App' },
  { label: 'Plan Review', path: '/project/new/plan', icon: FileText, group: 'App' },
  { label: 'Import Report', path: '/import', icon: FileSearch, group: 'App' },
];

const workspacePages = [
  { label: 'Plan', path: 'plan', icon: Sparkles },
  { label: 'Edit', path: 'edit', icon: Pencil },
  { label: 'Dev', path: 'dev', icon: Code2 },
  { label: 'Analysis', path: 'analysis', icon: BarChart3 },
  { label: 'Publish', path: 'publish', icon: Rocket },
  { label: 'Settings', path: 'settings', icon: Settings },
  { label: 'Versions', path: 'versions', icon: History },
];

const PageNavigator = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Detect if we're inside a project workspace
  const projectMatch = location.pathname.match(/^\/project\/([^/]+)/);
  const projectId = projectMatch?.[1];
  const isNewPlan = projectId === 'new';

  const groups: Record<string, typeof pages> = {};
  pages.forEach(p => {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  });

  return (
    <>
      {/* Floating trigger */}
      <Button
        onClick={() => setOpen(!open)}
        size="icon"
        className="fixed bottom-6 right-6 z-[60] h-12 w-12 rounded-full shadow-lg"
        title="Page Navigator"
      >
        {open ? <X className="h-5 w-5" /> : <Map className="h-5 w-5" />}
      </Button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-background/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Navigator panel */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 right-6 z-[60] w-72 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Map className="h-4 w-4 text-primary" />
                  All Pages
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Navigate to any page in the app
                </p>
              </div>

              <div className="max-h-[400px] overflow-y-auto p-2">
                {Object.entries(groups).map(([group, items]) => (
                  <div key={group} className="mb-2">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </p>
                    {items.map(page => {
                      const isActive = location.pathname === page.path;
                      return (
                        <Link
                          key={page.path}
                          to={page.path}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          <page.icon className="h-4 w-4 shrink-0" />
                          {page.label}
                          {isActive && <ChevronRight className="ml-auto h-3 w-3" />}
                        </Link>
                      );
                    })}
                  </div>
                ))}

                {/* Workspace pages — show if we're in a project */}
                {projectId && !isNewPlan && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Workspace
                    </p>
                    {workspacePages.map(page => {
                      const fullPath = `/project/${projectId}/${page.path}`;
                      const isActive = location.pathname === fullPath;
                      return (
                        <Link
                          key={page.path}
                          to={fullPath}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          <page.icon className="h-4 w-4 shrink-0" />
                          {page.label}
                          {isActive && <ChevronRight className="ml-auto h-3 w-3" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default PageNavigator;
