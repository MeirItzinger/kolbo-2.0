import { useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Menu, X, LogOut, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Spinner } from "@/components/ui/Spinner";
import { ProfileMenu, FULL_ACCOUNT_LINKS } from "@/components/ProfileMenu";

export default function AppLayout() {
  const { logout } = useAuth();
  const { activeProfile, isLoading: profilesLoading } = useActiveProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (profilesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!activeProfile) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/profiles/select?next=${next}`} replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-950">
      <header className="sticky top-0 z-50 border-b border-surface-800 bg-surface-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <span className="text-sm font-bold text-white">K</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Kolbo
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <NavLink
                to="/explore"
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-surface-800 text-white"
                      : "text-surface-300 hover:bg-surface-800/50 hover:text-white"
                  }`
                }
              >
                Browse
              </NavLink>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-surface-800 text-white"
                      : "text-surface-300 hover:bg-surface-800/50 hover:text-white"
                  }`
                }
              >
                <Search className="h-3.5 w-3.5 opacity-80" />
                Search
              </NavLink>
              <NavLink
                to="/library"
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-surface-800 text-white"
                      : "text-surface-300 hover:bg-surface-800/50 hover:text-white"
                  }`
                }
              >
                My Library
              </NavLink>
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <ProfileMenu accountLinks={FULL_ACCOUNT_LINKS} />
          </div>

          <button
            type="button"
            className="p-2 text-surface-300 hover:text-white md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {mobileOpen && (
          <div className="space-y-1 border-t border-surface-800 bg-surface-950 px-4 py-4 md:hidden">
            <NavLink
              to="/explore"
              className="block rounded-md px-3 py-2 text-sm font-medium text-surface-300 hover:bg-surface-800 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              Browse
            </NavLink>
            <NavLink
              to="/search"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-surface-300 hover:bg-surface-800 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <Search className="h-4 w-4 opacity-80" />
              Search
            </NavLink>
            <NavLink
              to="/library"
              className="block rounded-md px-3 py-2 text-sm font-medium text-surface-300 hover:bg-surface-800 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              My Library
            </NavLink>
            <div className="border-t border-surface-800 pt-2">
              {activeProfile && (
                <div className="mx-1 mb-2 rounded-md bg-surface-900 px-3 py-2 text-xs text-surface-400">
                  Watching as{" "}
                  <span className="font-semibold text-white">
                    {activeProfile.name}
                  </span>
                </div>
              )}
              <Link
                to="/profiles/select?force=1"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white"
              >
                Switch profile…
              </Link>
              {FULL_ACCOUNT_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
