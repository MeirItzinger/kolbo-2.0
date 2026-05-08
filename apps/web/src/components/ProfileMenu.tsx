import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  CreditCard,
  History,
  Library,
  LogOut,
  Monitor,
  Shield,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";

function profileInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

interface AccountLink {
  to: string;
  label: string;
  icon: typeof User;
  /** Show even when an admin role is required by the layout. */
  requiresRole?: "SUPER_ADMIN" | "CHANNEL_ADMIN";
}

interface ProfileMenuProps {
  /** Account-level links rendered between the profile switcher and the
   *  logout button. Layouts pass their preferred set (e.g. AppLayout's full
   *  account menu vs PublicLayout's compact one).
   */
  accountLinks?: AccountLink[];
  /** Optional extra row(s) rendered above the account links — used for things
   *  like the admin-panel shortcut on PublicLayout. */
  extraTop?: ReactNode;
}

export function ProfileMenu({ accountLinks, extraTop }: ProfileMenuProps) {
  const { user, logout } = useAuth();
  const { profiles, activeProfile, setActiveProfile } = useActiveProfile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/");
  };

  const userInitials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    "U";

  const buttonAvatarUrl = activeProfile?.avatarUrl ?? user.avatarUrl ?? null;
  const buttonInitials = activeProfile
    ? profileInitials(activeProfile.name)
    : userInitials;
  const buttonLabel = activeProfile?.name ?? user.firstName ?? "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-surface-800"
      >
        <Avatar className="h-8 w-8">
          {buttonAvatarUrl ? <AvatarImage src={buttonAvatarUrl} /> : null}
          <AvatarFallback className="text-xs">{buttonInitials}</AvatarFallback>
        </Avatar>
        <span className="max-w-[140px] truncate text-sm font-medium text-surface-200">
          {buttonLabel}
        </span>
        <ChevronDown className="h-4 w-4 text-surface-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-surface-700 bg-surface-900 py-1 shadow-xl">
          <div className="border-b border-surface-800 px-4 py-3">
            {activeProfile ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">
                  Watching as
                </p>
                <p className="mt-0.5 text-sm font-medium text-white">
                  {activeProfile.name}
                  {activeProfile.isKidsProfile && (
                    <span className="ml-2 rounded bg-primary-600/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-300">
                      Kids
                    </span>
                  )}
                </p>
                <p className="mt-1 truncate text-xs text-surface-400">
                  {user.email}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-surface-400">
                  {user.email}
                </p>
              </>
            )}
          </div>

          {profiles.length > 0 && (
            <div className="border-b border-surface-800 py-1">
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">
                Switch profile
              </p>
              {profiles.map((profile) => {
                const isActive = activeProfile?.id === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setActiveProfile(profile);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-surface-800/60 text-white"
                        : "text-surface-300 hover:bg-surface-800 hover:text-white"
                    }`}
                  >
                    <Avatar className="h-6 w-6">
                      {profile.avatarUrl ? (
                        <AvatarImage src={profile.avatarUrl} />
                      ) : null}
                      <AvatarFallback className="text-[10px]">
                        {profileInitials(profile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-left">
                      {profile.name}
                    </span>
                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-primary-400" />
                    )}
                  </button>
                );
              })}
              <Link
                to="/profiles/select?force=1"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-surface-400 hover:bg-surface-800 hover:text-white"
              >
                <Users className="h-4 w-4" />
                Manage / switch profile…
              </Link>
            </div>
          )}

          {extraTop ? <div className="py-1">{extraTop}</div> : null}

          {(accountLinks ?? DEFAULT_ACCOUNT_LINKS).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
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
  );
}

const DEFAULT_ACCOUNT_LINKS: AccountLink[] = [
  { to: "/account", label: "Account", icon: User },
];

export const FULL_ACCOUNT_LINKS: AccountLink[] = [
  { to: "/account", label: "Account", icon: User },
  { to: "/account/profiles", label: "Manage Profiles", icon: Users },
  { to: "/account/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/account/purchases", label: "Purchases", icon: Library },
  { to: "/account/history", label: "Watch History", icon: History },
  { to: "/account/devices", label: "Devices", icon: Monitor },
];

/** Convenience: an admin-panel link for layouts that want to expose it. */
export function AdminPanelLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      to="/admin"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 text-sm text-surface-300 transition-colors hover:bg-surface-800 hover:text-white"
    >
      <Shield className="h-4 w-4" />
      Admin Panel
    </Link>
  );
}
