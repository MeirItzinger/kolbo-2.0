import { useState, useRef, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, Megaphone, LogOut } from "lucide-react";
import { useAdvertiserAuth } from "@/hooks/useAdvertiserAuth";
import { Button } from "@/components/ui/Button";

export default function AdvertiserLayout() {
  const { advertiser, logout } = useAdvertiserAuth();
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
    navigate("/advertise");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary-600/10 text-primary-400"
        : "text-surface-300 hover:bg-surface-800 hover:text-white"
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-surface-950">
      <header className="sticky top-0 z-50 border-b border-surface-800 bg-surface-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/advertise/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Kolbo{" "}
              <span className="text-amber-400">Advertisers</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/advertise/dashboard" end className={navLinkClass}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink
              to="/advertise/campaigns/new"
              className={navLinkClass}
            >
              <Megaphone className="h-4 w-4" />
              New Campaign
            </NavLink>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-300 hover:text-white"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600/20 text-amber-400 text-xs font-bold">
                  {advertiser?.companyName?.[0]?.toUpperCase() ?? "A"}
                </div>
                <span className="max-w-[120px] truncate">
                  {advertiser?.companyName}
                </span>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-surface-700 bg-surface-900 py-1 shadow-xl">
                  <div className="border-b border-surface-800 px-4 py-3">
                    <p className="text-sm font-medium text-white">
                      {advertiser?.companyName}
                    </p>
                    <p className="text-xs text-surface-400">
                      {advertiser?.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
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
          <div className="space-y-2 border-t border-surface-800 px-4 pb-4 pt-3 md:hidden">
            <NavLink
              to="/advertise/dashboard"
              end
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink
              to="/advertise/campaigns/new"
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              <Megaphone className="h-4 w-4" />
              New Campaign
            </NavLink>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-surface-800 bg-surface-950 py-6 text-center text-xs text-surface-500">
        Kolbo Advertisers &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
