import { useState, useRef, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  User,
  CreditCard,
  History,
  Monitor,
  LogOut,
  ChevronDown,
  Library,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/Avatar";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate("/");
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "U";

  const accountLinks = [
    { to: "/account", label: "Account", icon: User },
    { to: "/account/subscriptions", label: "Subscriptions", icon: CreditCard },
    { to: "/account/purchases", label: "Purchases", icon: Library },
    { to: "/account/history", label: "Watch History", icon: History },
    { to: "/account/devices", label: "Devices", icon: Monitor },
  ];

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
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-surface-800"
              >
                <Avatar className="h-8 w-8">
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                  <AvatarFallback className="text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[120px] truncate text-sm font-medium text-surface-200">
                  {user?.firstName}
                </span>
                <ChevronDown className="h-4 w-4 text-surface-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-surface-700 bg-surface-900 py-1 shadow-xl">
                  <div className="border-b border-surface-800 px-4 py-3">
                    <p className="text-sm font-medium text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="truncate text-xs text-surface-400">
                      {user?.email}
                    </p>
                  </div>
                  {accountLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-surface-300 transition-colors hover:bg-surface-800 hover:text-white"
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  ))}
                  <div className="border-t border-surface-800">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-surface-300 transition-colors hover:bg-surface-800 hover:text-white"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
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
              to="/library"
              className="block rounded-md px-3 py-2 text-sm font-medium text-surface-300 hover:bg-surface-800 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              My Library
            </NavLink>
            <div className="border-t border-surface-800 pt-2">
              {accountLinks.map((link) => (
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
