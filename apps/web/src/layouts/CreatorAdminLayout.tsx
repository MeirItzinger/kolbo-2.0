import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Film,
  FolderOpen,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/Avatar";

export default function CreatorAdminLayout() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const base = `/creator-admin/${creatorId}`;

  const links = [
    { to: base, label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: `${base}/videos`, label: "Videos", icon: Film, end: false },
    { to: `${base}/categories`, label: "Categories", icon: FolderOpen, end: false },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "C";

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-surface-800 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-sm font-bold text-white">K</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Creator
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-600/15 text-primary-400"
                  : "text-surface-400 hover:bg-surface-800 hover:text-surface-100"
              }`
            }
          >
            <link.icon className="h-5 w-5 shrink-0" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {(user as any)?.avatarUrl && <AvatarImage src={(user as any).avatarUrl} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-surface-100">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-surface-500">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-400 transition-colors hover:bg-surface-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-surface-800 bg-surface-900 lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative h-full w-64 bg-surface-900">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-2 top-4 p-2 text-surface-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-surface-800 bg-surface-950/80 px-4 backdrop-blur-lg sm:px-6">
          <button
            type="button"
            className="p-2 text-surface-400 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-surface-400 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to site
          </Link>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
