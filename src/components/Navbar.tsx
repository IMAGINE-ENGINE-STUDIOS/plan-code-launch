import { Link, useLocation } from 'react-router-dom';
import { Layers, Plus, LogOut, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { user, signOut } = useAuth();

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
          {!user ? (
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
              <Button variant="ghost" size="sm" asChild>
                <Link to="/costs"><DollarSign className="mr-1 h-4 w-4" />Costs</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/new-project"><Plus className="mr-1 h-4 w-4" />New Project</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
