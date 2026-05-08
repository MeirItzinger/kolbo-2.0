import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, Megaphone, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/Button";
import {
  ProfileMenu,
  FULL_ACCOUNT_LINKS,
  AdminPanelLink,
} from "@/components/ProfileMenu";

export default function PublicLayout() {
  const { isAuthenticated, logout, hasRole } = useAuth();
  const { activeProfile } = useActiveProfile();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isAdmin = hasRole("SUPER_ADMIN") || hasRole("CHANNEL_ADMIN");

  return (
    <div className="flex min-h-screen flex-col bg-surface-950">
      <header className="sticky top-0 z-50 border-b border-surface-800 bg-surface-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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
            {isAuthenticated && (
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
                My Stuff
              </NavLink>
            )}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/advertise"
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-600/10 hover:text-amber-300"
            >
              <Megaphone className="h-3.5 w-3.5" />
              Advertise with Kolbo
            </Link>
            {isAuthenticated ? (
              <ProfileMenu
                accountLinks={FULL_ACCOUNT_LINKS}
                extraTop={isAdmin ? <AdminPanelLink /> : null}
              />
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Log In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </>
            )}
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
          <div className="space-y-2 border-t border-surface-800 bg-surface-950 px-4 py-4 md:hidden">
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
            {isAuthenticated && (
              <NavLink
                to="/library"
                className="block rounded-md px-3 py-2 text-sm font-medium text-surface-300 hover:bg-surface-800 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                My Stuff
              </NavLink>
            )}
            <Link
              to="/advertise"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-600/10"
              onClick={() => setMobileOpen(false)}
            >
              <Megaphone className="h-4 w-4" />
              Advertise with Kolbo
            </Link>
            <div className="flex flex-col gap-2 border-t border-surface-800 pt-2">
              {isAuthenticated ? (
                <>
                  {activeProfile && (
                    <div className="rounded-md bg-surface-900 px-3 py-2 text-xs text-surface-400">
                      Watching as{" "}
                      <span className="font-semibold text-white">
                        {activeProfile.name}
                      </span>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                    <Link
                      to="/profiles/select?force=1"
                      onClick={() => setMobileOpen(false)}
                    >
                      Switch profile…
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                    <Link to="/account" onClick={() => setMobileOpen(false)}>Account</Link>
                  </Button>
                  {hasRole("SUPER_ADMIN") && (
                    <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                      <Link to="/admin" onClick={() => setMobileOpen(false)}>Admin Panel</Link>
                    </Button>
                  )}
                  {hasRole("CHANNEL_ADMIN") && !hasRole("SUPER_ADMIN") && (
                    <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                      <Link to="/admin" onClick={() => setMobileOpen(false)}>Admin Panel</Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setMobileOpen(false); handleLogout(); }}>
                    Log Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="flex-1" asChild>
                    <Link to="/login" onClick={() => setMobileOpen(false)}>Log In</Link>
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link to="/signup" onClick={() => setMobileOpen(false)}>Sign Up</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-surface-800 bg-surface-950">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600">
                  <span className="text-xs font-bold text-white">K</span>
                </div>
                <span className="text-lg font-bold text-white">Kolbo</span>
              </div>
              <p className="text-sm text-surface-400">
                Stream everything you love, all in one place.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-surface-200">
                Browse
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/explore"
                    className="text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    All Channels
                  </Link>
                </li>
                <li>
                  <Link
                    to="/explore"
                    className="text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    New Releases
                  </Link>
                </li>
                <li>
                  <Link
                    to="/explore"
                    className="text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    Popular
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-surface-200">
                Support
              </h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-surface-200">
                Legal
              </h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-surface-800 pt-8">
            <p className="text-center text-sm text-surface-500">
              &copy; {new Date().getFullYear()} Kolbo — deployed via auto-push.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
