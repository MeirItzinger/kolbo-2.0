import { Navigate, Outlet, useParams, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import type { RoleName } from "@/types";

interface RoleRouteProps {
  role: RoleName | RoleName[];
  channelParam?: string;
  creatorParam?: string;
}

export function RoleRoute({
  role,
  channelParam,
  creatorParam,
}: RoleRouteProps) {
  const { isLoading, isAuthenticated, hasRole } = useAuth();
  const params = useParams();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const channelId = channelParam ? params[channelParam] : undefined;
  const creatorId = creatorParam ? params[creatorParam] : undefined;

  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const roles = Array.isArray(role) ? role : [role];
  const hasRequiredRole = roles.some((r) => hasRole(r, channelId, creatorId));

  if (!isSuperAdmin && !hasRequiredRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
