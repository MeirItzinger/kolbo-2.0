import { Link } from "react-router-dom";
import {
  User,
  Users,
  CreditCard,
  Tv,
  History,
  Monitor,
  ShoppingBag,
  Shield,
  ShieldCheck,
  Settings,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

const cards = [
  {
    to: "/account/profiles",
    icon: Users,
    label: "Profiles",
    description: "Add, rename, or remove profiles",
  },
  {
    to: "/account/parental-controls",
    icon: ShieldCheck,
    label: "Parental controls",
    description: "Set maturity caps and time limits",
  },
  {
    to: "/account/subscriptions",
    icon: Tv,
    label: "Subscriptions",
    description: "Manage your channel subscriptions",
  },
  {
    to: "/account/purchases",
    icon: ShoppingBag,
    label: "Purchases & rentals",
    description: "View purchases and active rentals",
  },
  {
    to: "/account/history",
    icon: History,
    label: "Watch history",
    description: "See what you've been watching",
  },
  {
    to: "/account/devices",
    icon: Monitor,
    label: "Devices",
    description: "Manage your registered devices",
  },
  {
    to: "/account/security",
    icon: Shield,
    label: "Security",
    description: "Password and account safety",
  },
  {
    to: "/account/settings",
    icon: Settings,
    label: "Settings",
    description: "Household preferences and purchase protection",
  },
  {
    to: "/account",
    icon: CreditCard,
    label: "Billing",
    description: "Payment method and invoices",
    disabled: true,
  },
] as const;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function AccountPage() {
  const { user } = useAuth();
  const { activeProfile } = useActiveProfile();

  const fullName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-white">Account</h1>
      <p className="mb-8 text-sm text-surface-400">
        Manage profiles, parental controls, and how your household uses Kolbo.
      </p>

      <section className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-surface-800 bg-surface-900 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">
              {initials(fullName || user?.email || "?")}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-base font-semibold text-white">{fullName}</p>
            <p className="text-sm text-surface-400">{user?.email}</p>
            {activeProfile && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-surface-500">
                Watching as{" "}
                <span className="font-medium text-surface-200">
                  {activeProfile.name}
                </span>
                {activeProfile.isKidsProfile && (
                  <Badge className="ml-1">Kids</Badge>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/profiles/select?force=1"
            className="rounded-md border border-surface-700 px-3 py-1.5 text-xs font-medium text-surface-200 transition-colors hover:border-surface-500 hover:text-white"
          >
            Switch profile
          </Link>
          <Link
            to="/account/profiles"
            className="rounded-md border border-surface-700 px-3 py-1.5 text-xs font-medium text-surface-200 transition-colors hover:border-surface-500 hover:text-white"
          >
            Manage profiles
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ to, icon: Icon, label, description, ...rest }) => {
          const disabled = "disabled" in rest && rest.disabled;
          const Cmp: any = disabled ? "div" : Link;
          return (
            <Cmp
              key={label}
              {...(disabled ? {} : { to })}
              className={`group flex items-start gap-4 rounded-xl border border-surface-800 bg-surface-900 p-4 transition-all ${
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "hover:border-primary-500/40 hover:bg-surface-850"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-800 transition-colors group-hover:bg-primary-600/20">
                <Icon className="h-5 w-5 text-surface-400 group-hover:text-primary-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{label}</p>
                  {disabled && (
                    <Badge variant="secondary" className="text-[10px]">
                      Soon
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-surface-500">{description}</p>
              </div>
              {!disabled && (
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-surface-600 group-hover:text-surface-400" />
              )}
            </Cmp>
          );
        })}
      </div>
    </div>
  );
}

void User;
