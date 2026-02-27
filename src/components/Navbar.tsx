import { Link, useLocation } from 'react-router-dom';
import { Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <nav className="sticky top-0 z-50 glass">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Layers className="h-4 w-4 text-primary-foreground" />
          </div>
          BuildStack
        </Link>
        <div className="flex items-center gap-3">
          {isLanding ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/new-project"><Plus className="mr-1 h-4 w-4" />New Project</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
