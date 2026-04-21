import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Spinner } from "@/components/ui/Spinner";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { activeProfile, isLoading: isProfileLoading } = useProfile();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enforce profile selection if not on profiles page
  if (!isProfileLoading && !activeProfile && location.pathname !== "/profiles") {
    return <Navigate to="/profiles" replace />;
  }

  return <Outlet />;
}
