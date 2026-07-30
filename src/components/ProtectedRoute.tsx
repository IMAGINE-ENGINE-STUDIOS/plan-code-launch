import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// TEMP: auth bypass — set to false to re-enable login protection
const BYPASS_AUTH = true;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (BYPASS_AUTH) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
