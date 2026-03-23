import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdvertiserAuth } from "@/hooks/useAdvertiserAuth";
import { Spinner } from "@/components/ui/Spinner";

export function AdvertiserRoute() {
  const { isAuthenticated, isLoading } = useAdvertiserAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/advertise/login" state={{ from: location }} replace />
    );
  }

  return <Outlet />;
}
